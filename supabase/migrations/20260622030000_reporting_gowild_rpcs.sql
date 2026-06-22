-- =============================================================================
-- Reporting RPCs — GoWild Availability category
--
-- Security model:
--   - Two reporting VIEWS (service-role only; REVOKED from anon + authenticated)
--   - Three SECURITY DEFINER RPCs (service_role only; REVOKED from all others)
--   - No dynamic SQL anywhere
--   - All time filtering uses UTC-boundaries computed from YYYY-MM-DD strings
--
-- Canonical observation key: (flight_search_id, stable_itinerary_key)
--   Deduplication strategy: DISTINCT ON ordered by snapshot_at DESC
--   Rationale: the snapshot writer may, in rare circumstances, produce
--   multiple rows for the same (search, itinerary) pair due to retries or
--   historical bulk backfills. Taking the most recent row is deterministic
--   and always correct.
--
-- cache_hit exclusion: COALESCE(result_source,'live_api') <> 'cache_hit'
--   Cache-hit searches replay stored results, not fresh provider data.
--   Including them would double-count the same availability signal and
--   bias route reliability upward.
-- =============================================================================

-- =============================================================================
-- New indexes (review first)
--
-- Existing indexes on public.flight_snapshots:
--   flight_snapshots_snapshot_idx           (snapshot_at DESC)
--   flight_snapshots_flight_search_idx      (flight_search_id)
--   flight_snapshots_flight_number_idx      (flight_number, snapshot_at DESC)
--   flight_snapshots_leg_route_idx          (leg_route, snapshot_at DESC)
--   flight_snapshots_has_gowild_idx         (has_go_wild, snapshot_at DESC)
--   flight_snapshots_gowild_seats_idx       (go_wild_available_seats DESC)
--                                             WHERE has_go_wild = true
--   idx_flight_snapshots_stable_key_time    (stable_itinerary_key, snapshot_at DESC)
--   idx_flight_snapshots_route_dep          (leg_origin_iata, leg_destination_iata, departure_at)
--
-- Added here:
--   1. (flight_search_id, stable_itinerary_key, snapshot_at DESC) — partial, non-null key
--      Supports the DISTINCT ON (flight_search_id, stable_itinerary_key) in the
--      canonical view, which is evaluated in ORDER BY flight_search_id,
--      stable_itinerary_key, snapshot_at DESC.
--
--   2. (stable_itinerary_key, availability_status, snapshot_at DESC) — partial, non-null key
--      Supports the "prior available" lookup in disappeared-itineraries:
--      WHERE availability_status = 'returned' AND has_go_wild = true
--      ORDER BY stable_itinerary_key, snapshot_at DESC.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rpt_snapshot_search_key_time
  ON public.flight_snapshots (flight_search_id, stable_itinerary_key, snapshot_at DESC)
  WHERE stable_itinerary_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rpt_snapshot_key_status_time
  ON public.flight_snapshots (stable_itinerary_key, availability_status, snapshot_at DESC)
  WHERE stable_itinerary_key IS NOT NULL;

-- =============================================================================
-- VIEW: admin_reporting_gowild_observations
--
-- Canonical layer: one row per (flight_search_id, stable_itinerary_key).
--
-- When multiple snapshot rows exist for the same (search, itinerary) pair —
-- which can happen due to retries, duplicate inserts, or historical backfills —
-- we keep only the most recent row (DISTINCT ON ordered by snapshot_at DESC).
--
-- not_returned synthetic rows (inserted by mark_disappeared_gowild_observations):
--   These have their own flight_search_id (the triggering search) and the
--   same stable_itinerary_key as the original itinerary. They appear as
--   distinct (search, key) pairs and are correctly included in the view.
--   They have availability_status = 'not_returned' and has_go_wild = false.
--
-- Columns included from flight_searches:
--   - result_source: canonical source classification (live_api, bulk, cache_hit)
--   - triggered_by: who initiated the search (NULL = user, 'admin_bulk_search', etc.)
--   - travel_date: the flight departure date the search was for (DATE)
--   - search_origin / search_destination: the airports searched (may differ from
--     itinerary origin/destination for all-destination searches)
-- =============================================================================

CREATE OR REPLACE VIEW public.admin_reporting_gowild_observations AS
SELECT DISTINCT ON (fs.flight_search_id, fs.stable_itinerary_key)
  fs.id                                                              AS snapshot_id,
  fs.flight_search_id,
  fs.stable_itinerary_key,
  fs.snapshot_at,
  -- Canonical observation timestamp: prefer the search-level provider timestamp
  -- over the row's snapshot_at. For not_returned synthetics, provider_observed_at
  -- reflects when the new search ran (or falls back to snapshot_at).
  COALESCE(fq.provider_observed_at, fs.snapshot_at)                 AS observed_at,
  fs.airline,
  fs.flight_number,
  fs.leg_origin_iata                                                 AS origin_iata,
  fs.leg_destination_iata                                            AS destination_iata,
  fs.leg_origin_iata || '-' || fs.leg_destination_iata              AS route,
  -- Itinerary departure / arrival datetimes (stored without timezone on the table)
  fs.departure_at,
  fs.arrival_at,
  fs.availability_status,
  fs.has_go_wild,
  fs.go_wild_available_seats,
  fs.go_wild_total,
  fs.standard_total,
  -- Search-level context
  fq.result_source,
  fq.triggered_by,
  fq.departure_date                                                  AS travel_date,
  fq.departure_airport                                               AS search_origin,
  fq.arrival_airport                                                 AS search_destination
FROM public.flight_snapshots fs
JOIN public.flight_searches fq ON fq.id = fs.flight_search_id
WHERE
  fs.stable_itinerary_key IS NOT NULL
  -- Cache-hit searches replay stored results — not fresh provider observations.
  AND COALESCE(fq.result_source, 'live_api') <> 'cache_hit'
ORDER BY
  fs.flight_search_id,
  fs.stable_itinerary_key,
  fs.snapshot_at DESC;

-- Block direct access; RPCs use SECURITY DEFINER and run as the owner.
REVOKE ALL ON public.admin_reporting_gowild_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_reporting_gowild_observations TO service_role;

-- =============================================================================
-- VIEW: admin_reporting_route_observations
--
-- Route observation layer: one row per (flight_search_id, origin, destination).
--
-- A route search "succeeded" (had_gowild_success = true) when at least one
-- itinerary in that search-route combination had:
--   availability_status = 'returned' AND has_go_wild = true
--
-- This prevents routes with more flight options from inflating their sample
-- size (a single search that returned 10 itineraries is one route observation,
-- not 10).
--
-- not_returned synthetic rows have has_go_wild = false and therefore
-- contribute to itinerary_count but never set had_gowild_success = true.
-- =============================================================================

CREATE OR REPLACE VIEW public.admin_reporting_route_observations AS
SELECT
  obs.flight_search_id,
  obs.origin_iata,
  obs.destination_iata,
  obs.origin_iata || '-' || obs.destination_iata                AS route,
  obs.result_source,
  obs.triggered_by,
  obs.travel_date,
  MAX(obs.observed_at)                                          AS observed_at,
  COUNT(*)                                                      AS itinerary_count,
  COUNT(*) FILTER (
    WHERE obs.has_go_wild AND obs.availability_status = 'returned'
  )                                                             AS gowild_returned_count,
  -- True if any itinerary in this search was returned with a GoWild fare.
  BOOL_OR(obs.has_go_wild AND obs.availability_status = 'returned')
                                                                AS had_gowild_success
FROM public.admin_reporting_gowild_observations obs
GROUP BY
  obs.flight_search_id,
  obs.origin_iata,
  obs.destination_iata,
  obs.result_source,
  obs.triggered_by,
  obs.travel_date;

REVOKE ALL ON public.admin_reporting_route_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_reporting_route_observations TO service_role;

-- =============================================================================
-- RPC 1: report_gowild_route_reliability
--
-- Metric definitions
-- ─────────────────────────────────────────────────────────────────────────────
-- search_observations:      total route searches within the window, after
--                           triggered_by filtering.
-- successful_observations:  route searches where had_gowild_success = true.
-- unsuccessful_observations: route searches where had_gowild_success = false.
-- raw_hit_rate:             100 * successful / total (plain percentage).
-- confidence_adjusted_score: Wilson lower confidence bound at 95% confidence
--                           (z = 1.96), scaled to 0–100.
--
--   Wilson formula (95% CI):
--     p   = successes / n
--     z   = 1.96
--     z²  = 3.8416
--
--     lower = (p + z²/(2n) − z·√(p(1−p)/n + z²/(4n²)))
--             / (1 + z²/n)
--
--     score = GREATEST(0, LEAST(100, 100 · lower))
--
--   The Wilson score adjusts for sample size:
--   - Large samples: score ≈ raw hit rate.
--   - Small samples: score is pulled toward 0 to reflect uncertainty.
--   This prevents low-observation routes from artificially ranking above
--   well-observed routes with slightly lower raw rates.
--
-- unique_travel_dates:      COUNT(DISTINCT travel_date) across all
--                           route observations in the window.
-- latest_observed_at:       most recent observation timestamp in the window.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_gowild_route_reliability(
  p_date_from              text,
  p_date_to                text,
  p_origin_iata            text     DEFAULT NULL,
  p_destination_iata       text     DEFAULT NULL,
  p_minimum_observations   int      DEFAULT 10,
  p_limit                  int      DEFAULT 25,
  p_include_admin_bulk     boolean  DEFAULT true,
  p_include_scheduled_bulk boolean  DEFAULT true,
  p_include_user_searches  boolean  DEFAULT true
)
RETURNS TABLE (
  origin_iata                text,
  destination_iata           text,
  route                      text,
  search_observations        bigint,
  successful_observations    bigint,
  unsuccessful_observations  bigint,
  raw_hit_rate               numeric,
  confidence_adjusted_score  numeric,
  unique_travel_dates        bigint,
  latest_observed_at         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from timestamptz;
  v_date_to   timestamptz;
BEGIN
  p_limit              := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  p_minimum_observations := GREATEST(COALESCE(p_minimum_observations, 10), 1);

  -- Inclusive start at midnight UTC on p_date_from; exclusive end at midnight
  -- UTC on the day after p_date_to.
  v_date_from := p_date_from::date::timestamptz;
  v_date_to   := (p_date_to::date + interval '1 day')::timestamptz;

  -- Sanity check: at least one source type must be included, else return nothing.
  IF NOT (p_include_user_searches OR p_include_scheduled_bulk OR p_include_admin_bulk) THEN
    RETURN;
  END IF;

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  WITH route_agg AS (
    SELECT
      robs.origin_iata,
      robs.destination_iata,
      robs.origin_iata || '-' || robs.destination_iata              AS route,
      COUNT(*)                                                       AS n,
      COUNT(*) FILTER (WHERE robs.had_gowild_success)               AS successes,
      COUNT(*) FILTER (WHERE NOT robs.had_gowild_success)           AS failures,
      COUNT(DISTINCT robs.travel_date)                              AS unique_travel_dates,
      MAX(robs.observed_at)                                         AS latest_observed_at
    FROM public.admin_reporting_route_observations robs
    WHERE
      robs.observed_at >= v_date_from
      AND robs.observed_at <  v_date_to
      AND (p_origin_iata      IS NULL OR robs.origin_iata      = upper(p_origin_iata))
      AND (p_destination_iata IS NULL OR robs.destination_iata = upper(p_destination_iata))
      AND (
        (p_include_user_searches    AND robs.triggered_by IS NULL)
        OR (p_include_scheduled_bulk AND robs.triggered_by = 'scheduled_bulk_search')
        OR (p_include_admin_bulk     AND robs.triggered_by = 'admin_bulk_search')
      )
    GROUP BY robs.origin_iata, robs.destination_iata
    HAVING COUNT(*) >= p_minimum_observations
  ),
  scored AS (
    SELECT
      ra.*,
      -- Raw hit rate: plain success percentage.
      ROUND(100.0 * ra.successes / ra.n, 2)                        AS raw_hit_rate,
      -- Wilson lower confidence bound (95% CI, z = 1.96, z² = 3.8416).
      -- Scaled to 0–100. GREATEST(0) guards against floating-point underflow.
      ROUND(
        100.0 * GREATEST(0.0, LEAST(1.0, (
            (ra.successes::numeric / ra.n)
            + 3.8416 / (2.0 * ra.n)
            - 1.96 * SQRT(GREATEST(0.0,
                (ra.successes::numeric / ra.n) * (1.0 - ra.successes::numeric / ra.n) / ra.n
                + 3.8416 / (4.0 * ra.n * ra.n)
              ))
          ) / (1.0 + 3.8416 / ra.n)
        )),
      2)                                                            AS confidence_adjusted_score
    FROM route_agg ra
  )
  SELECT
    s.origin_iata,
    s.destination_iata,
    s.route,
    s.n::bigint                  AS search_observations,
    s.successes::bigint          AS successful_observations,
    s.failures::bigint           AS unsuccessful_observations,
    s.raw_hit_rate,
    s.confidence_adjusted_score,
    s.unique_travel_dates::bigint,
    s.latest_observed_at
  FROM scored s
  ORDER BY
    s.confidence_adjusted_score DESC,
    s.n DESC,
    s.raw_hit_rate DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.report_gowild_route_reliability(
  text, text, text, text, int, int, boolean, boolean, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_gowild_route_reliability(
  text, text, text, text, int, int, boolean, boolean, boolean
) TO service_role;

-- =============================================================================
-- RPC 2: report_gowild_disappeared_itineraries
--
-- Returns itineraries whose most recent (or all) disappearance events fall
-- within the reporting window.
--
-- Disappearance event: a row in admin_reporting_gowild_observations where
--   availability_status = 'not_returned'
-- These are synthetic rows inserted by mark_disappeared_gowild_observations /
-- mark_disappeared_gowild_observations_admin after a fresh provider search
-- that did not return a previously GoWild-available itinerary.
--
-- Prior available lookup: all-time lookback (not bounded by the date window).
-- The prior observation is the most recent row with:
--   availability_status = 'returned' AND has_go_wild = true
-- for the same stable_itinerary_key.
--
-- When p_latest_event_only = true (default):
--   Return one row per stable_itinerary_key (the most recent disappearance).
--   disappearance_event_count shows how many total events occurred in the window.
--
-- When p_latest_event_only = false:
--   Return one row per disappearance event.
--   disappearance_event_count still shows the total within the window.
--
-- stable_itinerary_key is included in the output (hidden by default in the UI).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_gowild_disappeared_itineraries(
  p_date_from        text,
  p_date_to          text,
  p_origin_iata      text     DEFAULT NULL,
  p_destination_iata text     DEFAULT NULL,
  p_limit            int      DEFAULT 100,
  p_latest_event_only boolean DEFAULT true
)
RETURNS TABLE (
  stable_itinerary_key      text,
  route                     text,
  airline                   text,
  flight_number             text,
  departure_at              timestamp,
  arrival_at                timestamp,
  last_available_at         timestamptz,
  disappeared_at            timestamptz,
  prior_available_seats     integer,
  prior_gowild_fare         numeric,
  prior_standard_fare       numeric,
  prior_savings             numeric,
  disappearance_event_count bigint,
  result_source             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from timestamptz;
  v_date_to   timestamptz;
BEGIN
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);

  v_date_from := p_date_from::date::timestamptz;
  v_date_to   := (p_date_to::date + interval '1 day')::timestamptz;

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  WITH
  -- All disappearance events in the window.
  disappeared_all AS (
    SELECT
      obs.stable_itinerary_key,
      obs.route,
      obs.airline,
      obs.flight_number,
      obs.departure_at,
      obs.arrival_at,
      obs.observed_at                   AS disappeared_at,
      obs.result_source
    FROM public.admin_reporting_gowild_observations obs
    WHERE
      obs.availability_status = 'not_returned'
      AND obs.observed_at >= v_date_from
      AND obs.observed_at <  v_date_to
      AND (p_origin_iata      IS NULL OR obs.origin_iata      = upper(p_origin_iata))
      AND (p_destination_iata IS NULL OR obs.destination_iata = upper(p_destination_iata))
  ),
  -- Assign row number (1 = most recent) and total event count per key.
  -- This avoids a second pass for the count and avoids dynamic SQL for the
  -- latest_event_only filter.
  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY stable_itinerary_key
        ORDER BY disappeared_at DESC
      )::int                            AS rn,
      COUNT(*) OVER (
        PARTITION BY stable_itinerary_key
      )                                 AS disappearance_event_count
    FROM disappeared_all
  ),
  -- Apply p_latest_event_only without dynamic SQL:
  --   When true:  (NOT true) OR rn=1  = rn=1  → only most recent per key
  --   When false: (NOT false) OR rn=1 = true   → all events
  filtered AS (
    SELECT * FROM ranked
    WHERE (NOT p_latest_event_only) OR rn = 1
  ),
  -- Most recent prior returned+gowild observation per stable_itinerary_key.
  -- All-time lookback — not bounded by the report window, because disappearance
  -- can be detected long after the original availability was first observed.
  prior_available AS (
    SELECT DISTINCT ON (obs2.stable_itinerary_key)
      obs2.stable_itinerary_key,
      obs2.observed_at                                              AS last_available_at,
      obs2.go_wild_available_seats                                  AS prior_available_seats,
      obs2.go_wild_total                                            AS prior_gowild_fare,
      obs2.standard_total                                           AS prior_standard_fare,
      -- prior_savings: only when standard >= gowild (non-negative; NULL otherwise).
      CASE
        WHEN obs2.standard_total IS NOT NULL
          AND obs2.go_wild_total IS NOT NULL
          AND obs2.standard_total >= obs2.go_wild_total
        THEN obs2.standard_total - obs2.go_wild_total
        ELSE NULL
      END                                                           AS prior_savings
    FROM public.admin_reporting_gowild_observations obs2
    WHERE
      obs2.availability_status = 'returned'
      AND obs2.has_go_wild = true
    ORDER BY
      obs2.stable_itinerary_key,
      obs2.observed_at DESC
  )
  SELECT
    f.stable_itinerary_key,
    f.route,
    f.airline,
    f.flight_number,
    f.departure_at,
    f.arrival_at,
    pa.last_available_at,
    f.disappeared_at,
    pa.prior_available_seats,
    pa.prior_gowild_fare,
    pa.prior_standard_fare,
    pa.prior_savings,
    f.disappearance_event_count::bigint,
    f.result_source
  FROM filtered f
  LEFT JOIN prior_available pa USING (stable_itinerary_key)
  ORDER BY
    f.disappearance_event_count DESC,
    f.disappeared_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.report_gowild_disappeared_itineraries(
  text, text, text, text, int, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_gowild_disappeared_itineraries(
  text, text, text, text, int, boolean
) TO service_role;

-- =============================================================================
-- RPC 3: report_gowild_fare_savings_by_route
--
-- Uses only canonical observations where:
--   - availability_status = 'returned'   (real returned itinerary)
--   - has_go_wild = true                 (had a GoWild fare)
--   - go_wild_total IS NOT NULL          (fare was recorded)
--   - standard_total IS NOT NULL         (comparison fare was recorded)
--   - standard_total >= go_wild_total    (non-negative savings)
--
-- The last condition prevents negative savings (GoWild more expensive than
-- standard) from polluting the averages. These can occur due to fare
-- fluctuations recorded in different searches.
--
-- median_savings uses percentile_cont(0.5) — the true median, not an average
-- of the middle values. This is correct for skewed savings distributions.
--
-- average_savings_percent: (standard - gowild) / standard × 100, per-row
-- average, not computed from the aggregate averages (avoids Jensen's inequality).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_gowild_fare_savings_by_route(
  p_date_from        text,
  p_date_to          text,
  p_origin_iata      text    DEFAULT NULL,
  p_destination_iata text    DEFAULT NULL,
  p_minimum_samples  int     DEFAULT 5,
  p_limit            int     DEFAULT 25
)
RETURNS TABLE (
  origin_iata             text,
  destination_iata        text,
  route                   text,
  sample_count            bigint,
  average_gowild_fare     numeric,
  average_standard_fare   numeric,
  average_savings         numeric,
  median_savings          numeric,
  maximum_savings         numeric,
  average_savings_percent numeric,
  latest_observed_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from timestamptz;
  v_date_to   timestamptz;
BEGIN
  p_limit           := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  p_minimum_samples := GREATEST(COALESCE(p_minimum_samples, 5), 1);

  v_date_from := p_date_from::date::timestamptz;
  v_date_to   := (p_date_to::date + interval '1 day')::timestamptz;

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  SELECT
    obs.origin_iata,
    obs.destination_iata,
    obs.origin_iata || '-' || obs.destination_iata                  AS route,
    COUNT(*)::bigint                                                  AS sample_count,
    ROUND(AVG(obs.go_wild_total), 2)                                 AS average_gowild_fare,
    ROUND(AVG(obs.standard_total), 2)                                AS average_standard_fare,
    ROUND(AVG(obs.standard_total - obs.go_wild_total), 2)            AS average_savings,
    -- True median of the savings distribution using an ordered-set aggregate.
    ROUND(
      percentile_cont(0.5)
        WITHIN GROUP (ORDER BY obs.standard_total - obs.go_wild_total),
      2
    )                                                                 AS median_savings,
    ROUND(MAX(obs.standard_total - obs.go_wild_total), 2)            AS maximum_savings,
    -- Savings percent computed per-row then averaged to avoid Jensen's inequality.
    ROUND(
      AVG(100.0 * (obs.standard_total - obs.go_wild_total) / obs.standard_total),
      2
    )                                                                 AS average_savings_percent,
    MAX(obs.observed_at)                                             AS latest_observed_at

  FROM public.admin_reporting_gowild_observations obs
  WHERE
    obs.availability_status = 'returned'
    AND obs.has_go_wild = true
    AND obs.go_wild_total   IS NOT NULL
    AND obs.standard_total  IS NOT NULL
    AND obs.standard_total >= obs.go_wild_total    -- exclude negative savings
    AND obs.observed_at >= v_date_from
    AND obs.observed_at <  v_date_to
    AND (p_origin_iata      IS NULL OR obs.origin_iata      = upper(p_origin_iata))
    AND (p_destination_iata IS NULL OR obs.destination_iata = upper(p_destination_iata))
  GROUP BY obs.origin_iata, obs.destination_iata
  HAVING COUNT(*) >= p_minimum_samples
  ORDER BY AVG(obs.standard_total - obs.go_wild_total) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.report_gowild_fare_savings_by_route(
  text, text, text, text, int, int
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_gowild_fare_savings_by_route(
  text, text, text, text, int, int
) TO service_role;
