import { isGoWild, normalizeAirport } from "./airportHelpers";
import type { FlightSnapshot } from "./airportHelpers";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RouteStat = {
  route: string;
  origin: string;
  destination: string;
  goWildRate: number;
  totalLegs: number;
  goWildLegs: number;
};

export type ReliableRoute = {
  route: string;
  origin: string;
  destination: string;
  consistencyScore: number;
  goWildRate: number;
  variance: number;
  snapshotCount: number;
  limitedData: boolean;
};

export type FrequentRoute = {
  route: string;
  origin: string;
  destination: string;
  goWildMatches: number;
  snapshotCount: number;
  currentRate: number;
  trend: "up" | "down" | "stable";
};

export type RouteAnalytics = {
  topRoutes: RouteStat[];
  worstRoutes: RouteStat[];
  mostReliableRoute: ReliableRoute | null;
  mostFrequentGoWildRoute: FrequentRoute | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getRouteKey(s: FlightSnapshot): string | null {
  const origin = normalizeAirport(s.leg_origin_iata) ?? normalizeAirport(s.origin_iata);
  const destination = normalizeAirport(s.leg_destination_iata);
  if (!origin || !destination) return null;
  return `${origin} → ${destination}`;
}

function snapshotDay(snapshot_at: string): string {
  return snapshot_at.slice(0, 10); // "YYYY-MM-DD"
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

// ─── Route grouping ───────────────────────────────────────────────────────────

type RouteEntry = {
  origin: string;
  destination: string;
  total: number;
  goWild: number;
  // map of snapshot day → { total, goWild }
  byDay: Map<string, { total: number; goWild: number }>;
};

function buildRouteMap(snapshots: FlightSnapshot[]): Map<string, RouteEntry> {
  const map = new Map<string, RouteEntry>();

  for (const s of snapshots) {
    const key = getRouteKey(s);
    if (!key) continue;
    const origin = normalizeAirport(s.leg_origin_iata) ?? normalizeAirport(s.origin_iata) ?? "";
    const destination = normalizeAirport(s.leg_destination_iata) ?? "";

    if (!map.has(key)) {
      map.set(key, { origin, destination, total: 0, goWild: 0, byDay: new Map() });
    }
    const e = map.get(key)!;
    e.total++;
    const gw = isGoWild(s.has_go_wild);
    if (gw) e.goWild++;

    const day = snapshotDay(s.snapshot_at);
    if (!e.byDay.has(day)) e.byDay.set(day, { total: 0, goWild: 0 });
    const d = e.byDay.get(day)!;
    d.total++;
    if (gw) d.goWild++;
  }

  return map;
}

// ─── Exported computation functions ──────────────────────────────────────────

export function computeRouteAnalytics(snapshots: FlightSnapshot[]): RouteAnalytics {
  const map = buildRouteMap(snapshots);

  const allStats: (RouteStat & { entry: RouteEntry })[] = Array.from(map.entries()).map(
    ([route, e]) => ({
      route,
      origin: e.origin,
      destination: e.destination,
      totalLegs: e.total,
      goWildLegs: e.goWild,
      goWildRate: e.total > 0 ? (e.goWild / e.total) * 100 : 0,
      entry: e,
    })
  );

  // Minimum sample filter — fall back to showing all if not enough qualify
  const qualified = allStats.filter((s) => s.totalLegs >= 3);
  const pool = qualified.length >= 1 ? qualified : allStats;

  // Top 5 — highest GoWild rate
  const topRoutes: RouteStat[] = pool
    .slice()
    .sort((a, b) => b.goWildRate - a.goWildRate || b.goWildLegs - a.goWildLegs)
    .slice(0, 5)
    .map(({ route, origin, destination, goWildRate, totalLegs, goWildLegs }) => ({
      route,
      origin,
      destination,
      goWildRate,
      totalLegs,
      goWildLegs,
    }));

  // Worst 5 — lowest GoWild rate (must have at least 1 leg so we don't surface zero-data routes unfairly)
  const worstRoutes: RouteStat[] = pool
    .slice()
    .sort((a, b) => a.goWildRate - b.goWildRate || b.totalLegs - a.totalLegs)
    .slice(0, 5)
    .map(({ route, origin, destination, goWildRate, totalLegs, goWildLegs }) => ({
      route,
      origin,
      destination,
      goWildRate,
      totalLegs,
      goWildLegs,
    }));

  // Most Reliable — lowest variance across snapshot days (min 3 days preferred)
  let mostReliableRoute: ReliableRoute | null = null;
  {
    const candidates = allStats
      .filter((s) => s.entry.byDay.size >= 1)
      .map((s) => {
        const dailyRates = Array.from(s.entry.byDay.values()).map((d) =>
          d.total > 0 ? d.goWild / d.total : 0
        );
        const v = variance(dailyRates);
        const limitedData = s.entry.byDay.size < 3;
        // Consistency score: 0 variance → 100, 1.0 variance → 0
        const consistencyScore = Math.round(Math.max(0, (1 - Math.sqrt(v)) * 100));
        return { s, v, dailyRates, limitedData, consistencyScore };
      })
      .sort((a, b) => a.v - b.v || b.s.goWildLegs - a.s.goWildLegs);

    if (candidates.length > 0) {
      const { s, v, limitedData, consistencyScore } = candidates[0];
      mostReliableRoute = {
        route: s.route,
        origin: s.origin,
        destination: s.destination,
        consistencyScore,
        goWildRate: s.goWildRate,
        variance: Math.round(Math.sqrt(v) * 1000) / 10, // as ± percentage, 1 decimal
        snapshotCount: s.entry.byDay.size,
        limitedData,
      };
    }
  }

  // Most Frequent GoWild — highest raw GoWild match count
  let mostFrequentGoWildRoute: FrequentRoute | null = null;
  {
    const sorted = allStats.slice().sort((a, b) => b.goWildLegs - a.goWildLegs);
    if (sorted.length > 0) {
      const top = sorted[0];
      // Trend: compare last 7 days vs previous 7 days for that route
      const now = Date.now();
      const day7 = 7 * 24 * 60 * 60 * 1000;
      let currentPeriodGW = 0, currentPeriodTotal = 0;
      let prevPeriodGW = 0, prevPeriodTotal = 0;

      for (const s of snapshots) {
        if (getRouteKey(s) !== top.route) continue;
        const age = now - new Date(s.snapshot_at).getTime();
        const gw = isGoWild(s.has_go_wild) ? 1 : 0;
        if (age >= 0 && age < day7) { currentPeriodGW += gw; currentPeriodTotal++; }
        else if (age >= day7 && age < 2 * day7) { prevPeriodGW += gw; prevPeriodTotal++; }
      }

      let trend: "up" | "down" | "stable" = "stable";
      if (currentPeriodTotal > 0 && prevPeriodTotal > 0) {
        const diff =
          currentPeriodGW / currentPeriodTotal - prevPeriodGW / prevPeriodTotal;
        if (diff > 0.05) trend = "up";
        else if (diff < -0.05) trend = "down";
      }

      mostFrequentGoWildRoute = {
        route: top.route,
        origin: top.origin,
        destination: top.destination,
        goWildMatches: top.goWildLegs,
        snapshotCount: top.entry.byDay.size,
        currentRate: top.goWildRate,
        trend,
      };
    }
  }

  return { topRoutes, worstRoutes, mostReliableRoute, mostFrequentGoWildRoute };
}

export function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? `${Math.round(rounded)}%` : `${rounded.toFixed(1)}%`;
}
