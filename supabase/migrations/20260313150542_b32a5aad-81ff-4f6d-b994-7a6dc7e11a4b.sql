
-- Drop the overly permissive INSERT and UPDATE policies
DROP POLICY IF EXISTS "System can insert subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

-- Restrict INSERT: users can only insert their own row with plan_id = 'free' and status = 'active'
CREATE POLICY "Users can self-provision free subscription"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND plan_id = 'free'
    AND status = 'active'
  );

-- Restrict UPDATE: freeze all privileged columns — plan_id, status, stripe_* can only be changed by service role (stripe-webhook)
CREATE POLICY "Users cannot modify privileged subscription fields"
  ON public.user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND plan_id = (SELECT s.plan_id FROM public.user_subscriptions s WHERE s.user_id = auth.uid())
    AND status = (SELECT s.status FROM public.user_subscriptions s WHERE s.user_id = auth.uid())
    AND (stripe_customer_id IS NOT DISTINCT FROM (SELECT s.stripe_customer_id FROM public.user_subscriptions s WHERE s.user_id = auth.uid()))
    AND (stripe_subscription_id IS NOT DISTINCT FROM (SELECT s.stripe_subscription_id FROM public.user_subscriptions s WHERE s.user_id = auth.uid()))
    AND (stripe_price_id IS NOT DISTINCT FROM (SELECT s.stripe_price_id FROM public.user_subscriptions s WHERE s.user_id = auth.uid()))
  );
