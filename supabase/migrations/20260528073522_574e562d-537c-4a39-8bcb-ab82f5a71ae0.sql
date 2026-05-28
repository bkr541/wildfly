
CREATE OR REPLACE FUNCTION public.mark_disappeared_gowild_observations_admin(
  p_flight_search_id uuid,
  p_origin_iata text,
  p_destination_iata text,
  p_travel_date date,
  p_returned_stable_keys text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted int := 0;
BEGIN
  -- No auth.uid() check: this variant is intended for service-role callers
  -- (scheduled jobs / admin bulk searches). Callers must already be
  -- authenticated via the service role key; RLS does not apply.

  IF p_flight_search_id IS NULL THEN
    RAISE EXCEPTION 'p_flight_search_id is required';
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.mark_disappeared_gowild_observations_admin(uuid, text, text, date, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_disappeared_gowild_observations_admin(uuid, text, text, date, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.mark_disappeared_gowild_observations_admin(uuid, text, text, date, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_disappeared_gowild_observations_admin(uuid, text, text, date, text[]) TO service_role;
