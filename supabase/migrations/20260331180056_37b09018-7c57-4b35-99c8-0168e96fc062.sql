
CREATE TABLE public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  config_key text NOT NULL,
  config_value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, config_key)
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only developer-allowlisted users can access their own config
CREATE POLICY "Devs can select own config"
  ON public.app_config FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can insert own config"
  ON public.app_config FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can update own config"
  ON public.app_config FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE POLICY "Devs can delete own config"
  ON public.app_config FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid())
  );

CREATE TRIGGER set_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
