-- Track which auth user was provisioned for each beta application
ALTER TABLE public.beta_applications
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS beta_applications_auth_user_id_key
  ON public.beta_applications (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
