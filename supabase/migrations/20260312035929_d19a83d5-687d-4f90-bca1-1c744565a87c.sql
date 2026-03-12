
CREATE TABLE public.user_homepage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  component_name VARCHAR(60) NOT NULL,
  "order" SMALLINT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_homepage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own homepage config"
  ON public.user_homepage FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own homepage config"
  ON public.user_homepage FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own homepage config"
  ON public.user_homepage FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own homepage config"
  ON public.user_homepage FOR DELETE
  TO public
  USING (auth.uid() = user_id);

CREATE TRIGGER set_user_homepage_updated_at
  BEFORE UPDATE ON public.user_homepage
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
