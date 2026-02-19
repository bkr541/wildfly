
-- Add mobile_number column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile_number character varying;

-- Create avatar storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create user_locations join table
CREATE TABLE public.user_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id integer NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_locations_unique UNIQUE (user_id, location_id)
);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage their own location favorites
CREATE POLICY "Users can view own locations"
ON public.user_locations FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid())
);

CREATE POLICY "Users can insert own locations"
ON public.user_locations FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid())
);

CREATE POLICY "Users can delete own locations"
ON public.user_locations FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid())
);
