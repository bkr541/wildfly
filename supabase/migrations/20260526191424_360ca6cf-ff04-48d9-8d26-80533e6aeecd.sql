
CREATE OR REPLACE FUNCTION public.get_global_gowild_insight_snapshots(
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  source_itinerary_id text,
  leg_index smallint,
  origin_iata text,
  leg_origin_iata text,
  leg_destination_iata text,
  departure_at timestamp without time zone,
  arrival_at timestamp without time zone,
  snapshot_at timestamptz,
  has_go_wild boolean,
  go_wild_available_seats integer,
  go_wild_total numeric,
  standard_total numeric,
  stops smallint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RAISE EXCEPTION 'p_limit must be greater than 0';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'p_offset must be zero or greater';
  END IF;

  RETURN QUERY
  SELECT
    fsnap.id,
    -- Derived analytics observation key: combines the upstream search id with
    -- the upstream itinerary id so identical source_itinerary_id values from
    -- different searches never collide when grouped on the client. Aliased as
    -- source_itinerary_id so frontend grouping logic stays unchanged. The raw
    -- flight_search_id is intentionally NOT returned separately.
    (fsnap.flight_search_id::text || ':' || fsnap.source_itinerary_id) AS source_itinerary_id,
    fsnap.leg_index,
    fsnap.origin_iata,
    fsnap.leg_origin_iata,
    fsnap.leg_destination_iata,
    fsnap.departure_at,
    fsnap.arrival_at,
    fsnap.snapshot_at,
    fsnap.has_go_wild,
    fsnap.go_wild_available_seats,
    fsnap.go_wild_total,
    fsnap.standard_total,
    fsnap.stops
  FROM public.flight_snapshots fsnap
  WHERE p_since IS NULL OR fsnap.snapshot_at >= p_since
  ORDER BY fsnap.snapshot_at DESC, fsnap.id DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_global_gowild_insight_snapshots(timestamptz, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_global_gowild_insight_snapshots(timestamptz, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_global_gowild_insight_snapshots(timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_gowild_insight_snapshots(timestamptz, integer, integer) TO service_role;
