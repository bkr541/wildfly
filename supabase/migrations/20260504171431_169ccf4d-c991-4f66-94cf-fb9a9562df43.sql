
-- 1. Drop the policy that exposes all PII to authenticated users
DROP POLICY IF EXISTS "Discoverable users are searchable" ON public.user_info;

-- 2. Public-safe view for user search/discovery (only safe fields, only discoverable users)
CREATE OR REPLACE VIEW public.user_public_profiles AS
SELECT
  auth_user_id,
  username,
  display_name,
  first_name,
  last_name,
  avatar_url,
  home_city,
  home_airport,
  is_discoverable
FROM public.user_info
WHERE is_discoverable = true;

-- View runs as definer (owner=postgres) and bypasses base-table RLS,
-- but exposes only safe columns. Grant read to authenticated only.
REVOKE ALL ON public.user_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.user_public_profiles TO authenticated;

-- 3. Security-definer function so users can fetch safe profile fields for
--    their friends (even non-discoverable ones) and for themselves.
CREATE OR REPLACE FUNCTION public.get_friend_profiles(_user_ids uuid[])
RETURNS TABLE (
  auth_user_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  avatar_url text,
  home_city text,
  home_airport text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ui.auth_user_id,
    ui.username::text,
    ui.display_name,
    ui.first_name::text,
    ui.last_name::text,
    ui.avatar_url,
    ui.home_city,
    ui.home_airport
  FROM public.user_info ui
  WHERE ui.auth_user_id = ANY(_user_ids)
    AND (
      ui.auth_user_id = auth.uid()
      OR public.are_friends(auth.uid(), ui.auth_user_id)
      OR EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE (fr.requester_user_id = auth.uid() AND fr.recipient_user_id = ui.auth_user_id)
           OR (fr.recipient_user_id = auth.uid() AND fr.requester_user_id = ui.auth_user_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_friend_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_profiles(uuid[]) TO authenticated;
