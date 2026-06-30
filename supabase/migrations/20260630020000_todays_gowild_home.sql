-- Today's GoWild home feed
-- Exposes the newest scheduled inventory for the authenticated user's home
-- airport without weakening RLS or consuming a user-initiated search.

CREATE INDEX IF NOT EXISTS idx_flight_searches_scheduled_origin_date_latest
  ON public.flight_searches (
    departure_airport,
    departure_date,
    provider_observed_at DESC,
    search_timestamp DESC
  )
  WHERE triggered_by = 'scheduled_bulk_search'
    AND result_source = 'scheduled_bulk_search';

CREATE INDEX IF NOT EXISTS idx_flight_snapshots_available_by_search
  ON public.flight_snapshots (
    flight_search_id,
    departure_at,
    stable_itinerary_key
  )
  WHERE has_go_wild = true
    AND availability_status = 'returned';

CREATE OR REPLACE FUNCTION public.gowild_timezone_group(p_timezone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_timezone = ANY (ARRAY[
      'America/New_York', 'America/Detroit', 'America/Indiana/Indianapolis',
      'America/Indiana/Marengo', 'America/Indiana/Petersburg',
      'America/Indiana/Vevay', 'America/Indiana/Vincennes',
      'America/Indiana/Winamac', 'America/Kentucky/Louisville',
      'America/Kentucky/Monticello', 'America/Toronto', 'America/Nassau',
      'America/Port-au-Prince', 'America/Jamaica', 'America/Cancun',
      'America/Panama'
    ]) THEN 'ET'
    WHEN p_timezone = ANY (ARRAY[
      'America/Chicago', 'America/Indiana/Knox', 'America/Indiana/Tell_City',
      'America/Menominee', 'America/North_Dakota/Center',
      'America/North_Dakota/New_Salem', 'America/North_Dakota/Beulah',
      'America/Winnipeg', 'America/Mexico_City', 'America/Monterrey',
      'America/Merida', 'America/Matamoros', 'America/Tegucigalpa',
      'America/Belize', 'America/Costa_Rica', 'America/El_Salvador',
      'America/Guatemala', 'America/Managua'
    ]) THEN 'CT'
    WHEN p_timezone = ANY (ARRAY[
      'America/Denver', 'America/Boise', 'America/Phoenix',
      'America/Ojinaga', 'America/Chihuahua', 'America/Mazatlan'
    ]) THEN 'MT'
    WHEN p_timezone = ANY (ARRAY[
      'America/Los_Angeles', 'America/Vancouver', 'America/Tijuana',
      'America/Anchorage', 'America/Juneau', 'America/Sitka',
      'America/Nome', 'Pacific/Honolulu'
    ]) THEN 'PT'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_todays_home_gowild_flights()
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
  v_timezone_group text;
  v_local_date date;
  v_search_id uuid;
  v_observed_at timestamptz;
  v_job_status text;
  v_flights jsonb := '[]'::jsonb;
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
      'flights', '[]'::jsonb
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
      'flights', '[]'::jsonb
    );
  END IF;

  v_local_date := (now() AT TIME ZONE v_timezone)::date;
  v_timezone_group := public.gowild_timezone_group(v_timezone);

  SELECT fs.id,
         coalesce(fs.provider_observed_at, fs.search_timestamp)
    INTO v_search_id, v_observed_at
  FROM public.flight_searches fs
  WHERE upper(fs.departure_airport) = v_home_airport
    AND fs.departure_date = v_local_date
    AND fs.triggered_by = 'scheduled_bulk_search'
    AND fs.result_source = 'scheduled_bulk_search'
  ORDER BY fs.provider_observed_at DESC NULLS LAST,
           fs.search_timestamp DESC
  LIMIT 1;

  IF v_timezone_group IS NOT NULL THEN
    SELECT b.status
      INTO v_job_status
    FROM public.bulk_search_job_logs b
    WHERE b.timezone_group = v_timezone_group
      AND b.target_date = v_local_date
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
      'homeAirportTimezone', v_timezone,
      'localDate', v_local_date,
      'jobStatus', v_job_status,
      'flights', '[]'::jsonb
    );
  END IF;

  WITH ranked AS (
    SELECT fs.*,
           row_number() OVER (
             PARTITION BY coalesce(fs.stable_itinerary_key, fs.source_itinerary_id)
             ORDER BY fs.snapshot_at DESC, fs.id DESC
           ) AS row_rank
    FROM public.flight_snapshots fs
    WHERE fs.flight_search_id = v_search_id
      AND fs.has_go_wild = true
      AND fs.availability_status = 'returned'
  ), available AS (
    SELECT r.*,
           da.timezone AS destination_timezone,
           coalesce(dl.city, dl.name) AS destination_city,
           dl.state_code AS destination_state
    FROM ranked r
    LEFT JOIN public.airports da
      ON upper(da.iata_code) = upper(r.leg_destination_iata)
    LEFT JOIN public.locations dl
      ON dl.id = da.location_id
    WHERE r.row_rank = 1
    ORDER BY r.departure_at ASC, r.leg_destination_iata ASC
    LIMIT 150
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'itineraryKey', coalesce(a.stable_itinerary_key, a.source_itinerary_id),
        'airline', a.airline,
        'flightNumber', a.flight_number,
        'originIata', a.leg_origin_iata,
        'destinationIata', a.leg_destination_iata,
        'destinationCity', a.destination_city,
        'destinationState', a.destination_state,
        'destinationTimezone', a.destination_timezone,
        'departureDate', to_char(a.departure_at, 'YYYY-MM-DD'),
        'departureTime', ltrim(to_char(a.departure_at, 'HH12:MI AM'), '0'),
        'arrivalDate', to_char(a.arrival_at, 'YYYY-MM-DD'),
        'arrivalTime', ltrim(to_char(a.arrival_at, 'HH12:MI AM'), '0'),
        'flightType', a.flight_type,
        'stops', a.stops,
        'duration', a.total_duration_display,
        'cabin', a.display_cabin,
        'goWildPrice', a.go_wild_total,
        'standardPrice', a.standard_total,
        'availableSeats', a.go_wild_available_seats,
        'currency', coalesce(a.currency, 'USD')
      )
      ORDER BY a.departure_at ASC, a.leg_destination_iata ASC
    ),
    '[]'::jsonb
  )
    INTO v_flights
  FROM available a;

  v_status := CASE
    WHEN jsonb_array_length(v_flights) > 0 THEN 'ready'
    ELSE 'no_available_flights'
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'homeAirport', v_home_airport,
    'airportName', v_airport_name,
    'homeCity', v_home_city,
    'homeState', v_home_state,
    'homeAirportTimezone', v_timezone,
    'localDate', v_local_date,
    'observedAt', v_observed_at,
    'jobStatus', v_job_status,
    'flights', v_flights
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_todays_home_gowild_flights() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_todays_home_gowild_flights() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_todays_home_gowild_flights() TO authenticated;

-- Preserve existing custom ordering by appending the new widget. New accounts
-- receive it first through the application defaults added in this patch.
INSERT INTO public.user_homepage (user_id, component_name, "order", status)
SELECT users.user_id,
       'todays_gowild_flights',
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
LEFT JOIN public.user_homepage existing
  ON existing.user_id = users.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_homepage check_row
  WHERE check_row.user_id = users.user_id
    AND check_row.component_name = 'todays_gowild_flights'
)
GROUP BY users.user_id;
