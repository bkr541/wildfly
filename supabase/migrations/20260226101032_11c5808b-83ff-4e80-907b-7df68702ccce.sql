-- Allow authenticated users to insert and update flight_search_cache (client-side cache writes)
CREATE POLICY "Authenticated users can write cache"
  ON public.flight_search_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cache"
  ON public.flight_search_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);