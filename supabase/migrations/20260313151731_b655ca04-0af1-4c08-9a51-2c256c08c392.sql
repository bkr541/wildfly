-- Drop the overly permissive INSERT and UPDATE policies
DROP POLICY IF EXISTS "System can insert wallet" ON public.user_credit_wallet;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.user_credit_wallet;

-- Restrict INSERT: users can only insert with default/zero values for financial fields
CREATE POLICY "Users can only create empty wallet"
  ON public.user_credit_wallet
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND purchased_balance = 0
    AND monthly_used = 0
  );

-- Restrict UPDATE: users cannot modify financial columns (purchased_balance, monthly_used, monthly_period_*)
-- Only updated_at can be changed by users (for timestamp tracking)
CREATE POLICY "Users cannot modify credit balances"
  ON public.user_credit_wallet
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND purchased_balance = (SELECT w.purchased_balance FROM public.user_credit_wallet w WHERE w.user_id = auth.uid())
    AND monthly_used = (SELECT w.monthly_used FROM public.user_credit_wallet w WHERE w.user_id = auth.uid())
    AND monthly_period_start = (SELECT w.monthly_period_start FROM public.user_credit_wallet w WHERE w.user_id = auth.uid())
    AND monthly_period_end = (SELECT w.monthly_period_end FROM public.user_credit_wallet w WHERE w.user_id = auth.uid())
  );
