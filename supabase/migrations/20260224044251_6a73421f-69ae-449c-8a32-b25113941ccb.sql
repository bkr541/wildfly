
-- Add remember_me column to user_info
ALTER TABLE public.user_info
ADD COLUMN IF NOT EXISTS remember_me boolean NOT NULL DEFAULT false;
