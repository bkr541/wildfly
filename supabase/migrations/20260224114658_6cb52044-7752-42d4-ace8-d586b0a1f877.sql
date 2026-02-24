
-- Allow the SECURITY DEFINER trigger/RPC to insert rows (already handled by SECURITY DEFINER)
-- But add explicit INSERT policies for completeness so the linter is happy
CREATE POLICY "System can insert subscription" ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert wallet" ON public.user_credit_wallet
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Block all writes on plans (read-only reference table)
CREATE POLICY "Plans are read only" ON public.plans
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Plans update blocked" ON public.plans
  FOR UPDATE USING (false);
CREATE POLICY "Plans delete blocked" ON public.plans
  FOR DELETE USING (false);

-- Provision existing users who don't have subscription/wallet rows yet
INSERT INTO public.user_subscriptions (user_id, plan_id, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_credit_wallet (user_id, monthly_used, monthly_period_start, monthly_period_end, purchased_balance)
SELECT id, 0, now(), now() + interval '1 month', 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
