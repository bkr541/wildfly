-- Allow developer_allowlist members to read all beta_feedback rows.
-- Admin writes still go through service-role (edge functions); this covers read-only admin views.
CREATE POLICY "bf_admin_select"
  ON public.beta_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()
    )
  );
