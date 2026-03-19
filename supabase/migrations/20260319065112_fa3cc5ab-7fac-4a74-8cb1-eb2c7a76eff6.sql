
-- ─────────────────────────────────────────────────────────────────────────────
-- credit_transactions: immutable credit ledger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.credit_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text        NOT NULL
    CHECK (transaction_type IN ('search_debit','purchase_credit','monthly_grant','refund','admin_adjustment')),
  source_type      text        NOT NULL
    CHECK (source_type IN ('flight_search','stripe_checkout','system','admin')),
  source_id        text,
  amount           integer     NOT NULL,           -- negative = debit, positive = credit
  bucket           text        NOT NULL
    CHECK (bucket IN ('monthly','purchased')),
  balance_before   integer     NOT NULL,
  balance_after    integer     NOT NULL,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_transactions_user_created
  ON public.credit_transactions (user_id, created_at DESC);

CREATE INDEX idx_credit_transactions_source
  ON public.credit_transactions (source_type, source_id)
  WHERE source_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own ledger (for wallet history UI)
CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Block client-side INSERT (all writes go through service role / RPC)
CREATE POLICY "No client insert"
  ON public.credit_transactions
  FOR INSERT
  WITH CHECK (false);

-- Immutable: block UPDATE
CREATE POLICY "Ledger is immutable - no updates"
  ON public.credit_transactions
  FOR UPDATE
  USING (false);

-- Immutable: block DELETE
CREATE POLICY "Ledger is immutable - no deletes"
  ON public.credit_transactions
  FOR DELETE
  USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- Updated consume_search_credits RPC
-- Adds idempotency guard + per-bucket ledger rows
-- New optional param: p_source_id (flight_search.id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_search_credits(
  p_trip_type              text,
  p_arrival_airports_count integer,
  p_all_destinations       boolean,
  p_source_id              text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- ── Idempotency: if source_id already has ledger entries, return OK ──
  IF p_source_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id = v_uid
        AND source_type = 'flight_search'
        AND source_id   = p_source_id
    ) THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'reason',  'ALREADY_PROCESSED',
        'cost',    0
      );
    END IF;
  END IF;

  -- ── Compute cost ──
  IF p_all_destinations THEN
    v_cost := 5;
  ELSE
    v_cost := 1 + GREATEST(0, p_arrival_airports_count - 1);
  END IF;

  -- ── Load subscription + plan ──
  SELECT us.plan_id, us.status, p.monthly_allowance_credits
  INTO   v_plan_id, v_status, v_allowance
  FROM   public.user_subscriptions us
  JOIN   public.plans p ON p.id = us.plan_id
  WHERE  us.user_id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (v_uid, 'free', 'active');
    INSERT INTO public.user_credit_wallet (user_id)
    VALUES (v_uid);
    v_plan_id   := 'free';
    v_status    := 'active';
    v_allowance := 20;
  END IF;

  -- ── Gold / unlimited: allow without decrement ──
  IF v_status = 'active' AND v_allowance IS NULL THEN
    RETURN jsonb_build_object(
      'allowed',              true,
      'reason',               NULL,
      'cost',                 v_cost,
      'used_from_monthly',    0,
      'used_from_purchased',  0,
      'remaining_monthly',    -1,
      'purchased_balance',    (SELECT purchased_balance FROM public.user_credit_wallet WHERE user_id = v_uid),
      'plan_id',              v_plan_id
    );
  END IF;

  -- ── Lock wallet row ──
  SELECT monthly_used, monthly_period_start, monthly_period_end, purchased_balance
  INTO   v_monthly_used, v_period_start, v_period_end, v_purchased
  FROM   public.user_credit_wallet
  WHERE  user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_credit_wallet (user_id)
    VALUES (v_uid);
    v_monthly_used := 0;
    v_period_start := now();
    v_period_end   := now() + interval '1 month';
    v_purchased    := 0;
  END IF;

  -- ── Monthly reset ──
  IF now() >= v_period_end THEN
    -- Capture balance before grant
    v_monthly_before := 0;  -- just reset, old amount is gone

    -- Insert monthly_grant ledger row for the new period
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount,
       bucket, balance_before, balance_after, metadata)
    VALUES (
      v_uid, 'monthly_grant', 'system', NULL,
      COALESCE(v_allowance, 20),
      'monthly',
      0,
      COALESCE(v_allowance, 20),
      jsonb_build_object('reset_from', v_period_end, 'new_period_start', v_period_end, 'new_period_end', v_period_end + interval '1 month')
    );

    v_monthly_used := 0;
    v_period_start := v_period_end;
    v_period_end   := v_period_end + interval '1 month';
  END IF;

  IF v_allowance IS NULL THEN v_allowance := 20; END IF;
  v_available_monthly  := GREATEST(0, v_allowance - v_monthly_used);
  v_take_monthly       := LEAST(v_cost, v_available_monthly);
  v_take_purchased     := v_cost - v_take_monthly;

  IF v_take_purchased > v_purchased THEN
    RETURN jsonb_build_object(
      'allowed',              false,
      'reason',               'INSUFFICIENT_CREDITS',
      'cost',                 v_cost,
      'used_from_monthly',    0,
      'used_from_purchased',  0,
      'remaining_monthly',    v_available_monthly,
      'purchased_balance',    v_purchased,
      'plan_id',              v_plan_id
    );
  END IF;

  -- ── Snapshot balances before mutation ──
  v_monthly_before   := v_available_monthly;
  v_purchased_before := v_purchased;

  -- ── Apply wallet update ──
  UPDATE public.user_credit_wallet
  SET
    monthly_used         = v_monthly_used + v_take_monthly,
    monthly_period_start = v_period_start,
    monthly_period_end   = v_period_end,
    purchased_balance    = v_purchased - v_take_purchased,
    updated_at           = now()
  WHERE user_id = v_uid;

  -- ── Write ledger rows (same transaction) ──
  IF v_take_monthly > 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount,
       bucket, balance_before, balance_after, metadata)
    VALUES (
      v_uid, 'search_debit', 'flight_search', p_source_id,
      -v_take_monthly,
      'monthly',
      v_monthly_before,
      v_monthly_before - v_take_monthly,
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
      -v_take_purchased,
      'purchased',
      v_purchased_before,
      v_purchased_before - v_take_purchased,
      jsonb_build_object(
        'trip_type',              p_trip_type,
        'arrival_airports_count', p_arrival_airports_count,
        'all_destinations',       p_all_destinations,
        'total_cost',             v_cost
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed',              true,
    'reason',               NULL,
    'cost',                 v_cost,
    'used_from_monthly',    v_take_monthly,
    'used_from_purchased',  v_take_purchased,
    'remaining_monthly',    v_available_monthly - v_take_monthly,
    'purchased_balance',    v_purchased - v_take_purchased,
    'plan_id',              v_plan_id
  );
END;
$$;
