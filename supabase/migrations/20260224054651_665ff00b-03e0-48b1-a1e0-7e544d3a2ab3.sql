
CREATE TABLE public.user_flights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('alert', 'going')),
  flight_json JSONB NOT NULL,
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own user_flights"
ON public.user_flights FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own user_flights"
ON public.user_flights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own user_flights"
ON public.user_flights FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_user_flights_user_id ON public.user_flights (user_id);
CREATE INDEX idx_user_flights_type ON public.user_flights (user_id, type);
