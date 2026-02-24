
CREATE TABLE public.flight_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  search_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT,
  departure_date DATE NOT NULL,
  return_date DATE,
  trip_type TEXT NOT NULL,
  all_destinations TEXT NOT NULL DEFAULT 'No',
  json_body JSONB
);

ALTER TABLE public.flight_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own searches"
ON public.flight_searches FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own searches"
ON public.flight_searches FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own searches"
ON public.flight_searches FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_flight_searches_user_id ON public.flight_searches (user_id);
CREATE INDEX idx_flight_searches_timestamp ON public.flight_searches (search_timestamp DESC);
