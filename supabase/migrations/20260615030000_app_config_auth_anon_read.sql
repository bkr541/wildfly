-- The signup-control config keys (auth_registration_enabled, auth_oauth_login,
-- auth_oauth_signup) are read by the login screen before any user is
-- authenticated. The existing SELECT policy gates on developer_allowlist, so
-- anonymous callers always get zero rows and fall back to hardcoded defaults —
-- causing the UI to ignore whatever the admin has configured.
--
-- This policy adds a narrow anonymous-read exception for exactly those three
-- keys. They carry no secrets (just booleans / provider lists), so exposing
-- them to unauthenticated visitors is safe.

CREATE POLICY "anon_read_auth_config_keys"
  ON public.app_config
  FOR SELECT
  TO anon, authenticated
  USING (
    user_id IS NULL
    AND config_key IN (
      'auth_registration_enabled',
      'auth_oauth_login',
      'auth_oauth_signup'
    )
  );
