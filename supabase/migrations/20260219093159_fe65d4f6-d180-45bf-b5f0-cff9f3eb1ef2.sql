
-- Fix overly permissive INSERT/DELETE on reference tables (keep SELECT true for public read)

-- airports
DROP POLICY IF EXISTS "Allow delete airports" ON public.airports;
DROP POLICY IF EXISTS "Allow insert airports" ON public.airports;
CREATE POLICY "No public delete airports" ON public.airports FOR DELETE USING (false);
CREATE POLICY "No public insert airports" ON public.airports FOR INSERT WITH CHECK (false);

-- artists
DROP POLICY IF EXISTS "Allow delete artists" ON public.artists;
DROP POLICY IF EXISTS "Allow insert artists" ON public.artists;
CREATE POLICY "No public delete artists" ON public.artists FOR DELETE USING (false);
CREATE POLICY "No public insert artists" ON public.artists FOR INSERT WITH CHECK (false);

-- genres
DROP POLICY IF EXISTS "Allow delete genres" ON public.genres;
DROP POLICY IF EXISTS "Allow insert genres" ON public.genres;
CREATE POLICY "No public delete genres" ON public.genres FOR DELETE USING (false);
CREATE POLICY "No public insert genres" ON public.genres FOR INSERT WITH CHECK (false);

-- locations
DROP POLICY IF EXISTS "Allow delete locations" ON public.locations;
DROP POLICY IF EXISTS "Allow insert locations" ON public.locations;
CREATE POLICY "No public delete locations" ON public.locations FOR DELETE USING (false);
CREATE POLICY "No public insert locations" ON public.locations FOR INSERT WITH CHECK (false);

-- artist_genres
DROP POLICY IF EXISTS "Allow delete artist_genres" ON public.artist_genres;
DROP POLICY IF EXISTS "Allow insert artist_genres" ON public.artist_genres;
CREATE POLICY "No public delete artist_genres" ON public.artist_genres FOR DELETE USING (false);
CREATE POLICY "No public insert artist_genres" ON public.artist_genres FOR INSERT WITH CHECK (false);
