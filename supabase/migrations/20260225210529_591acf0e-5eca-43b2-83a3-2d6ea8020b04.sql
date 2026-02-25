
CREATE POLICY "No public access" ON public.user_info FOR SELECT USING (false);
CREATE POLICY "No public access" ON public.user_subscriptions FOR SELECT USING (false);
