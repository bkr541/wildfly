import type { FlightLegRow, Itinerary } from "./insightTypes";

export type ItineraryAirportStat = {
  code: string;
  totalItineraries: number;
  goWildItineraries: number;
  goWildRate: number; // 0-100
  avgSeats: number | null;
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
      e.seats.push(it.availableSeats);
    }
  }

  return Array.from(map.entries())
    .map(([code, d]): ItineraryAirportStat => ({
      code,
      totalItineraries: d.total,
      goWildItineraries: d.goWild,
      goWildRate: d.total > 0 ? (d.goWild / d.total) * 100 : 0,
      avgSeats: avgOrNull(d.seats),
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
    if (it.legs.length <= 1) e.direct++;
    else e.connecting++;
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

export function getMostFrequentGoWildItineraryRoute(
  itineraries: Itinerary[]
): ItineraryRouteStat | null {
  const stats = buildItineraryRouteStats(itineraries).filter((r) => r.goWildItineraries > 0);
  if (stats.length === 0) return null;
  stats.sort(
    (a, b) =>
      b.goWildItineraries - a.goWildItineraries ||
      b.goWildRate - a.goWildRate ||
      b.totalItineraries - a.totalItineraries
  );
  return stats[0];
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

function buildSeatItineraryRouteStats(itineraries: Itinerary[]): SeatItineraryRouteStat[] {
  type Entry = {
    origin: string;
    destination: string;
    routeLabel: string;
    total: number;
    goWild: number;
    seats: number[];
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
        seats: [],
      });
    }
    const e = map.get(it.routeKey)!;
    e.total++;
    if (it.isGoWildAvailable) {
      e.goWild++;
      // availableSeats already represents the min across legs — do NOT average across legs.
      e.seats.push(it.availableSeats);
    }
  }

  return Array.from(map.entries()).map(([routeKey, e]) => {
    const totalSeats = e.seats.reduce((a, b) => a + b, 0);
    const avgSeats = e.seats.length > 0 ? totalSeats / e.seats.length : 0;
    const maxSeats = e.seats.length > 0 ? Math.max(...e.seats) : 0;
    return {
      routeKey,
      route: e.routeLabel,
      origin: e.origin,
      destination: e.destination,
      totalItineraries: e.total,
      goWildItineraries: e.goWild,
      goWildRate: e.total > 0 ? (e.goWild / e.total) * 100 : 0,
      avgSeats,
      maxSeats,
      totalSeats,
    };
  });
}

function applySeatThreshold(
  all: SeatItineraryRouteStat[],
  comparator: (a: SeatItineraryRouteStat, b: SeatItineraryRouteStat) => number
): SeatRouteResult {
  const sorted = [...all].sort(comparator);
  const qualified = sorted.filter((r) => r.goWildItineraries >= SEATS_MIN_GOWILD);
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
      b.goWildRate - a.goWildRate
  );
}

export function getLowestSeatsItineraryRoutes(itineraries: Itinerary[]): SeatRouteResult {
  return applySeatThreshold(
    buildSeatItineraryRouteStats(itineraries),
    (a, b) =>
      a.avgSeats - b.avgSeats ||
      b.goWildItineraries - a.goWildItineraries ||
      a.goWildRate - b.goWildRate
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

export function getSeatItineraryAirportStats(itineraries: Itinerary[]): SeatItineraryAirportStat[] {
  type Entry = { total: number; goWild: number; seats: number[]; routes: Set<string> };
  const map = new Map<string, Entry>();
  for (const it of itineraries) {
    const code = it.origin;
    if (!code) continue;
    if (!map.has(code)) map.set(code, { total: 0, goWild: 0, seats: [], routes: new Set() });
    const e = map.get(code)!;
    e.total++;
    if (it.routeKey) e.routes.add(it.routeKey);
    if (it.isGoWildAvailable) {
      e.goWild++;
      e.seats.push(it.availableSeats);
    }
  }
  return Array.from(map.entries())
    .map(([code, e]): SeatItineraryAirportStat => ({
      code,
      totalItineraries: e.total,
      goWildItineraries: e.goWild,
      avgSeats: e.seats.length > 0 ? e.seats.reduce((a, b) => a + b, 0) / e.seats.length : 0,
      totalSeats: e.seats.reduce((a, b) => a + b, 0),
      routeCount: e.routes.size,
    }))
    .filter((r) => r.goWildItineraries > 0)
    .sort((a, b) => b.avgSeats - a.avgSeats || b.goWildItineraries - a.goWildItineraries)
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
