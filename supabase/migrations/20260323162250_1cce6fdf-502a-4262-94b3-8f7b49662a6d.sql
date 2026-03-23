
-- Add signup_type column to user_info
ALTER TABLE public.user_info
  ADD COLUMN IF NOT EXISTS signup_type character varying NOT NULL DEFAULT 'Email';

-- Backfill all existing records with 'Email'
UPDATE public.user_info SET signup_type = 'Email' WHERE signup_type IS NULL OR signup_type = '';

-- Add a check constraint to limit to valid values
ALTER TABLE public.user_info
  ADD CONSTRAINT user_info_signup_type_check
  CHECK (signup_type IN ('Email', 'Google', 'Apple'));
