
-- Enable RLS on flight_search_cache - service role only access
ALTER TABLE public.flight_search_cache ENABLE ROW LEVEL SECURITY;

-- Block all public/anon access - only service role (edge functions) can access
CREATE POLICY "Service role only - no public access" ON public.flight_search_cache
  FOR ALL USING (false);
