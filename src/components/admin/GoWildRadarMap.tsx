import { useState, useEffect, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RefreshIcon,
  AirplaneTakeOff01Icon,
  TrendUpIcon,
  TrendDownIcon,
  Cancel01Icon,
  FilterMailSquareIcon,
  AlertCircleIcon,
  Clock01Icon,
  Analytics01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  ArrowRight01Icon,
  Globe02Icon,
} from "@hugeicons/core-free-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";
import type { FlightSnapshot } from "@/components/insights/airportHelpers";
import { isGoWild } from "@/components/insights/airportHelpers";
import {
  type TimeRange,
  TIME_RANGE_LABELS,
  getTimeRangeStart,
} from "@/hooks/useAdminDashboardMetrics";
import { getFreshnessStatus } from "@/components/admin/FlightSearchDetailDrawer";

// ── Style constants ────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// ── Colour helpers ─────────────────────────────────────────────────────────────

function gwColor(rate: number): string {
  if (rate >= 0.5) return "#059669";
  if (rate >= 0.25) return "#F59E0B";
  return "#F43F5E";
}

function gwBadgeColor(rate: number): "emerald" | "amber" | "rose" {
  if (rate >= 0.5) return "emerald";
  if (rate >= 0.25) return "amber";
  return "rose";
}

// ── Arc geometry ───────────────────────────────────────────────────────────────

function arcPoints(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  steps = 24
): [number, number][] {
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  const dist = Math.sqrt(dlat * dlat + dlng * dlng);
  if (dist < 0.001) return [[lat1, lng1], [lat2, lng2]];
  const lift = dist * 0.18;
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const cpLat = midLat - (dlng / dist) * lift;
  const cpLng = midLng + (dlat / dist) * lift;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const mt = 1 - t;
    return [
      mt * mt * lat1 + 2 * mt * t * cpLat + t * t * lat2,
      mt * mt * lng1 + 2 * mt * t * cpLng + t * t * lng2,
    ] as [number, number];
  });
}

// ── Data types ─────────────────────────────────────────────────────────────────

interface AirportNode {
  iata: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  snapshotCount: number;
  goWildCount: number;
  goWildRate: number;
  avgSeats: number | null;
  avgSavings: number | null;
  routeKeys: string[];
  latestSnapshot: string | null;
}

interface RouteArc {
  key: string;
  origin: string;
  destination: string;
  snapshotCount: number;
  goWildCount: number;
  goWildRate: number;
  avgSeats: number | null;
  bookabilityScore: number;
  latestSnapshot: string | null;
  isStale: boolean;
}

interface RadarData {
  nodes: Map<string, AirportNode>;
  arcs: Map<string, RouteArc>;
  totalSnapshots: number;
}

// ── Data computation ───────────────────────────────────────────────────────────

function computeRadarData(
  snapshots: FlightSnapshot[],
  dict: ReturnType<typeof useAirportDictionary>["dict"]
): RadarData {
  const nodeAcc = new Map<
    string,
    {
      snapshotCount: number;
      goWildCount: number;
      seatSum: number;
      seatN: number;
      savingsSum: number;
      savingsN: number;
      routeKeys: Set<string>;
      latestSnapshot: string | null;
    }
  >();

  const arcAcc = new Map<
    string,
    {
      origin: string;
      destination: string;
      snapshotCount: number;
      goWildCount: number;
      seatSum: number;
      seatN: number;
      latestSnapshot: string | null;
    }
  >();

  for (const snap of snapshots) {
    const org = snap.leg_origin_iata ?? snap.origin_iata;
    const dst = snap.leg_destination_iata;
    if (!org || !dst) continue;
    const orgInfo = dict[org];
    const dstInfo = dict[dst];
    if (!orgInfo?.latitude || !orgInfo?.longitude) continue;
    if (!dstInfo?.latitude || !dstInfo?.longitude) continue;

    const gw = isGoWild(snap.has_go_wild);
    const seats = snap.go_wild_available_seats ?? null;
    const savings =
      snap.standard_total != null &&
      snap.go_wild_total != null &&
      snap.standard_total > snap.go_wild_total
        ? snap.standard_total - snap.go_wild_total
        : null;

    for (const code of [org, dst]) {
      let n = nodeAcc.get(code);
      if (!n) {
        n = {
          snapshotCount: 0,
          goWildCount: 0,
          seatSum: 0,
          seatN: 0,
          savingsSum: 0,
          savingsN: 0,
          routeKeys: new Set(),
          latestSnapshot: null,
        };
        nodeAcc.set(code, n);
      }
      n.snapshotCount++;
      if (gw) {
        n.goWildCount++;
        if (seats != null) {
          n.seatSum += seats;
          n.seatN++;
        }
      }
      if (savings != null) {
        n.savingsSum += savings;
        n.savingsN++;
      }
      n.routeKeys.add(`${org}-${dst}`);
      if (!n.latestSnapshot || snap.snapshot_at > n.latestSnapshot) {
        n.latestSnapshot = snap.snapshot_at;
      }
    }

    const routeKey = `${org}-${dst}`;
    let a = arcAcc.get(routeKey);
    if (!a) {
      a = {
        origin: org,
        destination: dst,
        snapshotCount: 0,
        goWildCount: 0,
        seatSum: 0,
        seatN: 0,
        latestSnapshot: null,
      };
      arcAcc.set(routeKey, a);
    }
    a.snapshotCount++;
    if (gw) {
      a.goWildCount++;
      if (seats != null) {
        a.seatSum += seats;
        a.seatN++;
      }
    }
    if (!a.latestSnapshot || snap.snapshot_at > a.latestSnapshot) {
      a.latestSnapshot = snap.snapshot_at;
    }
  }

  const nodes = new Map<string, AirportNode>();
  for (const [code, n] of nodeAcc) {
    const info = dict[code];
    if (!info?.latitude || !info?.longitude) continue;
    nodes.set(code, {
      iata: code,
      name: info.name,
      city: info.city ?? code,
      lat: info.latitude,
      lng: info.longitude,
      snapshotCount: n.snapshotCount,
      goWildCount: n.goWildCount,
      goWildRate: n.snapshotCount > 0 ? n.goWildCount / n.snapshotCount : 0,
      avgSeats: n.seatN > 0 ? n.seatSum / n.seatN : null,
      avgSavings: n.savingsN > 0 ? n.savingsSum / n.savingsN : null,
      routeKeys: Array.from(n.routeKeys),
      latestSnapshot: n.latestSnapshot,
    });
  }

  const arcs = new Map<string, RouteArc>();
  for (const [key, a] of arcAcc) {
    const gwRate = a.snapshotCount > 0 ? a.goWildCount / a.snapshotCount : 0;
    const avgSeats = a.seatN > 0 ? a.seatSum / a.seatN : null;
    const freshness = a.latestSnapshot
      ? getFreshnessStatus(a.latestSnapshot)
      : "unknown";
    const isStale = freshness === "stale" || freshness === "unknown";

    const availScore = gwRate * 40;
    const seatsScore = avgSeats != null ? Math.min(avgSeats / 5, 1) * 20 : 0;
    const freshScore =
      freshness === "fresh"
        ? 10
        : freshness === "recent"
        ? 8
        : freshness === "aging"
        ? 4
        : 0;
    const sampleScore = Math.min(a.snapshotCount / 20, 1) * 5;
    const bookabilityScore = availScore + seatsScore + freshScore + sampleScore;

    arcs.set(key, {
      key,
      origin: a.origin,
      destination: a.destination,
      snapshotCount: a.snapshotCount,
      goWildCount: a.goWildCount,
      goWildRate: gwRate,
      avgSeats,
      bookabilityScore,
      latestSnapshot: a.latestSnapshot,
      isStale,
    });
  }

  return { nodes, arcs, totalSnapshots: snapshots.length };
}

// ── Data hook ──────────────────────────────────────────────────────────────────

function useGoWildRadarData(timeRange: TimeRange) {
  const [snapshots, setSnapshots] = useState<FlightSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);
  const { dict, loading: dictLoading } = useAirportDictionary();

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: err } = await supabase.rpc(
          "get_global_gowild_insight_snapshots",
          { p_limit: 2000 }
        );
        if (cancelled) return;
        if (err) {
          setError(err.message);
          return;
        }
        setSnapshots((data ?? []) as FlightSnapshot[]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trigger]);

  const since = getTimeRangeStart(timeRange);

  const filteredByTime = useMemo(() => {
    if (!since) return snapshots;
    return snapshots.filter((s) => s.snapshot_at >= since);
  }, [snapshots, since]);

  const data = useMemo<RadarData | null>(() => {
    if (dictLoading || filteredByTime.length === 0) return null;
    return computeRadarData(filteredByTime, dict);
  }, [filteredByTime, dict, dictLoading]);

  return { data, loading: loading || dictLoading, error, refetch };
}

// ── Map auto-fitter ────────────────────────────────────────────────────────────

function MapFitter({ nodes }: { nodes: AirportNode[] }) {
  const map = useMap();
  const count = nodes.length;

  useEffect(() => {
    if (count === 0) return;
    if (count === 1) {
      map.setView([nodes[0].lat, nodes[0].lng], 8, { animate: true });
      return;
    }
    const lats = nodes.map((n) => n.lat);
    const lngs = nodes.map((n) => n.lng);
    map.fitBounds(
      [
        [Math.min(...lats) - 2, Math.min(...lngs) - 3],
        [Math.max(...lats) + 2, Math.max(...lngs) + 3],
      ],
      { animate: true, duration: 0.7 }
    );
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
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
    cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls[color]}`}
    >
      {children}
    </span>
  );
}

function RateBar({ rate }: { rate: number }) {
  const color =
    rate >= 0.5
      ? "bg-emerald-500"
      : rate >= 0.25
      ? "bg-amber-400"
      : "bg-rose-400";
  return (
    <div className="h-1 rounded-full bg-gray-100 overflow-hidden mt-1">
      <div
        className={`h-1 rounded-full ${color}`}
        style={{ width: `${Math.round(rate * 100)}%` }}
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  color = "emerald",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "emerald" | "amber" | "rose" | "cyan";
}) {
  const accent = {
    emerald: "#059669",
    amber: "#D97706",
    rose: "#E11D48",
    cyan: "#0891B2",
  }[color];
  return (
    <div
      className="flex flex-col gap-0.5 py-2 px-3 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.65)",
        border: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">
        {label}
      </div>
      <div
        className="text-lg font-black leading-tight"
        style={{ color: accent }}
      >
        {value}
      </div>
      {sub && <div className="text-[9px] text-[#9CA3AF]">{sub}</div>}
    </div>
  );
}

function AirportListItem({
  node,
  selected,
  onClick,
}: {
  node: AirportNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
        selected
          ? "bg-emerald-50 border border-emerald-200"
          : "hover:bg-gray-50 border border-transparent"
      }`}
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] text-white"
        style={{ background: gwColor(node.goWildRate) }}
      >
        {node.iata}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-[#2E4A4A] truncate">
            {node.city}
          </span>
          <Badge color={gwBadgeColor(node.goWildRate)}>
            {Math.round(node.goWildRate * 100)}%
          </Badge>
        </div>
        <RateBar rate={node.goWildRate} />
        <div className="text-[9px] text-[#9CA3AF] mt-0.5">
          {node.routeKeys.length} route{node.routeKeys.length !== 1 ? "s" : ""}{" "}
          · {node.snapshotCount} scans
        </div>
      </div>
    </button>
  );
}

// ── Airport detail panel ───────────────────────────────────────────────────────

function AirportDetailPanel({
  node,
  arcs,
  onClose,
  onSelectRoute,
}: {
  node: AirportNode;
  arcs: RouteArc[];
  onClose: () => void;
  onSelectRoute: (key: string) => void;
}) {
  const outbound = [...arcs.filter((a) => a.origin === node.iata)].sort(
    (a, b) => b.bookabilityScore - a.bookabilityScore
  );
  const inbound = [...arcs.filter((a) => a.destination === node.iata)].sort(
    (a, b) => b.bookabilityScore - a.bookabilityScore
  );
  const freshness = node.latestSnapshot
    ? getFreshnessStatus(node.latestSnapshot)
    : "unknown";

  return (
    <div
      className="absolute right-4 top-4 bottom-4 w-72 flex flex-col rounded-2xl overflow-hidden z-[1000]"
      style={CARD_STYLE}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0"
            style={{ background: gwColor(node.goWildRate) }}
          >
            {node.iata}
          </div>
          <div>
            <div className="text-sm font-bold text-[#2E4A4A] leading-tight">
              {node.city}
            </div>
            <div className="text-[10px] text-[#9CA3AF] truncate max-w-[140px]">
              {node.name}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={14}
            color="currentColor"
            strokeWidth={2.5}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-2.5 bg-gray-50">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              GoWild Rate
            </div>
            <div
              className="text-xl font-black"
              style={{ color: gwColor(node.goWildRate) }}
            >
              {Math.round(node.goWildRate * 100)}%
            </div>
            <RateBar rate={node.goWildRate} />
          </div>
          <div className="rounded-xl p-2.5 bg-gray-50">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Avg Seats
            </div>
            <div className="text-xl font-black text-[#2E4A4A]">
              {node.avgSeats != null ? node.avgSeats.toFixed(1) : "—"}
            </div>
          </div>
          <div className="rounded-xl p-2.5 bg-gray-50">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Total Scans
            </div>
            <div className="text-xl font-black text-[#2E4A4A]">
              {node.snapshotCount}
            </div>
          </div>
          <div className="rounded-xl p-2.5 bg-gray-50">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Freshness
            </div>
            <div
              className={`text-sm font-black capitalize ${
                freshness === "fresh"
                  ? "text-emerald-600"
                  : freshness === "recent"
                  ? "text-cyan-600"
                  : freshness === "aging"
                  ? "text-amber-600"
                  : "text-rose-500"
              }`}
            >
              {freshness}
            </div>
          </div>
        </div>

        {/* Outbound */}
        {outbound.length > 0 && (
          <RouteList
            title="Outbound"
            routes={outbound.slice(0, 8)}
            onSelect={onSelectRoute}
          />
        )}

        {/* Inbound */}
        {inbound.length > 0 && (
          <RouteList
            title="Inbound"
            routes={inbound.slice(0, 5)}
            onSelect={onSelectRoute}
          />
        )}
      </div>
    </div>
  );
}

function RouteList({
  title,
  routes,
  onSelect,
}: {
  title: string;
  routes: RouteArc[];
  onSelect: (key: string) => void;
}) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
        {title} Routes
      </div>
      <div className="flex flex-col gap-1">
        {routes.map((arc) => (
          <button
            key={arc.key}
            onClick={() => onSelect(arc.key)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-colors text-left w-full"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-[#2E4A4A]">
                  {arc.origin}
                </span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={10}
                  color="#9CA3AF"
                  strokeWidth={2}
                />
                <span className="text-xs font-bold text-[#2E4A4A]">
                  {arc.destination}
                </span>
                {arc.isStale && (
                  <span className="text-[9px] text-amber-500 font-semibold">
                    · stale
                  </span>
                )}
              </div>
              <RateBar rate={arc.goWildRate} />
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <Badge color={gwBadgeColor(arc.goWildRate)}>
                {Math.round(arc.goWildRate * 100)}%
              </Badge>
              <span className="text-[9px] text-[#9CA3AF]">
                {Math.round(arc.bookabilityScore)}/100
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Time range selector ────────────────────────────────────────────────────────

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-[#2E4A4A] hover:bg-gray-50 transition-colors w-full"
      >
        <span>{TIME_RANGE_LABELS[value]}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-gray-400 text-[9px] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
          style={{ background: "rgba(255,255,255,0.98)" }}
        >
          {(
            Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-xs font-semibold text-left transition-colors ${
                value === k
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-[#2E4A4A] hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GoWildRadarMap() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [minGoWildRate, setMinGoWildRate] = useState(0);
  const [showStale, setShowStale] = useState(true);
  const [showOnlyGoWild, setShowOnlyGoWild] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const { data, loading, error, refetch } = useGoWildRadarData(timeRange);

  const sortedNodes = useMemo<AirportNode[]>(() => {
    if (!data) return [];
    return Array.from(data.nodes.values()).sort(
      (a, b) => b.snapshotCount - a.snapshotCount
    );
  }, [data]);

  const filteredNodes = useMemo<AirportNode[]>(() => {
    return sortedNodes.filter((n) => {
      if (n.goWildRate < minGoWildRate / 100) return false;
      if (showOnlyGoWild && n.goWildCount === 0) return false;
      return true;
    });
  }, [sortedNodes, minGoWildRate, showOnlyGoWild]);

  const filteredNodeSet = useMemo(
    () => new Set(filteredNodes.map((n) => n.iata)),
    [filteredNodes]
  );

  const filteredArcs = useMemo<RouteArc[]>(() => {
    if (!data) return [];
    return Array.from(data.arcs.values()).filter((a) => {
      if (!filteredNodeSet.has(a.origin) || !filteredNodeSet.has(a.destination))
        return false;
      if (a.goWildRate < minGoWildRate / 100) return false;
      if (!showStale && a.isStale) return false;
      if (showOnlyGoWild && a.goWildCount === 0) return false;
      return true;
    });
  }, [data, filteredNodeSet, minGoWildRate, showStale, showOnlyGoWild]);

  const gwRouteCount = useMemo(
    () => filteredArcs.filter((a) => a.goWildCount > 0).length,
    [filteredArcs]
  );

  const avgRate = useMemo(() => {
    if (filteredNodes.length === 0) return 0;
    return (
      filteredNodes.reduce((s, n) => s + n.goWildRate, 0) / filteredNodes.length
    );
  }, [filteredNodes]);

  const hotRoute = useMemo<RouteArc | null>(() => {
    if (filteredArcs.length === 0) return null;
    return filteredArcs.reduce((best, a) =>
      a.bookabilityScore > best.bookabilityScore ? a : best
    );
  }, [filteredArcs]);

  const staleCount = useMemo(
    () => filteredArcs.filter((a) => a.isStale).length,
    [filteredArcs]
  );

  const maxSnaps = useMemo(
    () => Math.max(...filteredNodes.map((n) => n.snapshotCount), 1),
    [filteredNodes]
  );

  const selectedNode = selectedAirport
    ? (data?.nodes.get(selectedAirport) ?? null)
    : null;

  const selectedNodeArcs = useMemo<RouteArc[]>(() => {
    if (!selectedAirport || !data) return [];
    return Array.from(data.arcs.values()).filter(
      (a) => a.origin === selectedAirport || a.destination === selectedAirport
    );
  }, [selectedAirport, data]);

  function nodeRadius(n: AirportNode): number {
    const norm =
      Math.log(n.snapshotCount + 1) / Math.log(maxSnaps + 1);
    return 5 + norm * 16;
  }

  const handleRouteSelect = useCallback((key: string) => {
    setSelectedRoute((k) => (k === key ? null : key));
  }, []);

  return (
    <div
      className="flex gap-4"
      style={{ height: "calc(100vh - 196px)" }}
    >
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 w-64 flex flex-col gap-3 overflow-y-auto rounded-2xl"
        style={{ ...CARD_STYLE, padding: 16 }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Globe02Icon}
              size={16}
              color="#10B981"
              strokeWidth={2}
            />
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-[#10B981]">
                Radar
              </div>
              <div className="text-[9px] text-[#9CA3AF]">
                GoWild Opportunity
              </div>
            </div>
          </div>
          <button
            onClick={refetch}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9CA3AF] hover:bg-gray-100 hover:text-[#2E4A4A] transition-colors"
            title="Refresh"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={14}
              color="currentColor"
              strokeWidth={2.5}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>

        {/* Time range */}
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2">
          <KpiTile
            label="Airports"
            value={filteredNodes.length.toString()}
            sub="with data"
          />
          <KpiTile
            label="GW Routes"
            value={gwRouteCount.toString()}
            sub="active"
            color="cyan"
          />
          <KpiTile
            label="Avg Rate"
            value={`${Math.round(avgRate * 100)}%`}
            color={
              avgRate >= 0.5 ? "emerald" : avgRate >= 0.25 ? "amber" : "rose"
            }
          />
          <KpiTile
            label="Stale"
            value={staleCount.toString()}
            sub="routes"
            color={staleCount > 5 ? "rose" : "amber"}
          />
        </div>

        {/* Hottest route callout */}
        {hotRoute && (
          <div
            className="rounded-xl p-3 border border-emerald-100"
            style={{ background: "rgba(5,150,105,0.04)" }}
          >
            <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mb-1.5">
              Hottest Route
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-black text-[#2E4A4A]">
                {hotRoute.origin}
              </span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={11}
                color="#9CA3AF"
                strokeWidth={2}
              />
              <span className="text-sm font-black text-[#2E4A4A]">
                {hotRoute.destination}
              </span>
              <Badge color="emerald">
                {Math.round(hotRoute.goWildRate * 100)}%
              </Badge>
            </div>
            <div className="text-[9px] text-[#9CA3AF] mt-1">
              Score: {Math.round(hotRoute.bookabilityScore)}/100
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1.5">
            <HugeiconsIcon
              icon={FilterMailSquareIcon}
              size={11}
              color="currentColor"
              strokeWidth={2}
            />
            Filters
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-[#6B7B7B]">
                Min GoWild Rate
              </span>
              <span className="text-[11px] font-bold text-emerald-600">
                {minGoWildRate}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={minGoWildRate}
              onChange={(e) => setMinGoWildRate(Number(e.target.value))}
              className="w-full h-1 accent-emerald-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showStale}
              onChange={(e) => setShowStale(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span className="text-[11px] font-semibold text-[#6B7B7B]">
              Show stale routes
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyGoWild}
              onChange={(e) => setShowOnlyGoWild(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span className="text-[11px] font-semibold text-[#6B7B7B]">
              GoWild only
            </span>
          </label>
        </div>

        {/* Airport list */}
        <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
            Airports ({filteredNodes.length})
          </div>

          {loading && (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && filteredNodes.length === 0 && (
            <div className="text-[11px] text-[#9CA3AF] text-center py-4">
              No airports match filters
            </div>
          )}

          {filteredNodes.map((node) => (
            <AirportListItem
              key={node.iata}
              node={node}
              selected={selectedAirport === node.iata}
              onClick={() =>
                setSelectedAirport((v) => (v === node.iata ? null : node.iata))
              }
            />
          ))}
        </div>
      </div>

      {/* ── Map area ──────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 relative rounded-2xl overflow-hidden"
        style={CARD_STYLE}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-[1100] bg-white/60 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <HugeiconsIcon
                icon={Loading03Icon}
                size={28}
                color="#059669"
                strokeWidth={2}
                className="animate-spin"
              />
              <div className="text-sm font-semibold text-[#2E4A4A]">
                Loading radar data…
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-[1100] bg-white/80 rounded-2xl">
            <div className="flex flex-col items-center gap-3 text-center p-8">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={28}
                color="#F43F5E"
                strokeWidth={2}
              />
              <div className="text-sm font-semibold text-[#2E4A4A]">
                Failed to load data
              </div>
              <div className="text-xs text-[#9CA3AF]">{error}</div>
              <button
                onClick={refetch}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Leaflet map */}
        <MapContainer
          center={[39.5, -98.35]}
          zoom={4}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTR} />

          {!loading && data && <MapFitter nodes={filteredNodes} />}

          {/* Route arcs */}
          {filteredArcs.map((arc) => {
            const orgNode = data?.nodes.get(arc.origin);
            const dstNode = data?.nodes.get(arc.destination);
            if (!orgNode || !dstNode) return null;
            const pts = arcPoints(
              orgNode.lat,
              orgNode.lng,
              dstNode.lat,
              dstNode.lng
            );
            const isHighlighted =
              selectedRoute === arc.key ||
              (selectedAirport != null &&
                (arc.origin === selectedAirport ||
                  arc.destination === selectedAirport));
            const color = gwColor(arc.goWildRate);
            const weight = isHighlighted
              ? 3.5
              : 1.5 + Math.min(arc.snapshotCount / 20, 1) * 1.5;
            const opacity = arc.isStale
              ? 0.28
              : isHighlighted
              ? 1
              : 0.5;

            return (
              <Polyline
                key={arc.key}
                positions={pts}
                pathOptions={{
                  color,
                  weight,
                  opacity,
                  dashArray: arc.isStale ? "5 6" : undefined,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedRoute((k) => (k === arc.key ? null : arc.key));
                    setSelectedAirport(null);
                  },
                }}
              >
                <Tooltip sticky>
                  <div style={{ fontFamily: "Quicksand, sans-serif", minWidth: 140 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 2 }}>
                      {arc.origin} → {arc.destination}
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                      GoWild rate: {Math.round(arc.goWildRate * 100)}%
                    </div>
                    {arc.avgSeats != null && (
                      <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                        Avg seats: {arc.avgSeats.toFixed(1)}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                      Score: {Math.round(arc.bookabilityScore)}/100
                    </div>
                    {arc.isStale && (
                      <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>
                        ⚠ Stale data
                      </div>
                    )}
                  </div>
                </Tooltip>
              </Polyline>
            );
          })}

          {/* Airport nodes */}
          {filteredNodes.map((node) => {
            const isSelected = selectedAirport === node.iata;
            const radius = nodeRadius(node);
            const color = gwColor(node.goWildRate);

            return (
              <CircleMarker
                key={node.iata}
                center={[node.lat, node.lng]}
                radius={isSelected ? radius + 3 : radius}
                pathOptions={{
                  color: isSelected ? "#1A2E2E" : "rgba(255,255,255,0.6)",
                  fillColor: color,
                  fillOpacity: 0.88,
                  weight: isSelected ? 2.5 : 1,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedAirport((v) =>
                      v === node.iata ? null : node.iata
                    );
                    setSelectedRoute(null);
                  },
                }}
              >
                <Tooltip
                  permanent={isSelected}
                  direction="top"
                  offset={[0, -(radius + 2)]}
                >
                  <div style={{ fontFamily: "Quicksand, sans-serif" }}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>
                      {node.iata}
                    </div>
                    {(isSelected) && (
                      <>
                        <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                          {node.city}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: gwColor(node.goWildRate),
                          }}
                        >
                          {Math.round(node.goWildRate * 100)}% GoWild
                        </div>
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
          <div
            className="absolute top-4 left-4 rounded-xl px-3 py-1.5 z-[1000] flex items-center gap-2"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            }}
          >
            <HugeiconsIcon
              icon={Analytics01Icon}
              size={13}
              color="#059669"
              strokeWidth={2}
            />
            <span className="text-[11px] font-bold text-[#2E4A4A]">
              {data.totalSnapshots.toLocaleString()} snapshots
            </span>
            <span className="text-[10px] text-[#9CA3AF]">
              · {TIME_RANGE_LABELS[timeRange]}
            </span>
          </div>
        )}

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 z-[1000] rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          }}
        >
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">
            GoWild Rate
          </div>
          {(
            [
              { color: "#059669", label: "≥50%" },
              { color: "#F59E0B", label: "25–50%" },
              { color: "#F43F5E", label: "<25%" },
            ] as const
          ).map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: color }}
              />
              <span className="text-[10px] font-semibold text-[#6B7B7B]">
                {label}
              </span>
            </div>
          ))}
          <div className="w-px h-3.5 bg-gray-200" />
          <div className="flex items-center gap-1">
            <svg width="20" height="4">
              <line
                x1="0"
                y1="2"
                x2="20"
                y2="2"
                stroke="#9CA3AF"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </svg>
            <span className="text-[10px] font-semibold text-[#9CA3AF]">
              Stale
            </span>
          </div>
          <div className="text-[9px] text-[#9CA3AF]">
            Node size = scan volume
          </div>
        </div>

        {/* Airport detail panel */}
        {selectedNode && (
          <AirportDetailPanel
            node={selectedNode}
            arcs={selectedNodeArcs}
            onClose={() => setSelectedAirport(null)}
            onSelectRoute={handleRouteSelect}
          />
        )}
      </div>
    </div>
  );
}
