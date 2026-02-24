ALTER TABLE public.flight_search_cache
  ADD COLUMN dep_iata text,
  ADD COLUMN arr_iata text;