-- Migration 20260708093402_home_airport_gowild_summary
CREATE INDEX IF NOT EXISTS idx_flight_searches_scheduled_home_summary
  ON public.flight_searches (
    departure_airport,
    departure_date,
    provider_observed_at DESC,
    search_timestamp DESC
  )
  WHERE triggered_by = 'scheduled_bulk_search'
    AND result_source = 'scheduled_bulk_search'
    AND all_destinations = 'Yes';

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
    SELECT upper(cr.leg_destination_iata) AS destination,
           coalesce(min(dl.city), min(da.name)) AS destination_city,
           min(dl.state_code) AS destination_state,
           count(*)::integer AS go_wild_results,
           count(*) FILTER (WHERE coalesce(cr.stops, 0) = 0)::integer AS nonstop_count,
           coalesce(sum(coalesce(cr.go_wild_available_seats, 0)), 0)::integer AS seats,
           min(cr.go_wild_total) AS lowest_price,
           min(da.latitude) AS latitude,
           min(da.longitude) AS longitude
    FROM current_rows cr
    LEFT JOIN public.airports da ON upper(da.iata_code) = upper(cr.leg_destination_iata)
    LEFT JOIN public.locations dl ON dl.id = da.location_id
    WHERE cr.has_go_wild = true
      AND cr.availability_status = 'returned'
      AND coalesce(cr.leg_destination_iata, '') <> ''
    GROUP BY upper(cr.leg_destination_iata)
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

INSERT INTO public.user_homepage (user_id, component_name, "order", status)
SELECT users.user_id,
       'next_home_gowild_summary',
       least(coalesce(max(existing."order"), 0) + 1, 32767)::smallint,
       'active'
FROM (
  SELECT DISTINCT auth_user_id AS user_id
  FROM public.user_info
  WHERE auth_user_id IS NOT NULL
  UNION
  SELECT DISTINCT user_id
  FROM public.user_homepage
) users
LEFT JOIN public.user_homepage existing ON existing.user_id = users.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_homepage check_row
  WHERE check_row.user_id = users.user_id
    AND check_row.component_name = 'next_home_gowild_summary'
)
GROUP BY users.user_id;

-- Migration 20260709110000_home_gowild_and_day_trips_snapshot_fixes: add day trips RPC + index
CREATE INDEX IF NOT EXISTS idx_flight_snapshots_home_day_trip_pairing
  ON public.flight_snapshots (leg_origin_iata, leg_destination_iata, departure_at, flight_search_id)
  WHERE has_go_wild = true
    AND availability_status = 'returned'
    AND coalesce(stops, 0) = 0;

CREATE OR REPLACE FUNCTION public.get_home_day_trips_from_snapshots(
  p_dates date[] DEFAULT NULL,
  p_min_ground_minutes integer DEFAULT 360,
  p_limit integer DEFAULT 6
)
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
  v_timezone text;
  v_local_date date;
  v_dates date[];
  v_min_ground_minutes integer := greatest(coalesce(p_min_ground_minutes, 360), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 6), 1), 12);
  v_day_trips jsonb := '[]'::jsonb;
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
      'dayTrips', '[]'::jsonb
    );
  END IF;

  SELECT a.name,
         coalesce(l.city, l.name),
         l.state_code,
         a.timezone
    INTO v_airport_name, v_home_city, v_home_state, v_timezone
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
      'dayTrips', '[]'::jsonb
    );
  END IF;

  v_local_date := (now() AT TIME ZONE v_timezone)::date;
  v_dates := coalesce(p_dates, ARRAY[v_local_date, v_local_date + 1]);

  WITH requested_dates AS (
    SELECT DISTINCT unnest(v_dates)::date AS trip_date
  ), latest_searches AS (
    SELECT DISTINCT ON (upper(fs.departure_airport), fs.departure_date)
           upper(fs.departure_airport) AS origin_iata,
           fs.departure_date,
           fs.id AS flight_search_id,
           coalesce(fs.provider_observed_at, fs.search_timestamp) AS observed_at
    FROM public.flight_searches fs
    JOIN requested_dates rd ON rd.trip_date = fs.departure_date
    WHERE fs.all_destinations = 'Yes'
      AND fs.triggered_by = 'scheduled_bulk_search'
      AND fs.result_source = 'scheduled_bulk_search'
    ORDER BY upper(fs.departure_airport),
             fs.departure_date,
             fs.provider_observed_at DESC NULLS LAST,
             fs.search_timestamp DESC
  ), ranked_snapshots AS (
    SELECT snapshot.*,
           row_number() OVER (
             PARTITION BY snapshot.flight_search_id,
                          coalesce(snapshot.stable_itinerary_key, snapshot.source_itinerary_id, snapshot.id::text)
             ORDER BY snapshot.snapshot_at DESC, snapshot.id DESC
           ) AS row_rank
    FROM public.flight_snapshots snapshot
    JOIN latest_searches ls ON ls.flight_search_id = snapshot.flight_search_id
    WHERE snapshot.has_go_wild = true
      AND snapshot.availability_status = 'returned'
      AND coalesce(snapshot.stops, 0) = 0
  ), available AS (
    SELECT r.*,
           ls.origin_iata AS search_origin_iata,
           ls.departure_date AS search_departure_date,
           ls.observed_at
    FROM ranked_snapshots r
    JOIN latest_searches ls ON ls.flight_search_id = r.flight_search_id
    WHERE r.row_rank = 1
  ), pair_candidates AS (
    SELECT
      o.search_departure_date AS trip_date,
      upper(o.leg_destination_iata) AS destination,
      floor(extract(epoch FROM (ret.departure_at - o.arrival_at)) / 60)::integer AS ground_minutes,
      o.id AS outbound_snapshot_id,
      ret.id AS return_snapshot_id,
      o.leg_origin_iata AS outbound_origin,
      o.leg_destination_iata AS outbound_destination,
      o.departure_at AS outbound_departure_at,
      o.arrival_at AS outbound_arrival_at,
      coalesce(
        o.total_duration_display,
        floor(extract(epoch FROM (o.arrival_at - o.departure_at)) / 3600)::integer::text || ':' ||
          lpad(floor(mod(extract(epoch FROM (o.arrival_at - o.departure_at)), 3600) / 60)::integer::text, 2, '0') || ':00'
      ) AS outbound_duration,
      o.display_cabin AS outbound_cabin,
      o.go_wild_total AS outbound_go_wild_total,
      o.go_wild_available_seats AS outbound_go_wild_seats,
      ret.leg_origin_iata AS return_origin,
      ret.leg_destination_iata AS return_destination,
      ret.departure_at AS return_departure_at,
      ret.arrival_at AS return_arrival_at,
      coalesce(
        ret.total_duration_display,
        floor(extract(epoch FROM (ret.arrival_at - ret.departure_at)) / 3600)::integer::text || ':' ||
          lpad(floor(mod(extract(epoch FROM (ret.arrival_at - ret.departure_at)), 3600) / 60)::integer::text, 2, '0') || ':00'
      ) AS return_duration,
      ret.display_cabin AS return_cabin,
      ret.go_wild_total AS return_go_wild_total,
      ret.go_wild_available_seats AS return_go_wild_seats,
      coalesce(o.currency, ret.currency, 'USD') AS currency,
      greatest(o.observed_at, ret.observed_at) AS observed_at,
      row_number() OVER (
        PARTITION BY o.search_departure_date, upper(o.leg_destination_iata)
        ORDER BY
          floor(extract(epoch FROM (ret.departure_at - o.arrival_at)) / 60) DESC,
          o.departure_at ASC,
          ret.departure_at ASC,
          o.id ASC,
          ret.id ASC
      ) AS destination_rank
    FROM available o
    JOIN available ret
      ON ret.search_departure_date = o.search_departure_date
     AND ret.search_origin_iata = upper(o.leg_destination_iata)
     AND upper(ret.leg_origin_iata) = upper(o.leg_destination_iata)
     AND upper(ret.leg_destination_iata) = v_home_airport
    WHERE o.search_origin_iata = v_home_airport
      AND upper(o.leg_origin_iata) = v_home_airport
      AND coalesce(o.leg_destination_iata, '') <> ''
      AND upper(o.leg_destination_iata) <> v_home_airport
      AND o.departure_at::date = o.search_departure_date
      AND ret.arrival_at::date = o.search_departure_date
      AND o.departure_at::time >= time '00:01'
      AND ret.arrival_at::time <= time '23:59'
      AND ret.departure_at > o.arrival_at
      AND floor(extract(epoch FROM (ret.departure_at - o.arrival_at)) / 60)::integer >= v_min_ground_minutes
  ), selected_pairs AS (
    SELECT *
    FROM pair_candidates
    WHERE destination_rank = 1
    ORDER BY trip_date ASC,
             ground_minutes DESC,
             outbound_departure_at ASC,
             return_departure_at ASC
    LIMIT v_limit
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', destination || '-' || to_char(trip_date, 'YYYY-MM-DD'),
        'date', to_char(trip_date, 'YYYY-MM-DD'),
        'destination', destination,
        'timeInDestinationMinutes', ground_minutes,
        'observedAt', observed_at,
        'currency', currency,
        'outbound', jsonb_build_object(
          'id', outbound_snapshot_id,
          'origin', upper(outbound_origin),
          'destination', upper(outbound_destination),
          'departureIso', outbound_departure_at,
          'arrivalIso', outbound_arrival_at,
          'departureTime', ltrim(to_char(outbound_departure_at, 'HH12:MI AM'), '0'),
          'arrivalTime', ltrim(to_char(outbound_arrival_at, 'HH12:MI AM'), '0'),
          'duration', outbound_duration,
          'stops', 0,
          'cabin', coalesce(outbound_cabin, 'GoWild'),
          'fares', jsonb_build_object('go_wild', coalesce(outbound_go_wild_total, 0)),
          'goWildSeats', outbound_go_wild_seats
        ),
        'return', jsonb_build_object(
          'id', return_snapshot_id,
          'origin', upper(return_origin),
          'destination', upper(return_destination),
          'departureIso', return_departure_at,
          'arrivalIso', return_arrival_at,
          'departureTime', ltrim(to_char(return_departure_at, 'HH12:MI AM'), '0'),
          'arrivalTime', ltrim(to_char(return_arrival_at, 'HH12:MI AM'), '0'),
          'duration', return_duration,
          'stops', 0,
          'cabin', coalesce(return_cabin, 'GoWild'),
          'fares', jsonb_build_object('go_wild', coalesce(return_go_wild_total, 0)),
          'goWildSeats', return_go_wild_seats
        )
      )
      ORDER BY trip_date ASC, ground_minutes DESC, outbound_departure_at ASC, return_departure_at ASC
    ),
    '[]'::jsonb
  )
    INTO v_day_trips
  FROM selected_pairs;

  RETURN jsonb_build_object(
    'status', CASE WHEN jsonb_array_length(v_day_trips) > 0 THEN 'ready' ELSE 'no_available_day_trips' END,
    'homeAirport', v_home_airport,
    'airportName', v_airport_name,
    'homeCity', v_home_city,
    'homeState', v_home_state,
    'homeAirportTimezone', v_timezone,
    'localDate', v_local_date,
    'dates', to_jsonb(v_dates),
    'minGroundMinutes', v_min_ground_minutes,
    'dayTrips', v_day_trips
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_day_trips_from_snapshots(date[], integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_home_day_trips_from_snapshots(date[], integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_home_day_trips_from_snapshots(date[], integer, integer) TO authenticated;