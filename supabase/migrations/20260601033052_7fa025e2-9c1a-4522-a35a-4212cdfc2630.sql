CREATE OR REPLACE FUNCTION public.get_route_gowild_seat_calendar(
  p_origin_iata text,
  p_destination_iata text,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(travel_date date, available_seats integer, available_flights integer, last_observed_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH base AS (
    -- Every snapshot for this route in range, regardless of user / cron / cache.
    -- Fall back to source_itinerary_id when stable_itinerary_key is missing so
    -- nothing gets dropped just because the key wasn't computed.
    SELECT
      fs.flight_search_id,
      coalesce(fs.stable_itinerary_key, fs.source_itinerary_id) AS itin_key,
      fs.departure_at::date AS td,
      fs.has_go_wild,
      fs.availability_status,
      coalesce(fs.go_wild_available_seats, 0) AS seats,
      fs.snapshot_at
    FROM public.flight_snapshots fs
    WHERE fs.leg_origin_iata = upper(p_origin_iata)
      AND fs.leg_destination_iata = upper(p_destination_iata)
      AND fs.departure_at::date BETWEEN p_start_date AND p_end_date
  ),
  latest_per_itin AS (
    -- Most recent snapshot per itinerary key (across all searches/users).
    SELECT DISTINCT ON (itin_key)
      itin_key, td, has_go_wild, availability_status, seats, snapshot_at
    FROM base
    ORDER BY itin_key, snapshot_at DESC
  )
  SELECT
    l.td AS travel_date,
    coalesce(sum(CASE WHEN l.availability_status = 'returned' AND l.has_go_wild THEN l.seats ELSE 0 END)::int, 0) AS available_seats,
    coalesce(sum(CASE WHEN l.availability_status = 'returned' AND l.has_go_wild AND l.seats > 0 THEN 1 ELSE 0 END)::int, 0) AS available_flights,
    max(l.snapshot_at) AS last_observed_at
  FROM latest_per_itin l
  GROUP BY l.td
  ORDER BY l.td;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_route_gowild_seat_calendar(text, text, date, date) TO authenticated;