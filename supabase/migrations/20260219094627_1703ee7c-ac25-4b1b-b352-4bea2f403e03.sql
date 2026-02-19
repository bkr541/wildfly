
-- Drop junction/child tables first to avoid FK conflicts
DROP TABLE IF EXISTS public.artist_genres;
DROP TABLE IF EXISTS public.user_events;
DROP TABLE IF EXISTS public.user_favorite_genres;
DROP TABLE IF EXISTS public.user_favorite_artists;
DROP TABLE IF EXISTS public.user_favorite_locations;

-- Then drop parent tables
DROP TABLE IF EXISTS public.artists;
DROP TABLE IF EXISTS public.genres;
