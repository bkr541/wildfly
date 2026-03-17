-- Allow authenticated users to read rows of discoverable users
-- This enables the user search feature in the Friends UI
CREATE POLICY "Discoverable users are searchable"
  ON public.user_info
  FOR SELECT
  TO authenticated
  USING (is_discoverable = true);