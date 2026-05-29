
-- ─── authorize_paid_search ────────────────────────────────────────────────
-- Server-side credit authorization for paid flight searches. Mirrors the
-- existing consume_search_credits() logic but takes an explicit p_user_id
-- so it can be invoked by trusted server code (the flight-proxy edge function)
-- using the service role. Idempotent per (user_id, source_id).
CREATE OR REPLACE FUNCTION public.authorize_paid_search(
  p_user_id uuid,
  p_trip_type text,
  p_arrival_airports_count int,
  p_all_destinations boolean,
  p_source_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int;
  v_plan_id text;
  v_status text;
  v_allowance int;
  v_monthly_used int;
  v_purchased int;
  v_period_end timestamptz;
  v_period_start timestamptz;
  v_available_monthly int;
  v_take_monthly int;
  v_take_purchased int;
  v_monthly_before int;
  v_purchased_before int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;
  IF p_source_id IS NULL OR length(p_source_id) < 8 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'MISSING_REQUEST_ID');
  END IF;

  -- Idempotency: if this request_id already charged this user, return no-op.
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND source_type = 'flight_search'
      AND source_id = p_source_id
      AND transaction_type = 'search_debit'
  ) THEN
    -- Also check whether a refund undid it. If refunded, treat as fresh.
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id = p_user_id
        AND source_id = p_source_id
        AND transaction_type = 'search_refund'
    ) THEN
      -- previously charged then refunded — re-allow a fresh charge below
      NULL;
    ELSE
      RETURN jsonb_build_object(
        'allowed', true, 'reason', 'ALREADY_PROCESSED', 'cost', 0,
        'used_from_monthly', 0, 'used_from_purchased', 0
      );
    END IF;
  END IF;

  IF p_all_destinations THEN
    v_cost := 5;
  ELSE
    v_cost := 1 + GREATEST(0, p_arrival_airports_count - 1);
  END IF;

  SELECT us.plan_id, us.status, p.monthly_allowance_credits
  INTO v_plan_id, v_status, v_allowance
  FROM public.user_subscriptions us
  JOIN public.plans p ON p.id = us.plan_id
  WHERE us.user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (p_user_id, 'free', 'active')
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_credit_wallet (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    v_plan_id := 'free'; v_status := 'active'; v_allowance := 15;
  END IF;

  -- Gold/unlimited
  IF v_status = 'active' AND v_allowance IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true, 'reason', NULL, 'cost', v_cost,
      'used_from_monthly', 0, 'used_from_purchased', 0, 'remaining_monthly', -1,
      'purchased_balance', (SELECT purchased_balance FROM public.user_credit_wallet WHERE user_id = p_user_id),
      'plan_id', v_plan_id
    );
  END IF;

  -- Lock wallet row
  SELECT monthly_used, monthly_period_start, monthly_period_end, purchased_balance
  INTO v_monthly_used, v_period_start, v_period_end, v_purchased
  FROM public.user_credit_wallet WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_credit_wallet (user_id) VALUES (p_user_id);
    v_monthly_used := 0; v_period_start := now();
    v_period_end := now() + interval '1 month'; v_purchased := 0;
  END IF;

  IF now() >= v_period_end THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount, bucket, balance_before, balance_after, metadata)
    VALUES (p_user_id, 'monthly_grant', 'system', NULL,
            COALESCE(v_allowance, 15), 'monthly', 0, COALESCE(v_allowance, 15),
            jsonb_build_object('reset_from', v_period_end));
    v_monthly_used := 0; v_period_start := v_period_end;
    v_period_end := v_period_end + interval '1 month';
  END IF;

  IF v_allowance IS NULL THEN v_allowance := 15; END IF;
  v_available_monthly := GREATEST(0, v_allowance - v_monthly_used);
  v_take_monthly := LEAST(v_cost, v_available_monthly);
  v_take_purchased := v_cost - v_take_monthly;

  IF v_take_purchased > v_purchased THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'INSUFFICIENT_CREDITS', 'cost', v_cost,
      'used_from_monthly', 0, 'used_from_purchased', 0,
      'remaining_monthly', v_available_monthly,
      'purchased_balance', v_purchased, 'plan_id', v_plan_id
    );
  END IF;

  v_monthly_before := v_available_monthly;
  v_purchased_before := v_purchased;

  UPDATE public.user_credit_wallet
  SET monthly_used = v_monthly_used + v_take_monthly,
      monthly_period_start = v_period_start,
      monthly_period_end   = v_period_end,
      purchased_balance    = v_purchased - v_take_purchased,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF v_take_monthly > 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount, bucket, balance_before, balance_after, metadata)
    VALUES (p_user_id, 'search_debit', 'flight_search', p_source_id,
            -v_take_monthly, 'monthly',
            v_monthly_before, v_monthly_before - v_take_monthly,
            jsonb_build_object('trip_type', p_trip_type,
                               'arrival_airports_count', p_arrival_airports_count,
                               'all_destinations', p_all_destinations,
                               'total_cost', v_cost,
                               'charged_via', 'flight_proxy'));
  END IF;
  IF v_take_purchased > 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount, bucket, balance_before, balance_after, metadata)
    VALUES (p_user_id, 'search_debit', 'flight_search', p_source_id,
            -v_take_purchased, 'purchased',
            v_purchased_before, v_purchased_before - v_take_purchased,
            jsonb_build_object('trip_type', p_trip_type,
                               'arrival_airports_count', p_arrival_airports_count,
                               'all_destinations', p_all_destinations,
                               'total_cost', v_cost,
                               'charged_via', 'flight_proxy'));
  END IF;

  RETURN jsonb_build_object(
    'allowed', true, 'reason', NULL, 'cost', v_cost,
    'used_from_monthly', v_take_monthly,
    'used_from_purchased', v_take_purchased,
    'remaining_monthly', v_available_monthly - v_take_monthly,
    'purchased_balance', v_purchased - v_take_purchased,
    'plan_id', v_plan_id
  );
END;
$$;

-- ─── refund_paid_search ──────────────────────────────────────────────────
-- Reverses any 'search_debit' rows for (user_id, source_id) and inserts a
-- linked 'search_refund' ledger entry. Idempotent: returns no-op if a refund
-- already exists for this source_id.
CREATE OR REPLACE FUNCTION public.refund_paid_search(
  p_user_id uuid,
  p_source_id text,
  p_reason text DEFAULT 'upstream_failure'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit record;
  v_monthly_before int;
  v_purchased_before int;
  v_total_monthly int := 0;
  v_total_purchased int := 0;
BEGIN
  IF p_user_id IS NULL OR p_source_id IS NULL OR length(p_source_id) < 8 THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'INVALID_INPUT');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE user_id = p_user_id AND source_id = p_source_id
      AND transaction_type = 'search_refund'
  ) THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'ALREADY_REFUNDED');
  END IF;

  -- Lock wallet
  PERFORM 1 FROM public.user_credit_wallet WHERE user_id = p_user_id FOR UPDATE;

  SELECT monthly_used, purchased_balance INTO v_monthly_before, v_purchased_before
  FROM public.user_credit_wallet WHERE user_id = p_user_id;

  FOR v_debit IN
    SELECT bucket, amount FROM public.credit_transactions
    WHERE user_id = p_user_id AND source_id = p_source_id
      AND transaction_type = 'search_debit'
  LOOP
    IF v_debit.bucket = 'monthly' THEN
      v_total_monthly := v_total_monthly + (-v_debit.amount);
    ELSIF v_debit.bucket = 'purchased' THEN
      v_total_purchased := v_total_purchased + (-v_debit.amount);
    END IF;
  END LOOP;

  IF v_total_monthly = 0 AND v_total_purchased = 0 THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'NO_DEBIT_FOUND');
  END IF;

  UPDATE public.user_credit_wallet
  SET monthly_used = GREATEST(0, monthly_used - v_total_monthly),
      purchased_balance = purchased_balance + v_total_purchased,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF v_total_monthly > 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount, bucket, balance_before, balance_after, metadata)
    VALUES (p_user_id, 'search_refund', 'flight_search', p_source_id,
            v_total_monthly, 'monthly',
            v_monthly_before, v_monthly_before - v_total_monthly,
            jsonb_build_object('reason', p_reason));
  END IF;
  IF v_total_purchased > 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, transaction_type, source_type, source_id, amount, bucket, balance_before, balance_after, metadata)
    VALUES (p_user_id, 'search_refund', 'flight_search', p_source_id,
            v_total_purchased, 'purchased',
            v_purchased_before, v_purchased_before + v_total_purchased,
            jsonb_build_object('reason', p_reason));
  END IF;

  RETURN jsonb_build_object(
    'refunded', true,
    'refunded_monthly', v_total_monthly,
    'refunded_purchased', v_total_purchased
  );
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_paid_search(uuid, text, int, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_paid_search(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_paid_search(uuid, text, int, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_paid_search(uuid, text, text) TO service_role;
