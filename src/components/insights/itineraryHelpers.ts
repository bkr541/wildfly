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
