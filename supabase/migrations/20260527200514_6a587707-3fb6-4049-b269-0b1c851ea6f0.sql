
-- ============================================================
-- 1. flight_snapshots additions
-- ============================================================
ALTER TABLE public.flight_snapshots
  ADD COLUMN IF NOT EXISTS stable_itinerary_key text,
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'returned';

ALTER TABLE public.flight_snapshots
  DROP CONSTRAINT IF EXISTS flight_snapshots_availability_status_check;
ALTER TABLE public.flight_snapshots
  ADD CONSTRAINT flight_snapshots_availability_status_check
  CHECK (availability_status IN ('returned','no_gowild_fare','not_returned'));

-- ============================================================
-- 2. flight_searches additions
-- ============================================================
ALTER TABLE public.flight_searches
  ADD COLUMN IF NOT EXISTS result_source text,
  ADD COLUMN IF NOT EXISTS provider_observed_at timestamptz;

ALTER TABLE public.flight_searches
  DROP CONSTRAINT IF EXISTS flight_searches_result_source_check;
ALTER TABLE public.flight_searches
  ADD CONSTRAINT flight_searches_result_source_check
  CHECK (result_source IS NULL OR result_source IN
    ('live_api','scheduled_bulk_search','admin_bulk_search','cache_hit'));

-- ============================================================
-- 3. Backfill
-- ============================================================
-- Backfill stable_itinerary_key for existing nonstop snapshots that have enough data
UPDATE public.flight_snapshots
SET stable_itinerary_key =
  upper(coalesce(leg_origin_iata,'?')) || '|' ||
  upper(coalesce(leg_destination_iata,'?')) || '|' ||
  upper(coalesce(airline,'?')) || '|' ||
  coalesce(flight_number,'?') || '|' ||
  to_char(departure_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '|' ||
  to_char(arrival_at,   'YYYY-MM-DD"T"HH24:MI:SS')
WHERE stable_itinerary_key IS NULL
  AND coalesce(stops, 0) = 0
  AND departure_at IS NOT NULL
  AND arrival_at IS NOT NULL;

-- Best-effort backfill of result_source / provider_observed_at on flight_searches
UPDATE public.flight_searches
SET result_source = COALESCE(result_source,
      CASE
        WHEN triggered_by = 'scheduled_bulk_search' THEN 'scheduled_bulk_search'
        WHEN triggered_by = 'admin_bulk_search'     THEN 'admin_bulk_search'
        ELSE 'live_api'
      END),
    provider_observed_at = COALESCE(provider_observed_at, search_timestamp)
WHERE result_source IS NULL OR provider_observed_at IS NULL;

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_flight_snapshots_stable_key_time
  ON public.flight_snapshots (stable_itinerary_key, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_flight_snapshots_route_dep
  ON public.flight_snapshots (leg_origin_iata, leg_destination_iata, departure_at);

CREATE INDEX IF NOT EXISTS idx_flight_searches_source_observed
  ON public.flight_searches (result_source, provider_observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_flight_searches_route_date
  ON public.flight_searches (departure_airport, arrival_airport, departure_date);

-- ============================================================
-- 5. RPC: mark disappeared GoWild observations (called after a fresh search)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_disappeared_gowild_observations(
  p_flight_search_id uuid,
  p_origin_iata text,
  p_destination_iata text,        -- NULL when all-destinations search
  p_travel_date date,
  p_returned_stable_keys text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_inserted int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify search ownership (or system/bulk via service_role bypassing RLS not via this RPC)
  SELECT user_id INTO v_owner FROM public.flight_searches WHERE id = p_flight_search_id;
  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'Search not found or not owned by caller';
  END IF;

  -- Find stable keys that were previously available for this comparable scope but
  -- are not in the current returned set. Insert a "not_returned" observation copying
  -- identity fields from the most recent prior observation.
  WITH prior_latest AS (
    SELECT DISTINCT ON (fs.stable_itinerary_key)
      fs.stable_itinerary_key,
      fs.airline, fs.flight_number,
      fs.origin_iata, fs.leg_origin_iata, fs.leg_destination_iata,
      fs.departure_at, fs.arrival_at,
      fs.flight_type, fs.stops, fs.total_duration_display,
      fs.display_cabin, fs.display_price, fs.currency
    FROM public.flight_snapshots fs
    JOIN public.flight_searches fq ON fq.id = fs.flight_search_id
    WHERE fs.stable_itinerary_key IS NOT NULL
      AND fs.leg_origin_iata = upper(p_origin_iata)
      AND (p_destination_iata IS NULL OR fs.leg_destination_iata = upper(p_destination_iata))
      AND fs.departure_at::date = p_travel_date
      AND fq.result_source IN ('live_api','scheduled_bulk_search','admin_bulk_search')
    ORDER BY fs.stable_itinerary_key, fs.snapshot_at DESC
  ),
  to_mark AS (
    SELECT * FROM prior_latest pl
    WHERE pl.stable_itinerary_key <> ALL(coalesce(p_returned_stable_keys, ARRAY[]::text[]))
      AND EXISTS (
        SELECT 1 FROM public.flight_snapshots fs2
        WHERE fs2.stable_itinerary_key = pl.stable_itinerary_key
          AND fs2.has_go_wild = true
          AND fs2.availability_status = 'returned'
      )
  ),
  ins AS (
    INSERT INTO public.flight_snapshots (
      flight_search_id, snapshot_at,
      source_itinerary_id, airline, origin_iata,
      display_cabin, display_price, currency,
      flight_type, stops, total_duration_display,
      leg_index, flight_number, leg_origin_iata, leg_destination_iata,
      departure_at, arrival_at,
      has_go_wild, go_wild_available_seats,
      stable_itinerary_key, availability_status
    )
    SELECT
      p_flight_search_id, now(),
      'disappeared:' || tm.stable_itinerary_key,
      tm.airline, tm.origin_iata,
      tm.display_cabin, tm.display_price, tm.currency,
      tm.flight_type, tm.stops, tm.total_duration_display,
      1, tm.flight_number, tm.leg_origin_iata, tm.leg_destination_iata,
      tm.departure_at, tm.arrival_at,
      false, 0,
      tm.stable_itinerary_key, 'not_returned'
    FROM to_mark tm
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_disappeared_gowild_observations(uuid, text, text, date, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_disappeared_gowild_observations(uuid, text, text, date, text[]) TO service_role;

-- ============================================================
-- 6. RPC: route inventory calendar (per travel_date)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_route_gowild_inventory_calendar(
  p_origin_iata text,
  p_destination_iata text,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  travel_date date,
  available_flights_now int,
  available_seats_now int,
  original_available_flights int,
  original_available_seats int,
  seat_change int,
  lowest_gowild_fare_now numeric,
  lowest_standard_fare_now numeric,
  last_provider_observed_at timestamptz,
  has_observation boolean,
  has_current_gowild_availability boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT fs.*, fq.result_source, fq.provider_observed_at
    FROM public.flight_snapshots fs
    JOIN public.flight_searches fq ON fq.id = fs.flight_search_id
    WHERE fs.leg_origin_iata = upper(p_origin_iata)
      AND fs.leg_destination_iata = upper(p_destination_iata)
      AND fs.stable_itinerary_key IS NOT NULL
      AND fs.departure_at::date BETWEEN p_start_date AND p_end_date
      AND coalesce(fq.result_source,'live_api') <> 'cache_hit'
  ),
  latest_per_key AS (
    SELECT DISTINCT ON (stable_itinerary_key)
      stable_itinerary_key,
      departure_at::date AS td,
      has_go_wild, availability_status, go_wild_available_seats,
      go_wild_total, standard_total,
      coalesce(provider_observed_at, snapshot_at) AS observed_at
    FROM base
    ORDER BY stable_itinerary_key, snapshot_at DESC
  ),
  first_per_key AS (
    SELECT DISTINCT ON (stable_itinerary_key)
      stable_itinerary_key,
      departure_at::date AS td,
      has_go_wild, go_wild_available_seats
    FROM base
    WHERE availability_status = 'returned'
    ORDER BY stable_itinerary_key, snapshot_at ASC
  )
  SELECT
    l.td,
    coalesce(sum(CASE WHEN l.availability_status='returned' AND l.has_go_wild AND coalesce(l.go_wild_available_seats,0) > 0 THEN 1 ELSE 0 END)::int, 0),
    coalesce(sum(CASE WHEN l.availability_status='returned' AND l.has_go_wild THEN coalesce(l.go_wild_available_seats,0) ELSE 0 END)::int, 0),
    coalesce((SELECT count(*)::int FROM first_per_key f WHERE f.td = l.td AND f.has_go_wild), 0),
    coalesce((SELECT sum(coalesce(f.go_wild_available_seats,0))::int FROM first_per_key f WHERE f.td = l.td AND f.has_go_wild), 0),
    (coalesce(sum(CASE WHEN l.availability_status='returned' AND l.has_go_wild THEN coalesce(l.go_wild_available_seats,0) ELSE 0 END)::int, 0)
     - coalesce((SELECT sum(coalesce(f.go_wild_available_seats,0))::int FROM first_per_key f WHERE f.td = l.td AND f.has_go_wild), 0)),
    min(CASE WHEN l.availability_status='returned' AND l.has_go_wild THEN l.go_wild_total END),
    min(CASE WHEN l.availability_status='returned' THEN l.standard_total END),
    max(l.observed_at),
    true,
    bool_or(l.availability_status='returned' AND l.has_go_wild AND coalesce(l.go_wild_available_seats,0) > 0)
  FROM latest_per_key l
  GROUP BY l.td
  ORDER BY l.td;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_route_gowild_inventory_calendar(text, text, date, date) TO authenticated;

-- ============================================================
-- 7. RPC: route inventory day details
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_route_gowild_inventory_day_details(
  p_origin_iata text,
  p_destination_iata text,
  p_travel_date date
)
RETURNS TABLE(
  stable_itinerary_key text,
  departure_at timestamp,
  arrival_at timestamp,
  airline text,
  flight_number text,
  stops smallint,
  total_duration_display text,
  first_seats int,
  current_seats int,
  seat_change int,
  first_observed_at timestamptz,
  latest_observed_at timestamptz,
  latest_availability_status text,
  current_gowild_fare numeric,
  current_standard_fare numeric,
  is_currently_available boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT fs.*, fq.result_source, fq.provider_observed_at
    FROM public.flight_snapshots fs
    JOIN public.flight_searches fq ON fq.id = fs.flight_search_id
    WHERE fs.leg_origin_iata = upper(p_origin_iata)
      AND fs.leg_destination_iata = upper(p_destination_iata)
      AND fs.stable_itinerary_key IS NOT NULL
      AND fs.departure_at::date = p_travel_date
      AND coalesce(fq.result_source,'live_api') <> 'cache_hit'
  ),
  latest AS (
    SELECT DISTINCT ON (stable_itinerary_key)
      stable_itinerary_key,
      departure_at, arrival_at, airline, flight_number, stops, total_duration_display,
      has_go_wild, availability_status, go_wild_available_seats,
      go_wild_total, standard_total,
      coalesce(provider_observed_at, snapshot_at) AS latest_obs
    FROM base
    ORDER BY stable_itinerary_key, snapshot_at DESC
  ),
  first_obs AS (
    SELECT DISTINCT ON (stable_itinerary_key)
      stable_itinerary_key,
      coalesce(go_wild_available_seats, 0) AS first_seats,
      coalesce(provider_observed_at, snapshot_at) AS first_obs_at
    FROM base
    WHERE availability_status = 'returned'
    ORDER BY stable_itinerary_key, snapshot_at ASC
  )
  SELECT
    l.stable_itinerary_key, l.departure_at, l.arrival_at,
    l.airline, l.flight_number, l.stops, l.total_duration_display,
    coalesce(f.first_seats, 0),
    (CASE WHEN l.availability_status = 'returned' THEN coalesce(l.go_wild_available_seats, 0) ELSE 0 END),
    (CASE WHEN l.availability_status = 'returned' THEN coalesce(l.go_wild_available_seats, 0) ELSE 0 END) - coalesce(f.first_seats, 0),
    f.first_obs_at,
    l.latest_obs,
    l.availability_status,
    CASE WHEN l.availability_status='returned' AND l.has_go_wild THEN l.go_wild_total END,
    CASE WHEN l.availability_status='returned' THEN l.standard_total END,
    (l.availability_status='returned' AND l.has_go_wild AND coalesce(l.go_wild_available_seats,0) > 0)
  FROM latest l
  LEFT JOIN first_obs f USING (stable_itinerary_key)
  ORDER BY l.departure_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_route_gowild_inventory_day_details(text, text, date) TO authenticated;
