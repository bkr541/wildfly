
-- Create function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  notifications_master boolean NOT NULL DEFAULT false,
  notif_gowild_availability boolean NOT NULL DEFAULT false,
  notif_new_route_alerts boolean NOT NULL DEFAULT false,
  notif_pass_sale_alerts boolean NOT NULL DEFAULT false,
  notif_new_feature_announcements boolean NOT NULL DEFAULT true,
  theme_preference text NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('system', 'light', 'dark')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
ON public.user_settings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = user_settings.user_id
    AND users.auth_user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
ON public.user_settings FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = user_settings.user_id
    AND users.auth_user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
ON public.user_settings FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = user_settings.user_id
    AND users.auth_user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
CREATE POLICY "Users can delete own settings"
ON public.user_settings FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = user_settings.user_id
    AND users.auth_user_id = auth.uid()
));

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
