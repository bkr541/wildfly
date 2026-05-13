import type { Itinerary, LimitedDataMeta } from "./insightTypes";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RouteStat = {
  route: string;
  origin: string;
  destination: string;
  goWildRate: number;
  totalItineraries: number;
  goWildItineraries: number;
  avgSeats: number | null;
  directShare: number; // 0..1
  // back-compat aliases
  totalLegs: number;
  goWildLegs: number;
};

export type RouteStatsResult = LimitedDataMeta & {
  rows: RouteStat[];
};

export type ReliableRoute = {
  route: string;
  origin: string;
  destination: string;
  reliabilityScore: number; // 0..100 normalized for UI
  rawReliabilityScore: number;
  goWildRate: number;
  variance: number; // ± percentage points
  snapshotDays: number;
  sampleSize: number;
  limitedData: boolean;
  // back-compat for existing card UI
  consistencyScore: number;
  snapshotCount: number;
};

export type FrequentRoute = {
  route: string;
  origin: string;
  destination: string;
  goWildItineraries: number;
  totalItineraries: number;
  currentRate: number;
  trend: "up" | "down" | "stable";
  // back-compat
  goWildMatches: number;
  snapshotCount: number;
};

export type RouteAnalytics = {
  topRoutes: RouteStatsResult;
  worstRoutes: RouteStatsResult;
  mostReliableRoute: ReliableRoute | null;
  mostFrequentGoWildRoute: FrequentRoute | null;
};

const ROUTE_THRESHOLD = 30;
const RELIABILITY_MIN_DAYS = 7;
const TARGET_RESULTS = 5;

function snapshotDay(snapshot_at: string): string {
  return snapshot_at.slice(0, 10);
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

// ─── Route grouping (itinerary-level) ───────────────────────────────────────

type RouteEntry = {
  origin: string;
  destination: string;
  total: number;
  goWild: number;
  seats: number[];
  directCount: number;
  byDay: Map<string, { total: number; goWild: number }>;
};

function buildRouteMap(itineraries: Itinerary[]): Map<string, RouteEntry> {
  const map = new Map<string, RouteEntry>();

  for (const it of itineraries) {
    const key = it.routeLabel;
    if (!map.has(key)) {
      map.set(key, {
        origin: it.origin,
        destination: it.destination,
        total: 0,
        goWild: 0,
        seats: [],
        directCount: 0,
        byDay: new Map(),
      });
    }
    const e = map.get(key)!;
    e.total++;
    if (it.isDirect) e.directCount++;
    if (it.isGoWildAvailable) {
      e.goWild++;
      if (it.availableSeats > 0) e.seats.push(it.availableSeats);
    }

    const day = snapshotDay(it.snapshotAt);
    if (!e.byDay.has(day)) e.byDay.set(day, { total: 0, goWild: 0 });
    const d = e.byDay.get(day)!;
    d.total++;
    if (it.isGoWildAvailable) d.goWild++;
  }

  return map;
}

function entryToRouteStat(route: string, e: RouteEntry): RouteStat {
  return {
    route,
    origin: e.origin,
    destination: e.destination,
    totalItineraries: e.total,
    goWildItineraries: e.goWild,
    goWildRate: e.total > 0 ? (e.goWild / e.total) * 100 : 0,
    avgSeats:
      e.seats.length > 0 ? e.seats.reduce((a, b) => a + b, 0) / e.seats.length : null,
    directShare: e.total > 0 ? e.directCount / e.total : 0,
    totalLegs: e.total,
    goWildLegs: e.goWild,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeRouteAnalytics(itineraries: Itinerary[]): RouteAnalytics {
  const map = buildRouteMap(itineraries);
  const allWithEntry: { stat: RouteStat; entry: RouteEntry }[] = Array.from(map.entries()).map(
    ([route, e]) => ({ stat: entryToRouteStat(route, e), entry: e })
  );

  const all = allWithEntry.map((x) => x.stat);

  const topSort = (a: RouteStat, b: RouteStat) =>
    b.goWildRate - a.goWildRate ||
    b.goWildItineraries - a.goWildItineraries ||
    b.totalItineraries - a.totalItineraries;

  const worstSort = (a: RouteStat, b: RouteStat) =>
    a.goWildRate - b.goWildRate ||
    b.totalItineraries - a.totalItineraries;

  const qualified = all.filter((s) => s.totalItineraries >= ROUTE_THRESHOLD);

  const buildResult = (sortFn: (a: RouteStat, b: RouteStat) => number): RouteStatsResult => {
    if (qualified.length >= TARGET_RESULTS) {
      return {
        rows: qualified.slice().sort(sortFn).slice(0, TARGET_RESULTS),
        limitedData: false,
        qualifiedCount: qualified.length,
        threshold: ROUTE_THRESHOLD,
      };
    }
    return {
      rows: all
        .filter((s) => s.totalItineraries >= 3)
        .slice()
        .sort(sortFn)
        .slice(0, TARGET_RESULTS),
      limitedData: true,
      qualifiedCount: qualified.length,
      threshold: ROUTE_THRESHOLD,
    };
  };

  const topRoutes = buildResult(topSort);
  const worstRoutes = buildResult(worstSort);

  // ─── Most Reliable Route ────────────────────────────────────────────────
  let mostReliableRoute: ReliableRoute | null = null;
  {
    type Cand = { x: { stat: RouteStat; entry: RouteEntry }; score: number; v: number; days: number };
    const candidates: Cand[] = allWithEntry.map((x) => {
      const dailyRates = Array.from(x.entry.byDay.values()).map((d) =>
        d.total > 0 ? d.goWild / d.total : 0
      );
      const avg = dailyRates.length > 0
        ? dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length
        : 0;
      const v = variance(dailyRates);
      const sample = x.entry.total;
      const score = avg * Math.log10(sample + 1);
      return { x, score, v, days: x.entry.byDay.size };
    });

    const qualifiedReliable = candidates.filter(
      (c) => c.days >= RELIABILITY_MIN_DAYS && c.x.entry.total >= ROUTE_THRESHOLD
    );

    const pool = qualifiedReliable.length > 0 ? qualifiedReliable : candidates;
    const limitedReliable = qualifiedReliable.length === 0;

    pool.sort((a, b) => b.score - a.score || a.v - b.v);

    const top = pool[0];
    if (top) {
      const stat = top.x.stat;
      const stdev = Math.sqrt(top.v);
      // For UI: project rawScore (up to ~ log10(N+1)) to a 0..100 consistency display.
      const consistency = Math.round(Math.max(0, Math.min(100, (1 - stdev) * 100)));
      mostReliableRoute = {
        route: stat.route,
        origin: stat.origin,
        destination: stat.destination,
        reliabilityScore: Math.round(top.score * 100) / 100,
        rawReliabilityScore: top.score,
        goWildRate: stat.goWildRate,
        variance: Math.round(stdev * 1000) / 10,
        snapshotDays: top.days,
        sampleSize: top.x.entry.total,
        limitedData: limitedReliable,
        // back-compat aliases for the existing card UI
        consistencyScore: consistency,
        snapshotCount: top.days,
      };
    }
  }

  // ─── Most Frequent GoWild Route ─────────────────────────────────────────
  let mostFrequentGoWildRoute: FrequentRoute | null = null;
  {
    const sorted = allWithEntry
      .slice()
      .sort((a, b) => b.stat.goWildItineraries - a.stat.goWildItineraries);
    const top = sorted[0];
    if (top && top.stat.goWildItineraries > 0) {
      // Compare current 7d window vs prior 7d on this route
      const now = Date.now();
      const day7 = 7 * 24 * 60 * 60 * 1000;
      let curGW = 0, curT = 0, prevGW = 0, prevT = 0;
      for (const it of itineraries) {
        if (it.routeLabel !== top.stat.route) continue;
        const age = now - new Date(it.snapshotAt).getTime();
        const gw = it.isGoWildAvailable ? 1 : 0;
        if (age >= 0 && age < day7) { curGW += gw; curT++; }
        else if (age >= day7 && age < 2 * day7) { prevGW += gw; prevT++; }
      }
      let trend: "up" | "down" | "stable" = "stable";
      if (curT > 0 && prevT > 0) {
        const diff = curGW / curT - prevGW / prevT;
        if (diff > 0.05) trend = "up";
        else if (diff < -0.05) trend = "down";
      }
      mostFrequentGoWildRoute = {
        route: top.stat.route,
        origin: top.stat.origin,
        destination: top.stat.destination,
        goWildItineraries: top.stat.goWildItineraries,
        totalItineraries: top.stat.totalItineraries,
        currentRate: top.stat.goWildRate,
        trend,
        goWildMatches: top.stat.goWildItineraries,
        snapshotCount: top.entry.byDay.size,
      };
    }
  }

  return { topRoutes, worstRoutes, mostReliableRoute, mostFrequentGoWildRoute };
}

export function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? `${Math.round(rounded)}%` : `${rounded.toFixed(1)}%`;
}
