-- Allow authenticated users to read flight_search_cache (needed for client-side cache hits)
-- The existing "Service role only" policy blocks all client reads, causing every search to hit the API
CREATE POLICY "Authenticated users can read cache"
  ON public.flight_search_cache
  FOR SELECT
  TO authenticated
  USING (true);