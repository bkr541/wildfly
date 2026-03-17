-- Allow authenticated users to read user_info rows where is_discoverable = true.
-- This is required for the friend search feature to return results.
-- Without this policy, RLS restricts every user to only reading their own row.

CREATE POLICY "Discoverable users are searchable"
  ON public.user_info FOR SELECT
  USING (is_discoverable = true);
