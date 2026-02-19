
-- 1. Add auth_user_id column to users
ALTER TABLE public.users ADD COLUMN auth_user_id uuid UNIQUE;

-- 2. Make password nullable
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;

-- 3. Drop all existing RLS policies on users
DROP POLICY IF EXISTS "Users can read own row" ON public.users;
DROP POLICY IF EXISTS "Allow insert users" ON public.users;
DROP POLICY IF EXISTS "Allow delete users" ON public.users;

-- 4. Create new RLS policies for users based on auth_user_id
CREATE POLICY "Users can select own row"
  ON public.users FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own row"
  ON public.users FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update own row"
  ON public.users FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can delete own row"
  ON public.users FOR DELETE
  USING (auth_user_id = auth.uid());

-- 5. Create a security definer function to check user ownership
CREATE OR REPLACE FUNCTION public.is_owner_of_user_row(_user_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _user_id
      AND auth_user_id = auth.uid()
  );
$$;

-- 6. Update user_events policies
DROP POLICY IF EXISTS "Users read own events" ON public.user_events;
DROP POLICY IF EXISTS "Allow insert user_events" ON public.user_events;
DROP POLICY IF EXISTS "Allow delete user_events" ON public.user_events;

CREATE POLICY "Users select own events"
  ON public.user_events FOR SELECT
  USING (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users insert own events"
  ON public.user_events FOR INSERT
  WITH CHECK (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users delete own events"
  ON public.user_events FOR DELETE
  USING (public.is_owner_of_user_row(user_id));

-- 7. Update user_flights policies
DROP POLICY IF EXISTS "Users read own flights" ON public.user_flights;
DROP POLICY IF EXISTS "Allow insert user_flights" ON public.user_flights;
DROP POLICY IF EXISTS "Allow delete user_flights" ON public.user_flights;

CREATE POLICY "Users select own flights"
  ON public.user_flights FOR SELECT
  USING (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users insert own flights"
  ON public.user_flights FOR INSERT
  WITH CHECK (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users delete own flights"
  ON public.user_flights FOR DELETE
  USING (public.is_owner_of_user_row(user_id));

-- 8. Update user_favorite_artists policies
DROP POLICY IF EXISTS "Users read own fav artists" ON public.user_favorite_artists;
DROP POLICY IF EXISTS "Allow insert user_fav_artists" ON public.user_favorite_artists;
DROP POLICY IF EXISTS "Allow delete user_fav_artists" ON public.user_favorite_artists;

CREATE POLICY "Users select own fav artists"
  ON public.user_favorite_artists FOR SELECT
  USING (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users insert own fav artists"
  ON public.user_favorite_artists FOR INSERT
  WITH CHECK (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users delete own fav artists"
  ON public.user_favorite_artists FOR DELETE
  USING (public.is_owner_of_user_row(user_id));

-- 9. Update user_favorite_genres policies
DROP POLICY IF EXISTS "Users read own fav genres" ON public.user_favorite_genres;
DROP POLICY IF EXISTS "Allow insert user_fav_genres" ON public.user_favorite_genres;
DROP POLICY IF EXISTS "Allow delete user_fav_genres" ON public.user_favorite_genres;

CREATE POLICY "Users select own fav genres"
  ON public.user_favorite_genres FOR SELECT
  USING (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users insert own fav genres"
  ON public.user_favorite_genres FOR INSERT
  WITH CHECK (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users delete own fav genres"
  ON public.user_favorite_genres FOR DELETE
  USING (public.is_owner_of_user_row(user_id));

-- 10. Update user_favorite_locations policies
DROP POLICY IF EXISTS "Users read own fav locations" ON public.user_favorite_locations;
DROP POLICY IF EXISTS "Allow insert user_fav_locations" ON public.user_favorite_locations;
DROP POLICY IF EXISTS "Allow delete user_fav_locations" ON public.user_favorite_locations;

CREATE POLICY "Users select own fav locations"
  ON public.user_favorite_locations FOR SELECT
  USING (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users insert own fav locations"
  ON public.user_favorite_locations FOR INSERT
  WITH CHECK (public.is_owner_of_user_row(user_id));

CREATE POLICY "Users delete own fav locations"
  ON public.user_favorite_locations FOR DELETE
  USING (public.is_owner_of_user_row(user_id));
