
-- Rename the table
ALTER TABLE public.users RENAME TO userinfo;

-- Drop and recreate RLS policies (they reference the old table name internally)
DROP POLICY IF EXISTS "Users can select own row" ON public.userinfo;
DROP POLICY IF EXISTS "Users can insert own row" ON public.userinfo;
DROP POLICY IF EXISTS "Users can update own row" ON public.userinfo;
DROP POLICY IF EXISTS "Users can delete own row" ON public.userinfo;

CREATE POLICY "Users can select own row" ON public.userinfo FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Users can insert own row" ON public.userinfo FOR INSERT WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users can update own row" ON public.userinfo FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY "Users can delete own row" ON public.userinfo FOR DELETE USING (auth_user_id = auth.uid());

-- Recreate the is_owner_of_user_row function to reference userinfo
CREATE OR REPLACE FUNCTION public.is_owner_of_user_row(_user_id integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.userinfo
    WHERE id = _user_id
      AND auth_user_id = auth.uid()
  );
$function$;

-- Recreate the auth user deleted handler
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.userinfo WHERE auth_user_id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Update RLS policies on user_locations that reference users table
DROP POLICY IF EXISTS "Users can view own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can insert own locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON public.user_locations;

CREATE POLICY "Users can view own locations" ON public.user_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM userinfo WHERE userinfo.id = user_locations.user_id AND userinfo.auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own locations" ON public.user_locations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM userinfo WHERE userinfo.id = user_locations.user_id AND userinfo.auth_user_id = auth.uid()));
CREATE POLICY "Users can delete own locations" ON public.user_locations FOR DELETE
  USING (EXISTS (SELECT 1 FROM userinfo WHERE userinfo.id = user_locations.user_id AND userinfo.auth_user_id = auth.uid()));

-- Update RLS policies on user_settings that reference users table
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM userinfo WHERE userinfo.id = user_settings.user_id AND userinfo.auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM userinfo WHERE userinfo.id = user_settings.user_id AND userinfo.auth_user_id = auth.uid()));
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM userinfo WHERE userinfo.id = user_settings.user_id AND userinfo.auth_user_id = auth.uid()));
CREATE POLICY "Users can delete own settings" ON public.user_settings FOR DELETE
  USING (EXISTS (SELECT 1 FROM userinfo WHERE userinfo.id = user_settings.user_id AND userinfo.auth_user_id = auth.uid()));
