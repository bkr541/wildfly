// Itinerary-level airport stats. Used by Top Origin / Top Destination cards.
import type { Itinerary, LimitedDataMeta } from "./insightTypes";

// Re-export legacy leg-level types so existing imports keep working.
// These are kept for the (leg-level) availability heatmap card.
export type FlightSnapshot = {
  id: string;
  flight_search_id?: string | null;
  snapshot_at: string;
  departure_at: string | null;
  leg_origin_iata: string | null;
  leg_destination_iata: string | null;
  origin_iata?: string | null;
  destination_iata?: string | null;
  has_go_wild: boolean | string | number | null;
  go_wild_total?: number | null;
  standard_total?: number | null;
  go_wild_available_seats?: number | null;
};

export type DateRange = { start: string; end: string };

export type AirportInsightsProps = {
  snapshots: FlightSnapshot[];
  dateRange?: DateRange;
};

export type Confidence = "high" | "medium" | "low";

export type AirportStat = {
  code: string;
  totalItineraries: number;
  goWildItineraries: number;
  goWildRate: number;
  avgSeats: number | null;
  confidence: Confidence;
  // Back-compat aliases (some legacy components still read these)
  totalLegs: number;
  goWildLegs: number;
  avgSavings: number | null;
};

export type AirportStatsResult = LimitedDataMeta & {
  rows: AirportStat[];
};

export type HeatmapCell = {
  totalLegs: number;
  goWildLegs: number;
  goWildRate: number;
} | null;

export type HeatmapRow = {
  airport: string;
  cells: HeatmapCell[];
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const ORIGIN_DEST_THRESHOLD = 30;
const TARGET_RESULTS = 5;

export function isGoWild(value: boolean | string | number | null | undefined): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1";
  }
  return false;
}

export function normalizeAirport(code: string | null | undefined): string | null {
  if (!code) return null;
  const t = code.trim().toUpperCase();
  if (t.length < 2 || t.length > 4) return null;
  return t;
}

export function inDateRange(date: string, range: DateRange): boolean {
  const t = new Date(date).getTime();
  if (isNaN(t)) return false;
  return t >= new Date(range.start).getTime() && t <= new Date(range.end).getTime();
}

export function getFilteredSnapshots(snapshots: FlightSnapshot[], dateRange?: DateRange): FlightSnapshot[] {
  if (!dateRange) return snapshots;
  return snapshots.filter((s) => inDateRange(s.snapshot_at, dateRange));
}

export function getAirportConfidence(total: number): Confidence {
  if (total >= 30) return "high";
  if (total >= 10) return "medium";
  return "low";
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + "%";
}

export function getWeekdayFromDeparture(departure_at: string | null | undefined): number | null {
  if (!departure_at) return null;
  const d = new Date(departure_at);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

// ─── Itinerary-level airport calculations ────────────────────────────────────

function buildAirportStatsFromItineraries(
  itineraries: Itinerary[],
  pick: (it: Itinerary) => string
): AirportStatsResult {
  type Entry = { total: number; goWild: number; seats: number[] };
  const map = new Map<string, Entry>();

  for (const it of itineraries) {
    const code = pick(it);
    if (!code) continue;
    if (!map.has(code)) map.set(code, { total: 0, goWild: 0, seats: [] });
    const e = map.get(code)!;
    e.total++;
    if (it.isGoWildAvailable) {
      e.goWild++;
      if (it.availableSeats > 0) e.seats.push(it.availableSeats);
    }
  }

  const all: AirportStat[] = Array.from(map.entries()).map(([code, d]) => ({
    code,
    totalItineraries: d.total,
    goWildItineraries: d.goWild,
    goWildRate: d.total > 0 ? (d.goWild / d.total) * 100 : 0,
    avgSeats:
      d.seats.length > 0 ? d.seats.reduce((a, b) => a + b, 0) / d.seats.length : null,
    confidence: getAirportConfidence(d.total),
    // back-compat aliases
    totalLegs: d.total,
    goWildLegs: d.goWild,
    avgSavings: null,
  }));

  const sortFn = (a: AirportStat, b: AirportStat) =>
    b.goWildRate - a.goWildRate ||
    b.goWildItineraries - a.goWildItineraries ||
    b.totalItineraries - a.totalItineraries;

  const qualified = all.filter((s) => s.totalItineraries >= ORIGIN_DEST_THRESHOLD);

  if (qualified.length >= TARGET_RESULTS) {
    return {
      rows: qualified.sort(sortFn).slice(0, TARGET_RESULTS),
      limitedData: false,
      qualifiedCount: qualified.length,
      threshold: ORIGIN_DEST_THRESHOLD,
    };
  }

  // Fallback: not enough qualified — show best available, flag limited data.
  return {
    rows: all
      .filter((s) => s.totalItineraries >= 3)
      .sort(sortFn)
      .slice(0, TARGET_RESULTS),
    limitedData: true,
    qualifiedCount: qualified.length,
    threshold: ORIGIN_DEST_THRESHOLD,
  };
}

export function getOriginAirportStatsFromItineraries(
  itineraries: Itinerary[]
): AirportStatsResult {
  return buildAirportStatsFromItineraries(itineraries, (it) => it.origin);
}

export function getDestinationAirportStatsFromItineraries(
  itineraries: Itinerary[]
): AirportStatsResult {
  return buildAirportStatsFromItineraries(itineraries, (it) => it.destination);
}

// ─── Legacy leg-level heatmap (kept for the operational availability heatmap) ─

export function getHeatmapData(snapshots: FlightSnapshot[]): HeatmapRow[] {
  type AirportEntry = { total: number; cells: { total: number; goWild: number }[] };
  const map = new Map<string, AirportEntry>();

  for (const s of snapshots) {
    const dayIdx = getWeekdayFromDeparture(s.departure_at);
    if (dayIdx === null) continue;
    const code = normalizeAirport(s.leg_origin_iata) ?? normalizeAirport(s.origin_iata);
    if (!code) continue;
    if (!map.has(code))
      map.set(code, { total: 0, cells: Array.from({ length: 7 }, () => ({ total: 0, goWild: 0 })) });
    const e = map.get(code)!;
    e.total++;
    e.cells[dayIdx].total++;
    if (isGoWild(s.has_go_wild)) e.cells[dayIdx].goWild++;
  }

  return Array.from(map.entries())
    .filter(([, d]) => d.cells.some((c) => c.total > 0))
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([airport, data]) => ({
      airport,
      cells: data.cells.map((c) =>
        c.total === 0
          ? null
          : { totalLegs: c.total, goWildLegs: c.goWild, goWildRate: (c.goWild / c.total) * 100 }
      ),
    }));
}
