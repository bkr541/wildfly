
-- Explicitly deny public/anonymous SELECT access on sensitive tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_info' AND policyname = 'No public access'
  ) THEN
    CREATE POLICY "No public access" ON public.user_info FOR SELECT USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_subscriptions' AND policyname = 'No public access'
  ) THEN
    CREATE POLICY "No public access" ON public.user_subscriptions FOR SELECT USING (false);
  END IF;
END $$;
