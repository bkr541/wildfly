
-- Add status column to user_info with default 'pending'
ALTER TABLE public.user_info
ADD COLUMN status character varying NOT NULL DEFAULT 'pending';

-- Set all existing users to 'current' so they aren't locked out
UPDATE public.user_info SET status = 'current';
