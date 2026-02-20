
-- Rename the table
ALTER TABLE public.userinfo RENAME TO user_info;

-- Drop and recreate RLS policies
DROP POLICY IF EXISTS "Users can select own row" ON public.user_info;
DROP POLICY IF EXISTS "Users can insert own row" ON public.user_info;
DROP POLICY IF EXISTS "Users can update own row" ON public.user_info;
DROP POLICY IF EXISTS "Users can delete own row" ON public.user_info;

CREATE POLICY "Users can select own row" ON public.user_info FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Users can insert own row" ON public.user_info FOR INSERT WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users can update own row" ON public.user_info FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY "Users can delete own row" ON public.user_info FOR DELETE USING (auth_user_id = auth.uid());

-- Update functions
CREATE OR REPLACE FUNCTION public.is_owner_of_user_row(_user_id integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_info
    WHERE id = _user_id
      AND auth_user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.user_info WHERE auth_user_id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Update user_locations RLS policies
DROP POLICY IF EXISTS "Users can view own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can insert own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON public.user_locations;

CREATE POLICY "Users can view own locations" ON public.user_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_info WHERE user_info.id = user_locations.user_id AND user_info.auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own locations" ON public.user_locations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_info WHERE user_info.id = user_locations.user_id AND user_info.auth_user_id = auth.uid()));
CREATE POLICY "Users can delete own locations" ON public.user_locations FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_info WHERE user_info.id = user_locations.user_id AND user_info.auth_user_id = auth.uid()));

-- Update user_settings RLS policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));
CREATE POLICY "Users can delete own settings" ON public.user_settings FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_info WHERE user_info.id = user_settings.user_id AND user_info.auth_user_id = auth.uid()));
