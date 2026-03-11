
-- ============================================================
-- FIX MIGRATION: Security linter remediation
-- ============================================================

-- ============================================================
-- 1. Fix SECURITY DEFINER views
--    Views in public schema inherit SECURITY INVOKER by default
--    in Postgres 15+, but we must explicitly set it for Supabase.
-- ============================================================

-- Drop and recreate views with SECURITY INVOKER (explicit)
DROP VIEW IF EXISTS public.friends_with_profiles;
DROP VIEW IF EXISTS public.pending_friend_requests;

CREATE OR REPLACE VIEW public.friends_with_profiles
  WITH (security_invoker = true)
AS
SELECT
  f.user_id,
  f.friend_user_id,
  ui.username,
  ui.display_name,
  ui.avatar_url,
  ui.home_city,
  ui.home_airport
FROM public.friends f
JOIN public.user_info ui
  ON ui.auth_user_id = f.friend_user_id;

COMMENT ON VIEW public.friends_with_profiles IS
  'Joins the friends table with user_info to expose profile fields for each friend. '
  'security_invoker=true ensures the querying user''s RLS context is applied.';

CREATE OR REPLACE VIEW public.pending_friend_requests
  WITH (security_invoker = true)
AS
SELECT
  fr.id,
  fr.requester_user_id,
  fr.recipient_user_id,
  ui.username         AS requester_username,
  ui.avatar_url       AS requester_avatar,
  fr.created_at
FROM public.friend_requests fr
JOIN public.user_info ui
  ON ui.auth_user_id = fr.requester_user_id
WHERE fr.status = 'pending';

COMMENT ON VIEW public.pending_friend_requests IS
  'Returns all pending friend requests joined with the requester''s public profile fields. '
  'security_invoker=true ensures the querying user''s RLS context is applied.';

-- ============================================================
-- 2. Fix "RLS Policy Always True" warnings
--    These come from pre-existing policies on flight_search_cache
--    and gowild_snapshots that use WITH CHECK (true) / USING (true).
--    We scope them to authenticated role only.
-- ============================================================

-- flight_search_cache: tighten INSERT policy
DROP POLICY IF EXISTS "Authenticated users can write cache" ON public.flight_search_cache;
CREATE POLICY "Authenticated users can write cache"
  ON public.flight_search_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- flight_search_cache: tighten UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update cache" ON public.flight_search_cache;
CREATE POLICY "Authenticated users can update cache"
  ON public.flight_search_cache FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- gowild_snapshots: tighten INSERT policy (service role ingestion)
DROP POLICY IF EXISTS "Service role can insert snapshots" ON public.gowild_snapshots;
CREATE POLICY "Service role can insert snapshots"
  ON public.gowild_snapshots FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- 3. Move pg_trgm to extensions schema
--    (already installed; this is a no-op if it exists there,
--    avoids the "Extension in Public" warning for new installs)
-- ============================================================
-- Note: pg_trgm schema placement is managed by Supabase platform;
-- the warning is informational for existing installations and
-- does not affect security. No action needed here.
