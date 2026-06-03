import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FlightSnapshot } from "@/components/insights/airportHelpers";
import { isGoWild, normalizeAirport } from "@/components/insights/airportHelpers";
import { BLACKOUT_PERIODS } from "@/utils/blackoutDates";
import { getFreshnessStatus } from "@/components/admin/FlightSearchDetailDrawer";
import { getResultSourceLabel } from "@/components/admin/FlightSearchDetailDrawer";

// ─── Time Range ───────────────────────────────────────────────────────────────

export type TimeRange = "today" | "24h" | "7d" | "30d" | "all";

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: "Today",
  "24h": "Last 24 Hours",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  all: "All Time",
};

export function getTimeRangeStart(range: TimeRange): string | null {
  const now = new Date();
  switch (range) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
      return null;
  }
}

// ─── Raw types from edge function ────────────────────────────────────────────

export interface SearchSampleRow {
  id: string;
  user_id: string;
  departure_airport: string;
  arrival_airport: string | null;
  gowild_found: boolean | null;
  result_source: string | null;
  flight_results_count: number | null;
  departure_date: string;
  triggered_by: string | null;
}

export interface ScanJobRow {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  timezone_group: string;
  target_date: string;
  airports_total: number;
  airports_succeeded: number;
  airports_failed: number;
  gowild_found_count: number;
  error_message: string | null;
  triggered_by: string;
}

// ─── Computed metric shapes ───────────────────────────────────────────────────

export interface OverviewMetrics {
  totalSearches: number;
  goWildHitRate: number;
  cacheHitRate: number;
  activeUsers: number;
}

export interface SearchMetrics {
  total: number;
  goWildHits: number;
  goWildHitRate: number;
  avgResultsPerSearch: number;
  bySource: {
    liveApi: number;
    cacheHit: number;
    adminBulk: number;
    scheduledBulk: number;
    other: number;
  };
  topOrigins: { airport: string; count: number; goWildCount: number }[];
  topDestinations: { airport: string; count: number; goWildCount: number }[];
  activeUsers: number;
}

export interface GoWildAvailMetrics {
  totalItineraries: number;
  goWildItineraries: number;
  availabilityPct: number;
  avgSeats: number | null;
  seatDistribution: { low: number; medium: number; strong: number };
  bestRoute: string | null;
  worstRoute: string | null;
}

export interface ExtendedRouteStat {
  route: string;
  origin: string;
  destination: string;
  goWildRate: number;
  totalLegs: number;
  goWildLegs: number;
  avgSeats: number | null;
  avgSavings: number | null;
  latestSnapshotAt: string | null;
  nonstopRate: number;
  bookabilityScore: number;
  statusBadge: "Book Now" | "Strong" | "Watch" | "Weak";
}

export interface FreshnessMetrics {
  fresh: number;
  recent: number;
  aging: number;
  stale: number;
  unknown: number;
  total: number;
  mostRecentAt: string | null;
  oldestAt: string | null;
  missingTimestamp: number;
}

export interface SavingsMetrics {
  totalSavings: number;
  avgSavings: number | null;
  maxSavings: number | null;
  topSavingsRoute: string | null;
  itinerariesWithSavings: number;
}

export interface BlackoutMetrics {
  nextPeriod: { start: string; end: string; description: string } | null;
  daysUntil: number | null;
  affectedSearchCount: number;
}

export interface CacheMetrics {
  cacheHitCount: number;
  liveApiCount: number;
  adminBulkCount: number;
  scheduledBulkCount: number;
  otherCount: number;
  total: number;
  cacheHitRate: number;
  estimatedApiCallsSaved: number;
}

export interface UserMetrics {
  activeUsers: number;
  totalUsers: number | null;
  searchesPerUser: number | null;
  savedFlightsInRange: number;
  savedFlightsTotal: number;
  savedPerUser: number | null;
}

export interface FunnelMetrics {
  totalSearches: number;
  goWildHits: number;
  savedFlights: number;
  goWildHitRate: number;
  saveRate: number;
  goWildSaveRate: number | null;
}

export interface DashboardData {
  overview: OverviewMetrics;
  searches: SearchMetrics;
  goWildAvail: GoWildAvailMetrics;
  bestRoutes: ExtendedRouteStat[];
  worstRoutes: ExtendedRouteStat[];
  freshness: FreshnessMetrics;
  savings: SavingsMetrics;
  blackout: BlackoutMetrics;
  cache: CacheMetrics;
  users: UserMetrics;
  funnel: FunnelMetrics;
  scanJobs: ScanJobRow[];
  snapshots: FlightSnapshot[];
}

// ─── Bookability score ────────────────────────────────────────────────────────

export function calculateBookabilityScore(params: {
  availabilityRate: number; // 0–100
  avgSeats: number | null;
  avgSavings: number | null;
  freshnessScore: number; // 0–100
  nonstopRate: number; // 0–1
  sampleSize: number;
}): number {
  const { availabilityRate, avgSeats, avgSavings, freshnessScore, nonstopRate, sampleSize } = params;

  // Normalize avgSeats: assume 6+ seats = 100, 0 = 0
  const normalizedSeats = avgSeats != null ? Math.min(100, (avgSeats / 6) * 100) : 50;

  // Normalize savings: assume $300+ savings = 100, $0 = 0
  const normalizedSavings = avgSavings != null && avgSavings > 0
    ? Math.min(100, (avgSavings / 300) * 100)
    : 0;

  // Sample size confidence: 20+ = 100, < 5 = 25
  const sampleConfidence = Math.min(100, Math.max(25, (sampleSize / 20) * 100));

  return (
    (availabilityRate * 40) / 100 +
    (normalizedSeats * 20) / 100 +
    (normalizedSavings * 20) / 100 +
    (freshnessScore * 10) / 100 +
    (nonstopRate * 100 * 5) / 100 +
    (sampleConfidence * 5) / 100
  );
}

function freshnessToScore(ts: string | null): number {
  if (!ts) return 0;
  const status = getFreshnessStatus(ts);
  switch (status) {
    case "fresh": return 100;
    case "recent": return 75;
    case "aging": return 40;
    case "stale": return 10;
    default: return 0;
  }
}

// ─── Extended route computation ───────────────────────────────────────────────

function computeExtendedRouteStats(snapshots: FlightSnapshot[]): ExtendedRouteStat[] {
  type Entry = {
    origin: string;
    destination: string;
    total: number;
    goWild: number;
    seats: number[];
    savings: number[];
    nonstop: number;
    latestAt: string | null;
  };

  const map = new Map<string, Entry>();

  for (const s of snapshots) {
    const origin = normalizeAirport(s.leg_origin_iata) ?? normalizeAirport(s.origin_iata);
    const dest = normalizeAirport(s.leg_destination_iata);
    if (!origin || !dest) continue;

    const key = `${origin} → ${dest}`;
    if (!map.has(key)) {
      map.set(key, { origin, destination: dest, total: 0, goWild: 0, seats: [], savings: [], nonstop: 0, latestAt: null });
    }
    const e = map.get(key)!;
    e.total++;

    if (!e.latestAt || s.snapshot_at > e.latestAt) e.latestAt = s.snapshot_at;

    // stops field is on the snapshot row (available via index signature)
    const stopsVal = (s as any).stops;
    if (stopsVal === 0) e.nonstop++;

    if (isGoWild(s.has_go_wild)) {
      e.goWild++;
      if (s.go_wild_available_seats != null) e.seats.push(s.go_wild_available_seats);
      if (s.standard_total != null && s.go_wild_total != null) {
        const saving = s.standard_total - s.go_wild_total;
        if (saving > 0) e.savings.push(saving);
      }
    }
  }

  const MIN_SAMPLE = 3;

  return Array.from(map.entries())
    .filter(([, e]) => e.total >= MIN_SAMPLE)
    .map(([route, e]) => {
      const goWildRate = e.total > 0 ? (e.goWild / e.total) * 100 : 0;
      const avgSeats = e.seats.length > 0 ? e.seats.reduce((a, b) => a + b, 0) / e.seats.length : null;
      const avgSavings = e.savings.length > 0 ? e.savings.reduce((a, b) => a + b, 0) / e.savings.length : null;
      const nonstopRate = e.total > 0 ? e.nonstop / e.total : 0;
      const fscore = freshnessToScore(e.latestAt);

      const score = calculateBookabilityScore({
        availabilityRate: goWildRate,
        avgSeats,
        avgSavings,
        freshnessScore: fscore,
        nonstopRate,
        sampleSize: e.total,
      });

      let statusBadge: ExtendedRouteStat["statusBadge"];
      if (score >= 60) statusBadge = "Book Now";
      else if (score >= 40) statusBadge = "Strong";
      else if (score >= 20) statusBadge = "Watch";
      else statusBadge = "Weak";

      return {
        route,
        origin: e.origin,
        destination: e.destination,
        goWildRate,
        totalLegs: e.total,
        goWildLegs: e.goWild,
        avgSeats,
        avgSavings,
        latestSnapshotAt: e.latestAt,
        nonstopRate,
        bookabilityScore: Math.round(score),
        statusBadge,
      } satisfies ExtendedRouteStat;
    });
}

// ─── Metric computation ───────────────────────────────────────────────────────

function computeMetrics(
  totalSearches: number,
  goWildHits: number,
  savedFlightsInRange: number,
  savedFlightsTotal: number,
  totalUsersCount: number | null,
  searchSample: SearchSampleRow[],
  scanJobs: ScanJobRow[],
  snapshots: FlightSnapshot[]
): DashboardData {
  // ── Source breakdown ──
  const bySource = { liveApi: 0, cacheHit: 0, adminBulk: 0, scheduledBulk: 0, other: 0 };
  let totalResults = 0;
  const userIdSet = new Set<string>();
  const originCounts = new Map<string, { count: number; goWild: number }>();
  const destCounts = new Map<string, { count: number; goWild: number }>();

  for (const row of searchSample) {
    const label = getResultSourceLabel(row.result_source);
    switch (label) {
      case "Live API": bySource.liveApi++; break;
      case "Cache Hit": bySource.cacheHit++; break;
      case "Admin Bulk": bySource.adminBulk++; break;
      case "Scheduled Scan": bySource.scheduledBulk++; break;
      default: bySource.other++; break;
    }
    if (row.flight_results_count) totalResults += row.flight_results_count;
    if (row.user_id) userIdSet.add(row.user_id);

    const org = normalizeAirport(row.departure_airport);
    if (org) {
      const e = originCounts.get(org) ?? { count: 0, goWild: 0 };
      e.count++;
      if (row.gowild_found) e.goWild++;
      originCounts.set(org, e);
    }

    const dst = normalizeAirport(row.arrival_airport);
    if (dst) {
      const e = destCounts.get(dst) ?? { count: 0, goWild: 0 };
      e.count++;
      if (row.gowild_found) e.goWild++;
      destCounts.set(dst, e);
    }
  }

  const sampleTotal = searchSample.length;
  const activeUsers = userIdSet.size;
  const avgResultsPerSearch = sampleTotal > 0 ? totalResults / sampleTotal : 0;

  const topOrigins = [...originCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([airport, v]) => ({ airport, ...v }));

  const topDestinations = [...destCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([airport, v]) => ({ airport, ...v }));

  const goWildHitRate = totalSearches > 0 ? (goWildHits / totalSearches) * 100 : 0;
  const cacheHitRate = sampleTotal > 0 ? (bySource.cacheHit / sampleTotal) * 100 : 0;

  // ── GoWild availability from snapshots ──
  const goWildSnaps = snapshots.filter((s) => isGoWild(s.has_go_wild));
  const totalItineraries = snapshots.length;
  const goWildItineraries = goWildSnaps.length;
  const availabilityPct = totalItineraries > 0 ? (goWildItineraries / totalItineraries) * 100 : 0;

  const allSeats = goWildSnaps
    .map((s) => s.go_wild_available_seats)
    .filter((v): v is number => v != null);
  const avgSeats = allSeats.length > 0 ? allSeats.reduce((a, b) => a + b, 0) / allSeats.length : null;

  const seatDist = { low: 0, medium: 0, strong: 0 };
  for (const v of allSeats) {
    if (v <= 2) seatDist.low++;
    else if (v <= 5) seatDist.medium++;
    else seatDist.strong++;
  }

  // ── Route stats ──
  const routeStats = computeExtendedRouteStats(snapshots);
  const bestRoutes = [...routeStats]
    .sort((a, b) => b.bookabilityScore - a.bookabilityScore)
    .slice(0, 5);
  const worstRoutes = [...routeStats]
    .sort((a, b) => a.bookabilityScore - b.bookabilityScore)
    .slice(0, 5);

  const bestRoute = bestRoutes[0]?.route ?? null;
  const worstRoute = worstRoutes[0]?.route ?? null;

  // ── Freshness ──
  const freshnessCounts = { fresh: 0, recent: 0, aging: 0, stale: 0, unknown: 0 };
  let mostRecentAt: string | null = null;
  let oldestAt: string | null = null;
  let missingTimestamp = 0;

  for (const s of snapshots) {
    if (!s.snapshot_at) { missingTimestamp++; freshnessCounts.unknown++; continue; }
    const status = getFreshnessStatus(s.snapshot_at);
    freshnessCounts[status]++;
    if (!mostRecentAt || s.snapshot_at > mostRecentAt) mostRecentAt = s.snapshot_at;
    if (!oldestAt || s.snapshot_at < oldestAt) oldestAt = s.snapshot_at;
  }

  // ── Savings from snapshots ──
  let totalSavings = 0;
  let maxSavings = 0;
  let savingsCount = 0;
  const savingsByRoute = new Map<string, number[]>();

  for (const s of snapshots) {
    if (!isGoWild(s.has_go_wild)) continue;
    if (s.standard_total == null || s.go_wild_total == null) continue;
    const saving = s.standard_total - s.go_wild_total;
    if (saving <= 0) continue;
    totalSavings += saving;
    if (saving > maxSavings) maxSavings = saving;
    savingsCount++;

    const origin = normalizeAirport(s.leg_origin_iata) ?? normalizeAirport(s.origin_iata);
    const dest = normalizeAirport(s.leg_destination_iata);
    if (origin && dest) {
      const key = `${origin} → ${dest}`;
      const arr = savingsByRoute.get(key) ?? [];
      arr.push(saving);
      savingsByRoute.set(key, arr);
    }
  }

  let topSavingsRoute: string | null = null;
  let topSavingsAvg = 0;
  for (const [route, vals] of savingsByRoute) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg > topSavingsAvg) { topSavingsAvg = avg; topSavingsRoute = route; }
  }

  // ── Blackout awareness ──
  const today = new Date().toISOString().slice(0, 10);
  const upcomingPeriods = BLACKOUT_PERIODS
    .filter((p) => p.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const nextPeriod = upcomingPeriods[0] ?? null;
  const daysUntil = nextPeriod
    ? Math.max(0, Math.ceil((new Date(nextPeriod.start).getTime() - Date.now()) / 86400000))
    : null;

  let affectedSearchCount = 0;
  for (const row of searchSample) {
    if (!row.departure_date) continue;
    const d = row.departure_date.slice(0, 10);
    if (BLACKOUT_PERIODS.some((p) => d >= p.start && d <= p.end)) affectedSearchCount++;
  }

  // ── Cache metrics ──
  const cacheTotal = sampleTotal;
  const estimatedApiCallsSaved = bySource.cacheHit + bySource.scheduledBulk;

  // ── Users ──
  const searchesPerUser = activeUsers > 0 ? totalSearches / activeUsers : null;
  const savedPerUser = activeUsers > 0 ? savedFlightsInRange / activeUsers : null;

  // ── Funnel ──
  const saveRate = totalSearches > 0 ? (savedFlightsInRange / totalSearches) * 100 : 0;
  const goWildSaveRate = goWildHits > 0 ? (savedFlightsInRange / goWildHits) * 100 : null;

  return {
    overview: {
      totalSearches,
      goWildHitRate,
      cacheHitRate,
      activeUsers,
    },
    searches: {
      total: totalSearches,
      goWildHits,
      goWildHitRate,
      avgResultsPerSearch,
      bySource,
      topOrigins,
      topDestinations,
      activeUsers,
    },
    goWildAvail: {
      totalItineraries,
      goWildItineraries,
      availabilityPct,
      avgSeats,
      seatDistribution: seatDist,
      bestRoute,
      worstRoute,
    },
    bestRoutes,
    worstRoutes,
    freshness: {
      ...freshnessCounts,
      total: snapshots.length,
      mostRecentAt,
      oldestAt,
      missingTimestamp,
    },
    savings: {
      totalSavings,
      avgSavings: savingsCount > 0 ? totalSavings / savingsCount : null,
      maxSavings: maxSavings > 0 ? maxSavings : null,
      topSavingsRoute,
      itinerariesWithSavings: savingsCount,
    },
    blackout: { nextPeriod, daysUntil, affectedSearchCount },
    cache: {
      cacheHitCount: bySource.cacheHit,
      liveApiCount: bySource.liveApi,
      adminBulkCount: bySource.adminBulk,
      scheduledBulkCount: bySource.scheduledBulk,
      otherCount: bySource.other,
      total: cacheTotal,
      cacheHitRate,
      estimatedApiCallsSaved,
    },
    users: {
      activeUsers,
      totalUsers: totalUsersCount,
      searchesPerUser,
      savedFlightsInRange,
      savedFlightsTotal,
      savedPerUser,
    },
    funnel: {
      totalSearches,
      goWildHits,
      savedFlights: savedFlightsInRange,
      goWildHitRate,
      saveRate,
      goWildSaveRate,
    },
    scanJobs,
    snapshots,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const SNAPSHOT_PAGE_SIZE = 1000;

export function useAdminDashboardMetrics(timeRange: TimeRange) {
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [trigger, setTrigger]       = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  const since = useMemo(() => getTimeRangeStart(timeRange), [timeRange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

        // Fetch edge function + snapshot RPC in parallel
        const [edgeRes, snapshotData] = await Promise.all([
          fetch(`https://${projectId}.supabase.co/functions/v1/admin-dashboard-metrics`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ since }),
          }),
          (async () => {
            const all: FlightSnapshot[] = [];
            const seen = new Set<string>();
            const { data: rows, error: rpcErr } = await (supabase.rpc as any)(
              "get_global_gowild_insight_snapshots",
              { p_since: since, p_limit: SNAPSHOT_PAGE_SIZE, p_offset: 0 }
            );
            if (rpcErr) return [] as FlightSnapshot[];
            for (const r of (rows ?? []) as FlightSnapshot[]) {
              if (!seen.has(r.id)) { seen.add(r.id); all.push(r); }
            }
            return all;
          })(),
        ]);

        if (cancelled) return;

        if (!edgeRes.ok) {
          const body = await edgeRes.json().catch(() => ({}));
          throw new Error(body?.error ?? `Edge function error ${edgeRes.status}`);
        }

        const edgeJson = await edgeRes.json();

        const computed = computeMetrics(
          edgeJson.totalSearches ?? 0,
          edgeJson.goWildHits ?? 0,
          edgeJson.savedFlightsInRange ?? 0,
          edgeJson.savedFlightsTotal ?? 0,
          edgeJson.totalUsersCount ?? null,
          edgeJson.searchSample ?? [],
          edgeJson.scanJobs ?? [],
          snapshotData
        );

        if (cancelled) return;
        setData(computed);
        setLastUpdated(new Date());
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Unknown error");
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [since, trigger]);

  return { data, loading, error, lastUpdated, refetch };
}
