-- Create route_favorites table for storing user favorite routes
CREATE TABLE public.route_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  origin_iata TEXT NOT NULL,
  dest_iata TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, origin_iata, dest_iata)
);

-- Enable RLS
ALTER TABLE public.route_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view own route favorites"
  ON public.route_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert own route favorites"
  ON public.route_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete own route favorites"
  ON public.route_favorites FOR DELETE
  USING (auth.uid() = user_id);