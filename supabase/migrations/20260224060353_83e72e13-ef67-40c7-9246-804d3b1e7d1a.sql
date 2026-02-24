
CREATE TABLE IF NOT EXISTS public.flight_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  reset_bucket timestamptz NOT NULL,
  canonical_request jsonb NOT NULL,
  provider text NOT NULL DEFAULT 'frontier',
  status text NOT NULL DEFAULT 'fetching',
  payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flight_search_cache_provider_check CHECK (provider IN ('frontier')),
  CONSTRAINT flight_search_cache_status_check CHECK (status IN ('fetching', 'ready', 'error')),
  CONSTRAINT flight_search_cache_cache_key_reset_bucket_key UNIQUE (cache_key, reset_bucket)
);

CREATE INDEX IF NOT EXISTS idx_flight_search_cache_key_bucket ON public.flight_search_cache (cache_key, reset_bucket);
CREATE INDEX IF NOT EXISTS idx_flight_search_cache_status ON public.flight_search_cache (status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_flight_search_cache_updated_at ON public.flight_search_cache;
CREATE TRIGGER trg_flight_search_cache_updated_at
  BEFORE UPDATE ON public.flight_search_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
