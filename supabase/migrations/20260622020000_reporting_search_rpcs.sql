-- =============================================================================
-- Reporting RPCs — Flight Searches category
--
-- Four SECURITY DEFINER functions callable only by service_role.
-- No dynamic SQL. All parameters validated inside the function.
--
-- Timezone-aware date bucketing: pass YYYY-MM-DD date strings + timezone.
-- The function converts to UTC boundaries via AT TIME ZONE, so callers
-- never need to append "T00:00:00" or "23:59:59" strings themselves.
-- =============================================================================

-- =============================================================================
-- INDEX REVIEW
--
-- Existing indexes on public.flight_searches:
--   idx_flight_searches_user_id         (user_id)
--   idx_flight_searches_timestamp       (search_timestamp DESC)
--   idx_flight_searches_source_observed (result_source, provider_observed_at DESC)
--   idx_flight_searches_route_date      (departure_airport, arrival_airport, departure_date)
--
-- The reporting queries filter by search_timestamp (not departure_date or
-- provider_observed_at) and group by route or result_source.
--
-- Two new indexes are added:
--   1. Route + time:  supports top-routes and zero-results queries that
--      filter by search_timestamp and group by departure/arrival airport.
--      Leftmost column is search_timestamp for the common case (no route filter).
--
--   2. Source + time: supports source-cache-mix queries.
--      The existing (result_source, provider_observed_at) index uses the wrong
--      date column and cannot be repurposed here.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rpt_fs_ts_route
  ON public.flight_searches (search_timestamp DESC, departure_airport, arrival_airport);

CREATE INDEX IF NOT EXISTS idx_rpt_fs_source_ts
  ON public.flight_searches (result_source, search_timestamp DESC);

-- =============================================================================
-- Shared system-exclusion helper comment (applies to all four RPCs):
--
-- When p_include_system_activity = false, exclude:
--   - The all-zero system UUID (00000000-0000-0000-0000-000000000000)
--   - triggered_by IN ('scheduled_bulk_search', 'admin_bulk_search')
--   - Preserves rows where triggered_by IS NULL (normal user-initiated searches)
--
-- Timezone-aware boundaries:
--   v_date_from := (p_start_date || 'T00:00:00')::timestamp AT TIME ZONE p_timezone
--   v_date_to   := (p_end_date   || 'T00:00:00')::timestamp AT TIME ZONE p_timezone
--                  + interval '1 day'
--
-- This gives midnight-to-midnight in the user's local timezone without
-- the caller needing to compute UTC offsets or append time strings.
-- =============================================================================

-- =============================================================================
-- 1. report_searches_volume_over_time
--
-- Grain: one row per time bucket (day / week / month) in the reporting timezone.
--
-- Time bucketing is done with:
--   date_trunc(p_granularity, search_timestamp AT TIME ZONE p_timezone)
--        AT TIME ZONE p_timezone
-- which converts UTC → local → truncate → convert back to UTC timestamptz.
-- Grouping on raw UTC timestamps and labelling the result as local dates would
-- be incorrect and is explicitly avoided.
--
-- cache_hit_count: rows where result_source = 'cache_hit'
-- live_search_count: rows where COALESCE(result_source, 'live_api') = 'live_api'
--   (NULL result_source rows are treated as live per the backfill convention)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_searches_volume_over_time(
  p_start_date              text,
  p_end_date                text,
  p_timezone                text     DEFAULT 'America/New_York',
  p_granularity             text     DEFAULT 'day',
  p_include_system_activity boolean  DEFAULT false,
  p_origin_iata             text     DEFAULT NULL,
  p_destination_iata        text     DEFAULT NULL,
  p_result_source           text     DEFAULT NULL,
  p_triggered_by            text     DEFAULT NULL
)
RETURNS TABLE (
  period_start           timestamptz,
  search_count           bigint,
  unique_users           bigint,
  gowild_hit_count       bigint,
  gowild_hit_rate        numeric,
  total_flight_results   bigint,
  average_flight_results numeric,
  cache_hit_count        bigint,
  live_search_count      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from  timestamptz;
  v_date_to    timestamptz;
BEGIN
  -- Validate granularity to the allowed set before using it in date_trunc.
  IF p_granularity NOT IN ('day', 'week', 'month') THEN
    p_granularity := 'day';
  END IF;
  IF p_timezone NOT IN (
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC'
  ) THEN
    p_timezone := 'America/New_York';
  END IF;

  -- Compute timezone-aware inclusive start / exclusive end boundaries.
  -- AT TIME ZONE on a timestamp-without-timezone interprets it as local time
  -- and returns the corresponding timestamptz (UTC).
  v_date_from := (p_start_date || 'T00:00:00')::timestamp AT TIME ZONE p_timezone;
  v_date_to   := (p_end_date   || 'T00:00:00')::timestamp AT TIME ZONE p_timezone
                 + interval '1 day';

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  SELECT
    -- Convert: UTC → local (strip tz) → truncate to bucket → back to UTC timestamptz.
    (date_trunc(p_granularity,
                fs.search_timestamp AT TIME ZONE p_timezone
               ) AT TIME ZONE p_timezone)                           AS period_start,

    COUNT(*)::bigint                                                 AS search_count,
    COUNT(DISTINCT fs.user_id)::bigint                              AS unique_users,
    COUNT(*) FILTER (WHERE fs.gowild_found = true)::bigint          AS gowild_hit_count,

    CASE WHEN COUNT(*) = 0 THEN NULL::numeric
         ELSE ROUND(
           100.0 * COUNT(*) FILTER (WHERE fs.gowild_found = true) / COUNT(*),
           2
         )
    END                                                              AS gowild_hit_rate,

    COALESCE(SUM(fs.flight_results_count), 0)::bigint               AS total_flight_results,
    ROUND(AVG(fs.flight_results_count::numeric), 2)                 AS average_flight_results,

    COUNT(*) FILTER (WHERE fs.result_source = 'cache_hit')::bigint  AS cache_hit_count,
    COUNT(*) FILTER (
      WHERE COALESCE(fs.result_source, 'live_api') = 'live_api'
    )::bigint                                                        AS live_search_count

  FROM public.flight_searches fs
  WHERE
    fs.search_timestamp >= v_date_from
    AND fs.search_timestamp <  v_date_to
    AND (
      p_include_system_activity
      OR (
        fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
        AND (
          fs.triggered_by IS NULL
          OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
        )
      )
    )
    AND (p_origin_iata IS NULL OR fs.departure_airport = p_origin_iata)
    AND (p_destination_iata IS NULL OR fs.arrival_airport = p_destination_iata)
    AND (p_result_source IS NULL OR (
      CASE WHEN p_result_source = 'unknown'
           THEN (fs.result_source IS NULL OR TRIM(fs.result_source) = '')
           ELSE fs.result_source = p_result_source
      END
    ))
    AND (p_triggered_by IS NULL OR (
      CASE WHEN p_triggered_by = 'user'
           THEN fs.triggered_by IS NULL
           ELSE fs.triggered_by = p_triggered_by
      END
    ))
  GROUP BY
    date_trunc(p_granularity, fs.search_timestamp AT TIME ZONE p_timezone)
  ORDER BY
    1 ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.report_searches_volume_over_time(
  text, text, text, text, boolean, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_searches_volume_over_time(
  text, text, text, text, boolean, text, text, text, text
) TO service_role;

-- =============================================================================
-- 2. report_searches_top_routes
--
-- Grain: one row per (departure_airport, arrival_airport) pair in the window.
--
-- Ranked by search_count DESC.
--
-- All-destinations searches (arrival_airport IS NULL):
--   Excluded when p_include_all_destinations = false.
--   When included, null destination is displayed as 'ALL' in destination_iata
--   and the route string.
--
-- zero_result_count counts rows where flight_results_count = 0 explicitly.
-- NULL flight_results_count means the count was not recorded (not zero).
--
-- Saved-flight, feedback, and route-favorite counts are NOT aggregated here
-- to avoid cross-join row multiplication with non-search activity tables.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_searches_top_routes(
  p_start_date              text,
  p_end_date                text,
  p_timezone                text     DEFAULT 'America/New_York',
  p_include_system_activity boolean  DEFAULT false,
  p_origin_iata             text     DEFAULT NULL,
  p_destination_iata        text     DEFAULT NULL,
  p_result_source           text     DEFAULT NULL,
  p_triggered_by            text     DEFAULT NULL,
  p_limit                   int      DEFAULT 25,
  p_include_all_destinations boolean DEFAULT false
)
RETURNS TABLE (
  origin_iata          text,
  destination_iata     text,
  route                text,
  search_count         bigint,
  unique_users         bigint,
  gowild_hit_count     bigint,
  gowild_hit_rate      numeric,
  zero_result_count    bigint,
  average_result_count numeric,
  last_searched_at     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from  timestamptz;
  v_date_to    timestamptz;
BEGIN
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  IF p_timezone NOT IN (
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC'
  ) THEN
    p_timezone := 'America/New_York';
  END IF;

  v_date_from := (p_start_date || 'T00:00:00')::timestamp AT TIME ZONE p_timezone;
  v_date_to   := (p_end_date   || 'T00:00:00')::timestamp AT TIME ZONE p_timezone
                 + interval '1 day';

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  SELECT
    fs.departure_airport                                                   AS origin_iata,
    COALESCE(fs.arrival_airport, 'ALL')                                    AS destination_iata,
    fs.departure_airport || '-' || COALESCE(fs.arrival_airport, 'ALL')    AS route,
    COUNT(*)::bigint                                                        AS search_count,
    COUNT(DISTINCT fs.user_id)::bigint                                      AS unique_users,
    COUNT(*) FILTER (WHERE fs.gowild_found = true)::bigint                 AS gowild_hit_count,
    CASE WHEN COUNT(*) = 0 THEN NULL::numeric
         ELSE ROUND(
           100.0 * COUNT(*) FILTER (WHERE fs.gowild_found = true) / COUNT(*),
           2
         )
    END                                                                     AS gowild_hit_rate,
    COUNT(*) FILTER (WHERE fs.flight_results_count = 0)::bigint            AS zero_result_count,
    ROUND(AVG(fs.flight_results_count::numeric), 2)                        AS average_result_count,
    MAX(fs.search_timestamp)                                                AS last_searched_at

  FROM public.flight_searches fs
  WHERE
    fs.search_timestamp >= v_date_from
    AND fs.search_timestamp <  v_date_to
    AND (
      p_include_system_activity
      OR (
        fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
        AND (
          fs.triggered_by IS NULL
          OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
        )
      )
    )
    -- Exclude null-destination (all-destinations) searches when not requested.
    AND (p_include_all_destinations OR fs.arrival_airport IS NOT NULL)
    AND (p_origin_iata IS NULL      OR fs.departure_airport = p_origin_iata)
    AND (p_destination_iata IS NULL OR fs.arrival_airport   = p_destination_iata)
    AND (p_result_source IS NULL OR (
      CASE WHEN p_result_source = 'unknown'
           THEN (fs.result_source IS NULL OR TRIM(fs.result_source) = '')
           ELSE fs.result_source = p_result_source
      END
    ))
    AND (p_triggered_by IS NULL OR (
      CASE WHEN p_triggered_by = 'user'
           THEN fs.triggered_by IS NULL
           ELSE fs.triggered_by = p_triggered_by
      END
    ))
  GROUP BY fs.departure_airport, fs.arrival_airport
  ORDER BY COUNT(*) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.report_searches_top_routes(
  text, text, text, boolean, text, text, text, text, int, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_searches_top_routes(
  text, text, text, boolean, text, text, text, text, int, boolean
) TO service_role;

-- =============================================================================
-- 3. report_searches_zero_results
--
-- Grain: one row per (departure_airport, arrival_airport) pair with
--        at least p_minimum_searches total searches in the window.
--
-- IMPORTANT: This function builds route-level aggregates from ALL matching
-- searches (not just zero-result rows) before computing the failure rate.
-- Filtering to zero-result rows first and calling that the failure rate would
-- exclude successful searches from the denominator and produce inflated rates.
--
-- zero_result_searches: rows where flight_results_count = 0 exactly.
-- NULL flight_results_count is treated as "count not recorded", not zero.
--
-- last_zero_result_at:      most recent search with flight_results_count = 0
-- last_successful_result_at: most recent search with flight_results_count > 0
--
-- Default ordering: zero_result_searches DESC → zero_result_rate DESC → total DESC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_searches_zero_results(
  p_start_date              text,
  p_end_date                text,
  p_timezone                text     DEFAULT 'America/New_York',
  p_include_system_activity boolean  DEFAULT false,
  p_origin_iata             text     DEFAULT NULL,
  p_destination_iata        text     DEFAULT NULL,
  p_result_source           text     DEFAULT NULL,
  p_triggered_by            text     DEFAULT NULL,
  p_minimum_searches        int      DEFAULT 1,
  p_limit                   int      DEFAULT 100,
  p_include_all_destinations boolean DEFAULT false
)
RETURNS TABLE (
  origin_iata               text,
  destination_iata          text,
  route                     text,
  total_searches            bigint,
  zero_result_searches      bigint,
  zero_result_rate          numeric,
  unique_users_affected     bigint,
  last_zero_result_at       timestamptz,
  last_successful_result_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from  timestamptz;
  v_date_to    timestamptz;
BEGIN
  p_minimum_searches := GREATEST(COALESCE(p_minimum_searches, 1), 1);
  p_limit            := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  IF p_timezone NOT IN (
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC'
  ) THEN
    p_timezone := 'America/New_York';
  END IF;

  v_date_from := (p_start_date || 'T00:00:00')::timestamp AT TIME ZONE p_timezone;
  v_date_to   := (p_end_date   || 'T00:00:00')::timestamp AT TIME ZONE p_timezone
                 + interval '1 day';

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  SELECT
    fs.departure_airport                                                     AS origin_iata,
    COALESCE(fs.arrival_airport, 'ALL')                                      AS destination_iata,
    fs.departure_airport || '-' || COALESCE(fs.arrival_airport, 'ALL')      AS route,
    COUNT(*)::bigint                                                          AS total_searches,

    COUNT(*) FILTER (WHERE fs.flight_results_count = 0)::bigint              AS zero_result_searches,

    -- zero_result_rate: safe because HAVING guarantees COUNT(*) >= 1.
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE fs.flight_results_count = 0) / COUNT(*),
      2
    )                                                                         AS zero_result_rate,

    -- Users who experienced at least one zero-result search on this route.
    COUNT(DISTINCT fs.user_id) FILTER (
      WHERE fs.flight_results_count = 0
    )::bigint                                                                 AS unique_users_affected,

    MAX(fs.search_timestamp) FILTER (
      WHERE fs.flight_results_count = 0
    )                                                                         AS last_zero_result_at,

    MAX(fs.search_timestamp) FILTER (
      WHERE fs.flight_results_count > 0
    )                                                                         AS last_successful_result_at

  FROM public.flight_searches fs
  WHERE
    fs.search_timestamp >= v_date_from
    AND fs.search_timestamp <  v_date_to
    AND (
      p_include_system_activity
      OR (
        fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
        AND (
          fs.triggered_by IS NULL
          OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
        )
      )
    )
    AND (p_include_all_destinations OR fs.arrival_airport IS NOT NULL)
    AND (p_origin_iata IS NULL      OR fs.departure_airport = p_origin_iata)
    AND (p_destination_iata IS NULL OR fs.arrival_airport   = p_destination_iata)
    AND (p_result_source IS NULL OR (
      CASE WHEN p_result_source = 'unknown'
           THEN (fs.result_source IS NULL OR TRIM(fs.result_source) = '')
           ELSE fs.result_source = p_result_source
      END
    ))
    AND (p_triggered_by IS NULL OR (
      CASE WHEN p_triggered_by = 'user'
           THEN fs.triggered_by IS NULL
           ELSE fs.triggered_by = p_triggered_by
      END
    ))
  GROUP BY fs.departure_airport, fs.arrival_airport
  HAVING COUNT(*) >= p_minimum_searches
  ORDER BY
    COUNT(*) FILTER (WHERE fs.flight_results_count = 0) DESC,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE fs.flight_results_count = 0) / COUNT(*),
      2
    ) DESC,
    COUNT(*) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.report_searches_zero_results(
  text, text, text, boolean, text, text, text, text, int, int, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_searches_zero_results(
  text, text, text, boolean, text, text, text, text, int, int, boolean
) TO service_role;

-- =============================================================================
-- 4. report_searches_source_cache_mix
--
-- Grain: one row per (normalized_result_source, triggered_by) combination.
--
-- Source normalization: NULL or blank result_source → 'unknown'.
--   This groups rows where result_source was not recorded separately from
--   confirmed 'live_api' rows.
--
-- percentage_of_searches: fraction of total searches for this source/trigger
--   combination. Uses a window function over the grouped result set so no
--   second pass is needed.
--
-- Summary cards (computed in the Edge Function handler from the returned rows):
--   - Total searches
--   - Live API percentage
--   - Cache-hit percentage
--   - System (scheduled + admin) percentage
--   - Overall GoWild hit rate
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_searches_source_cache_mix(
  p_start_date              text,
  p_end_date                text,
  p_timezone                text     DEFAULT 'America/New_York',
  p_include_system_activity boolean  DEFAULT false,
  p_origin_iata             text     DEFAULT NULL,
  p_destination_iata        text     DEFAULT NULL,
  p_result_source           text     DEFAULT NULL,
  p_triggered_by            text     DEFAULT NULL
)
RETURNS TABLE (
  result_source          text,
  triggered_by           text,
  search_count           bigint,
  percentage_of_searches numeric,
  gowild_hit_count       bigint,
  gowild_hit_rate        numeric,
  average_result_count   numeric,
  latest_search_at       timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_from  timestamptz;
  v_date_to    timestamptz;
BEGIN
  IF p_timezone NOT IN (
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC'
  ) THEN
    p_timezone := 'America/New_York';
  END IF;

  v_date_from := (p_start_date || 'T00:00:00')::timestamp AT TIME ZONE p_timezone;
  v_date_to   := (p_end_date   || 'T00:00:00')::timestamp AT TIME ZONE p_timezone
                 + interval '1 day';

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  SELECT
    -- Normalize NULL or blank result_source to 'unknown'.
    COALESCE(NULLIF(TRIM(fs.result_source), ''), 'unknown')         AS result_source,
    fs.triggered_by,
    COUNT(*)::bigint                                                  AS search_count,
    -- Window function: percentage of total searches this row represents.
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::numeric     AS percentage_of_searches,
    COUNT(*) FILTER (WHERE fs.gowild_found = true)::bigint           AS gowild_hit_count,
    CASE WHEN COUNT(*) = 0 THEN NULL::numeric
         ELSE ROUND(
           100.0 * COUNT(*) FILTER (WHERE fs.gowild_found = true) / COUNT(*),
           2
         )
    END                                                               AS gowild_hit_rate,
    ROUND(AVG(fs.flight_results_count::numeric), 2)                  AS average_result_count,
    MAX(fs.search_timestamp)                                          AS latest_search_at

  FROM public.flight_searches fs
  WHERE
    fs.search_timestamp >= v_date_from
    AND fs.search_timestamp <  v_date_to
    AND (
      p_include_system_activity
      OR (
        fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
        AND (
          fs.triggered_by IS NULL
          OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
        )
      )
    )
    AND (p_origin_iata IS NULL OR fs.departure_airport = p_origin_iata)
    AND (p_destination_iata IS NULL OR fs.arrival_airport = p_destination_iata)
    AND (p_result_source IS NULL OR (
      CASE WHEN p_result_source = 'unknown'
           THEN (fs.result_source IS NULL OR TRIM(fs.result_source) = '')
           ELSE fs.result_source = p_result_source
      END
    ))
    AND (p_triggered_by IS NULL OR (
      CASE WHEN p_triggered_by = 'user'
           THEN fs.triggered_by IS NULL
           ELSE fs.triggered_by = p_triggered_by
      END
    ))
  GROUP BY
    COALESCE(NULLIF(TRIM(fs.result_source), ''), 'unknown'),
    fs.triggered_by
  ORDER BY COUNT(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.report_searches_source_cache_mix(
  text, text, text, boolean, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_searches_source_cache_mix(
  text, text, text, boolean, text, text, text, text
) TO service_role;
