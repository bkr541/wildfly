-- ============================================================
-- Frontier Market Layer
-- Adds Frontier-specific metadata to airports, snapshot log
-- table, directed route-pair table, views, indexes, and RLS.
-- Safe to re-run: uses IF NOT EXISTS / DO blocks throughout.
-- ============================================================


-- ── 1. airports: add Frontier metadata columns ───────────────

ALTER TABLE public.airports
  ADD COLUMN IF NOT EXISTS frontier_source         text,
  ADD COLUMN IF NOT EXISTS frontier_last_seen_at   timestamptz,
  ADD COLUMN IF NOT EXISTS frontier_image_url      text,
  ADD COLUMN IF NOT EXISTS metadata_status         text NOT NULL DEFAULT 'verified';

-- metadata_status check constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname     = 'airports_metadata_status_check'
      AND conrelid    = 'public.airports'::regclass
  ) THEN
    ALTER TABLE public.airports
      ADD CONSTRAINT airports_metadata_status_check
      CHECK (metadata_status IN ('verified', 'needs_review', 'auto_created'));
  END IF;
END $$;


-- ── 2. frontier_market_snapshots ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.frontier_market_snapshots (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type        text        NOT NULL DEFAULT 'local_market_offerings_json',
  source_path        text,
  source_checksum    text,
  raw_json           jsonb       NOT NULL,
  station_count      integer     NOT NULL DEFAULT 0,
  origin_count       integer     NOT NULL DEFAULT 0,
  route_pair_count   integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);


-- ── 3. frontier_routes ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.frontier_routes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_iata       varchar(3)  NOT NULL,
  destination_iata  varchar(3)  NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_snapshot_id  uuid        REFERENCES public.frontier_market_snapshots(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT frontier_routes_unique_pair
    UNIQUE (origin_iata, destination_iata),
  CONSTRAINT frontier_routes_origin_iata_check
    CHECK (origin_iata = upper(origin_iata) AND length(origin_iata) = 3),
  CONSTRAINT frontier_routes_dest_iata_check
    CHECK (destination_iata = upper(destination_iata) AND length(destination_iata) = 3)
);


-- ── 4. Indexes ───────────────────────────────────────────────

-- frontier_routes: active routes by origin
CREATE INDEX IF NOT EXISTS idx_frontier_routes_active_origin
  ON public.frontier_routes (origin_iata)
  WHERE is_active = true;

-- frontier_routes: active routes by destination
CREATE INDEX IF NOT EXISTS idx_frontier_routes_active_destination
  ON public.frontier_routes (destination_iata)
  WHERE is_active = true;

-- frontier_routes: by snapshot FK
CREATE INDEX IF NOT EXISTS idx_frontier_routes_snapshot_id
  ON public.frontier_routes (last_snapshot_id);

-- airports: by is_active
CREATE INDEX IF NOT EXISTS idx_airports_is_active
  ON public.airports (is_active);

-- airports: by frontier_last_seen_at
CREATE INDEX IF NOT EXISTS idx_airports_frontier_last_seen_at
  ON public.airports (frontier_last_seen_at);


-- ── 5. updated_at trigger (reuse shared handle_updated_at) ───

DROP TRIGGER IF EXISTS set_frontier_routes_updated_at ON public.frontier_routes;
CREATE TRIGGER set_frontier_routes_updated_at
  BEFORE UPDATE ON public.frontier_routes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── 6. Views ─────────────────────────────────────────────────

-- Aggregated route map: one row per origin, destinations as array
CREATE OR REPLACE VIEW public.frontier_active_route_map
  WITH (security_invoker = true)
AS
SELECT
  origin_iata,
  array_agg(destination_iata ORDER BY destination_iata) AS destinations
FROM  public.frontier_routes
WHERE is_active = true
GROUP BY origin_iata;

-- Active airports joined with location metadata
CREATE OR REPLACE VIEW public.frontier_active_airports
  WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.name,
  a.iata_code,
  a.icao_code,
  a.latitude,
  a.longitude,
  a.timezone,
  a.is_hub,
  a.is_active,
  a.frontier_source,
  a.frontier_last_seen_at,
  a.frontier_image_url,
  a.metadata_status,
  a.location_id,
  l.name       AS location_name,
  l.city,
  l.state,
  l.state_code,
  l.region,
  l.country
FROM  public.airports  a
LEFT JOIN public.locations l ON l.id = a.location_id
WHERE a.is_active = true;

-- Grant view access to authenticated users
GRANT SELECT ON public.frontier_active_route_map TO authenticated;
GRANT SELECT ON public.frontier_active_airports  TO authenticated;


-- ── 7. RLS ───────────────────────────────────────────────────

-- frontier_routes: authenticated users can read, no client writes
ALTER TABLE public.frontier_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read frontier routes"
  ON public.frontier_routes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "No client insert frontier routes"
  ON public.frontier_routes FOR INSERT
  TO public WITH CHECK (false);

CREATE POLICY "No client update frontier routes"
  ON public.frontier_routes FOR UPDATE
  TO public USING (false);

CREATE POLICY "No client delete frontier routes"
  ON public.frontier_routes FOR DELETE
  TO public USING (false);

-- frontier_market_snapshots: developer-only read, no client writes
ALTER TABLE public.frontier_market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read frontier snapshots"
  ON public.frontier_market_snapshots
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.developer_allowlist
    WHERE developer_allowlist.user_id = auth.uid()
  ));

CREATE POLICY "No client insert frontier snapshots"
  ON public.frontier_market_snapshots FOR INSERT
  TO public WITH CHECK (false);

CREATE POLICY "No client update frontier snapshots"
  ON public.frontier_market_snapshots FOR UPDATE
  TO public USING (false);

CREATE POLICY "No client delete frontier snapshots"
  ON public.frontier_market_snapshots FOR DELETE
  TO public USING (false);
