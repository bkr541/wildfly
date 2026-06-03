// ── Snapshot summary returned by the list endpoint ───────────────────────────

export interface FlightSearchSnapshotSummary {
  flight_search_id: string;
  snapshot_rows: number;
  unique_itineraries: number;
  gowild_itineraries: number;
  gowild_rate: number;
  avg_gowild_seats: number | null;
  max_gowild_seats: number | null;
  min_gowild_fare: number | null;
  avg_savings: number | null;
  nonstop_count: number;
  connecting_count: number;
  sold_out_count: number;
  best_destination: string | null;
  best_destination_score: number | null;
  last_snapshot_at: string | null;
}

// ── Filter state ──────────────────────────────────────────────────────────────

export interface FlightSearchFiltersState {
  search: string;
  origin: string;
  destination: string;
  tripType: string;
  resultSource: string;
  triggeredBy: string;
  goWildStatus: "all" | "found" | "not_found";
  allDestinations: "all" | "yes" | "no";
  freshness: "all" | "fresh" | "recent" | "aging" | "stale" | "unknown";
  dateFrom: string;
  dateTo: string;
  departureDateFrom: string;
  departureDateTo: string;
  minResults: string;
  maxResults: string;
}

export type FlightSearchViewMode = "table" | "timeline";

export const DEFAULT_FILTERS: FlightSearchFiltersState = {
  search: "",
  origin: "",
  destination: "",
  tripType: "",
  resultSource: "",
  triggeredBy: "",
  goWildStatus: "all",
  allDestinations: "all",
  freshness: "all",
  dateFrom: "",
  dateTo: "",
  departureDateFrom: "",
  departureDateTo: "",
  minResults: "",
  maxResults: "",
};

export function hasActiveFilters(f: FlightSearchFiltersState): boolean {
  return !!(
    f.search || f.origin || f.destination || f.tripType || f.resultSource ||
    f.triggeredBy || f.goWildStatus !== "all" || f.allDestinations !== "all" ||
    f.freshness !== "all" || f.dateFrom || f.dateTo || f.departureDateFrom ||
    f.departureDateTo || f.minResults || f.maxResults
  );
}

export function countActiveFilters(f: FlightSearchFiltersState): number {
  let n = 0;
  if (f.search) n++;
  if (f.origin) n++;
  if (f.destination) n++;
  if (f.tripType) n++;
  if (f.resultSource) n++;
  if (f.triggeredBy) n++;
  if (f.goWildStatus !== "all") n++;
  if (f.allDestinations !== "all") n++;
  if (f.freshness !== "all") n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.departureDateFrom || f.departureDateTo) n++;
  if (f.minResults || f.maxResults) n++;
  return n;
}
