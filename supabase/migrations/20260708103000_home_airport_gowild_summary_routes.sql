-- Restyle support for the home-airport GoWild summary card.
-- Adds home-airport coordinates and top destination route metrics to the
-- existing secure RPC so the Home widget can render an in-app SVG route map.

CREATE OR REPLACE FUNCTION public.get_next_home_gowild_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_home_airport text;
  v_airport_name text;
  v_home_city text;
  v_home_state text;
  v_home_latitude double precision;
  v_home_longitude double precision;
  v_timezone text;
  v_timezone_group text;
  v_local_date date;
  v_target_date date;
  v_search_id uuid;
  v_observed_at timestamptz;
  v_job_status text;
  v_search_flight_count integer;
  v_all_flights_count integer := 0;
  v_gowild_flights_count integer := 0;
  v_destination_count integer := 0;
  v_nonstop_gowild_count integer := 0;
  v_total_gowild_seats integer := 0;
  v_lowest_gowild_price numeric;
  v_currency text := 'USD';
  v_top_routes jsonb := '[]'::jsonb;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT upper(trim(ui.home_airport))
    INTO v_home_airport
  FROM public.user_info ui
  WHERE ui.auth_user_id = v_user_id
  LIMIT 1;

  IF coalesce(v_home_airport, '') = '' THEN
    RETURN jsonb_build_object(
      'status', 'home_airport_missing',
      'allFlightsCount', 0,
      'goWildFlightsCount', 0,
      'destinationCount', 0,
      'nonstopGoWildCount', 0,
      'totalGoWildSeats', 0,
      'currency', 'USD',
      'topRoutes', '[]'::jsonb
    );
  END IF;

  SELECT a.name,
         coalesce(l.city, l.name),
         l.state_code,
         a.latitude,
         a.longitude,
         a.timezone
    INTO v_airport_name, v_home_city, v_home_state, v_home_latitude, v_home_longitude, v_timezone
  FROM public.airports a
  LEFT JOIN public.locations l ON l.id = a.location_id
  WHERE upper(a.iata_code) = v_home_airport
    AND a.is_active = true
  LIMIT 1;

  IF coalesce(v_timezone, '') = '' THEN
    RETURN jsonb_build_object(
      'status', 'timezone_missing',
      'homeAirport', v_home_airport,
      'airportName', v_airport_name,
      'homeCity', v_home_city,
      'homeState', v_home_state,
      'homeAirportLatitude', v_home_latitude,
      'homeAirportLongitude', v_home_longitude,
      'allFlightsCount', 0,
      'goWildFlightsCount', 0,
      'destinationCount', 0,
      'nonstopGoWildCount', 0,
      'totalGoWildSeats', 0,
      'currency', 'USD',
      'topRoutes', '[]'::jsonb
    );
  END IF;

  v_local_date := (now() AT TIME ZONE v_timezone)::date;
  v_target_date := v_local_date + 1;
  v_timezone_group := public.gowild_timezone_group(v_timezone);

  SELECT fs.id,
         coalesce(fs.provider_observed_at, fs.search_timestamp),
         fs.flight_results_count
    INTO v_search_id, v_observed_at, v_search_flight_count
  FROM public.flight_searches fs
  WHERE upper(fs.departure_airport) = v_home_airport
    AND fs.departure_date = v_target_date
    AND fs.all_destinations = 'Yes'
    AND fs.triggered_by = 'scheduled_bulk_search'
    AND fs.result_source = 'scheduled_bulk_search'
  ORDER BY fs.provider_observed_at DESC NULLS LAST, fs.search_timestamp DESC
  LIMIT 1;

  IF v_timezone_group IS NOT NULL THEN
    SELECT b.status
      INTO v_job_status
    FROM public.bulk_search_job_logs b
    WHERE b.timezone_group = v_timezone_group
      AND b.target_date = v_target_date
    ORDER BY b.started_at DESC
    LIMIT 1;
  END IF;

  IF v_search_id IS NULL THEN
    v_status := CASE
      WHEN v_job_status = 'running' THEN 'processing'
      WHEN v_job_status = 'failed' THEN 'job_failed'
      ELSE 'not_ready'
    END;

    RETURN jsonb_build_object(
      'status', v_status,
      'homeAirport', v_home_airport,
      'airportName', v_airport_name,
      'homeCity', v_home_city,
      'homeState', v_home_state,
      'homeAirportLatitude', v_home_latitude,
      'homeAirportLongitude', v_home_longitude,
      'homeAirportTimezone', v_timezone,
      'localDate', v_local_date,
      'targetDate', v_target_date,
      'jobStatus', v_job_status,
      'allFlightsCount', 0,
      'goWildFlightsCount', 0,
      'destinationCount', 0,
      'nonstopGoWildCount', 0,
      'totalGoWildSeats', 0,
      'currency', 'USD',
      'topRoutes', '[]'::jsonb
    );
  END IF;

  WITH ranked AS (
    SELECT snapshot.*,
           row_number() OVER (
             PARTITION BY coalesce(snapshot.stable_itinerary_key, snapshot.source_itinerary_id, snapshot.id::text)
             ORDER BY snapshot.snapshot_at DESC, snapshot.id DESC
           ) AS row_rank
    FROM public.flight_snapshots snapshot
    WHERE snapshot.flight_search_id = v_search_id
      AND snapshot.availability_status <> 'not_returned'
  ), current_rows AS (
    SELECT *
    FROM ranked
    WHERE row_rank = 1
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE has_go_wild = true AND availability_status = 'returned')::integer,
         count(DISTINCT leg_destination_iata)::integer,
         count(*) FILTER (WHERE has_go_wild = true AND availability_status = 'returned' AND coalesce(stops, 0) = 0)::integer,
         coalesce(sum(coalesce(go_wild_available_seats, 0)) FILTER (WHERE has_go_wild = true AND availability_status = 'returned'), 0)::integer,
         min(go_wild_total) FILTER (WHERE has_go_wild = true AND availability_status = 'returned'),
         coalesce(min(currency) FILTER (WHERE has_go_wild = true AND availability_status = 'returned' AND currency IS NOT NULL), 'USD')
    INTO v_all_flights_count,
         v_gowild_flights_count,
         v_destination_count,
         v_nonstop_gowild_count,
         v_total_gowild_seats,
         v_lowest_gowild_price,
         v_currency
  FROM current_rows;

  WITH ranked AS (
    SELECT snapshot.*,
           row_number() OVER (
             PARTITION BY coalesce(snapshot.stable_itinerary_key, snapshot.source_itinerary_id, snapshot.id::text)
             ORDER BY snapshot.snapshot_at DESC, snapshot.id DESC
           ) AS row_rank
    FROM public.flight_snapshots snapshot
    WHERE snapshot.flight_search_id = v_search_id
      AND snapshot.availability_status <> 'not_returned'
  ), current_rows AS (
    SELECT *
    FROM ranked
    WHERE row_rank = 1
  ), route_stats AS (
    SELECT upper(cr.final_destination_iata) AS destination,
           coalesce(min(dl.city), min(da.name)) AS destination_city,
           min(dl.state_code) AS destination_state,
           count(*)::integer AS go_wild_results,
           count(*) FILTER (WHERE coalesce(cr.stops, 0) = 0)::integer AS nonstop_count,
           coalesce(sum(coalesce(cr.go_wild_available_seats, 0)), 0)::integer AS seats,
           min(cr.go_wild_total) AS lowest_price,
           min(da.latitude) AS latitude,
           min(da.longitude) AS longitude
    FROM current_rows cr
    LEFT JOIN public.airports da ON upper(da.iata_code) = upper(cr.final_destination_iata)
    LEFT JOIN public.locations dl ON dl.id = da.location_id
    WHERE cr.has_go_wild = true
      AND cr.availability_status = 'returned'
      AND coalesce(cr.final_destination_iata, '') <> ''
    GROUP BY upper(cr.final_destination_iata)
    ORDER BY count(*) DESC,
             coalesce(sum(coalesce(cr.go_wild_available_seats, 0)), 0) DESC,
             min(cr.go_wild_total) ASC NULLS LAST
    LIMIT 6
  )
  SELECT coalesce(
           jsonb_agg(
             jsonb_build_object(
               'destination', destination,
               'destinationCity', destination_city,
               'destinationState', destination_state,
               'goWildResults', go_wild_results,
               'nonstopCount', nonstop_count,
               'seats', seats,
               'lowestPrice', lowest_price,
               'latitude', latitude,
               'longitude', longitude
             )
             ORDER BY go_wild_results DESC, seats DESC, lowest_price ASC NULLS LAST
           ),
           '[]'::jsonb
         )
    INTO v_top_routes
  FROM route_stats;

  v_all_flights_count := coalesce(v_search_flight_count, v_all_flights_count, 0);
  v_gowild_flights_count := coalesce(v_gowild_flights_count, 0);
  v_destination_count := coalesce(v_destination_count, 0);
  v_nonstop_gowild_count := coalesce(v_nonstop_gowild_count, 0);
  v_total_gowild_seats := coalesce(v_total_gowild_seats, 0);
  v_currency := coalesce(v_currency, 'USD');
  v_top_routes := coalesce(v_top_routes, '[]'::jsonb);

  v_status := CASE
    WHEN v_all_flights_count > 0 THEN 'ready'
    ELSE 'no_available_flights'
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'homeAirport', v_home_airport,
    'airportName', v_airport_name,
    'homeCity', v_home_city,
    'homeState', v_home_state,
    'homeAirportLatitude', v_home_latitude,
    'homeAirportLongitude', v_home_longitude,
    'homeAirportTimezone', v_timezone,
    'localDate', v_local_date,
    'targetDate', v_target_date,
    'observedAt', v_observed_at,
    'jobStatus', v_job_status,
    'allFlightsCount', v_all_flights_count,
    'goWildFlightsCount', v_gowild_flights_count,
    'destinationCount', v_destination_count,
    'nonstopGoWildCount', v_nonstop_gowild_count,
    'totalGoWildSeats', v_total_gowild_seats,
    'lowestGoWildPrice', v_lowest_gowild_price,
    'currency', v_currency,
    'topRoutes', v_top_routes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_home_gowild_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_home_gowild_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_next_home_gowild_summary() TO authenticated;
