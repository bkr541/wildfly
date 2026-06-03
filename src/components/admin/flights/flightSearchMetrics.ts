import type { FlightSearchSnapshotSummary, FlightSearchFiltersState } from "./types";
import { DEFAULT_FILTERS } from "./types";
import type { FlightSearchRow } from "@/components/admin/FlightSearchDetailDrawer";
import { getFreshnessStatus } from "@/components/admin/FlightSearchDetailDrawer";

// ── Visible metrics (computed from current page) ──────────────────────────────

export interface VisibleFlightMetrics {
  totalVisible: number;
  goWildFoundCount: number;
  goWildHitRate: number;
  avgResults: number | null;
  allDestinationCount: number;
  agingOrStaleCount: number;
  freshCount: number;
  topOrigin: string | null;
  topOriginCount: number;
  avgSavings: number | null;
}

export function computeVisibleFlightMetrics(
  flights: FlightSearchRow[],
  snapshotSummaries: Record<string, FlightSearchSnapshotSummary>,
): VisibleFlightMetrics {
  if (!flights.length) {
    return {
      totalVisible: 0, goWildFoundCount: 0, goWildHitRate: 0,
      avgResults: null, allDestinationCount: 0, agingOrStaleCount: 0,
      freshCount: 0, topOrigin: null, topOriginCount: 0, avgSavings: null,
    };
  }

  let goWildFoundCount = 0;
  let allDestinationCount = 0;
  let agingOrStaleCount = 0;
  let freshCount = 0;
  let resultSum = 0;
  let resultCount = 0;
  const originCount = new Map<string, number>();
  const savingsList: number[] = [];

  for (const f of flights) {
    if (f.gowild_found) goWildFoundCount++;
    if (f.all_destinations === "Yes") allDestinationCount++;

    const freshness = getFreshnessStatus(f.provider_observed_at ?? f.created_at ?? f.search_timestamp);
    if (freshness === "aging" || freshness === "stale") agingOrStaleCount++;
    if (freshness === "fresh") freshCount++;

    if (f.flight_results_count != null) {
      resultSum += f.flight_results_count;
      resultCount++;
    }

    if (f.departure_airport) {
      originCount.set(f.departure_airport, (originCount.get(f.departure_airport) ?? 0) + 1);
    }

    const summary = snapshotSummaries[f.id];
    if (summary?.avg_savings != null && summary.avg_savings > 0) {
      savingsList.push(summary.avg_savings);
    }
  }

  const topEntry = Array.from(originCount.entries()).sort((a, b) => b[1] - a[1])[0];
  const avgSavings = savingsList.length
    ? savingsList.reduce((a, b) => a + b, 0) / savingsList.length
    : null;

  return {
    totalVisible: flights.length,
    goWildFoundCount,
    goWildHitRate: flights.length ? goWildFoundCount / flights.length : 0,
    avgResults: resultCount ? resultSum / resultCount : null,
    allDestinationCount,
    agingOrStaleCount,
    freshCount,
    topOrigin: topEntry?.[0] ?? null,
    topOriginCount: topEntry?.[1] ?? 0,
    avgSavings,
  };
}

// ── Top origins list ──────────────────────────────────────────────────────────

export interface TopOriginStat {
  iata: string;
  count: number;
  goWildCount: number;
  goWildRate: number;
}

export function getTopOrigins(flights: FlightSearchRow[]): TopOriginStat[] {
  const map = new Map<string, { count: number; goWildCount: number }>();
  for (const f of flights) {
    if (!f.departure_airport) continue;
    const entry = map.get(f.departure_airport) ?? { count: 0, goWildCount: 0 };
    entry.count++;
    if (f.gowild_found) entry.goWildCount++;
    map.set(f.departure_airport, entry);
  }
  return Array.from(map.entries())
    .map(([iata, s]) => ({ iata, ...s, goWildRate: s.count ? s.goWildCount / s.count : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ── Freshness breakdown ───────────────────────────────────────────────────────

export interface FreshnessBreakdown {
  fresh: number;
  recent: number;
  aging: number;
  stale: number;
  unknown: number;
}

export function getFreshnessBreakdown(flights: FlightSearchRow[]): FreshnessBreakdown {
  const counts: FreshnessBreakdown = { fresh: 0, recent: 0, aging: 0, stale: 0, unknown: 0 };
  for (const f of flights) {
    const k = getFreshnessStatus(f.provider_observed_at ?? f.created_at ?? f.search_timestamp);
    counts[k]++;
  }
  return counts;
}

// ── Label formatters ──────────────────────────────────────────────────────────

export function formatRouteLabel(row: FlightSearchRow): string {
  const dest = row.all_destinations === "Yes" ? "All Destinations" : (row.arrival_airport ?? "All Destinations");
  return `${row.departure_airport} → ${dest}`;
}

export function formatSourceLabel(row: FlightSearchRow): string {
  const v = String(row.result_source ?? row.triggered_by ?? "").toLowerCase();
  if (v.includes("cache")) return "Cache Hit";
  if (v.includes("admin_bulk") || v.includes("admin bulk")) return "Admin Bulk";
  if (v.includes("schedul")) return "Scheduled Scan";
  if (v.includes("live") || v.includes("api") || v === "provider") return "Live API";
  if (v) return String(row.result_source ?? row.triggered_by ?? "");
  return "Unknown";
}

export function formatTripTypeLabel(row: FlightSearchRow): string {
  const s = (row.trip_type || "").toLowerCase();
  if (s.includes("round")) return "Round-trip";
  if (s.includes("one")) return "One-way";
  if (s.includes("day")) return "Day Trip";
  if (s.includes("plan")) return "Trip Planner";
  return row.trip_type || "—";
}

// ── GoWild signal ─────────────────────────────────────────────────────────────

export interface GoWildSignalInfo {
  status: "found" | "not_found" | "unknown";
  strength: "strong" | "moderate" | "weak" | null;
  gwCount: number | null;
  totalCount: number | null;
  avgSeats: number | null;
  maxSeats: number | null;
  avgSavings: number | null;
  bestDest: string | null;
}

export function getGoWildSignal(
  row: FlightSearchRow,
  summary: FlightSearchSnapshotSummary | null | undefined,
): GoWildSignalInfo {
  if (row.gowild_found == null) {
    return { status: "unknown", strength: null, gwCount: null, totalCount: null, avgSeats: null, maxSeats: null, avgSavings: null, bestDest: null };
  }
  if (!row.gowild_found) {
    return { status: "not_found", strength: null, gwCount: summary?.gowild_itineraries ?? null, totalCount: summary?.unique_itineraries ?? null, avgSeats: null, maxSeats: null, avgSavings: null, bestDest: null };
  }

  let strength: "strong" | "moderate" | "weak" | null = null;
  if (summary) {
    if (summary.gowild_rate >= 0.5) strength = "strong";
    else if (summary.gowild_rate >= 0.2) strength = "moderate";
    else strength = "weak";
  }

  return {
    status: "found",
    strength,
    gwCount: summary?.gowild_itineraries ?? null,
    totalCount: summary?.unique_itineraries ?? null,
    avgSeats: summary?.avg_gowild_seats ?? null,
    maxSeats: summary?.max_gowild_seats ?? null,
    avgSavings: summary?.avg_savings ?? null,
    bestDest: summary?.best_destination ?? null,
  };
}

export function getFreshnessState(row: FlightSearchRow) {
  return getFreshnessStatus(row.provider_observed_at ?? row.created_at ?? row.search_timestamp);
}

// ── Saved views ───────────────────────────────────────────────────────────────

export type SavedViewId =
  | "all" | "gowild_found" | "no_gowild" | "all_destinations"
  | "stale" | "admin_bulk" | "user_searches";

export interface SavedView {
  id: SavedViewId;
  label: string;
  filters: FlightSearchFiltersState;
}

export const SAVED_VIEWS: SavedView[] = [
  { id: "all",              label: "All Searches",       filters: { ...DEFAULT_FILTERS } },
  { id: "gowild_found",     label: "GoWild Found",        filters: { ...DEFAULT_FILTERS, goWildStatus: "found" } },
  { id: "no_gowild",        label: "No GoWild",           filters: { ...DEFAULT_FILTERS, goWildStatus: "not_found" } },
  { id: "all_destinations", label: "All Destinations",    filters: { ...DEFAULT_FILTERS, allDestinations: "yes" } },
  { id: "stale",            label: "Stale Searches",      filters: { ...DEFAULT_FILTERS, freshness: "stale" } },
  { id: "admin_bulk",       label: "Admin Bulk",          filters: { ...DEFAULT_FILTERS, resultSource: "admin_bulk" } },
  { id: "user_searches",    label: "User Searches",       filters: { ...DEFAULT_FILTERS } },
];

export function getSavedViewFilters(viewId: SavedViewId): FlightSearchFiltersState {
  return SAVED_VIEWS.find((v) => v.id === viewId)?.filters ?? { ...DEFAULT_FILTERS };
}

// ── Detect active saved view from current filter state ────────────────────────

export function getActiveViewId(filters: FlightSearchFiltersState): SavedViewId | null {
  if (!filters.search && !filters.origin && !filters.destination && !filters.tripType &&
      !filters.triggeredBy && !filters.dateFrom && !filters.dateTo &&
      !filters.departureDateFrom && !filters.departureDateTo &&
      !filters.minResults && !filters.maxResults) {
    if (filters.goWildStatus === "found" && filters.allDestinations === "all" && filters.freshness === "all" && !filters.resultSource) return "gowild_found";
    if (filters.goWildStatus === "not_found" && filters.allDestinations === "all" && filters.freshness === "all" && !filters.resultSource) return "no_gowild";
    if (filters.allDestinations === "yes" && filters.goWildStatus === "all" && filters.freshness === "all" && !filters.resultSource) return "all_destinations";
    if (filters.freshness === "stale" && filters.goWildStatus === "all" && filters.allDestinations === "all" && !filters.resultSource) return "stale";
    if (filters.resultSource === "admin_bulk" && filters.goWildStatus === "all" && filters.allDestinations === "all" && filters.freshness === "all") return "admin_bulk";
    if (filters.goWildStatus === "all" && filters.allDestinations === "all" && filters.freshness === "all" && !filters.resultSource) return "all";
  }
  return null;
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

export type SortKey =
  | "departure_date" | "search_timestamp" | "flight_results_count"
  | "gowild_found" | "departure_airport" | "arrival_airport" | "result_source"
  | "freshness";

export type SortDirection = "asc" | "desc";

const FRESHNESS_ORDER: Record<string, number> = { fresh: 4, recent: 3, aging: 2, stale: 1, unknown: 0 };

export function sortFlights(
  flights: FlightSearchRow[],
  key: SortKey,
  dir: SortDirection,
): FlightSearchRow[] {
  return [...flights].sort((a, b) => {
    let av: string | number | boolean | null = null;
    let bv: string | number | boolean | null = null;

    switch (key) {
      case "departure_date":
        av = a.departure_date ?? "";
        bv = b.departure_date ?? "";
        break;
      case "search_timestamp":
        av = a.search_timestamp ?? "";
        bv = b.search_timestamp ?? "";
        break;
      case "flight_results_count":
        av = a.flight_results_count ?? -1;
        bv = b.flight_results_count ?? -1;
        break;
      case "gowild_found":
        av = a.gowild_found ? 1 : 0;
        bv = b.gowild_found ? 1 : 0;
        break;
      case "departure_airport":
        av = a.departure_airport ?? "";
        bv = b.departure_airport ?? "";
        break;
      case "arrival_airport":
        av = a.arrival_airport ?? "";
        bv = b.arrival_airport ?? "";
        break;
      case "result_source":
        av = formatSourceLabel(a);
        bv = formatSourceLabel(b);
        break;
      case "freshness":
        av = FRESHNESS_ORDER[getFreshnessStatus(a.provider_observed_at ?? a.created_at ?? a.search_timestamp)] ?? 0;
        bv = FRESHNESS_ORDER[getFreshnessStatus(b.provider_observed_at ?? b.created_at ?? b.search_timestamp)] ?? 0;
        break;
    }

    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));

    return dir === "asc" ? cmp : -cmp;
  });
}
