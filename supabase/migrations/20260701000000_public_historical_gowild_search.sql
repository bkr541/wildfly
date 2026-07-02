-- Public, read-only historical GoWild explorer for /gowild-guide.
--
-- The RPC returns one sanitized, snapshot-backed All Destinations search for a
-- past travel date. It never calls the provider, consumes search credits, or
-- creates new flight_searches / flight_snapshots rows.

CREATE INDEX IF NOT EXISTS idx_flight_searches_public_history_lookup
  ON public.flight_searches (departure_airport, departure_date, search_timestamp DESC)
  WHERE all_destinations = 'Yes' AND arrival_airport IS NULL;

CREATE OR REPLACE FUNCTION public.get_public_historical_gowild_search(
  p_origin_iata text,
  p_travel_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origin text := upper(trim(coalesce(p_origin_iata, '')));
  v_search public.flight_searches%ROWTYPE;
  v_flights jsonb;
  v_source text := 'stored_search';
  v_observed_at timestamptz;
BEGIN
  IF v_origin !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'A valid three-letter airport code is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_travel_date IS NULL OR p_travel_date >= current_date THEN
    RAISE EXCEPTION 'Historical searches require a date before today'
      USING ERRCODE = '22023';
  END IF;

  SELECT fs.*
  INTO v_search
  FROM public.flight_searches fs
  WHERE fs.departure_airport = v_origin
    AND fs.departure_date = p_travel_date
    AND fs.all_destinations = 'Yes'
    AND fs.arrival_airport IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.flight_snapshots snapshot
      WHERE snapshot.flight_search_id = fs.id
        AND snapshot.availability_status <> 'not_returned'
    )
  ORDER BY coalesce(fs.provider_observed_at, fs.search_timestamp) DESC,
           fs.search_timestamp DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_observed_at := coalesce(v_search.provider_observed_at, v_search.search_timestamp);

  -- Current records store the normalized provider response directly in
  -- flight_searches.json_body. Older records may wrap it in response.flights.
  -- Use that exact stored payload whenever available so connecting itineraries
  -- retain their original legs, fares, and timing details.
  IF jsonb_typeof(v_search.json_body -> 'flights') = 'array' THEN
    v_flights := v_search.json_body -> 'flights';
  ELSIF jsonb_typeof(v_search.json_body -> 'response' -> 'flights') = 'array' THEN
    v_flights := v_search.json_body -> 'response' -> 'flights';
  END IF;

  -- Snapshot fallback for legacy rows that have no normalized json_body. Only
  -- returned provider rows are included; synthetic disappearance observations
  -- are deliberately excluded from the replay.
  IF v_flights IS NULL THEN
    v_source := 'flight_snapshots';

    SELECT coalesce(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', snapshot.source_itinerary_id,
            'airline', snapshot.airline,
            'flightNumber', snapshot.flight_number,
            'origin', snapshot.leg_origin_iata,
            'destination', snapshot.leg_destination_iata,
            'departureTime', snapshot.departure_at,
            'arrivalTime', snapshot.arrival_at,
            'stops', coalesce(snapshot.stops, 0),
            'flightType', snapshot.flight_type,
            'total_duration', snapshot.total_duration_display,
            'price', coalesce(
              snapshot.display_price,
              snapshot.go_wild_total,
              snapshot.discount_den_total,
              snapshot.standard_total
            ),
            'currency', coalesce(snapshot.currency, 'USD'),
            'legs', jsonb_build_array(
              jsonb_build_object(
                'origin', snapshot.leg_origin_iata,
                'destination', snapshot.leg_destination_iata,
                'departure_time', snapshot.departure_at,
                'arrival_time', snapshot.arrival_at
              )
            ),
            'fares', jsonb_build_object(
              'basic', coalesce(
                snapshot.display_price,
                snapshot.go_wild_total,
                snapshot.discount_den_total,
                snapshot.standard_total
              ),
              'economy', snapshot.discount_den_total,
              'premium', snapshot.standard_total,
              'business', NULL,
              'go_wild', snapshot.go_wild_total,
              'discount_den', snapshot.discount_den_total,
              'standard', snapshot.standard_total,
              'miles', snapshot.miles_total
            ),
            'rawPayload', jsonb_build_object(
              'total_trip_time', snapshot.total_duration_display,
              'fares', jsonb_build_object(
                'go_wild', jsonb_build_object(
                  'total', snapshot.go_wild_total,
                  'available_seats', snapshot.go_wild_available_seats,
                  'fare_status', snapshot.go_wild_fare_status,
                  'loyalty_points', snapshot.go_wild_loyalty_points
                ),
                'discount_den', jsonb_build_object(
                  'total', snapshot.discount_den_total,
                  'available_seats', snapshot.discount_den_available_seats,
                  'fare_status', snapshot.discount_den_fare_status,
                  'loyalty_points', snapshot.discount_den_loyalty_points
                ),
                'standard', jsonb_build_object(
                  'total', snapshot.standard_total,
                  'available_seats', snapshot.standard_available_seats,
                  'fare_status', snapshot.standard_fare_status,
                  'loyalty_points', snapshot.standard_loyalty_points
                ),
                'miles', jsonb_build_object(
                  'total', snapshot.miles_total,
                  'available_seats', snapshot.miles_available_seats,
                  'fare_status', snapshot.miles_fare_status,
                  'loyalty_points', snapshot.miles_loyalty_points
                )
              ),
              'segments', jsonb_build_array(
                jsonb_build_object(
                  'departure_airport', snapshot.leg_origin_iata,
                  'arrival_airport', snapshot.leg_destination_iata,
                  'departure_time', snapshot.departure_at,
                  'arrival_time', snapshot.arrival_at,
                  'airline', snapshot.airline,
                  'flight_number', snapshot.flight_number
                )
              )
            )
          )
        )
        ORDER BY snapshot.departure_at, snapshot.leg_destination_iata, snapshot.flight_number
      ),
      '[]'::jsonb
    )
    INTO v_flights
    FROM public.flight_snapshots snapshot
    WHERE snapshot.flight_search_id = v_search.id
      AND snapshot.availability_status <> 'not_returned';
  END IF;

  RETURN jsonb_build_object(
    'origin', v_origin,
    'travelDate', p_travel_date,
    'observedAt', v_observed_at,
    'source', v_source,
    'flights', coalesce(v_flights, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_historical_gowild_search(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_historical_gowild_search(text, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_historical_gowild_search(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_historical_gowild_search(text, date) TO service_role;

COMMENT ON FUNCTION public.get_public_historical_gowild_search(text, date) IS
  'Returns one sanitized, snapshot-backed historical All Destinations search for a past airport/date without invoking a live provider search.';
