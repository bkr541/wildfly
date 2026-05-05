
-- Update Free plan to 15 monthly credits
UPDATE public.plans SET monthly_allowance_credits = 15 WHERE id = 'free';

-- Add billing_period (already exists) and price_usd in features for Gold plans
UPDATE public.plans
  SET features = jsonb_set(features, '{price_usd}', to_jsonb(12.99))
  WHERE id = 'gold_monthly';

UPDATE public.plans
  SET features = jsonb_set(features, '{price_usd}', to_jsonb(74.99))
  WHERE id = 'gold_yearly';

-- Ensure billing_period set correctly
UPDATE public.plans SET billing_period = 'monthly' WHERE id = 'gold_monthly';
UPDATE public.plans SET billing_period = 'yearly'  WHERE id = 'gold_yearly';

-- Credit packs: deactivate 25-pack, update prices, ensure 10/50/100 active
UPDATE public.credit_packs SET is_active = false WHERE id = 'credit_pack_25';

UPDATE public.credit_packs SET price_usd = 1.99,  is_active = true, display_order = 1 WHERE id = 'credit_pack_10';
UPDATE public.credit_packs SET price_usd = 4.99,  is_active = true, display_order = 2 WHERE id = 'credit_pack_50';
UPDATE public.credit_packs SET price_usd = 12.99, is_active = true, display_order = 3 WHERE id = 'credit_pack_100';

-- Insert any missing packs (idempotent)
INSERT INTO public.credit_packs (id, name, credits_amount, price_usd, display_order, is_active)
VALUES
  ('credit_pack_10',  '10 Credits',  10,  1.99, 1, true),
  ('credit_pack_50',  '50 Credits',  50,  4.99, 2, true),
  ('credit_pack_100', '100 Credits', 100, 12.99, 3, true)
ON CONFLICT (id) DO NOTHING;

-- Update consume_search_credits default allowance fallback from 20 to 15
CREATE OR REPLACE FUNCTION public.consume_search_credits(p_trip_type text, p_arrival_airports_count integer, p_all_destinations boolean, p_source_id text DEFAULT NULL::text)
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
      WHERE user_id = v_uid
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
    v_plan_id := 'free';
    v_status  := 'active';
    v_allowance := 15;
  END IF;

  IF v_status = 'active' AND v_allowance IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true, 'reason', NULL, 'cost', v_cost,
      'used_from_monthly', 0, 'used_from_purchased', 0,
      'remaining_monthly', -1,
      'purchased_balance', (SELECT purchased_balance FROM public.user_credit_wallet WHERE user_id = v_uid),
      'plan_id', v_plan_id
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
      jsonb_build_object('reset_from', v_period_end, 'new_period_start', v_period_end, 'new_period_end', v_period_end + interval '1 month')
    );
    v_monthly_used := 0;
    v_period_start := v_period_end;
    v_period_end   := v_period_end + interval '1 month';
  END IF;

  IF v_allowance IS NULL THEN v_allowance := 15; END IF;
  v_available_monthly  := GREATEST(0, v_allowance - v_monthly_used);
  v_take_monthly       := LEAST(v_cost, v_available_monthly);
  v_take_purchased     := v_cost - v_take_monthly;

  IF v_take_purchased > v_purchased THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'INSUFFICIENT_CREDITS', 'cost', v_cost,
      'used_from_monthly', 0, 'used_from_purchased', 0,
      'remaining_monthly', v_available_monthly,
      'purchased_balance', v_purchased, 'plan_id', v_plan_id
    );
  END IF;

  v_monthly_before   := v_available_monthly;
  v_purchased_before := v_purchased;

  UPDATE public.user_credit_wallet
  SET monthly_used = v_monthly_used + v_take_monthly,
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
      jsonb_build_object('trip_type', p_trip_type, 'arrival_airports_count', p_arrival_airports_count, 'all_destinations', p_all_destinations, 'total_cost', v_cost)
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
      jsonb_build_object('trip_type', p_trip_type, 'arrival_airports_count', p_arrival_airports_count, 'all_destinations', p_all_destinations, 'total_cost', v_cost)
    );
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
$function$;
