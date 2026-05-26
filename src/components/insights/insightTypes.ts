// Shared types for GoWild Insights itinerary-level analytics.

export type FlightLegRow = {
  id: string;
  /**
   * Analytics observation key for grouping legs into itineraries.
   *
   * IMPORTANT: When sourced from the `get_global_gowild_insight_snapshots`
   * RPC (the only source used by GoWild Insights), this is NOT the raw
   * upstream itinerary id — it is a derived globally unique key of the form
   * `<flight_search_id>:<source_itinerary_id>`. This guarantees that
   * identical raw itinerary ids observed in different searches remain
   * distinct itinerary observations and are never merged by the client.
   */
  source_itinerary_id: string | null;
  leg_index: number | null;

  origin_iata?: string | null;
  destination_iata?: string | null;
  leg_origin_iata: string | null;
  leg_destination_iata: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  snapshot_at: string;
  has_go_wild: boolean | string | number | null;
  go_wild_available_seats?: number | null;
  go_wild_total?: number | null;
  standard_total?: number | null;
  stops?: number | null;
};

export type Itinerary = {
  itineraryId: string;
  legs: FlightLegRow[];
  origin: string;
  destination: string;
  routeKey: string;
  routeLabel: string;
  departureAt: string | null;
  arrivalAt: string | null;
  snapshotAt: string;
  isGoWildAvailable: boolean;
  availableSeats: number;
  totalGoWildPrice: number | null;
  totalStandardPrice: number | null;
};
