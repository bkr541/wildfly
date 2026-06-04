import { useState, useEffect, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RefreshIcon,
  AirplaneTakeOff01Icon,
  ArrowUpRight01Icon,
  ArrowDownLeft01Icon,
  Cancel01Icon,
  AlertCircleIcon,
  Clock01Icon,
  Analytics01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  ArrowRight01Icon,
  Globe02Icon,
  FilterMailSquareIcon,
  Radar01Icon,
  ChartRoseIcon,
  Coins01Icon,
} from "@hugeicons/core-free-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";
import type { FlightSnapshot } from "@/components/insights/airportHelpers";
import { isGoWild } from "@/components/insights/airportHelpers";
import { getFreshnessStatus, type Freshness } from "@/components/admin/FlightSearchDetailDrawer";

// ── Style constants ────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// ── Types ──────────────────────────────────────────────────────────────────────

type RadarTimeRange = "3h" | "24h" | "7d" | "30d" | "all";
type RadarMode = "availability" | "seats" | "savings" | "freshness" | "searchDemand" | "volatility";
type BookabilityStatus = "book_now" | "strong" | "watch" | "cold" | "weak";
type RouteTypeFilter = "all" | "gowild" | "no-gowild" | "fresh" | "stale";

interface RouteMetric {
  routeKey: string;
  origin: string;
  destination: string;
  snapshotCount: number;
  goWildCount: number;
  availabilityRate: number;
  avgGoWildSeats: number | null;
  maxGoWildSeats: number | null;
  avgGoWildFare: number | null;
  avgStandardFare: number | null;
  avgSavings: number | null;
  maxSavings: number | null;
  latestObservedAt: string | null;
  freshnessStatus: Freshness;
  volatilityScore: number;
  bookabilityScore: number;
  bookabilityStatus: BookabilityStatus;
  isStale: boolean;
  searchCount: number;
}

interface AirportMetric {
  iata: string;
  lat: number;
  lng: number;
  name: string;
  city: string;
  searchVolume: number;
  routeCount: number;
  goWildRouteCount: number;
  avgAvailabilityRate: number | null;
  avgSeats: number | null;
  avgSavings: number | null;
  latestObservedAt: string | null;
  freshnessStatus: Freshness;
  opportunityStrength: "strong" | "good" | "weak" | "poor" | "unknown";
}

interface RadarData {
  routes: RouteMetric[];
  airports: AirportMetric[];
  totalSnapshots: number;
  availableOrigins: string[];
  availableDestinations: string[];
}

// ── Time range ─────────────────────────────────────────────────────────────────

const RADAR_TIME_LABELS: Record<RadarTimeRange, string> = {
  "3h":  "Last 3 Hours",
  "24h": "Last 24 Hours",
  "7d":  "Last 7 Days",
  "30d": "Last 30 Days",
  "all": "All Time",
};

function getRadarTimeStart(range: RadarTimeRange): string | null {
  const MS: Partial<Record<RadarTimeRange, number>> = {
    "3h":  3 * 3600_000,
    "24h": 24 * 3600_000,
    "7d":  7 * 24 * 3600_000,
    "30d": 30 * 24 * 3600_000,
  };
  const ms = MS[range];
  return ms != null ? new Date(Date.now() - ms).toISOString() : null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<RadarMode, string> = {
  availability:  "Availability",
  seats:         "Seats",
  savings:       "Savings",
  freshness:     "Freshness",
  searchDemand:  "Search Demand",
  volatility:    "Volatility",
};

function getFreshnessScore(status: Freshness): number {
  return status === "fresh" ? 1 : status === "recent" ? 0.75 : status === "aging" ? 0.35 : status === "stale" ? 0.1 : 0;
}

function calculateBookabilityScore(r: {
  availabilityRate: number;
  avgGoWildSeats: number | null;
  avgSavings: number | null;
  freshnessStatus: Freshness;
  snapshotCount: number;
  volatilityScore: number;
}): number {
  // availabilityRate × 40 + normalizedSeats × 20 + normalizedSavings × 20
  // + freshnessScore × 10 + sampleConfidence × 5 + nonstopBonus × 5 - volatilityPenalty
  const availScore = r.availabilityRate * 40;
  const seatsScore = r.avgGoWildSeats != null ? Math.min(r.avgGoWildSeats / 8, 1) * 20 : 0;
  const savingsScore = r.avgSavings != null ? Math.min(r.avgSavings / 150, 1) * 20 : 0;
  const freshScore = getFreshnessScore(r.freshnessStatus) * 10;
  const sampleScore = Math.min(r.snapshotCount / 20, 1) * 5;
  const volatilityPenalty = Math.min(r.volatilityScore / 100, 1) * 10;
  return Math.max(0, Math.min(100, availScore + seatsScore + savingsScore + freshScore + sampleScore - volatilityPenalty));
}

function getBookabilityStatus(score: number): BookabilityStatus {
  if (score >= 90) return "book_now";
  if (score >= 75) return "strong";
  if (score >= 55) return "watch";
  if (score >= 35) return "cold";
  return "weak";
}

const BOOKABILITY_LABEL: Record<BookabilityStatus, string> = {
  book_now: "Book Now",
  strong:   "Strong",
  watch:    "Watch",
  cold:     "Cold",
  weak:     "Weak",
};

const BOOKABILITY_COLOR: Record<BookabilityStatus, "emerald" | "cyan" | "amber" | "rose" | "gray"> = {
  book_now: "emerald",
  strong:   "cyan",
  watch:    "amber",
  cold:     "rose",
  weak:     "gray",
};

function getRouteColor(route: RouteMetric, mode: RadarMode): string {
  switch (mode) {
    case "availability": {
      if (route.availabilityRate >= 0.5)  return "#059669";
      if (route.availabilityRate >= 0.25) return "#F59E0B";
      return "#F43F5E";
    }
    case "seats": {
      const s = route.avgGoWildSeats;
      if (s == null) return "#9CA3AF";
      if (s >= 8) return "#059669";
      if (s >= 4) return "#0891B2";
      if (s >= 1) return "#F59E0B";
      return "#F43F5E";
    }
    case "savings": {
      const sv = route.avgSavings;
      if (sv == null) return "#9CA3AF";
      if (sv >= 100) return "#059669";
      if (sv >= 50)  return "#0891B2";
      if (sv >= 10)  return "#F59E0B";
      return "#9CA3AF";
    }
    case "freshness": {
      const f = route.freshnessStatus;
      if (f === "fresh")   return "#059669";
      if (f === "recent")  return "#0891B2";
      if (f === "aging")   return "#F59E0B";
      if (f === "stale")   return "#F43F5E";
      return "#9CA3AF";
    }
    case "searchDemand": {
      const d = route.searchCount;
      if (d >= 50) return "#059669";
      if (d >= 20) return "#0891B2";
      if (d >= 5)  return "#F59E0B";
      return "#9CA3AF";
    }
    case "volatility": {
      const v = route.volatilityScore;
      if (v < 20 && route.availabilityRate >= 0.4) return "#059669";
      if (v < 30) return "#F59E0B";
      return "#F43F5E";
    }
  }
}

function getAirportColor(airport: AirportMetric, mode: RadarMode): string {
  switch (mode) {
    case "availability": {
      const r = airport.avgAvailabilityRate ?? 0;
      if (r >= 0.5)  return "#059669";
      if (r >= 0.25) return "#F59E0B";
      return "#F43F5E";
    }
    case "seats": {
      const s = airport.avgSeats;
      if (s == null) return "#9CA3AF";
      if (s >= 8) return "#059669";
      if (s >= 4) return "#0891B2";
      if (s >= 1) return "#F59E0B";
      return "#F43F5E";
    }
    case "savings": {
      const sv = airport.avgSavings;
      if (sv == null) return "#9CA3AF";
      if (sv >= 100) return "#059669";
      if (sv >= 50)  return "#0891B2";
      if (sv >= 10)  return "#F59E0B";
      return "#9CA3AF";
    }
    case "freshness": {
      const f = airport.freshnessStatus;
      if (f === "fresh")  return "#059669";
      if (f === "recent") return "#0891B2";
      if (f === "aging")  return "#F59E0B";
      if (f === "stale")  return "#F43F5E";
      return "#9CA3AF";
    }
    case "searchDemand": {
      const v = airport.searchVolume;
      if (v >= 100) return "#059669";
      if (v >= 30)  return "#0891B2";
      if (v >= 5)   return "#F59E0B";
      return "#9CA3AF";
    }
    case "volatility": {
      const str = airport.opportunityStrength;
      if (str === "strong") return "#059669";
      if (str === "good")   return "#0891B2";
      if (str === "weak")   return "#F59E0B";
      if (str === "poor")   return "#F43F5E";
      return "#9CA3AF";
    }
  }
}

// ── Arc geometry ───────────────────────────────────────────────────────────────

function arcPoints(lat1: number, lng1: number, lat2: number, lng2: number, steps = 24): [number, number][] {
  const dlat = lat2 - lat1, dlng = lng2 - lng1;
  const dist = Math.sqrt(dlat * dlat + dlng * dlng);
  if (dist < 0.001) return [[lat1, lng1], [lat2, lng2]];
  const lift = dist * 0.18;
  const midLat = (lat1 + lat2) / 2, midLng = (lng1 + lng2) / 2;
  const cpLat = midLat - (dlng / dist) * lift;
  const cpLng = midLng + (dlat / dist) * lift;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, mt = 1 - t;
    return [mt * mt * lat1 + 2 * mt * t * cpLat + t * t * lat2, mt * mt * lng1 + 2 * mt * t * cpLng + t * t * lng2] as [number, number];
  });
}

// ── Data computation ───────────────────────────────────────────────────────────

function computeRadarData(
  snapshots: FlightSnapshot[],
  searchDemand: Map<string, number>,
  dict: ReturnType<typeof useAirportDictionary>["dict"]
): RadarData {
  // Per-route accumulators
  const routeAcc = new Map<string, {
    origin: string; destination: string;
    snapshotCount: number; goWildCount: number;
    seatSum: number; seatN: number;
    savingsSum: number; savingsN: number;
    gwFareSum: number; gwFareN: number;
    stdFareSum: number; stdFareN: number;
    maxSeats: number; maxSavings: number;
    gwSeries: boolean[]; // for volatility
    latestAt: string | null;
  }>();

  // Per-airport accumulators
  const airportAcc = new Map<string, {
    routeKeys: Set<string>; gwRouteKeys: Set<string>;
    rateSum: number; rateN: number;
    seatSum: number; seatN: number;
    savingsSum: number; savingsN: number;
    latestAt: string | null;
  }>();

  for (const snap of snapshots) {
    const org = snap.leg_origin_iata ?? snap.origin_iata;
    const dst = snap.leg_destination_iata ?? snap.destination_iata;
    if (!org || !dst) continue;
    if (!dict[org]?.latitude || !dict[dst]?.latitude) continue;

    const gw = isGoWild(snap.has_go_wild);
    const seats = snap.go_wild_available_seats ?? null;
    const savings = snap.standard_total != null && snap.go_wild_total != null && snap.standard_total > snap.go_wild_total
      ? snap.standard_total - snap.go_wild_total
      : null;

    const routeKey = `${org}-${dst}`;
    let r = routeAcc.get(routeKey);
    if (!r) {
      r = { origin: org, destination: dst, snapshotCount: 0, goWildCount: 0, seatSum: 0, seatN: 0, savingsSum: 0, savingsN: 0, gwFareSum: 0, gwFareN: 0, stdFareSum: 0, stdFareN: 0, maxSeats: 0, maxSavings: 0, gwSeries: [], latestAt: null };
      routeAcc.set(routeKey, r);
    }
    r.snapshotCount++;
    r.gwSeries.push(gw);
    if (gw) {
      r.goWildCount++;
      if (seats != null) { r.seatSum += seats; r.seatN++; if (seats > r.maxSeats) r.maxSeats = seats; }
      if (snap.go_wild_total != null) { r.gwFareSum += snap.go_wild_total; r.gwFareN++; }
    }
    if (savings != null) { r.savingsSum += savings; r.savingsN++; if (savings > r.maxSavings) r.maxSavings = savings; }
    if (snap.standard_total != null) { r.stdFareSum += snap.standard_total; r.stdFareN++; }
    if (!r.latestAt || snap.snapshot_at > r.latestAt) r.latestAt = snap.snapshot_at;

    // Airport accumulators
    for (const code of [org, dst]) {
      let a = airportAcc.get(code);
      if (!a) {
        a = { routeKeys: new Set(), gwRouteKeys: new Set(), rateSum: 0, rateN: 0, seatSum: 0, seatN: 0, savingsSum: 0, savingsN: 0, latestAt: null };
        airportAcc.set(code, a);
      }
      a.routeKeys.add(routeKey);
      if (gw) {
        a.gwRouteKeys.add(routeKey);
        if (seats != null) { a.seatSum += seats; a.seatN++; }
      }
      if (savings != null) { a.savingsSum += savings; a.savingsN++; }
      if (!a.latestAt || snap.snapshot_at > a.latestAt) a.latestAt = snap.snapshot_at;
    }
  }

  // Build RouteMetric[]
  const routes: RouteMetric[] = [];
  for (const [routeKey, acc] of routeAcc) {
    const availabilityRate = acc.snapshotCount > 0 ? acc.goWildCount / acc.snapshotCount : 0;
    const avgGoWildSeats = acc.seatN > 0 ? acc.seatSum / acc.seatN : null;
    const avgSavings = acc.savingsN > 0 ? acc.savingsSum / acc.savingsN : null;
    const avgGoWildFare = acc.gwFareN > 0 ? acc.gwFareSum / acc.gwFareN : null;
    const avgStandardFare = acc.stdFareN > 0 ? acc.stdFareSum / acc.stdFareN : null;
    const freshnessStatus = acc.latestAt ? getFreshnessStatus(acc.latestAt) : "unknown";
    const isStale = freshnessStatus === "stale" || freshnessStatus === "unknown";

    // Volatility: proportion of minority class × 4 (max at 50/50 split = 100)
    const gwFlips = acc.gwSeries.length > 1
      ? acc.gwSeries.reduce((n, v, i) => i > 0 && v !== acc.gwSeries[i - 1] ? n + 1 : n, 0)
      : 0;
    const volatilityScore = acc.gwSeries.length > 1 ? Math.min((gwFlips / (acc.gwSeries.length - 1)) * 100, 100) : 0;

    const searchCount = (searchDemand.get(acc.origin) ?? 0) + (searchDemand.get(acc.destination) ?? 0);

    const partial = { availabilityRate, avgGoWildSeats, avgSavings, freshnessStatus, snapshotCount: acc.snapshotCount, volatilityScore };
    const bookabilityScore = calculateBookabilityScore(partial);
    const bookabilityStatus = getBookabilityStatus(bookabilityScore);

    routes.push({
      routeKey, origin: acc.origin, destination: acc.destination,
      snapshotCount: acc.snapshotCount, goWildCount: acc.goWildCount,
      availabilityRate, avgGoWildSeats,
      maxGoWildSeats: acc.seatN > 0 ? acc.maxSeats : null,
      avgGoWildFare, avgStandardFare,
      avgSavings, maxSavings: acc.savingsN > 0 ? acc.maxSavings : null,
      latestObservedAt: acc.latestAt, freshnessStatus, isStale,
      volatilityScore, bookabilityScore, bookabilityStatus, searchCount,
    });
  }

  // Build AirportMetric[]
  const airports: AirportMetric[] = [];
  for (const [iata, acc] of airportAcc) {
    const info = dict[iata];
    if (!info?.latitude || !info?.longitude) continue;

    // avg availability rate across routes
    let rateSum = 0, rateN = 0;
    for (const rk of acc.routeKeys) {
      const rm = routeAcc.get(rk);
      if (rm) { rateSum += rm.goWildCount / rm.snapshotCount; rateN++; }
    }
    const avgAvailabilityRate = rateN > 0 ? rateSum / rateN : null;
    const avgSeats = acc.seatN > 0 ? acc.seatSum / acc.seatN : null;
    const avgSavings = acc.savingsN > 0 ? acc.savingsSum / acc.savingsN : null;
    const freshnessStatus = acc.latestAt ? getFreshnessStatus(acc.latestAt) : "unknown";
    const searchVolume = searchDemand.get(iata) ?? 0;

    const rate = avgAvailabilityRate ?? 0;
    const opportunityStrength: AirportMetric["opportunityStrength"] =
      rate >= 0.5  ? "strong"
      : rate >= 0.35 ? "good"
      : rate >= 0.15 ? "weak"
      : rate > 0    ? "poor"
      : "unknown";

    airports.push({
      iata, lat: info.latitude, lng: info.longitude, name: info.name ?? iata, city: info.city ?? iata,
      searchVolume, routeCount: acc.routeKeys.size, goWildRouteCount: acc.gwRouteKeys.size,
      avgAvailabilityRate, avgSeats, avgSavings, latestObservedAt: acc.latestAt,
      freshnessStatus, opportunityStrength,
    });
  }

  const availableOrigins = [...new Set(routes.map((r) => r.origin))].sort();
  const availableDestinations = [...new Set(routes.map((r) => r.destination))].sort();

  return { routes, airports, totalSnapshots: snapshots.length, availableOrigins, availableDestinations };
}

// ── Data hook ──────────────────────────────────────────────────────────────────

function useGoWildRadarData(timeRange: RadarTimeRange) {
  const [snapshots, setSnapshots] = useState<FlightSnapshot[]>([]);
  const [searchDemand, setSearchDemand] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { dict, loading: dictLoading } = useAirportDictionary();

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const since = getRadarTimeStart(timeRange);
        const [snapshotRes, searchRes] = await Promise.all([
          supabase.rpc("get_global_gowild_insight_snapshots", { p_limit: 2000 }),
          supabase.from("flight_searches")
            .select("departure_airport, arrival_airport")
            .gte("search_timestamp", since ?? "2000-01-01")
            .limit(2000),
        ]);
        if (cancelled) return;
        if (snapshotRes.error) { setError(snapshotRes.error.message); return; }

        // Filter snapshots by time range client-side
        const raw = (snapshotRes.data ?? []) as FlightSnapshot[];
        const filtered = since ? raw.filter((s) => s.snapshot_at >= since) : raw;
        setSnapshots(filtered);

        // Build demand map
        const demand = new Map<string, number>();
        for (const row of (searchRes.data ?? [])) {
          if (row.departure_airport) demand.set(row.departure_airport, (demand.get(row.departure_airport) ?? 0) + 1);
          if (row.arrival_airport)   demand.set(row.arrival_airport,   (demand.get(row.arrival_airport)   ?? 0) + 1);
        }
        setSearchDemand(demand);
        setLastUpdated(new Date());
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trigger, timeRange]);

  const data = useMemo<RadarData | null>(() => {
    if (dictLoading || snapshots.length === 0) return null;
    return computeRadarData(snapshots, searchDemand, dict);
  }, [snapshots, searchDemand, dict, dictLoading]);

  return { data, loading: loading || dictLoading, error, refetch, lastUpdated };
}

// ── Map auto-fitter ────────────────────────────────────────────────────────────

function MapFitter({ airports }: { airports: AirportMetric[] }) {
  const map = useMap();
  const count = airports.length;
  useEffect(() => {
    if (count === 0) return;
    if (count === 1) { map.setView([airports[0].lat, airports[0].lng], 8, { animate: true }); return; }
    const lats = airports.map((n) => n.lat), lngs = airports.map((n) => n.lng);
    map.fitBounds([[Math.min(...lats) - 2, Math.min(...lngs) - 3], [Math.max(...lats) + 2, Math.max(...lngs) + 3]], { animate: true, duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  return null;
}

// ── Micro-components ───────────────────────────────────────────────────────────

function Badge({
  children,
  color = "emerald",
}: {
  children: React.ReactNode;
  color?: "emerald" | "amber" | "rose" | "cyan" | "indigo" | "gray";
}) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    amber:   "bg-amber-100 text-amber-700 border-amber-200",
    rose:    "bg-rose-100 text-rose-700 border-rose-200",
    cyan:    "bg-cyan-100 text-cyan-700 border-cyan-200",
    indigo:  "bg-indigo-100 text-indigo-700 border-indigo-200",
    gray:    "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls[color]}`}>
      {children}
    </span>
  );
}

function BookabilityBadge({ status }: { status: BookabilityStatus }) {
  return <Badge color={BOOKABILITY_COLOR[status]}>{BOOKABILITY_LABEL[status]}</Badge>;
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 0.5 ? "bg-emerald-500" : rate >= 0.25 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="h-1 rounded-full bg-gray-100 overflow-hidden mt-1">
      <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.round(rate * 100)}%` }} />
    </div>
  );
}

function SkeletonCard({ height = 80 }: { height?: number }) {
  return <div className="rounded-2xl bg-gray-100 animate-pulse" style={{ height }} />;
}

// ── Mode tabs ──────────────────────────────────────────────────────────────────

function RadarModeTabs({ mode, onChange }: { mode: RadarMode; onChange: (m: RadarMode) => void }) {
  const modes = Object.entries(MODE_LABELS) as [RadarMode, string][];
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-2xl overflow-x-auto no-scrollbar"
      style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 2px 8px rgba(52,92,90,0.06)" }}
    >
      {modes.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 min-w-[92px] px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
            mode === key
              ? "text-white"
              : "text-[#6B7B7B] hover:text-[#2E4A4A] hover:bg-gray-50"
          }`}
          style={mode === key ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Filter row ─────────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] font-semibold text-[#2E4A4A] hover:bg-gray-50 transition-colors whitespace-nowrap"
      >
        <span>{selected?.label ?? placeholder}</span>
        <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-[8px] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 min-w-[140px]" style={{ background: "rgba(255,255,255,0.98)" }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center px-3 py-2 text-[11px] font-semibold text-left transition-colors ${value === opt.value ? "bg-emerald-50 text-emerald-700" : "text-[#2E4A4A] hover:bg-gray-50"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = "#059669" }: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl flex-1" style={CARD_STYLE}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <HugeiconsIcon icon={icon} size={18} color={color} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">{label}</div>
        <div className="text-xl font-black leading-tight" style={{ color }}>{value}</div>
        {sub && <div className="text-[9px] text-[#9CA3AF] truncate">{sub}</div>}
      </div>
    </div>
  );
}

function KpiStrip({ routes, loading }: { routes: RouteMetric[]; loading: boolean }) {
  const activeRoutes = routes.length;
  const hotspots = routes.filter((r) => r.bookabilityStatus === "book_now" || r.bookabilityStatus === "strong").length;
  const avgSavings = useMemo(() => {
    const valid = routes.filter((r) => r.avgSavings != null);
    return valid.length > 0 ? valid.reduce((s, r) => s + r.avgSavings!, 0) / valid.length : null;
  }, [routes]);
  const freshRoutes = routes.filter((r) => r.freshnessStatus === "fresh" || r.freshnessStatus === "recent").length;

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0,1,2,3].map((i) => <SkeletonCard key={i} height={72} />)}
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard icon={AirplaneTakeOff01Icon} label="Active Routes" value={activeRoutes.toString()} sub="within current filters" />
      <KpiCard icon={CheckmarkCircle01Icon} label="GoWild Hotspots" value={hotspots.toString()} sub="Book Now or Strong" color="#0891B2" />
      <KpiCard icon={Coins01Icon} label="Avg Savings" value={avgSavings != null ? `$${Math.round(avgSavings)}` : "—"} sub="positive savings across routes" color="#D97706" />
      <KpiCard icon={Clock01Icon} label="Fresh Data Routes" value={freshRoutes.toString()} sub="fresh or recent observation" color="#7C3AED" />
    </div>
  );
}

// ── Best Moves panel ───────────────────────────────────────────────────────────

function BestMovesPanel({
  routes,
  selectedRoute,
  onSelect,
  loading,
}: {
  routes: RouteMetric[];
  selectedRoute: string | null;
  onSelect: (key: string) => void;
  loading: boolean;
}) {
  const top5 = useMemo(
    () => [...routes].sort((a, b) => b.bookabilityScore - a.bookabilityScore).slice(0, 5),
    [routes]
  );

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden" style={CARD_STYLE}>
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} color="#059669" strokeWidth={2} />
        <span className="text-xs font-black text-[#2E4A4A] uppercase tracking-wide">Best Moves Right Now</span>
      </div>
      <div className="flex flex-col overflow-y-auto">
        {loading ? (
          <div className="p-3 flex flex-col gap-2">
            {[0,1,2,3,4].map((i) => <SkeletonCard key={i} height={56} />)}
          </div>
        ) : top5.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">No routes match current filters</div>
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {top5.map((route, i) => {
              const isSelected = selectedRoute === route.routeKey;
              return (
                <button
                  key={route.routeKey}
                  onClick={() => onSelect(route.routeKey)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? "bg-emerald-50 border border-emerald-200" : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="w-5 h-5 rounded-lg bg-gray-100 flex items-center justify-center text-[9px] font-black text-[#6B7B7B] flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-bold text-[#2E4A4A]">{route.origin}</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={10} color="#9CA3AF" strokeWidth={2} />
                      <span className="text-xs font-bold text-[#2E4A4A]">{route.destination}</span>
                      <BookabilityBadge status={route.bookabilityStatus} />
                    </div>
                    <div className="text-[9px] text-[#9CA3AF] mt-0.5">
                      Score {Math.round(route.bookabilityScore)}
                      {route.avgGoWildSeats != null && ` · ${route.avgGoWildSeats.toFixed(1)} seats`}
                      {route.avgSavings != null && ` · $${Math.round(route.avgSavings)} savings`}
                    </div>
                    <RateBar rate={route.availabilityRate} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Risky Routes panel ─────────────────────────────────────────────────────────

const RISK_REASON: Record<string, string> = {
  stale:        "Stale data",
  no_gowild:    "No recent GoWild",
  high_demand:  "High demand, low GoWild",
  fading:       "Availability fading",
  low_score:    "Low bookability",
};

function getRiskReason(route: RouteMetric): string {
  if (route.freshnessStatus === "stale" || route.freshnessStatus === "unknown") return "stale";
  if (route.goWildCount === 0) return "no_gowild";
  if (route.searchCount > 20 && route.availabilityRate < 0.2) return "high_demand";
  if (route.volatilityScore > 40 && route.availabilityRate < 0.3) return "fading";
  return "low_score";
}

function RiskyRoutesPanel({
  routes,
  selectedRoute,
  onSelect,
  loading,
}: {
  routes: RouteMetric[];
  selectedRoute: string | null;
  onSelect: (key: string) => void;
  loading: boolean;
}) {
  const risky5 = useMemo(() => {
    // Rank by: low bookability + (stale OR high-demand-low-supply OR volatile)
    return [...routes]
      .filter((r) => r.bookabilityStatus === "cold" || r.bookabilityStatus === "weak" || r.isStale || (r.searchCount > 15 && r.availabilityRate < 0.2) || r.volatilityScore > 40)
      .sort((a, b) => {
        const scoreA = (a.isStale ? 50 : 0) + (100 - a.bookabilityScore) + a.volatilityScore;
        const scoreB = (b.isStale ? 50 : 0) + (100 - b.bookabilityScore) + b.volatilityScore;
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [routes]);

  const riskBadgeColor = (reason: string): "rose" | "amber" | "gray" =>
    reason === "stale" || reason === "no_gowild" ? "rose" : reason === "fading" ? "amber" : "gray";

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden" style={CARD_STYLE}>
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <HugeiconsIcon icon={ArrowDownLeft01Icon} size={15} color="#F43F5E" strokeWidth={2} />
        <span className="text-xs font-black text-[#2E4A4A] uppercase tracking-wide">Risky / Fading</span>
      </div>
      <div className="flex flex-col overflow-y-auto">
        {loading ? (
          <div className="p-3 flex flex-col gap-2">
            {[0,1,2,3,4].map((i) => <SkeletonCard key={i} height={52} />)}
          </div>
        ) : risky5.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">No risky routes in current filters</div>
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {risky5.map((route) => {
              const reason = getRiskReason(route);
              const isSelected = selectedRoute === route.routeKey;
              return (
                <button
                  key={route.routeKey}
                  onClick={() => onSelect(route.routeKey)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected ? "bg-rose-50 border border-rose-200" : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-bold text-[#2E4A4A]">{route.origin}</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={10} color="#9CA3AF" strokeWidth={2} />
                      <span className="text-xs font-bold text-[#2E4A4A]">{route.destination}</span>
                      <Badge color={riskBadgeColor(reason)}>{RISK_REASON[reason]}</Badge>
                    </div>
                    <div className="text-[9px] text-[#9CA3AF] mt-0.5">
                      Score {Math.round(route.bookabilityScore)}
                      {route.searchCount > 0 && ` · ${route.searchCount} searches`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Map legend ─────────────────────────────────────────────────────────────────

const LEGEND_ITEMS: Record<RadarMode, { color: string; label: string }[]> = {
  availability:  [{ color: "#059669", label: "≥50%" }, { color: "#F59E0B", label: "25–50%" }, { color: "#F43F5E", label: "<25%" }, { color: "#9CA3AF", label: "No data" }],
  seats:         [{ color: "#059669", label: "≥8 seats" }, { color: "#0891B2", label: "4–7" }, { color: "#F59E0B", label: "1–3" }, { color: "#F43F5E", label: "0" }],
  savings:       [{ color: "#059669", label: "≥$100" }, { color: "#0891B2", label: "$50–99" }, { color: "#F59E0B", label: "$10–49" }, { color: "#9CA3AF", label: "No fare data" }],
  freshness:     [{ color: "#059669", label: "Fresh" }, { color: "#0891B2", label: "Recent" }, { color: "#F59E0B", label: "Aging" }, { color: "#F43F5E", label: "Stale" }],
  searchDemand:  [{ color: "#059669", label: "≥50 searches" }, { color: "#0891B2", label: "20–49" }, { color: "#F59E0B", label: "5–19" }, { color: "#9CA3AF", label: "<5" }],
  volatility:    [{ color: "#059669", label: "Stable & strong" }, { color: "#F59E0B", label: "Some volatility" }, { color: "#F43F5E", label: "High volatility" }],
};

function MapLegend({ mode }: { mode: RadarMode }) {
  return (
    <div
      className="absolute bottom-4 left-4 z-[1000] rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap"
      style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}
    >
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">{MODE_LABELS[mode]}</div>
      {LEGEND_ITEMS[mode].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: color }} />
          <span className="text-[10px] font-semibold text-[#6B7B7B]">{label}</span>
        </div>
      ))}
      <div className="w-px h-3.5 bg-gray-200" />
      <div className="flex items-center gap-1">
        <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="4 4" /></svg>
        <span className="text-[10px] font-semibold text-[#9CA3AF]">Stale</span>
      </div>
      <span className="text-[9px] text-[#9CA3AF]">Node size = scan volume</span>
    </div>
  );
}

// ── Airport detail panel ───────────────────────────────────────────────────────

function AirportDetailPanel({
  airport,
  routes,
  mode,
  onClose,
  onSelectRoute,
}: {
  airport: AirportMetric;
  routes: RouteMetric[];
  mode: RadarMode;
  onClose: () => void;
  onSelectRoute: (key: string) => void;
}) {
  const outbound = routes.filter((r) => r.origin === airport.iata).sort((a, b) => b.bookabilityScore - a.bookabilityScore);
  const inbound  = routes.filter((r) => r.destination === airport.iata).sort((a, b) => b.bookabilityScore - a.bookabilityScore);
  const color = getAirportColor(airport, mode);

  return (
    <div className="absolute right-2 top-2 bottom-2 sm:right-4 sm:top-4 sm:bottom-4 w-[min(18rem,calc(100%-1rem))] flex flex-col rounded-2xl overflow-hidden z-[1000]" style={CARD_STYLE}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0" style={{ background: color }}>
            {airport.iata}
          </div>
          <div>
            <div className="text-sm font-bold text-[#2E4A4A] leading-tight">{airport.city}</div>
            <div className="text-[10px] text-[#9CA3AF] truncate max-w-[140px]">{airport.name}</div>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-gray-100 transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "GoWild Rate", value: airport.avgAvailabilityRate != null ? `${Math.round(airport.avgAvailabilityRate * 100)}%` : "—", accent: color },
            { label: "Avg Seats", value: airport.avgSeats != null ? airport.avgSeats.toFixed(1) : "—" },
            { label: "Routes", value: airport.routeCount.toString() },
            { label: "GW Routes", value: airport.goWildRouteCount.toString() },
            { label: "Searches", value: airport.searchVolume.toString() },
            { label: "Freshness", value: airport.freshnessStatus, cap: true },
          ].map(({ label, value, accent, cap }) => (
            <div key={label} className="rounded-xl p-2.5 bg-gray-50">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">{label}</div>
              <div className={`text-base font-black ${cap ? "capitalize" : ""}`} style={{ color: accent ?? "#2E4A4A" }}>{value}</div>
            </div>
          ))}
        </div>
        {outbound.length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">Outbound Routes</div>
            <div className="flex flex-col gap-1">
              {outbound.slice(0, 6).map((r) => (
                <button key={r.routeKey} onClick={() => onSelectRoute(r.routeKey)} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-colors text-left w-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-[#2E4A4A]">{r.origin}</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={10} color="#9CA3AF" strokeWidth={2} />
                      <span className="text-xs font-bold text-[#2E4A4A]">{r.destination}</span>
                    </div>
                    <RateBar rate={r.availabilityRate} />
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <Badge color={BOOKABILITY_COLOR[r.bookabilityStatus]}>{Math.round(r.availabilityRate * 100)}%</Badge>
                    <span className="text-[9px] text-[#9CA3AF]">{Math.round(r.bookabilityScore)}/100</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {inbound.length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">Inbound Routes</div>
            <div className="flex flex-col gap-1">
              {inbound.slice(0, 4).map((r) => (
                <button key={r.routeKey} onClick={() => onSelectRoute(r.routeKey)} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-colors text-left w-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-[#2E4A4A]">{r.origin}</span>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={10} color="#9CA3AF" strokeWidth={2} />
                      <span className="text-xs font-bold text-[#2E4A4A]">{r.destination}</span>
                    </div>
                    <RateBar rate={r.availabilityRate} />
                  </div>
                  <Badge color={BOOKABILITY_COLOR[r.bookabilityStatus]}>{Math.round(r.availabilityRate * 100)}%</Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GoWildRadarMap() {
  const [timeRange, setTimeRange]       = useState<RadarTimeRange>("24h");
  const [mode, setMode]                 = useState<RadarMode>("availability");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [destFilter, setDestFilter]     = useState<string>("all");
  const [routeType, setRouteType]       = useState<RouteTypeFilter>("all");
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute]     = useState<string | null>(null);

  const { data, loading, error, refetch, lastUpdated } = useGoWildRadarData(timeRange);

  // ── Filtered routes ──────────────────────────────────────────────────────────

  const filteredRoutes = useMemo<RouteMetric[]>(() => {
    if (!data) return [];
    return data.routes.filter((r) => {
      if (originFilter !== "all" && r.origin !== originFilter) return false;
      if (destFilter   !== "all" && r.destination !== destFilter) return false;
      switch (routeType) {
        case "gowild":    if (r.goWildCount === 0) return false; break;
        case "no-gowild": if (r.goWildCount > 0) return false; break;
        case "fresh":     if (r.freshnessStatus !== "fresh" && r.freshnessStatus !== "recent") return false; break;
        case "stale":     if (!r.isStale) return false; break;
      }
      return true;
    });
  }, [data, originFilter, destFilter, routeType]);

  // Limit arcs rendered to top 120 by bookability (always include selected)
  const visibleArcs = useMemo<RouteMetric[]>(() => {
    const sorted = [...filteredRoutes].sort((a, b) => b.bookabilityScore - a.bookabilityScore);
    const top = sorted.slice(0, 120);
    if (selectedRoute && !top.find((r) => r.routeKey === selectedRoute)) {
      const sel = filteredRoutes.find((r) => r.routeKey === selectedRoute);
      if (sel) top.push(sel);
    }
    return top;
  }, [filteredRoutes, selectedRoute]);

  const filteredAirports = useMemo<AirportMetric[]>(() => {
    if (!data) return [];
    const routeAirports = new Set(filteredRoutes.flatMap((r) => [r.origin, r.destination]));
    return data.airports.filter((a) => routeAirports.has(a.iata));
  }, [data, filteredRoutes]);

  const maxSnapCount = useMemo(
    () => Math.max(...filteredAirports.map((a) => a.routeCount + a.searchVolume / 2), 1),
    [filteredAirports]
  );

  const airportMap = useMemo<Map<string, AirportMetric>>(() => {
    const m = new Map<string, AirportMetric>();
    if (data) for (const a of data.airports) m.set(a.iata, a);
    return m;
  }, [data]);

  const selectedAirportData = selectedAirport ? airportMap.get(selectedAirport) ?? null : null;

  function nodeRadius(a: AirportMetric): number {
    const norm = Math.log((a.routeCount + a.searchVolume / 2) + 1) / Math.log(maxSnapCount + 1);
    return 5 + norm * 14;
  }

  const handleRouteSelect = useCallback((key: string) => {
    setSelectedRoute((k) => k === key ? null : key);
    setSelectedAirport(null);
  }, []);

  // ── Origin / destination options ─────────────────────────────────────────────

  const originOptions = useMemo(() => [
    { value: "all", label: "All Origins" },
    ...(data?.availableOrigins ?? []).map((o) => ({ value: o, label: o })),
  ], [data]);

  const destOptions = useMemo(() => [
    { value: "all", label: "All Destinations" },
    ...(data?.availableDestinations ?? []).map((d) => ({ value: d, label: d })),
  ], [data]);

  const routeTypeOptions: { value: RouteTypeFilter; label: string }[] = [
    { value: "all",       label: "All Routes" },
    { value: "gowild",    label: "GoWild Available" },
    { value: "no-gowild", label: "No GoWild" },
    { value: "fresh",     label: "Fresh Only" },
    { value: "stale",     label: "Stale Only" },
  ];

  const lastUpdatedLabel = lastUpdated
    ? (() => {
        const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
        return mins < 1 ? "just now" : `${mins}m ago`;
      })()
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Mode tabs ───────────────────────────────────────────────────────── */}
      <RadarModeTabs mode={mode} onChange={setMode} />

      {/* ── Filter row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap" style={{ ...CARD_STYLE, borderRadius: 16, padding: "10px 16px" }}>
        <HugeiconsIcon icon={FilterMailSquareIcon} size={14} color="#9CA3AF" strokeWidth={2} />
        <FilterSelect value={timeRange} onChange={(v) => setTimeRange(v as RadarTimeRange)} options={Object.entries(RADAR_TIME_LABELS).map(([k, l]) => ({ value: k, label: l }))} placeholder="Time range" />
        <FilterSelect value={originFilter} onChange={setOriginFilter} options={originOptions} placeholder="All Origins" />
        <FilterSelect value={destFilter}   onChange={setDestFilter}   options={destOptions}   placeholder="All Destinations" />
        <FilterSelect value={routeType}    onChange={(v) => setRouteType(v as RouteTypeFilter)} options={routeTypeOptions} placeholder="All Routes" />
        <div className="ml-auto flex items-center gap-3">
          {lastUpdatedLabel && (
            <span className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
              <HugeiconsIcon icon={Clock01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
              Updated {lastUpdatedLabel}
            </span>
          )}
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <HugeiconsIcon icon={RefreshIcon} size={12} color="white" strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Map + right panels ───────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-3 lg:h-[calc(100vh-380px)] lg:min-h-[400px]">
        {/* Map */}
        <div className="flex-1 relative rounded-2xl overflow-hidden min-h-[480px] lg:h-auto" style={CARD_STYLE}>
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-[1100] bg-white/60 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center gap-3">
                <HugeiconsIcon icon={Loading03Icon} size={28} color="#059669" strokeWidth={2} className="animate-spin" />
                <div className="text-sm font-semibold text-[#2E4A4A]">Loading radar data…</div>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-[1100] bg-white/80 rounded-2xl">
              <div className="flex flex-col items-center gap-3 text-center p-8">
                <HugeiconsIcon icon={AlertCircleIcon} size={28} color="#F43F5E" strokeWidth={2} />
                <div className="text-sm font-semibold text-[#2E4A4A]">Unable to load GoWild radar data</div>
                <div className="text-xs text-[#9CA3AF]">{error}</div>
                <button onClick={refetch} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredRoutes.length === 0 && data != null && (
            <div className="absolute inset-0 flex items-center justify-center z-[1050] pointer-events-none">
              <div className="flex flex-col items-center gap-3 text-center p-8 rounded-2xl pointer-events-auto" style={{ background: "rgba(255,255,255,0.92)" }}>
                <HugeiconsIcon icon={Globe02Icon} size={28} color="#9CA3AF" strokeWidth={1.5} />
                <div className="text-sm font-semibold text-[#2E4A4A]">No radar data found for this filter set</div>
                <div className="text-xs text-[#9CA3AF]">Try expanding the time range or clearing filters.</div>
                <button
                  onClick={() => { setOriginFilter("all"); setDestFilter("all"); setRouteType("all"); setTimeRange("7d"); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}

          <MapContainer center={[39.5, -98.35]} zoom={4} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
            {!loading && data && <MapFitter airports={filteredAirports} />}

            {/* Route arcs */}
            {visibleArcs.map((route) => {
              const orgInfo = airportMap.get(route.origin);
              const dstInfo = airportMap.get(route.destination);
              if (!orgInfo || !dstInfo) return null;
              const pts = arcPoints(orgInfo.lat, orgInfo.lng, dstInfo.lat, dstInfo.lng);
              const isHighlighted =
                selectedRoute === route.routeKey ||
                (selectedAirport != null && (route.origin === selectedAirport || route.destination === selectedAirport));
              const color = getRouteColor(route, mode);
              const weight = isHighlighted ? 3.5 : 1.5 + Math.min(route.snapshotCount / 20, 1) * 1.5;
              const opacity = route.isStale ? 0.25 : isHighlighted ? 1 : 0.5;

              return (
                <Polyline
                  key={route.routeKey}
                  positions={pts}
                  pathOptions={{ color, weight, opacity, dashArray: route.isStale ? "5 6" : undefined }}
                  eventHandlers={{ click: () => { setSelectedRoute((k) => k === route.routeKey ? null : route.routeKey); setSelectedAirport(null); } }}
                >
                  <Tooltip sticky>
                    <div style={{ fontFamily: "Quicksand, sans-serif", minWidth: 150 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 3 }}>{route.origin} → {route.destination}</div>
                      <div style={{ fontSize: 11, color: "#6B7B7B" }}>GoWild rate: {Math.round(route.availabilityRate * 100)}%</div>
                      {route.avgGoWildSeats != null && <div style={{ fontSize: 11, color: "#6B7B7B" }}>Avg seats: {route.avgGoWildSeats.toFixed(1)}</div>}
                      {route.avgSavings != null && <div style={{ fontSize: 11, color: "#6B7B7B" }}>Avg savings: ${Math.round(route.avgSavings)}</div>}
                      {route.avgGoWildFare != null && <div style={{ fontSize: 11, color: "#6B7B7B" }}>GoWild fare: ${Math.round(route.avgGoWildFare)}</div>}
                      <div style={{ fontSize: 11, color: "#6B7B7B" }}>Bookability: {Math.round(route.bookabilityScore)}/100</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: route.bookabilityStatus === "book_now" ? "#059669" : route.bookabilityStatus === "weak" ? "#F43F5E" : "#6B7B7B" }}>
                        {BOOKABILITY_LABEL[route.bookabilityStatus]}
                      </div>
                      {route.isStale && <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>⚠ Stale data</div>}
                    </div>
                  </Tooltip>
                </Polyline>
              );
            })}

            {/* Airport nodes */}
            {filteredAirports.map((airport) => {
              const isSelected = selectedAirport === airport.iata;
              const radius = nodeRadius(airport);
              const color = getAirportColor(airport, mode);
              return (
                <CircleMarker
                  key={airport.iata}
                  center={[airport.lat, airport.lng]}
                  radius={isSelected ? radius + 3 : radius}
                  pathOptions={{ color: isSelected ? "#1A2E2E" : "rgba(255,255,255,0.6)", fillColor: color, fillOpacity: 0.9, weight: isSelected ? 2.5 : 1 }}
                  eventHandlers={{ click: () => { setSelectedAirport((v) => v === airport.iata ? null : airport.iata); setSelectedRoute(null); } }}
                >
                  <Tooltip permanent={isSelected} direction="top" offset={[0, -(radius + 2)]}>
                    <div style={{ fontFamily: "Quicksand, sans-serif" }}>
                      <div style={{ fontWeight: 800, fontSize: 12 }}>{airport.iata}</div>
                      {isSelected && (
                        <>
                          <div style={{ fontSize: 11, color: "#6B7B7B" }}>{airport.city}</div>
                          {airport.avgAvailabilityRate != null && (
                            <div style={{ fontSize: 11, fontWeight: 700, color }}>
                              {Math.round(airport.avgAvailabilityRate * 100)}% GoWild
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "#6B7B7B" }}>{airport.routeCount} routes · {airport.searchVolume} searches</div>
                        </>
                      )}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Top-left data badge */}
          {data && !loading && (
            <div className="absolute top-4 left-4 rounded-xl px-3 py-1.5 z-[1000] flex items-center gap-2" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
              <HugeiconsIcon icon={Analytics01Icon} size={13} color="#059669" strokeWidth={2} />
              <span className="text-[11px] font-bold text-[#2E4A4A]">{data.totalSnapshots.toLocaleString()} snapshots</span>
              <span className="text-[10px] text-[#9CA3AF]">· {filteredRoutes.length} routes · {RADAR_TIME_LABELS[timeRange]}</span>
            </div>
          )}

          <MapLegend mode={mode} />

          {/* Airport detail panel */}
          {selectedAirportData && (
            <AirportDetailPanel
              airport={selectedAirportData}
              routes={filteredRoutes}
              mode={mode}
              onClose={() => setSelectedAirport(null)}
              onSelectRoute={handleRouteSelect}
            />
          )}
        </div>

        {/* ── Right panels ──────────────────────────────────────────────────── */}
        <div className="w-full lg:w-72 flex flex-col gap-3 lg:overflow-y-auto flex-shrink-0">
          <BestMovesPanel routes={filteredRoutes} selectedRoute={selectedRoute} onSelect={handleRouteSelect} loading={loading} />
          <RiskyRoutesPanel routes={filteredRoutes} selectedRoute={selectedRoute} onSelect={handleRouteSelect} loading={loading} />
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────────── */}
      <KpiStrip routes={filteredRoutes} loading={loading} />
    </div>
  );
}
