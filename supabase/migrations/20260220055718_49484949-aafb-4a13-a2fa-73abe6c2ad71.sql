-- Drop existing restrictive policies on user_info
DROP POLICY IF EXISTS "Users can select own row" ON public.user_info;
DROP POLICY IF EXISTS "Users can insert own row" ON public.user_info;
DROP POLICY IF EXISTS "Users can update own row" ON public.user_info;
DROP POLICY IF EXISTS "Users can delete own row" ON public.user_info;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can select own row"
  ON public.user_info FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own row"
  ON public.user_info FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update own row"
  ON public.user_info FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can delete own row"
  ON public.user_info FOR DELETE
  USING (auth_user_id = auth.uid());

-- Also fix user_locations policies
DROP POLICY IF EXISTS "Users can view own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can insert own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON public.user_locations;

CREATE POLICY "Users can view own locations"
  ON public.user_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_info WHERE user_info.id = user_locations.user_id AND user_info.auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own locations"
  ON public.user_locations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_info WHERE user_info.id = user_locations.user_id AND user_info.auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own locations"
  ON public.user_locations FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_info WHERE user_info.id = user_locations.user_id AND user_info.auth_user_id = auth.uid()));

-- Also fix user_settings policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own settings"
  ON public.user_settings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));

-- Fix airports and locations too
DROP POLICY IF EXISTS "Anyone can read airports" ON public.airports;
DROP POLICY IF EXISTS "No public delete airports" ON public.airports;
DROP POLICY IF EXISTS "No public insert airports" ON public.airports;

CREATE POLICY "Anyone can read airports" ON public.airports FOR SELECT USING (true);
CREATE POLICY "No public delete airports" ON public.airports FOR DELETE USING (false);
CREATE POLICY "No public insert airports" ON public.airports FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Anyone can read locations" ON public.locations;
DROP POLICY IF EXISTS "No public delete locations" ON public.locations;
DROP POLICY IF EXISTS "No public insert locations" ON public.locations;

CREATE POLICY "Anyone can read locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "No public delete locations" ON public.locations FOR DELETE USING (false);
CREATE POLICY "No public insert locations" ON public.locations FOR INSERT WITH CHECK (false);