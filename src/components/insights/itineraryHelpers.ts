import type { FlightLegRow, Itinerary } from "./insightTypes";

export type ItineraryAirportStat = {
  code: string;
  totalItineraries: number;
  goWildItineraries: number;
  goWildRate: number; // 0-100
  totalGoWildAvailableSeats: number;
  avgGoWildSeatsPerItinerary: number;
};

export type ItinerarySnapshotMetrics = {
  totalItineraries: number;
  goWildItineraries: number;
  availabilityRate: number | null; // 0-100
  avgSeats: number | null;
  trend: number | null; // current rate - previous rate, percentage points
};

function isGoWild(value: FlightLegRow["has_go_wild"]): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1";
  }
  return false;
}

function pickOrigin(leg: FlightLegRow): string {
  return (leg.leg_origin_iata ?? leg.origin_iata ?? "").trim().toUpperCase();
}

function pickDestination(leg: FlightLegRow): string {
  return (leg.leg_destination_iata ?? leg.destination_iata ?? "").trim().toUpperCase();
}

/**
 * Groups raw flight leg rows into itinerary objects keyed by source_itinerary_id.
 * Legs without a source_itinerary_id are skipped.
 */
export function groupLegsIntoItineraries(rows: FlightLegRow[]): Itinerary[] {
  const groups = new Map<string, FlightLegRow[]>();

  for (const row of rows) {
    const id = row.source_itinerary_id;
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
  }

  const itineraries: Itinerary[] = [];

  for (const [itineraryId, legsRaw] of groups) {
    const legs = [...legsRaw].sort(
      (a, b) => (a.leg_index ?? 0) - (b.leg_index ?? 0)
    );
    if (legs.length === 0) continue;

    const first = legs[0];
    const last = legs[legs.length - 1];

    const origin = pickOrigin(first);
    const destination = pickDestination(last);

    const allGoWild = legs.every((l) => isGoWild(l.has_go_wild));

    let availableSeats = 0;
    if (allGoWild) {
      const seats = legs
        .map((l) => l.go_wild_available_seats)
        .filter((s): s is number => typeof s === "number");
      availableSeats = seats.length === legs.length ? Math.min(...seats) : 0;
    }

    const sumOrNull = (vals: (number | null | undefined)[]): number | null => {
      const nums = vals.filter((v): v is number => typeof v === "number");
      return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
    };

    // Snapshot consistency: use the most recent snapshot_at across legs.
    const snapshotAt = legs
      .map((l) => l.snapshot_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] ?? first.snapshot_at;

    itineraries.push({
      itineraryId,
      legs,
      origin,
      destination,
      routeKey: `${origin}-${destination}`,
      routeLabel: `${origin} → ${destination}`,
      departureAt: first.departure_at,
      arrivalAt: last.arrival_at,
      snapshotAt,
      isGoWildAvailable: allGoWild,
      availableSeats,
      totalGoWildPrice: sumOrNull(legs.map((l) => l.go_wild_total)),
      totalStandardPrice: sumOrNull(legs.map((l) => l.standard_total)),
    });
  }

  return itineraries;
}

function avgOrNull(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Snapshot-level metrics computed across itineraries (not legs).
 * Trend compares the most recent 7 days vs the prior 7 days using availability rate.
 */
export function computeItinerarySnapshotMetrics(
  itineraries: Itinerary[]
): ItinerarySnapshotMetrics {
  const total = itineraries.length;
  const goWild = itineraries.filter((i) => i.isGoWildAvailable);
  const availabilityRate = total === 0 ? null : (goWild.length / total) * 100;
  const avgSeats = avgOrNull(goWild.map((i) => i.availableSeats));

  // Trend: last 7d vs prior 7d using snapshotAt
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const current: Itinerary[] = [];
  const previous: Itinerary[] = [];
  for (const it of itineraries) {
    const t = new Date(it.snapshotAt).getTime();
    if (isNaN(t)) continue;
    const age = now - t;
    if (age >= 0 && age < week) current.push(it);
    else if (age >= week && age < 2 * week) previous.push(it);
  }
  let trend: number | null = null;
  if (current.length > 0 && previous.length > 0) {
    const cur = (current.filter((i) => i.isGoWildAvailable).length / current.length) * 100;
    const prev = (previous.filter((i) => i.isGoWildAvailable).length / previous.length) * 100;
    trend = cur - prev;
  }

  return {
    totalItineraries: total,
    goWildItineraries: goWild.length,
    availabilityRate,
    avgSeats,
    trend,
  };
}

function buildAirportItineraryStats(
  itineraries: Itinerary[],
  pick: (i: Itinerary) => string
): ItineraryAirportStat[] {
  type Entry = { total: number; goWild: number; totalSeats: number };
  const map = new Map<string, Entry>();

  for (const it of itineraries) {
    const code = pick(it);
    if (!code) continue;
    if (!map.has(code)) map.set(code, { total: 0, goWild: 0, totalSeats: 0 });
    const e = map.get(code)!;
    e.total++;
    if (it.isGoWildAvailable) {
      e.goWild++;
      e.totalSeats += it.availableSeats || 0;
    }
    // Non-GoWild itineraries contribute 0 seats by design.
  }

  return Array.from(map.entries())
    .map(([code, d]): ItineraryAirportStat => ({
      code,
      totalItineraries: d.total,
      goWildItineraries: d.goWild,
      goWildRate: d.total > 0 ? (d.goWild / d.total) * 100 : 0,
      totalGoWildAvailableSeats: d.totalSeats,
      avgGoWildSeatsPerItinerary: d.total > 0 ? d.totalSeats / d.total : 0,
    }))
    .sort(
      (a, b) =>
        b.goWildRate - a.goWildRate ||
        b.goWildItineraries - a.goWildItineraries ||
        b.totalItineraries - a.totalItineraries
    );
}

export const ITINERARY_AIRPORT_MIN = 30;
export const MIN_QUALIFIED_RESULTS = 5;
export const TOP_N = 5;

export type AirportStatsResult = {
  stats: ItineraryAirportStat[];
  limited: boolean;
};

function applyThreshold(all: ItineraryAirportStat[]): AirportStatsResult {
  const qualified = all.filter((s) => s.totalItineraries >= ITINERARY_AIRPORT_MIN);
  if (qualified.length >= MIN_QUALIFIED_RESULTS) {
    return { stats: qualified.slice(0, TOP_N), limited: false };
  }
  return { stats: all.slice(0, TOP_N), limited: true };
}

export function getOriginItineraryStats(itineraries: Itinerary[]): AirportStatsResult {
  return applyThreshold(buildAirportItineraryStats(itineraries, (i) => i.origin));
}

export function getDestinationItineraryStats(itineraries: Itinerary[]): AirportStatsResult {
  return applyThreshold(buildAirportItineraryStats(itineraries, (i) => i.destination));
}

// ─── Route-level itinerary analytics ─────────────────────────────────────────

export type ItineraryRouteStat = {
  route: string;
  routeKey: string;
  origin: string;
  destination: string;
  totalItineraries: number;
  goWildItineraries: number;
  goWildRate: number; // 0-100
  avgSeats: number | null;
  directCount: number;
  connectingCount: number;
};

export type RouteStatsResult = {
  routes: ItineraryRouteStat[];
  limited: boolean;
};

export const ROUTE_MIN_ITINERARIES = 30;

function buildItineraryRouteStats(itineraries: Itinerary[]): ItineraryRouteStat[] {
  type Entry = {
    origin: string;
    destination: string;
    routeLabel: string;
    total: number;
    goWild: number;
    seats: number[];
    direct: number;
    connecting: number;
  };
  const map = new Map<string, Entry>();

  for (const it of itineraries) {
    const key = it.routeKey;
    if (!key || !it.origin || !it.destination) continue;
    if (!map.has(key)) {
      map.set(key, {
        origin: it.origin,
        destination: it.destination,
        routeLabel: it.routeLabel,
        total: 0,
        goWild: 0,
        seats: [],
        direct: 0,
        connecting: 0,
      });
    }
    const e = map.get(key)!;
    e.total++;
    const isConnecting =
      (typeof it.legs[0]?.stops === "number" && (it.legs[0].stops ?? 0) > 0) ||
      it.legs.length > 1;
    if (isConnecting) e.connecting++;
    else e.direct++;
    if (it.isGoWildAvailable) {
      e.goWild++;
      e.seats.push(it.availableSeats);
    }
  }

  return Array.from(map.entries()).map(([routeKey, e]) => ({
    route: e.routeLabel,
    routeKey,
    origin: e.origin,
    destination: e.destination,
    totalItineraries: e.total,
    goWildItineraries: e.goWild,
    goWildRate: e.total > 0 ? (e.goWild / e.total) * 100 : 0,
    avgSeats: avgOrNull(e.seats),
    directCount: e.direct,
    connectingCount: e.connecting,
  }));
}

function applyRouteThreshold(
  all: ItineraryRouteStat[],
  comparator: (a: ItineraryRouteStat, b: ItineraryRouteStat) => number
): RouteStatsResult {
  const sortedAll = [...all].sort(comparator);
  const qualified = sortedAll.filter((r) => r.totalItineraries >= ROUTE_MIN_ITINERARIES);
  if (qualified.length >= MIN_QUALIFIED_RESULTS) {
    return { routes: qualified.slice(0, TOP_N), limited: false };
  }
  return { routes: sortedAll.slice(0, TOP_N), limited: true };
}

export function getTopItineraryRoutes(itineraries: Itinerary[]): RouteStatsResult {
  return applyRouteThreshold(
    buildItineraryRouteStats(itineraries),
    (a, b) =>
      b.goWildRate - a.goWildRate ||
      b.goWildItineraries - a.goWildItineraries ||
      b.totalItineraries - a.totalItineraries
  );
}

export function getWorstItineraryRoutes(itineraries: Itinerary[]): RouteStatsResult {
  return applyRouteThreshold(
    buildItineraryRouteStats(itineraries),
    (a, b) =>
      a.goWildRate - b.goWildRate ||
      b.totalItineraries - a.totalItineraries
  );
}

export type MostFrequentGoWildResult = {
  route: ItineraryRouteStat;
  limited: boolean;
} | null;

/**
 * Selects the route with the highest GoWild frequency rate across ALL complete
 * itinerary opportunities for that route. Raw GoWild count is a tie-breaker
 * only, never the primary ranking metric.
 *
 * Sample qualification uses total itinerary count (>= ROUTE_MIN_ITINERARIES)
 * so a 1/1 = 100% fluke route can never outrank a high-volume route. If no
 * route qualifies, fall back to the best low-volume route and flag the result
 * as `limited` so the UI can show a Limited data state.
 */
export function getMostFrequentGoWildItineraryRoute(
  itineraries: Itinerary[]
): MostFrequentGoWildResult {
  const all = buildItineraryRouteStats(itineraries).filter((r) => r.goWildItineraries > 0);
  if (all.length === 0) return null;

  const byRate = (a: ItineraryRouteStat, b: ItineraryRouteStat) =>
    b.goWildRate - a.goWildRate ||
    b.goWildItineraries - a.goWildItineraries ||
    b.totalItineraries - a.totalItineraries;

  const qualified = all.filter((r) => r.totalItineraries >= ROUTE_MIN_ITINERARIES);
  if (qualified.length > 0) {
    qualified.sort(byRate);
    return { route: qualified[0], limited: false };
  }
  const sorted = [...all].sort(byRate);
  return { route: sorted[0], limited: true };
}


// ─── Seat availability (itinerary-level) ─────────────────────────────────────

export type SeatItineraryRouteStat = {
  routeKey: string;
  route: string;
  origin: string;
  destination: string;
  totalItineraries: number;
  goWildItineraries: number;
  goWildRate: number; // 0-100
  avgSeats: number;
  maxSeats: number;
  totalSeats: number;
};

export const SEATS_MIN_GOWILD = 10;

export type SeatRouteResult = {
  stats: SeatItineraryRouteStat[];
  limited: boolean;
};

/**
 * Route-level seat stats with itinerary-based denominator.
 *
 * For every complete itinerary on a route:
 * - If fully GoWild-available, it contributes its bottleneck seat count
 *   (already stored on `it.availableSeats`, computed as min across legs).
 * - Otherwise it contributes 0.
 *
 * avgSeats   = totalGoWildAvailableSeats / totalItineraries
 * totalSeats = sum of GoWild seat contributions across all itineraries
 * maxSeats   = highest bottleneck seat count among GoWild-available itineraries only
 *
 * Null seat values on GoWild-available itineraries are treated as 0,
 * matching the shared itinerary grouping rule in groupLegsIntoItineraries.
 */
function buildSeatItineraryRouteStats(itineraries: Itinerary[]): SeatItineraryRouteStat[] {
  type Entry = {
    origin: string;
    destination: string;
    routeLabel: string;
    total: number;
    goWild: number;
    totalSeats: number;
    maxSeats: number;
  };
  const map = new Map<string, Entry>();

  for (const it of itineraries) {
    if (!it.routeKey || !it.origin || !it.destination) continue;
    if (!map.has(it.routeKey)) {
      map.set(it.routeKey, {
        origin: it.origin,
        destination: it.destination,
        routeLabel: it.routeLabel,
        total: 0,
        goWild: 0,
        totalSeats: 0,
        maxSeats: 0,
      });
    }
    const e = map.get(it.routeKey)!;
    e.total++;
    if (it.isGoWildAvailable) {
      e.goWild++;
      const seats = it.availableSeats || 0;
      e.totalSeats += seats;
      if (seats > e.maxSeats) e.maxSeats = seats;
    }
    // Non-GoWild itineraries contribute 0 to totalSeats by design.
  }

  return Array.from(map.entries()).map(([routeKey, e]) => ({
    routeKey,
    route: e.routeLabel,
    origin: e.origin,
    destination: e.destination,
    totalItineraries: e.total,
    goWildItineraries: e.goWild,
    goWildRate: e.total > 0 ? (e.goWild / e.total) * 100 : 0,
    avgSeats: e.total > 0 ? e.totalSeats / e.total : 0,
    maxSeats: e.maxSeats,
    totalSeats: e.totalSeats,
  }));
}

function applySeatThreshold(
  all: SeatItineraryRouteStat[],
  comparator: (a: SeatItineraryRouteStat, b: SeatItineraryRouteStat) => number
): SeatRouteResult {
  const sorted = [...all].sort(comparator);
  // Threshold is based on total itineraries (opportunities), not successful ones.
  const qualified = sorted.filter((r) => r.totalItineraries >= ROUTE_MIN_ITINERARIES);
  if (qualified.length >= MIN_QUALIFIED_RESULTS) {
    return { stats: qualified.slice(0, TOP_N), limited: false };
  }
  return { stats: sorted.slice(0, TOP_N), limited: true };
}

export function getMostSeatsItineraryRoutes(itineraries: Itinerary[]): SeatRouteResult {
  return applySeatThreshold(
    buildSeatItineraryRouteStats(itineraries),
    (a, b) =>
      b.avgSeats - a.avgSeats ||
      b.goWildItineraries - a.goWildItineraries ||
      b.totalItineraries - a.totalItineraries
  );
}

/**
 * Lowest Seat Availability ranking.
 * Excludes routes with zero GoWild-successful itineraries — a route with no
 * observed GoWild availability should not be presented as "low seat availability".
 */
export function getLowestSeatsItineraryRoutes(itineraries: Itinerary[]): SeatRouteResult {
  const eligible = buildSeatItineraryRouteStats(itineraries).filter(
    (r) => r.goWildItineraries > 0
  );
  return applySeatThreshold(
    eligible,
    (a, b) =>
      a.avgSeats - b.avgSeats ||
      b.totalItineraries - a.totalItineraries ||
      a.goWildItineraries - b.goWildItineraries
  );
}

export type SeatItineraryAirportStat = {
  code: string;
  totalItineraries: number;
  goWildItineraries: number;
  avgSeats: number;
  totalSeats: number;
  routeCount: number;
};

/**
 * Origin-airport seat stats with itinerary-based denominator.
 * Each complete itinerary is counted once under its first-leg origin airport.
 * Non-GoWild itineraries contribute 0 GoWild seats. routeCount is computed
 * across all complete itineraries originating at the airport.
 * Airports with zero GoWild observations are excluded — they should not
 * outrank airports with real seat availability.
 */
export function getSeatItineraryAirportStats(itineraries: Itinerary[]): SeatItineraryAirportStat[] {
  type Entry = {
    total: number;
    goWild: number;
    totalSeats: number;
    routes: Set<string>;
  };
  const map = new Map<string, Entry>();
  for (const it of itineraries) {
    const code = it.origin;
    if (!code) continue;
    if (!map.has(code)) map.set(code, { total: 0, goWild: 0, totalSeats: 0, routes: new Set() });
    const e = map.get(code)!;
    e.total++;
    if (it.routeKey) e.routes.add(it.routeKey);
    if (it.isGoWildAvailable) {
      e.goWild++;
      e.totalSeats += it.availableSeats || 0;
    }
  }
  return Array.from(map.entries())
    .map(([code, e]): SeatItineraryAirportStat => ({
      code,
      totalItineraries: e.total,
      goWildItineraries: e.goWild,
      avgSeats: e.total > 0 ? e.totalSeats / e.total : 0,
      totalSeats: e.totalSeats,
      routeCount: e.routes.size,
    }))
    .filter((r) => r.goWildItineraries > 0)
    .sort(
      (a, b) =>
        b.avgSeats - a.avgSeats ||
        b.goWildItineraries - a.goWildItineraries ||
        b.totalItineraries - a.totalItineraries
    )
    .slice(0, 5);
}

// ─── Most reliable itinerary route ───────────────────────────────────────────

export type ReliableItineraryRoute = {
  route: string;
  routeKey: string;
  origin: string;
  destination: string;
  reliabilityScore: number; // arbitrary score
  avgAvailabilityRate: number; // 0-100
  variance: number; // stddev in percentage points
  sampleSize: number; // total itineraries
  snapshotDays: number;
};

export const RELIABILITY_MIN_DAYS = 7;
export const RELIABILITY_MIN_ITINERARIES = 30;

function dayKey(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function getMostReliableItineraryRoute(
  itineraries: Itinerary[]
): ReliableItineraryRoute | null {
  type Entry = {
    origin: string;
    destination: string;
    routeLabel: string;
    total: number;
    byDay: Map<string, { total: number; goWild: number }>;
  };
  const map = new Map<string, Entry>();
  for (const it of itineraries) {
    if (!it.routeKey) continue;
    const day = dayKey(it.snapshotAt);
    if (!day) continue;
    if (!map.has(it.routeKey)) {
      map.set(it.routeKey, {
        origin: it.origin,
        destination: it.destination,
        routeLabel: it.routeLabel,
        total: 0,
        byDay: new Map(),
      });
    }
    const e = map.get(it.routeKey)!;
    e.total++;
    if (!e.byDay.has(day)) e.byDay.set(day, { total: 0, goWild: 0 });
    const d = e.byDay.get(day)!;
    d.total++;
    if (it.isGoWildAvailable) d.goWild++;
  }

  const candidates = Array.from(map.entries())
    .filter(([, e]) => e.total >= RELIABILITY_MIN_ITINERARIES && e.byDay.size >= RELIABILITY_MIN_DAYS)
    .map(([routeKey, e]) => {
      const dailyRates = Array.from(e.byDay.values()).map((d) =>
        d.total > 0 ? (d.goWild / d.total) * 100 : 0
      );
      const mean = dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length;
      const variance =
        dailyRates.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyRates.length;
      const stddev = Math.sqrt(variance);
      const reliabilityScore = mean * Math.log10(e.total + 1);
      return {
        route: e.routeLabel,
        routeKey,
        origin: e.origin,
        destination: e.destination,
        reliabilityScore,
        avgAvailabilityRate: mean,
        variance: stddev,
        sampleSize: e.total,
        snapshotDays: e.byDay.size,
      } as ReliableItineraryRoute;
    });

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      b.reliabilityScore - a.reliabilityScore ||
      a.variance - b.variance ||
      b.sampleSize - a.sampleSize
  );
  return candidates[0];
}

// ─── Timing (itinerary-level) ────────────────────────────────────────────────

export type TimingItineraryRow = {
  label: string;
  goWildRate: number; // 0-100
  goWildItineraries: number;
  totalItineraries: number;
};

export type TimingResult = { rows: TimingItineraryRow[]; limited: boolean };

export const TIMING_MIN_ITINERARIES = 30;

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_WINDOWS = [
  "12 AM – 2 AM", "2 AM – 4 AM", "4 AM – 6 AM", "6 AM – 8 AM",
  "8 AM – 10 AM", "10 AM – 12 PM", "12 PM – 2 PM", "2 PM – 4 PM",
  "4 PM – 6 PM", "6 PM – 8 PM", "8 PM – 10 PM", "10 PM – 12 AM",
];

function firstLegDeparture(it: Itinerary): Date | null {
  const iso = it.legs[0]?.departure_at ?? it.departureAt;
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function applyTimingThreshold(rows: TimingItineraryRow[]): TimingResult {
  const qualified = rows.filter((r) => r.totalItineraries >= TIMING_MIN_ITINERARIES);
  if (qualified.length >= MIN_QUALIFIED_RESULTS) return { rows: qualified, limited: false };
  // Fall back to all rows with any data
  return { rows: rows.filter((r) => r.totalItineraries > 0), limited: true };
}

export function getDayOfWeekItineraryStats(itineraries: Itinerary[]): TimingResult {
  const counts = Array.from({ length: 7 }, () => ({ total: 0, goWild: 0 }));
  for (const it of itineraries) {
    const d = firstLegDeparture(it);
    if (!d) continue;
    const day = d.getDay();
    const idx = day === 0 ? 6 : day - 1;
    counts[idx].total++;
    if (it.isGoWildAvailable) counts[idx].goWild++;
  }
  const rows = counts.map((c, i) => ({
    label: DAY_LABELS[i],
    goWildRate: c.total > 0 ? (c.goWild / c.total) * 100 : 0,
    goWildItineraries: c.goWild,
    totalItineraries: c.total,
  }));
  return applyTimingThreshold(rows);
}

export function getTimeWindowItineraryStats(itineraries: Itinerary[]): TimingResult {
  const counts = Array.from({ length: 12 }, () => ({ total: 0, goWild: 0 }));
  for (const it of itineraries) {
    const d = firstLegDeparture(it);
    if (!d) continue;
    const idx = Math.floor(d.getHours() / 2);
    counts[idx].total++;
    if (it.isGoWildAvailable) counts[idx].goWild++;
  }
  const rows = counts.map((c, i) => ({
    label: TIME_WINDOWS[i],
    goWildRate: c.total > 0 ? (c.goWild / c.total) * 100 : 0,
    goWildItineraries: c.goWild,
    totalItineraries: c.total,
  }));
  return applyTimingThreshold(rows);
}

// ─── GoWild Snapshot card metrics (itinerary-level) ─────────────────────────
//
// All metrics use complete itineraries as the denominator. A connecting itinerary
// counts ONCE; its GoWild seat contribution is the bottleneck across its legs
// (already represented by `availableSeats` on the Itinerary), and non-GoWild
// itineraries contribute 0 seats. Buckets are keyed by `snapshotAt` (the most
// recent leg snapshot in the itinerary) — chosen because the dashboard measures
// recorded availability over time.

export type GoWildSnapshotPeriod = "24h" | "7d" | "30d" | "all";

export type GoWildSnapshotTrendBucket = {
  bucketKey: string;
  bucketLabel: string;
  totalItineraries: number;
  goWildAvailableItineraries: number;
  goWildAvailabilityRate: number | null; // null when bucket empty → gap in chart
};

export type GoWildSnapshotMetrics = {
  totalItineraries: number;
  goWildAvailableItineraries: number;
  goWildAvailabilityRate: number; // 0–100, 0 when total=0
  totalGoWildAvailableSeats: number;
  avgGoWildSeatsPerItinerary: number;
  trendPercentagePoints: number | null;
  trendDirection: "up" | "down" | "flat" | "unavailable";
  trendData: GoWildSnapshotTrendBucket[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function periodWindowMs(period: GoWildSnapshotPeriod): number | null {
  switch (period) {
    case "24h": return 24 * HOUR_MS;
    case "7d":  return 7 * DAY_MS;
    case "30d": return 30 * DAY_MS;
    case "all": return null;
  }
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function formatHourLabel(d: Date): string {
  const h = d.getHours();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function snapshotMs(it: Itinerary): number | null {
  const t = new Date(it.snapshotAt).getTime();
  return isNaN(t) ? null : t;
}

function computeCoreMetrics(items: Itinerary[]) {
  const total = items.length;
  const goWild = items.filter((i) => i.isGoWildAvailable);
  const goWildCount = goWild.length;
  const rate = total > 0 ? (goWildCount / total) * 100 : 0;
  const totalSeats = items.reduce(
    (acc, it) => acc + (it.isGoWildAvailable ? (it.availableSeats || 0) : 0),
    0,
  );
  const avgSeats = total > 0 ? totalSeats / total : 0;
  return { total, goWildCount, rate, totalSeats, avgSeats };
}

type BucketShape = {
  size: "hour" | "day" | "week";
  windowStart: number;
  windowEnd: number;
};

function bucketShapeFor(period: GoWildSnapshotPeriod, items: Itinerary[], now: number): BucketShape {
  if (period === "24h") return { size: "hour", windowStart: now - 24 * HOUR_MS, windowEnd: now };
  if (period === "7d")  return { size: "day",  windowStart: now - 7 * DAY_MS,   windowEnd: now };
  if (period === "30d") return { size: "day",  windowStart: now - 30 * DAY_MS,  windowEnd: now };
  let min = now;
  for (const it of items) {
    const t = snapshotMs(it);
    if (t !== null && t < min) min = t;
  }
  return { size: "week", windowStart: min, windowEnd: now };
}

function bucketKeyAndLabel(d: Date, size: BucketShape["size"]): { key: string; label: string } {
  if (size === "hour") {
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}`;
    return { key: k, label: formatHourLabel(d) };
  }
  if (size === "day") {
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return { key: k, label: formatDayLabel(d) };
  }
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const k = `${monday.getFullYear()}-W-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
  return { key: k, label: formatDayLabel(monday) };
}

function buildTrendBuckets(items: Itinerary[], shape: BucketShape): GoWildSnapshotTrendBucket[] {
  type Acc = { key: string; label: string; total: number; goWild: number };
  const map = new Map<string, Acc>();
  for (const it of items) {
    const t = snapshotMs(it);
    if (t === null || t < shape.windowStart || t > shape.windowEnd) continue;
    const d = new Date(t);
    if (shape.size === "hour") d.setMinutes(0, 0, 0);
    else d.setHours(0, 0, 0, 0);
    const { key, label } = bucketKeyAndLabel(d, shape.size);
    if (!map.has(key)) map.set(key, { key, label, total: 0, goWild: 0 });
    const e = map.get(key)!;
    e.total++;
    if (it.isGoWildAvailable) e.goWild++;
  }
  return Array.from(map.values())
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((e) => ({
      bucketKey: e.key,
      bucketLabel: e.label,
      totalItineraries: e.total,
      goWildAvailableItineraries: e.goWild,
      goWildAvailabilityRate: e.total > 0 ? (e.goWild / e.total) * 100 : null,
    }));
}

/**
 * Computes the GoWild Snapshot card metrics for the selected period.
 *
 * `itineraries` must include items spanning AT LEAST the current period AND the
 * immediately preceding equal-length period — the helper splits them by
 * `snapshotAt`. Totals and seat averages use only the current window; the trend
 * delta is (current rate − prior rate) in percentage points. For period "all",
 * no prior comparison is computed and `trendDirection` is "unavailable".
 */
export function computeGoWildSnapshotMetrics(
  itineraries: Itinerary[],
  period: GoWildSnapshotPeriod,
  nowMs: number = Date.now(),
): GoWildSnapshotMetrics {
  const windowMs = periodWindowMs(period);

  let current: Itinerary[];
  let prior: Itinerary[] = [];
  if (windowMs === null) {
    current = itineraries;
  } else {
    current = [];
    for (const it of itineraries) {
      const t = snapshotMs(it);
      if (t === null) continue;
      const age = nowMs - t;
      if (age >= 0 && age < windowMs) current.push(it);
      else if (age >= windowMs && age < 2 * windowMs) prior.push(it);
    }
  }

  const core = computeCoreMetrics(current);

  let trendPercentagePoints: number | null = null;
  let trendDirection: GoWildSnapshotMetrics["trendDirection"] = "unavailable";
  if (windowMs !== null && current.length > 0 && prior.length > 0) {
    const priorCore = computeCoreMetrics(prior);
    trendPercentagePoints = core.rate - priorCore.rate;
    if (Math.abs(trendPercentagePoints) < 0.05) trendDirection = "flat";
    else if (trendPercentagePoints > 0) trendDirection = "up";
    else trendDirection = "down";
  }

  const shape = bucketShapeFor(period, current, nowMs);
  const trendData = buildTrendBuckets(current, shape);

  return {
    totalItineraries: core.total,
    goWildAvailableItineraries: core.goWildCount,
    goWildAvailabilityRate: core.rate,
    totalGoWildAvailableSeats: core.totalSeats,
    avgGoWildSeatsPerItinerary: core.avgSeats,
    trendPercentagePoints,
    trendDirection,
    trendData,
  };
}

// ─── Origin × Weekday availability heatmap (itinerary-level) ────────────────

export type ItineraryHeatmapCell = {
  totalItineraries: number;
  goWildItineraries: number;
  goWildRate: number; // 0-100
} | null;

export type ItineraryHeatmapRow = {
  airport: string;
  totalItineraries: number;
  cells: ItineraryHeatmapCell[]; // length 7, Mon..Sun
};

export const HEATMAP_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** 0=Mon … 6=Sun, or null if unparsable. */
export function getItineraryWeekdayIndex(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  return day === 0 ? 6 : day - 1;
}

/**
 * Builds an origin × weekday heatmap from complete itineraries.
 * Each itinerary contributes exactly one observation based on its first-leg
 * origin and first-leg departure weekday. The top 5 origins by total
 * itinerary volume are returned.
 */
export function getItineraryHeatmapData(itineraries: Itinerary[]): ItineraryHeatmapRow[] {
  type AirportEntry = {
    total: number;
    cells: { total: number; goWild: number }[];
  };
  const map = new Map<string, AirportEntry>();

  for (const it of itineraries) {
    const first = it.legs[0];
    if (!first) continue;
    const dayIdx = getItineraryWeekdayIndex(first.departure_at);
    if (dayIdx === null) continue;
    const code = (first.leg_origin_iata ?? first.origin_iata ?? it.origin ?? "")
      .trim()
      .toUpperCase();
    if (!code) continue;

    if (!map.has(code)) {
      map.set(code, {
        total: 0,
        cells: Array.from({ length: 7 }, () => ({ total: 0, goWild: 0 })),
      });
    }
    const e = map.get(code)!;
    e.total++;
    e.cells[dayIdx].total++;
    if (it.isGoWildAvailable) e.cells[dayIdx].goWild++;
  }

  return Array.from(map.entries())
    .filter(([, d]) => d.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([airport, data]) => ({
      airport,
      totalItineraries: data.total,
      cells: data.cells.map((c) =>
        c.total === 0
          ? null
          : {
              totalItineraries: c.total,
              goWildItineraries: c.goWild,
              goWildRate: (c.goWild / c.total) * 100,
            }
      ),
    }));
}
