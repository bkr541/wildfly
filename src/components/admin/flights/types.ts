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
  routeType: "all" | "domestic" | "international";
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
  routeType: "all",
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
    f.routeType !== "all" || f.freshness !== "all" || f.dateFrom || f.dateTo || f.departureDateFrom ||
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
  if (f.routeType !== "all") n++;
  if (f.freshness !== "all") n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.departureDateFrom || f.departureDateTo) n++;
  if (f.minResults || f.maxResults) n++;
  return n;
}

// ── Column configuration ──────────────────────────────────────────────────────

export type ColumnKey =
  | "route" | "user" | "departure" | "trip" | "source"
  | "gowild_signal" | "results_quality" | "freshness" | "actions"
  | "search_id" | "return_date" | "triggered_by" | "credits_cost"
  | "snapshot_count" | "avg_savings" | "avg_seats" | "best_destination";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  optional: boolean;
  width: string;
}

export const ALL_COLUMN_DEFS: ColumnDef[] = [
  { key: "route",           label: "Route",           optional: false, width: "minmax(180px,2fr)" },
  { key: "user",            label: "User",            optional: false, width: "minmax(100px,1.2fr)" },
  { key: "departure",       label: "Departure",       optional: false, width: "100px" },
  { key: "trip",            label: "Trip",            optional: false, width: "90px" },
  { key: "source",          label: "Source",          optional: false, width: "110px" },
  { key: "gowild_signal",   label: "GoWild Signal",   optional: false, width: "minmax(130px,1.6fr)" },
  { key: "results_quality", label: "Results",         optional: false, width: "minmax(110px,1.2fr)" },
  { key: "freshness",       label: "Freshness",       optional: false, width: "110px" },
  { key: "actions",         label: "",                optional: false, width: "80px" },
  { key: "search_id",       label: "Search ID",       optional: true,  width: "120px" },
  { key: "return_date",     label: "Return Date",     optional: true,  width: "100px" },
  { key: "triggered_by",    label: "Triggered By",    optional: true,  width: "120px" },
  { key: "credits_cost",    label: "Credits",         optional: true,  width: "80px" },
  { key: "snapshot_count",  label: "Snapshots",       optional: true,  width: "90px" },
  { key: "avg_savings",     label: "Avg Savings",     optional: true,  width: "100px" },
  { key: "avg_seats",       label: "Avg Seats",       optional: true,  width: "90px" },
  { key: "best_destination",label: "Best Dest",       optional: true,  width: "90px" },
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  "route", "user", "departure", "trip", "source",
  "gowild_signal", "results_quality", "freshness", "actions",
];

export const COLUMNS_STORAGE_KEY = "wildfly.admin.flights.columns";
