ALTER TABLE public.flight_searches
  ADD COLUMN IF NOT EXISTS gowild_found boolean,
  ADD COLUMN IF NOT EXISTS flight_results_count integer;