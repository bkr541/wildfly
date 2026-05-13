// Shared types for GoWild Insights itinerary-level analytics

export type RawSnapshotRow = {
  id: string;
  source_itinerary_id: string | null;
  leg_index: number | null;
  origin_iata: string | null;
  destination_iata?: string | null;
  leg_origin_iata: string | null;
  leg_destination_iata: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  snapshot_at: string;
  has_go_wild: boolean | string | number | null;
  go_wild_available_seats: number | null;
  go_wild_total: number | null;
  standard_total: number | null;
};

export type Itinerary = {
  itineraryId: string;
  legs: RawSnapshotRow[];
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
  isDirect: boolean;
};

export type LimitedDataMeta = {
  limitedData: boolean;
  qualifiedCount: number;
  threshold: number;
};
