-- The saveConfigKey helper was inserting auth config rows with user_id set to
-- the calling developer's ID. The INSERT and SELECT policies both require
-- user_id IS NULL for global config, so those rows were invisible on reload
-- and to anonymous visitors. This migration clears user_id on the three auth
-- control keys so they satisfy all existing policies.
UPDATE public.app_config
SET user_id = NULL
WHERE config_key IN (
  'auth_registration_enabled',
  'auth_oauth_login',
  'auth_oauth_signup'
)
AND user_id IS NOT NULL;
