
-- 1) plans table
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_allowance_credits int,
  features jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable" ON public.plans FOR SELECT USING (true);

-- Seed plans
INSERT INTO public.plans (id, name, monthly_allowance_credits, features) VALUES
  ('free', 'Free', 20, '{"search": true, "watchlist": false, "daytrips": false, "alerts": false}'),
  ('gold_monthly', 'Gold Monthly', NULL, '{"search": true, "watchlist": true, "daytrips": true, "alerts": true}'),
  ('gold_yearly', 'Gold Yearly', NULL, '{"search": true, "watchlist": true, "daytrips": true, "alerts": true}');

-- 2) user_subscriptions
CREATE TABLE public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id) DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- 3) user_credit_wallet
CREATE TABLE public.user_credit_wallet (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_used int NOT NULL DEFAULT 0,
  monthly_period_start timestamptz NOT NULL DEFAULT now(),
  monthly_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  purchased_balance int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_credit_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.user_credit_wallet FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.user_credit_wallet FOR UPDATE USING (auth.uid() = user_id);

-- 4) Add columns to flight_searches
ALTER TABLE public.flight_searches
  ADD COLUMN credits_cost int,
  ADD COLUMN arrival_airports_count int;

-- 5) Auto-provision subscription + wallet on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_credit_wallet (user_id, monthly_used, monthly_period_start, monthly_period_end, purchased_balance)
  VALUES (NEW.id, 0, now(), now() + interval '1 month', 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();

-- 6) consume_search_credits RPC
CREATE OR REPLACE FUNCTION public.consume_search_credits(
  p_trip_type text,
  p_arrival_airports_count int,
  p_all_destinations boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
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
  v_remainder int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  -- Compute cost
  IF p_all_destinations THEN
    v_cost := 5;
  ELSE
    v_cost := 1 + GREATEST(0, p_arrival_airports_count - 1);
  END IF;

  -- Load subscription + plan
  SELECT us.plan_id, us.status, p.monthly_allowance_credits
  INTO v_plan_id, v_status, v_allowance
  FROM public.user_subscriptions us
  JOIN public.plans p ON p.id = us.plan_id
  WHERE us.user_id = v_uid;

  IF NOT FOUND THEN
    -- Auto-provision free
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (v_uid, 'free', 'active');
    INSERT INTO public.user_credit_wallet (user_id)
    VALUES (v_uid);
    v_plan_id := 'free';
    v_status := 'active';
    v_allowance := 20;
  END IF;

  -- Gold unlimited: allow without decrement
  IF v_status = 'active' AND v_allowance IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'cost', v_cost,
      'used_from_monthly', 0,
      'used_from_purchased', 0,
      'remaining_monthly', -1,
      'purchased_balance', (SELECT purchased_balance FROM public.user_credit_wallet WHERE user_id = v_uid),
      'plan_id', v_plan_id
    );
  END IF;

  -- Free tier: lock wallet
  SELECT monthly_used, monthly_period_start, monthly_period_end, purchased_balance
  INTO v_monthly_used, v_period_start, v_period_end, v_purchased
  FROM public.user_credit_wallet
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_credit_wallet (user_id)
    VALUES (v_uid);
    v_monthly_used := 0;
    v_period_start := now();
    v_period_end := now() + interval '1 month';
    v_purchased := 0;
  END IF;

  -- Reset if period expired
  IF now() >= v_period_end THEN
    v_monthly_used := 0;
    v_period_start := v_period_end;
    v_period_end := v_period_end + interval '1 month';
  END IF;

  -- Use allowance (default 20)
  IF v_allowance IS NULL THEN v_allowance := 20; END IF;
  v_available_monthly := GREATEST(0, v_allowance - v_monthly_used);
  v_take_monthly := LEAST(v_cost, v_available_monthly);
  v_remainder := v_cost - v_take_monthly;

  IF v_remainder > v_purchased THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'INSUFFICIENT_CREDITS',
      'cost', v_cost,
      'used_from_monthly', 0,
      'used_from_purchased', 0,
      'remaining_monthly', v_available_monthly,
      'purchased_balance', v_purchased,
      'plan_id', v_plan_id
    );
  END IF;

  -- Decrement
  UPDATE public.user_credit_wallet
  SET
    monthly_used = v_monthly_used + v_take_monthly,
    monthly_period_start = v_period_start,
    monthly_period_end = v_period_end,
    purchased_balance = v_purchased - v_remainder,
    updated_at = now()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'cost', v_cost,
    'used_from_monthly', v_take_monthly,
    'used_from_purchased', v_remainder,
    'remaining_monthly', v_available_monthly - v_take_monthly,
    'purchased_balance', v_purchased - v_remainder,
    'plan_id', v_plan_id
  );
END;
$$;
