-- Allow user_id to be NULL for global (system-level) config entries
ALTER TABLE public.app_config ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing compound unique constraint
ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_user_id_config_key_key;

-- Re-establish uniqueness via two partial indexes:
-- 1. Per-user entries (existing behavior preserved)
CREATE UNIQUE INDEX IF NOT EXISTS app_config_user_key
  ON public.app_config (user_id, config_key)
  WHERE user_id IS NOT NULL;

-- 2. Global entries (one row per config_key with no user)
CREATE UNIQUE INDEX IF NOT EXISTS app_config_global_key
  ON public.app_config (config_key)
  WHERE user_id IS NULL;

-- RLS policies for global config: readable/writable by dev-allowlisted users
CREATE POLICY "Devs can select global config"
  ON public.app_config FOR SELECT
  USING (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can insert global config"
  ON public.app_config FOR INSERT
  WITH CHECK (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can update global config"
  ON public.app_config FOR UPDATE
  USING (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can delete global config"
  ON public.app_config FOR DELETE
  USING (
    user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );
