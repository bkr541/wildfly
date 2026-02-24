CREATE POLICY "Users can check their own allowlist entry"
ON public.developer_allowlist
FOR SELECT
USING (auth.uid() = user_id);