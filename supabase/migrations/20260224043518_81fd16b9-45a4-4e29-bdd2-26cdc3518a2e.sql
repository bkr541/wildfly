
-- ============================================================
-- 1) SHARED: updated_at trigger function (reusable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- 2) USER_SETTINGS
-- ============================================================

-- Drop old table (incompatible schema: integer user_id → uuid user_id)
DROP TABLE IF EXISTS public.user_settings CASCADE;

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT false,
  notify_gowild_availability boolean NOT NULL DEFAULT false,
  notify_new_routes boolean NOT NULL DEFAULT false,
  notify_pass_sales boolean NOT NULL DEFAULT false,
  notify_new_features boolean NOT NULL DEFAULT true,
  theme_preference text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Theme constraint via validation trigger (not CHECK, per guidelines)
CREATE OR REPLACE FUNCTION public.validate_theme_preference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.theme_preference NOT IN ('system', 'light', 'dark') THEN
    RAISE EXCEPTION 'theme_preference must be system, light, or dark';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_theme_preference
  BEFORE INSERT OR UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_theme_preference();

-- updated_at trigger
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3) DEVELOPER_ALLOWLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.developer_allowlist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.developer_allowlist ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage the allowlist (no public access)

-- ============================================================
-- 4) DEVELOPER_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.developer_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  debug_enabled boolean NOT NULL DEFAULT false,
  show_raw_payload boolean NOT NULL DEFAULT false,
  log_level text NOT NULL DEFAULT 'error',
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Log level constraint via validation trigger
CREATE OR REPLACE FUNCTION public.validate_log_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.log_level NOT IN ('off', 'error', 'info', 'debug') THEN
    RAISE EXCEPTION 'log_level must be off, error, info, or debug';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_log_level
  BEFORE INSERT OR UPDATE ON public.developer_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_log_level();

-- updated_at trigger (reuse shared function)
CREATE TRIGGER trg_developer_settings_updated_at
  BEFORE UPDATE ON public.developer_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.developer_settings ENABLE ROW LEVEL SECURITY;

-- ── Version B: Allowlist-gated access (recommended) ──
CREATE POLICY "Devs can select own settings (allowlisted)"
  ON public.developer_settings FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE developer_allowlist.user_id = auth.uid())
  );

CREATE POLICY "Devs can insert own settings (allowlisted)"
  ON public.developer_settings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE developer_allowlist.user_id = auth.uid())
  );

CREATE POLICY "Devs can update own settings (allowlisted)"
  ON public.developer_settings FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE developer_allowlist.user_id = auth.uid())
  );
