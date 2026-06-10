-- ============================================================
-- 1. gowilder_global_token (20260401000000)
-- ============================================================

-- Allow user_id to be NULL for global (system-level) config entries
ALTER TABLE public.app_config ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing compound unique constraint
ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_user_id_config_key_key;

-- Re-establish uniqueness via two partial indexes:
-- 1. Per-user entries (existing behavior preserved)
CREATE UNIQUE INDEX IF NOT EXISTS app_config_user_key
  ON public.app_config (user_id, config_key)
  WHERE user_id IS NOT NULL;

-- 2. Global entries (one row per config_key with no user)
CREATE UNIQUE INDEX IF NOT EXISTS app_config_global_key
  ON public.app_config (config_key)
  WHERE user_id IS NULL;

-- RLS policies for global config: readable/writable by dev-allowlisted users
CREATE POLICY "Devs can select global config"
  ON public.app_config FOR SELECT
  USING (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can insert global config"
  ON public.app_config FOR INSERT
  WITH CHECK (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can update global config"
  ON public.app_config FOR UPDATE
  USING (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can delete global config"
  ON public.app_config FOR DELETE
  USING (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

-- ============================================================
-- 2. gold_search_ledger (20260505180000)
-- ============================================================

-- Allow 'gold_search' as a valid transaction type in the ledger
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'search_debit',
    'purchase_credit',
    'monthly_grant',
    'refund',
    'admin_adjustment',
    'gold_search'
  ));

-- Write a zero-cost ledger row for Gold/unlimited searches so every
-- search is traceable regardless of plan.
CREATE OR REPLACE FUNCTION public.consume_search_credits(
  p_trip_type              text,
  p_arrival_airports_count integer,
  p_all_destinations       boolean,
  p_source_id              text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid            uuid := auth.uid();
  v_cost           int;
  v_plan_id        text;
  v_status         text;
  v_allowance      int;
  v_monthly_used   int;
  v_purchased      int;
  v_period_end     timestamptz;
  v_period_start   timestamptz;
  v_available_monthly  int;
  v_take_monthly   int;
  v_take_purchased int;
  v_monthly_before int;
  v_purchased_before int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  IF p_source_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id   = v_uid
        AND source_type = 'flight_search'
        AND source_id   = p_source_id
    ) THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'ALREADY_PROCESSED', 'cost', 0);
    END IF;
  END IF;

  IF p_all_destinations THEN
    v_cost := 5;
  ELSE
    v_cost := 1 + GREATEST(0, p_arrival_airports_count - 1);
  END IF;

  SELECT us.plan_id, us.status, p.monthly_allowance_credits
  INTO   v_plan_id, v_status, v_allowance
  FROM   public.user_subscriptions us
  JOIN   public.plans p ON p.id = us.plan_id
  WHERE  us.user_id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (v_uid, 'free', 'active');
    INSERT INTO public.user_credit_wallet (user_id) VALUES (v_uid);
    v_plan_id   := 'free';
    v_status    := 'active';
    v_allowance := 15;
  END IF;

  -- Gold / unlimited: log a zero-cost ledger row then allow
  IF v_status = 'active' AND v_allowance IS NULL THEN
    IF p_source_id IS NOT NULL THEN
      INSERT INTO public.credit_transactions
        (user_id, transaction_type, source_type, source_id, amount,
         bucket, balance_before, balance_after, metadata)
      VALUES (
        v_uid, 'gold_search', 'flight_search', p_source_id,
        0, 'monthly', 0, 0,
        jsonb_build_object(
          'trip_type',              p_trip_type,
          'arrival_airports_count', p_arrival_airports_count,
          'all_destinations',       p_all_destinations,
          'nominal_cost',           v_cost
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed',             true,
      'reason',              NULL,
      'cost',                v_cost,
      'used_from_monthly',   0,
      'used_from_purchased', 0,
      'remaining_monthly',   -1,
      'purchased_balance',   (SELECT purchased_balance FROM public.user_credit_wallet WHERE user_id = v_uid),
      'plan_id',             v_plan_id
    );
  END IF;

  SELECT monthly_used, monthly_period_start, monthly_period_end, purchased_balance
  INTO   v_monthly_used, v_period_start, v_period_end, v_purchased
  FROM   public.user_credit_wallet
  WHERE  user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_credit_wallet (user_id) VALUES (v_uid);
    v_monthly_used := 0;
    v_period_start := now();
    v_period_end   := now() + interval '1 month';
    v_purchased    := 0;
  END IF;

  IF now() >= v_period_end THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount,
       bucket, balance_before, balance_after, metadata)
    VALUES (
      v_uid, 'monthly_grant', 'system', NULL,
      COALESCE(v_allowance, 15),
      'monthly', 0, COALESCE(v_allowance, 15),
      jsonb_build_object(
        'reset_from',       v_period_end,
        'new_period_start', v_period_end,
        'new_period_end',   v_period_end + interval '1 month'
      )
    );
    v_monthly_used := 0;
    v_period_start := v_period_end;
    v_period_end   := v_period_end + interval '1 month';
  END IF;

  IF v_allowance IS NULL THEN v_allowance := 15; END IF;
  v_available_monthly := GREATEST(0, v_allowance - v_monthly_used);
  v_take_monthly      := LEAST(v_cost, v_available_monthly);
  v_take_purchased    := v_cost - v_take_monthly;

  IF v_take_purchased > v_purchased THEN
    RETURN jsonb_build_object(
      'allowed',             false,
      'reason',              'INSUFFICIENT_CREDITS',
      'cost',                v_cost,
      'used_from_monthly',   0,
      'used_from_purchased', 0,
      'remaining_monthly',   v_available_monthly,
      'purchased_balance',   v_purchased,
      'plan_id',             v_plan_id
    );
  END IF;

  v_monthly_before   := v_available_monthly;
  v_purchased_before := v_purchased;

  UPDATE public.user_credit_wallet
  SET monthly_used         = v_monthly_used + v_take_monthly,
      monthly_period_start = v_period_start,
      monthly_period_end   = v_period_end,
      purchased_balance    = v_purchased - v_take_purchased,
      updated_at           = now()
  WHERE user_id = v_uid;

  IF v_take_monthly > 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount,
       bucket, balance_before, balance_after, metadata)
    VALUES (
      v_uid, 'search_debit', 'flight_search', p_source_id,
      -v_take_monthly, 'monthly',
      v_monthly_before, v_monthly_before - v_take_monthly,
      jsonb_build_object(
        'trip_type',              p_trip_type,
        'arrival_airports_count', p_arrival_airports_count,
        'all_destinations',       p_all_destinations,
        'total_cost',             v_cost
      )
    );
  END IF;

  IF v_take_purchased > 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount,
       bucket, balance_before, balance_after, metadata)
    VALUES (
      v_uid, 'search_debit', 'flight_search', p_source_id,
      -v_take_purchased, 'purchased',
      v_purchased_before, v_purchased_before - v_take_purchased,
      jsonb_build_object(
        'trip_type',              p_trip_type,
        'arrival_airports_count', p_arrival_airports_count,
        'all_destinations',       p_all_destinations,
        'total_cost',             v_cost
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed',             true,
    'reason',              NULL,
    'cost',                v_cost,
    'used_from_monthly',   v_take_monthly,
    'used_from_purchased', v_take_purchased,
    'remaining_monthly',   v_available_monthly - v_take_monthly,
    'purchased_balance',   v_purchased - v_take_purchased,
    'plan_id',             v_plan_id
  );
END;
$function$;

-- ============================================================
-- 3. subscription_cancel_at_period_end (20260505190000)
-- ============================================================

-- Store whether a subscription is set to cancel at the end of the current period
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

-- ============================================================
-- 4. update_log_level_constraint (20260608000000)
-- ============================================================

-- Replace the validation function with the new allowed set
CREATE OR REPLACE FUNCTION public.validate_log_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.log_level NOT IN ('silent', 'error', 'warn', 'info', 'debug') THEN
    RAISE EXCEPTION 'log_level must be silent, error, warn, info, or debug';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Migrate any existing 'off' rows to 'silent' (equivalent: nothing logs)
UPDATE public.developer_settings
SET log_level = 'silent'
WHERE log_level = 'off';

-- ============================================================
-- 5. beta_application_provisioning (20260609000000)
-- ============================================================

-- Track which auth user was provisioned for each beta application
ALTER TABLE public.beta_applications
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS beta_applications_auth_user_id_key
  ON public.beta_applications (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- ============================================================
-- 6. frontier_market_layer (20260609120000)
-- ============================================================

-- ── 6a. airports: add Frontier metadata columns ───────────────

ALTER TABLE public.airports
  ADD COLUMN IF NOT EXISTS frontier_source         text,
  ADD COLUMN IF NOT EXISTS frontier_last_seen_at   timestamptz,
  ADD COLUMN IF NOT EXISTS frontier_image_url      text,
  ADD COLUMN IF NOT EXISTS metadata_status         text NOT NULL DEFAULT 'verified';

-- metadata_status check constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname     = 'airports_metadata_status_check'
      AND conrelid    = 'public.airports'::regclass
  ) THEN
    ALTER TABLE public.airports
      ADD CONSTRAINT airports_metadata_status_check
      CHECK (metadata_status IN ('verified', 'needs_review', 'auto_created'));
  END IF;
END $$;

-- ── 6b. frontier_market_snapshots ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.frontier_market_snapshots (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type        text        NOT NULL DEFAULT 'local_market_offerings_json',
  source_path        text,
  source_checksum    text,
  raw_json           jsonb       NOT NULL,
  station_count      integer     NOT NULL DEFAULT 0,
  origin_count       integer     NOT NULL DEFAULT 0,
  route_pair_count   integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.frontier_market_snapshots TO authenticated;
GRANT ALL ON public.frontier_market_snapshots TO service_role;

-- ── 6c. frontier_routes ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.frontier_routes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_iata       varchar(3)  NOT NULL,
  destination_iata  varchar(3)  NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_snapshot_id  uuid        REFERENCES public.frontier_market_snapshots(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT frontier_routes_unique_pair
    UNIQUE (origin_iata, destination_iata),
  CONSTRAINT frontier_routes_origin_iata_check
    CHECK (origin_iata = upper(origin_iata) AND length(origin_iata) = 3),
  CONSTRAINT frontier_routes_dest_iata_check
    CHECK (destination_iata = upper(destination_iata) AND length(destination_iata) = 3)
);

GRANT SELECT ON public.frontier_routes TO authenticated;
GRANT ALL ON public.frontier_routes TO service_role;

-- ── 6d. Indexes ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_frontier_routes_active_origin
  ON public.frontier_routes (origin_iata)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_frontier_routes_active_destination
  ON public.frontier_routes (destination_iata)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_frontier_routes_snapshot_id
  ON public.frontier_routes (last_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_airports_is_active
  ON public.airports (is_active);

CREATE INDEX IF NOT EXISTS idx_airports_frontier_last_seen_at
  ON public.airports (frontier_last_seen_at);

-- ── 6e. updated_at trigger ───────────────────────────────────

DROP TRIGGER IF EXISTS set_frontier_routes_updated_at ON public.frontier_routes;
CREATE TRIGGER set_frontier_routes_updated_at
  BEFORE UPDATE ON public.frontier_routes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 6f. Views ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.frontier_active_route_map
  WITH (security_invoker = true)
AS
SELECT
  origin_iata,
  array_agg(destination_iata ORDER BY destination_iata) AS destinations
FROM  public.frontier_routes
WHERE is_active = true
GROUP BY origin_iata;

CREATE OR REPLACE VIEW public.frontier_active_airports
  WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.name,
  a.iata_code,
  a.icao_code,
  a.latitude,
  a.longitude,
  a.timezone,
  a.is_hub,
  a.is_active,
  a.frontier_source,
  a.frontier_last_seen_at,
  a.frontier_image_url,
  a.metadata_status,
  a.location_id,
  l.name       AS location_name,
  l.city,
  l.state,
  l.state_code,
  l.region,
  l.country
FROM  public.airports  a
LEFT JOIN public.locations l ON l.id = a.location_id
WHERE a.is_active = true;

GRANT SELECT ON public.frontier_active_route_map TO authenticated;
GRANT SELECT ON public.frontier_active_airports  TO authenticated;

-- ── 6g. RLS ─────────────────────────────────────────────────

ALTER TABLE public.frontier_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read frontier routes"
  ON public.frontier_routes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "No client insert frontier routes"
  ON public.frontier_routes FOR INSERT
  TO public WITH CHECK (false);

CREATE POLICY "No client update frontier routes"
  ON public.frontier_routes FOR UPDATE
  TO public USING (false);

CREATE POLICY "No client delete frontier routes"
  ON public.frontier_routes FOR DELETE
  TO public USING (false);

ALTER TABLE public.frontier_market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read frontier snapshots"
  ON public.frontier_market_snapshots
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.developer_allowlist
    WHERE developer_allowlist.user_id = auth.uid()
  ));

CREATE POLICY "No client insert frontier snapshots"
  ON public.frontier_market_snapshots FOR INSERT
  TO public WITH CHECK (false);

CREATE POLICY "No client update frontier snapshots"
  ON public.frontier_market_snapshots FOR UPDATE
  TO public USING (false);

CREATE POLICY "No client delete frontier snapshots"
  ON public.frontier_market_snapshots FOR DELETE
  TO public USING (false);