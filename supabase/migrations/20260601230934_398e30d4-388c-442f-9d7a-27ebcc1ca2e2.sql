CREATE OR REPLACE FUNCTION public.get_route_gowild_seat_calendar(
  p_origin_iata text,
  p_destination_iata text,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(travel_date date, available_seats integer, available_flights integer, last_observed_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      fs.departure_at::date AS td,
      coalesce(
        fs.stable_itinerary_key,
        fs.source_itinerary_id,
        concat_ws('|', fs.leg_origin_iata, fs.leg_destination_iata, fs.airline, fs.flight_number, fs.departure_at::text, fs.arrival_at::text)
      ) AS itin_key,
      fs.has_go_wild,
      fs.availability_status,
      coalesce(fs.go_wild_available_seats, 0) AS seats,
      fs.snapshot_at
    FROM public.flight_snapshots fs
    WHERE upper(fs.leg_origin_iata) = upper(p_origin_iata)
      AND upper(fs.leg_destination_iata) = upper(p_destination_iata)
      AND fs.departure_at::date BETWEEN p_start_date AND p_end_date
  ),
  latest_per_itinerary_per_day AS (
    SELECT DISTINCT ON (b.td, b.itin_key)
      b.td,
      b.itin_key,
      b.has_go_wild,
      b.availability_status,
      b.seats,
      b.snapshot_at
    FROM base b
    ORDER BY b.td, b.itin_key, b.snapshot_at DESC
  )
  SELECT
    l.td AS travel_date,
    coalesce(max(CASE WHEN l.availability_status = 'returned' AND l.has_go_wild THEN l.seats ELSE 0 END)::integer, 0) AS available_seats,
    coalesce(sum(CASE WHEN l.availability_status = 'returned' AND l.has_go_wild AND l.seats > 0 THEN 1 ELSE 0 END)::integer, 0) AS available_flights,
    max(l.snapshot_at) AS last_observed_at
  FROM latest_per_itinerary_per_day l
  GROUP BY l.td
  ORDER BY l.td;
$$;

REVOKE ALL ON FUNCTION public.get_route_gowild_seat_calendar(text, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_route_gowild_seat_calendar(text, text, date, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_route_gowild_seat_calendar(text, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_route_gowild_seat_calendar(text, text, date, date) TO service_role;