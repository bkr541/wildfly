
ALTER TABLE public.developer_settings
  ADD COLUMN IF NOT EXISTS logging_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled_component_logging text[] NOT NULL DEFAULT '{}'::text[];
