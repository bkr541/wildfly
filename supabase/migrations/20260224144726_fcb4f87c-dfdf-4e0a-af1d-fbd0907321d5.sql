ALTER TABLE public.developer_settings
ADD COLUMN IF NOT EXISTS enabled_debug_components text[] NOT NULL DEFAULT '{}';