-- Production Readiness Patch 1: the shared provider cache is a server-owned
-- implementation detail. Browser roles must never be able to enumerate or
-- mutate globally shared cache entries.

ALTER TABLE public.flight_search_cache ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'flight_search_cache'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.flight_search_cache',
      policy_row.policyname
    );
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE public.flight_search_cache FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.flight_search_cache FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.flight_search_cache FROM authenticated;
GRANT ALL PRIVILEGES ON TABLE public.flight_search_cache TO service_role;

-- Existing rows were writable by authenticated clients and therefore cannot be
-- trusted after this boundary is introduced. Rebuild the cache from provider
-- responses obtained by trusted server code.
TRUNCATE TABLE public.flight_search_cache;

ALTER TABLE public.flight_search_cache
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payload_version smallint,
  ADD COLUMN IF NOT EXISTS payload_size_bytes integer,
  ADD COLUMN IF NOT EXISTS payload_sha256 text;

ALTER TABLE public.flight_search_cache
  DROP CONSTRAINT IF EXISTS flight_search_cache_payload_size_check,
  DROP CONSTRAINT IF EXISTS flight_search_cache_payload_sha256_check,
  DROP CONSTRAINT IF EXISTS flight_search_cache_ready_payload_check,
  DROP CONSTRAINT IF EXISTS flight_search_cache_canonical_request_check;

ALTER TABLE public.flight_search_cache
  ADD CONSTRAINT flight_search_cache_payload_size_check
    CHECK (
      payload_size_bytes IS NULL
      OR payload_size_bytes BETWEEN 2 AND 4000000
    ),
  ADD CONSTRAINT flight_search_cache_payload_sha256_check
    CHECK (
      payload_sha256 IS NULL
      OR payload_sha256 ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT flight_search_cache_ready_payload_check
    CHECK (
      status <> 'ready'
      OR (
        payload IS NOT NULL
        AND expires_at IS NOT NULL
        AND payload_version = 1
        AND payload_size_bytes IS NOT NULL
        AND payload_sha256 IS NOT NULL
      )
    ),
  ADD CONSTRAINT flight_search_cache_canonical_request_check
    CHECK (jsonb_typeof(canonical_request) = 'object');

CREATE INDEX IF NOT EXISTS idx_flight_search_cache_ready_expiry
  ON public.flight_search_cache (cache_key, reset_bucket, expires_at DESC)
  WHERE status = 'ready';

COMMENT ON TABLE public.flight_search_cache IS
  'Server-owned shared provider-response cache. Only trusted service-role code may read or write it.';
COMMENT ON COLUMN public.flight_search_cache.canonical_request IS
  'Normalized request constructed by trusted server code; never accepted as a client-selected cache key.';
COMMENT ON COLUMN public.flight_search_cache.payload IS
  'Versioned provider-response envelope validated and written by the trusted flight cache service.';
COMMENT ON COLUMN public.flight_search_cache.expires_at IS
  'Absolute cache expiry. Expired records are never returned as valid hits.';
