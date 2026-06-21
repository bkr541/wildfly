// Shared types for the styled radar route map.
// These are the public-facing shapes consumed by RadarStyledRouteMap and its layers.

export type RadarMode =
  | "availability"
  | "seats"
  | "savings"
  | "freshness"
  | "searchDemand"
  | "volatility";

export interface RadarCurrentSearch {
  hasGoWild?: boolean;
  hasNonstop?: boolean;
  flightCount?: number;
  minFare?: number | null;
  city?: string;
  stateCode?: string;
  country?: string;
}

export interface RadarStyledRoute {
  routeKey: string;
  origin: string;
  destination: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  snapshotCount: number;
  goWildCount: number;
  availabilityRate: number | null;
  avgGoWildSeats: number | null;
  avgGoWildFare: number | null;
  avgSavings: number | null;
  searchCount: number;
  volatilityScore: number | null;
  freshnessStatus: string;
  isStale: boolean;
  bookabilityScore?: number | null;
  bookabilityStatus?: string | null;
  currentSearch?: RadarCurrentSearch;
  metadata?: Record<string, unknown>;
}

export interface RadarStyledAirport {
  iata: string;
  lat: number;
  lng: number;
  name?: string;
  city?: string;
  routeCount: number;
  searchVolume: number;
  avgAvailabilityRate: number | null;
  avgSeats: number | null;
  avgSavings: number | null;
  freshnessStatus: string;
  opportunityStrength?: string;
}
