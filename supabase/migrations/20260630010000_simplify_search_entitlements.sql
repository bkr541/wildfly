-- ============================================================
-- Simplified Free / Paid search entitlement model
--
-- Free: 5 user-initiated searches per UTC calendar month.
-- Paid: unlimited user-initiated searches.
-- Every deliberate search costs exactly one search, regardless of route type.
-- Legacy wallet and transaction tables are retained for historical reporting,
-- but no longer drive new search authorization.
-- ============================================================

-- ── 1. Explicit plan entitlements ───────────────────────────────────────────

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS entitlement_tier text;

UPDATE public.plans
SET
  entitlement_tier = CASE WHEN id = 'free' THEN 'free' ELSE 'paid' END,
  monthly_allowance_credits = CASE WHEN id = 'free' THEN 5 ELSE NULL END,
  name = CASE
    WHEN id = 'free' THEN 'Free'
    WHEN id = 'gold_monthly' THEN 'Paid Monthly'
    WHEN id = 'gold_yearly' THEN 'Paid Yearly'
    ELSE name
  END,
  features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
    'search_entitlement', CASE WHEN id = 'free' THEN 'free' ELSE 'paid' END,
    'monthly_search_limit', CASE WHEN id = 'free' THEN 5 ELSE NULL END
  );

ALTER TABLE public.plans
  ALTER COLUMN entitlement_tier SET DEFAULT 'free';

UPDATE public.plans
SET entitlement_tier = 'free'
WHERE entitlement_tier IS NULL;

ALTER TABLE public.plans
  ALTER COLUMN entitlement_tier SET NOT NULL;

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_entitlement_tier_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_entitlement_tier_check
  CHECK (entitlement_tier IN ('free', 'paid'));

-- Credit packs are retired from the active catalog. Historical purchases and
-- ledger rows remain untouched for support, reconciliation, and audit needs.
UPDATE public.credit_packs SET is_active = false WHERE is_active = true;

-- ── 2. Monthly usage and idempotency ledger ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_search_usage_monthly (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  used_count   integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_start)
);

CREATE TABLE IF NOT EXISTS public.search_usage_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id             uuid NOT NULL,
  period_start           date,
  entitlement_tier       text NOT NULL CHECK (entitlement_tier IN ('free', 'paid')),
  counted_against_limit  boolean NOT NULL DEFAULT false,
  search_source          text NOT NULL DEFAULT 'user_search',
  status                 text NOT NULL CHECK (status IN ('authorized', 'denied', 'refunded')),
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_search_usage_events_user_created
  ON public.search_usage_events (user_id, created_at DESC);

ALTER TABLE public.user_search_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own monthly search usage"
  ON public.user_search_usage_monthly;
CREATE POLICY "Users can view own monthly search usage"
  ON public.user_search_usage_monthly
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own search usage events"
  ON public.search_usage_events;
CREATE POLICY "Users can view own search usage events"
  ON public.search_usage_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- No direct client inserts/updates/deletes. SECURITY DEFINER functions below
-- are the only mutation path.

-- ── 3. Shared entitlement resolver ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_search_entitlement(p_user_id uuid)
RETURNS TABLE (
  plan_id text,
  plan_name text,
  entitlement_tier text,
  monthly_limit integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(active_plan.id, free_plan.id, 'free') AS plan_id,
    COALESCE(active_plan.name, free_plan.name, 'Free') AS plan_name,
    COALESCE(active_plan.entitlement_tier, free_plan.entitlement_tier, 'free') AS entitlement_tier,
    CASE
      WHEN COALESCE(active_plan.entitlement_tier, free_plan.entitlement_tier, 'free') = 'paid'
        THEN NULL
      ELSE COALESCE(active_plan.monthly_allowance_credits, free_plan.monthly_allowance_credits, 5)
    END AS monthly_limit
  FROM (SELECT 1) seed
  LEFT JOIN LATERAL (
    SELECT p.*
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE us.user_id = p_user_id
      AND us.status IN ('active', 'trialing', 'past_due')
      AND p.is_active = true
    LIMIT 1
  ) active_plan ON true
  LEFT JOIN LATERAL (
    SELECT p.*
    FROM public.plans p
    WHERE p.id = 'free'
    LIMIT 1
  ) free_plan ON true;
$$;

REVOKE ALL ON FUNCTION public.resolve_search_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_search_entitlement(uuid) TO authenticated, service_role;

-- ── 4. Atomic authorization for one user-initiated search ───────────────────

CREATE OR REPLACE FUNCTION public.authorize_user_search(
  p_request_id uuid,
  p_search_source text DEFAULT 'user_search'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan_id text;
  v_plan_name text;
  v_tier text;
  v_limit integer;
  v_period_start date := date_trunc('month', timezone('UTC', now()))::date;
  v_period_end date := (date_trunc('month', timezone('UTC', now())) + interval '1 month')::date;
  v_used integer := 0;
  v_existing public.search_usage_events%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'NOT_AUTHENTICATED'
    );
  END IF;

  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'MISSING_REQUEST_ID'
    );
  END IF;

  SELECT r.plan_id, r.plan_name, r.entitlement_tier, r.monthly_limit
  INTO v_plan_id, v_plan_name, v_tier, v_limit
  FROM public.resolve_search_entitlement(v_uid) r;

  v_plan_id := COALESCE(v_plan_id, 'free');
  v_plan_name := COALESCE(v_plan_name, 'Free');
  v_tier := COALESCE(v_tier, 'free');
  v_limit := CASE WHEN v_tier = 'paid' THEN NULL ELSE COALESCE(v_limit, 5) END;

  INSERT INTO public.user_search_usage_monthly (user_id, period_start, used_count)
  VALUES (v_uid, v_period_start, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- Serialize all authorizations for a user within the month. This prevents
  -- concurrent tabs from both claiming the fifth and final Free search.
  SELECT used_count
  INTO v_used
  FROM public.user_search_usage_monthly
  WHERE user_id = v_uid AND period_start = v_period_start
  FOR UPDATE;

  SELECT *
  INTO v_existing
  FROM public.search_usage_events
  WHERE user_id = v_uid AND request_id = p_request_id
  FOR UPDATE;

  IF FOUND AND v_existing.status = 'authorized' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'ALREADY_PROCESSED',
      'already_processed', true,
      'request_id', p_request_id,
      'plan_id', v_plan_id,
      'plan_name', v_plan_name,
      'tier', v_tier,
      'limit', v_limit,
      'used', v_used,
      'remaining', CASE WHEN v_tier = 'paid' THEN NULL ELSE GREATEST(0, v_limit - v_used) END,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'charged', 0
    );
  END IF;

  IF v_tier = 'free' AND v_used >= v_limit THEN
    INSERT INTO public.search_usage_events (
      user_id, request_id, period_start, entitlement_tier,
      counted_against_limit, search_source, status, metadata, updated_at
    ) VALUES (
      v_uid, p_request_id, v_period_start, v_tier,
      false, COALESCE(NULLIF(p_search_source, ''), 'user_search'), 'denied',
      jsonb_build_object('reason', 'MONTHLY_LIMIT_REACHED'), now()
    )
    ON CONFLICT (user_id, request_id) DO UPDATE SET
      period_start = EXCLUDED.period_start,
      entitlement_tier = EXCLUDED.entitlement_tier,
      counted_against_limit = false,
      search_source = EXCLUDED.search_source,
      status = 'denied',
      metadata = EXCLUDED.metadata,
      updated_at = now();

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'MONTHLY_LIMIT_REACHED',
      'already_processed', false,
      'request_id', p_request_id,
      'plan_id', v_plan_id,
      'plan_name', v_plan_name,
      'tier', v_tier,
      'limit', v_limit,
      'used', v_used,
      'remaining', 0,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'charged', 0
    );
  END IF;

  IF v_tier = 'free' THEN
    UPDATE public.user_search_usage_monthly
    SET used_count = used_count + 1,
        updated_at = now()
    WHERE user_id = v_uid AND period_start = v_period_start
    RETURNING used_count INTO v_used;
  END IF;

  INSERT INTO public.search_usage_events (
    user_id, request_id, period_start, entitlement_tier,
    counted_against_limit, search_source, status, metadata, updated_at
  ) VALUES (
    v_uid, p_request_id, v_period_start, v_tier,
    v_tier = 'free', COALESCE(NULLIF(p_search_source, ''), 'user_search'),
    'authorized', '{}'::jsonb, now()
  )
  ON CONFLICT (user_id, request_id) DO UPDATE SET
    period_start = EXCLUDED.period_start,
    entitlement_tier = EXCLUDED.entitlement_tier,
    counted_against_limit = EXCLUDED.counted_against_limit,
    search_source = EXCLUDED.search_source,
    status = 'authorized',
    metadata = '{}'::jsonb,
    updated_at = now();

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'already_processed', false,
    'request_id', p_request_id,
    'plan_id', v_plan_id,
    'plan_name', v_plan_name,
    'tier', v_tier,
    'limit', v_limit,
    'used', v_used,
    'remaining', CASE WHEN v_tier = 'paid' THEN NULL ELSE GREATEST(0, v_limit - v_used) END,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'charged', CASE WHEN v_tier = 'free' THEN 1 ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_user_search(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_user_search(uuid, text) TO authenticated;

-- ── 5. Server-only refund when the upstream provider fails ──────────────────

CREATE OR REPLACE FUNCTION public.refund_authorized_search(
  p_user_id uuid,
  p_request_id uuid,
  p_reason text DEFAULT 'UPSTREAM_FAILURE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.search_usage_events%ROWTYPE;
  v_used integer;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'INVALID_ARGUMENTS');
  END IF;

  SELECT *
  INTO v_event
  FROM public.search_usage_events
  WHERE user_id = p_user_id AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'NOT_FOUND');
  END IF;

  IF v_event.status = 'refunded' THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'ALREADY_REFUNDED');
  END IF;

  IF v_event.status <> 'authorized' THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'NOT_AUTHORIZED');
  END IF;

  IF v_event.counted_against_limit AND v_event.period_start IS NOT NULL THEN
    UPDATE public.user_search_usage_monthly
    SET used_count = GREATEST(0, used_count - 1),
        updated_at = now()
    WHERE user_id = p_user_id AND period_start = v_event.period_start
    RETURNING used_count INTO v_used;
  END IF;

  UPDATE public.search_usage_events
  SET status = 'refunded',
      metadata = metadata || jsonb_build_object('refund_reason', COALESCE(p_reason, 'UPSTREAM_FAILURE')),
      updated_at = now()
  WHERE id = v_event.id;

  RETURN jsonb_build_object(
    'refunded', true,
    'request_id', p_request_id,
    'used', v_used
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_authorized_search(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_authorized_search(uuid, uuid, text)
  TO service_role;

-- ── 6. Read model for Account / Subscription UI ─────────────────────────────

CREATE OR REPLACE FUNCTION public.get_search_entitlement()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan_id text;
  v_plan_name text;
  v_tier text;
  v_limit integer;
  v_period_start date := date_trunc('month', timezone('UTC', now()))::date;
  v_period_end date := (date_trunc('month', timezone('UTC', now())) + interval '1 month')::date;
  v_used integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT r.plan_id, r.plan_name, r.entitlement_tier, r.monthly_limit
  INTO v_plan_id, v_plan_name, v_tier, v_limit
  FROM public.resolve_search_entitlement(v_uid) r;

  v_plan_id := COALESCE(v_plan_id, 'free');
  v_plan_name := COALESCE(v_plan_name, 'Free');
  v_tier := COALESCE(v_tier, 'free');
  v_limit := CASE WHEN v_tier = 'paid' THEN NULL ELSE COALESCE(v_limit, 5) END;

  SELECT COALESCE(used_count, 0)
  INTO v_used
  FROM public.user_search_usage_monthly
  WHERE user_id = v_uid AND period_start = v_period_start;

  RETURN jsonb_build_object(
    'authenticated', true,
    'plan_id', v_plan_id,
    'plan_name', v_plan_name,
    'tier', v_tier,
    'is_paid', v_tier = 'paid',
    'limit', v_limit,
    'used', COALESCE(v_used, 0),
    'remaining', CASE WHEN v_tier = 'paid' THEN NULL ELSE GREATEST(0, v_limit - COALESCE(v_used, 0)) END,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_search_entitlement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_search_entitlement() TO authenticated;

-- ── 7. Compatibility wrapper for older clients during rollout ──────────────
-- All legacy route-cost arguments are intentionally ignored. A deterministic
-- UUID is generated from source_id only for old clients that do not yet send a
-- UUID request id. New clients call authorize_user_search directly.

CREATE OR REPLACE FUNCTION public.consume_search_credits(
  p_trip_type text,
  p_arrival_airports_count integer,
  p_all_destinations boolean,
  p_source_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text := COALESCE(NULLIF(p_source_id, ''), gen_random_uuid()::text);
  v_hash text;
  v_request_id uuid;
  v_result jsonb;
BEGIN
  v_hash := md5(auth.uid()::text || ':' || v_source);
  v_request_id := (
    substr(v_hash, 1, 8) || '-' ||
    substr(v_hash, 9, 4) || '-' ||
    substr(v_hash, 13, 4) || '-' ||
    substr(v_hash, 17, 4) || '-' ||
    substr(v_hash, 21, 12)
  )::uuid;

  v_result := public.authorize_user_search(v_request_id, 'legacy_client');

  RETURN v_result || jsonb_build_object(
    'cost', CASE WHEN COALESCE((v_result->>'allowed')::boolean, false) THEN 1 ELSE 0 END,
    'used_from_monthly', COALESCE((v_result->>'charged')::integer, 0),
    'used_from_purchased', 0,
    'remaining_monthly', CASE WHEN v_result ? 'remaining' THEN v_result->'remaining' ELSE 'null'::jsonb END,
    'purchased_balance', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_search_credits(text, integer, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_search_credits(text, integer, boolean, text)
  TO authenticated;
