import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO, formatDistanceToNowStrict } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Copy01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlightSearchRow {
  id: string;
  user_id: string;
  departure_airport: string;
  arrival_airport: string | null;
  departure_date: string;
  return_date: string | null;
  trip_type: string;
  all_destinations: string;
  gowild_found: boolean | null;
  flight_results_count: number | null;
  credits_cost: number | null;
  arrival_airports_count: number | null;
  search_timestamp: string;
  triggered_by: string | null;
  result_source?: string | null;
  provider_observed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  json_body?: any;
  request_body?: any;
  // any other passthrough
  [key: string]: any;
}

interface SnapshotRow {
  id: string;
  flight_search_id: string;
  snapshot_at: string;
  stable_itinerary_key?: string | null;
  source_itinerary_id?: string | null;
  origin_iata: string | null;
  leg_origin_iata: string | null;
  leg_destination_iata: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  flight_number: string | null;
  leg_index: number | null;
  stops: number | null;
  flight_type?: string | null;
  has_go_wild: boolean | null;
  go_wild_available_seats: number | null;
  go_wild_total: number | null;
  standard_total: number | null;
  availability_status?: string | null;
  [key: string]: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatDateTime(v: any): string {
  if (!v) return "Not available";
  try { return format(parseISO(String(v)), "MMM d, yyyy h:mm a"); } catch { return String(v); }
}
export function formatDate(v: any): string {
  if (!v) return "Not available";
  try { return format(parseISO(String(v)), "MMM d, yyyy"); } catch { return String(v); }
}
export function formatCurrency(v: any): string {
  if (v == null || isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}
export function formatNumber(v: any, digits = 0): string {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: digits });
}
export function formatPercent(v: any): string {
  if (v == null || isNaN(Number(v))) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}
export function getRelativeAge(v: any): string {
  if (!v) return "unknown age";
  try { return `${formatDistanceToNowStrict(parseISO(String(v)))} ago`; } catch { return "unknown age"; }
}

export type Freshness = "fresh" | "recent" | "aging" | "stale" | "unknown";
export function getFreshnessStatus(v: any): Freshness {
  if (!v) return "unknown";
  const t = new Date(v).getTime();
  if (isNaN(t)) return "unknown";
  const mins = (Date.now() - t) / 60000;
  if (mins < 30) return "fresh";
  if (mins < 180) return "recent";
  if (mins < 720) return "aging";
  return "stale";
}

const FRESHNESS_STYLES: Record<Freshness, string> = {
  fresh: "bg-emerald-100 text-emerald-700 border-emerald-200",
  recent: "bg-cyan-100 text-cyan-700 border-cyan-200",
  aging: "bg-amber-100 text-amber-700 border-amber-200",
  stale: "bg-rose-100 text-rose-700 border-rose-200",
  unknown: "bg-gray-100 text-gray-600 border-gray-200",
};

export function getResultSourceLabel(v: any): string {
  if (!v) return "Unknown";
  const s = String(v).toLowerCase();
  if (s.includes("cache")) return "Cache Hit";
  if (s.includes("bulk")) return "Admin Bulk";
  if (s.includes("schedul")) return "Scheduled Scan";
  if (s.includes("live") || s.includes("api") || s === "provider") return "Live API";
  return String(v);
}
export function getResultSourceBadgeClass(v: any): string {
  const l = getResultSourceLabel(v);
  switch (l) {
    case "Live API": return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "Cache Hit": return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "Admin Bulk": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Scheduled Scan": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function getGoWildBadgeClass(found: any): string {
  return found
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-gray-100 text-gray-500 border-gray-200";
}

export function safeJsonStringify(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export async function copyToClipboard(value: string) {
  try { await navigator.clipboard.writeText(value); } catch { /* noop */ }
}

// ── Snapshot fetching hook ─────────────────────────────────────────────────────

export function useFlightSearchSnapshots(searchId: string | null) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchId) return;
    let cancel = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/admin-flight-search-snapshots`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ search_id: searchId }),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed");
        if (!cancel) setSnapshots((json?.snapshots ?? []) as SnapshotRow[]);
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [searchId]);

  return { snapshots, loading, error };
}

// ── Metric calculations ────────────────────────────────────────────────────────

function itinKey(s: SnapshotRow): string {
  return (
    s.stable_itinerary_key ||
    s.source_itinerary_id ||
    `${s.origin_iata ?? "?"}-${s.leg_destination_iata ?? "?"}-${s.departure_at ?? "?"}-${s.arrival_at ?? "?"}-${s.flight_number ?? "?"}`
  );
}

function computeMetrics(snapshots: SnapshotRow[]) {
  // Group by itinerary key, take first leg as representative (lowest leg_index)
  const groups = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const k = itinKey(s);
    const arr = groups.get(k) ?? [];
    arr.push(s);
    groups.set(k, arr);
  }
  const itineraries = Array.from(groups.values()).map((legs) => {
    legs.sort((a, b) => (a.leg_index ?? 0) - (b.leg_index ?? 0));
    const first = legs[0];
    const last = legs[legs.length - 1];
    const hasGW = legs.some((l) => !!l.has_go_wild);
    const gwSeats = Math.min(...legs.map((l) => l.go_wild_available_seats ?? Infinity));
    const gwTotal = first.go_wild_total ?? null;
    const stdTotal = first.standard_total ?? null;
    const savings = gwTotal != null && stdTotal != null ? stdTotal - gwTotal : null;
    const stops = first.stops ?? Math.max(0, legs.length - 1);
    return {
      key: itinKey(first),
      origin: first.origin_iata ?? first.leg_origin_iata,
      destination: last.leg_destination_iata,
      departure_at: first.departure_at,
      arrival_at: last.arrival_at,
      flight_type: first.flight_type ?? null,
      availability_status: first.availability_status ?? null,
      stops,
      has_go_wild: hasGW,
      go_wild_available_seats: isFinite(gwSeats) ? gwSeats : null,
      go_wild_total: gwTotal,
      standard_total: stdTotal,
      savings,
    };
  });

  const total = itineraries.length;
  const gw = itineraries.filter((i) => i.has_go_wild);
  const gwSeats = gw.map((i) => i.go_wild_available_seats).filter((x): x is number => x != null);
  const gwFares = gw.map((i) => i.go_wild_total).filter((x): x is number => x != null);
  const stdFares = itineraries.map((i) => i.standard_total).filter((x): x is number => x != null);
  const savings = itineraries.map((i) => i.savings).filter((x): x is number => x != null);
  const nonstop = itineraries.filter((i) => i.stops === 0).length;
  const oneStop = itineraries.filter((i) => i.stops === 1).length;
  const twoPlus = itineraries.filter((i) => (i.stops ?? 0) >= 2).length;
  const soldOut = itineraries.filter((i) => /sold|unavailable|limited/i.test(i.availability_status ?? "")).length;

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    itineraries,
    total,
    totalSnapshots: snapshots.length,
    gowildCount: gw.length,
    gowildRate: total ? gw.length / total : 0,
    avgGwSeats: avg(gwSeats),
    maxGwSeats: gwSeats.length ? Math.max(...gwSeats) : null,
    minGwFare: gwFares.length ? Math.min(...gwFares) : null,
    avgGwFare: avg(gwFares),
    avgStdFare: avg(stdFares),
    avgSavings: avg(savings),
    nonstop,
    oneStop,
    twoPlus,
    soldOut,
    gwUnavailable: total - gw.length,
  };
}

type Metrics = ReturnType<typeof computeMetrics>;

// ── Small UI helpers ───────────────────────────────────────────────────────────

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border", className)}>
      {children}
    </span>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-[#EAECEC] shadow-sm overflow-hidden">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#F0F1F1] bg-[#FAFBFB]">
        <h3 className="text-sm font-semibold text-[#1A2E2E]">{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KV({ label, value, copy }: { label: string; value: React.ReactNode; copy?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</div>
      <div className="text-sm text-[#1A2E2E] mt-0.5 flex items-center gap-1.5 break-all">
        <span className="truncate">{value ?? "Not available"}</span>
        {copy && (
          <button
            onClick={() => copyToClipboard(copy)}
            className="text-[#9CA3AF] hover:text-[#059669] shrink-0"
            aria-label={`Copy ${label}`}
          >
            <HugeiconsIcon icon={Copy01Icon} size={12} color="currentColor" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#F0F1F1] bg-[#FAFBFB] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</div>
      <div className={cn("text-base font-bold mt-0.5", accent ?? "text-[#1A2E2E]")}>{value}</div>
    </div>
  );
}

function JsonBlock({ value }: { value: any }) {
  const str = safeJsonStringify(value);
  if (!str) return <div className="text-sm text-[#9CA3AF]">No data available.</div>;
  return (
    <div className="relative">
      <button
        onClick={() => copyToClipboard(str)}
        className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] hover:text-[#059669] bg-white/80 border border-[#EAECEC] rounded px-2 py-0.5"
      >
        Copy
      </button>
      <pre className="text-[11px] leading-relaxed bg-[#0F1729] text-[#D1D5DB] p-3 rounded-xl overflow-auto max-h-80 font-mono">
        {str}
      </pre>
    </div>
  );
}

// ── Trip type label ────────────────────────────────────────────────────────────
function tripTypeLabel(t: string): string {
  const s = (t || "").toLowerCase();
  if (s.includes("round")) return "Round-trip";
  if (s.includes("one")) return "One-way";
  if (s.includes("day")) return "Day trip";
  if (s.includes("plan")) return "Trip Planner";
  return t || "—";
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  search: FlightSearchRow | null;
}

export function FlightSearchDetailDrawer({ open, onClose, search }: DrawerProps) {
  const { snapshots, loading, error } = useFlightSearchSnapshots(open && search ? search.id : null);
  const [tab, setTab] = useState<"summary" | "snapshots" | "params" | "request" | "response" | "errors">("summary");
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Reset debug tab to summary whenever a new search opens
  useEffect(() => {
    if (open && search) setTab("summary");
  }, [search?.id, open]);

  // Escape close + focus management
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Move focus to close button when drawer opens
    const raf = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      cancelAnimationFrame(raf);
    };
  }, [open, onClose]);

  const metrics = useMemo(() => computeMetrics(snapshots), [snapshots]);

  const topGw = useMemo(() => {
    return [...metrics.itineraries]
      .sort((a, b) => {
        if (a.has_go_wild !== b.has_go_wild) return a.has_go_wild ? -1 : 1;
        const seatsDiff = (b.go_wild_available_seats ?? -1) - (a.go_wild_available_seats ?? -1);
        if (seatsDiff !== 0) return seatsDiff;
        const fareA = a.go_wild_total ?? Infinity;
        const fareB = b.go_wild_total ?? Infinity;
        if (fareA !== fareB) return fareA - fareB;
        return (b.savings ?? -Infinity) - (a.savings ?? -Infinity);
      })
      .slice(0, 5);
  }, [metrics.itineraries]);

  const routeIntel = useMemo(() => {
    if (!metrics.itineraries.length) return null;
    const gw = metrics.itineraries.filter((i) => i.has_go_wild);
    const bestDest = gw.length
      ? gw.reduce((a, b) =>
          ((b.go_wild_available_seats ?? 0) + (b.savings ?? 0) / 100) >
          ((a.go_wild_available_seats ?? 0) + (a.savings ?? 0) / 100) ? b : a)
      : null;
    const cheapest = gw.filter((i) => i.go_wild_total != null)
      .sort((a, b) => (a.go_wild_total ?? 0) - (b.go_wild_total ?? 0))[0] ?? null;
    const seatiest = gw.filter((i) => i.go_wild_available_seats != null)
      .sort((a, b) => (b.go_wild_available_seats ?? 0) - (a.go_wild_available_seats ?? 0))[0] ?? null;
    const savings = gw.filter((i) => i.savings != null)
      .sort((a, b) => (b.savings ?? 0) - (a.savings ?? 0))[0] ?? null;
    // most common dest
    const destCount = new Map<string, number>();
    for (const i of metrics.itineraries) {
      if (!i.destination) continue;
      destCount.set(i.destination, (destCount.get(i.destination) ?? 0) + 1);
    }
    const mostCommonDest = Array.from(destCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const stopsCount = new Map<number, number>();
    for (const i of metrics.itineraries) stopsCount.set(i.stops, (stopsCount.get(i.stops) ?? 0) + 1);
    const mostCommonStops = Array.from(stopsCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { bestDest, cheapest, seatiest, savings, mostCommonDest, mostCommonStops };
  }, [metrics.itineraries]);

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!search && !open) return null;

  const isAllDest = search?.all_destinations === "Yes";
  const routeLabel = `${search?.departure_airport ?? "—"} → ${isAllDest ? "All Destinations" : (search?.arrival_airport ?? "—")}`;
  const freshness = getFreshnessStatus(search?.provider_observed_at ?? search?.created_at ?? search?.search_timestamp);
  const provAge = search?.provider_observed_at;
  const createdAt = search?.created_at ?? search?.search_timestamp ?? null;

  const seatTier = (n: number | null) => {
    if (n == null || n === 0) return { dots: 0, label: "none", color: "bg-gray-200" };
    if (n <= 2) return { dots: 2, label: "low", color: "bg-amber-400" };
    if (n <= 5) return { dots: 4, label: "medium", color: "bg-cyan-500" };
    return { dots: 6, label: "strong", color: "bg-emerald-500" };
  };
  const tier = seatTier(metrics.avgGwSeats != null ? Math.round(metrics.avgGwSeats) : null);

  return createPortal(
    <AnimatePresence>
      {open && search && (
        <motion.div
          key="fs-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9998] bg-black/40"
          onClick={handleBackdrop}
        >
          <motion.aside
            key="fs-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Flight search details"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="absolute top-0 right-0 h-full w-full sm:w-[600px] md:w-[640px] lg:w-[680px] bg-[#F4F6F6] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="px-5 py-4 bg-white border-b border-[#EAECEC] flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-[#1A2E2E] font-mono">{routeLabel}</h2>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200">{tripTypeLabel(search.trip_type)}</Badge>
                  <Badge className={getGoWildBadgeClass(search.gowild_found)}>
                    {search.gowild_found ? "GoWild Found" : "No GoWild"}
                  </Badge>
                  <Badge className={getResultSourceBadgeClass(search.result_source ?? search.triggered_by)}>
                    {getResultSourceLabel(search.result_source ?? search.triggered_by).toUpperCase()}
                  </Badge>
                  <Badge className={FRESHNESS_STYLES[freshness]}>{freshness}</Badge>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-2">Created {formatDateTime(createdAt)}</p>
              </div>
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="Close drawer"
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[#F2F3F3] hover:bg-[#E5E7E7] text-[#1A2E2E]"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Search Summary */}
              <Card title="Search Summary">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <KV label="Search ID" value={<span className="font-mono text-xs">{search.id.slice(0, 8)}…</span>} copy={search.id} />
                  <KV label="User ID" value={<span className="font-mono text-xs">{search.user_id.slice(0, 8)}…</span>} copy={search.user_id} />
                  <KV label="Origin" value={search.departure_airport} />
                  <KV label={isAllDest ? "Destinations" : "Destination"} value={isAllDest ? "All Destinations" : (search.arrival_airport ?? "—")} />
                  <KV label="Departure Date" value={formatDate(search.departure_date)} />
                  <KV label="Return Date" value={search.return_date ? formatDate(search.return_date) : "Not available"} />
                  <KV label="Trip Type" value={tripTypeLabel(search.trip_type)} />
                  <KV label="Results Count" value={formatNumber(search.flight_results_count)} />
                  <KV label="GoWild Found" value={search.gowild_found ? "Yes" : "No"} />
                  <KV label="Credits Cost" value={formatNumber(search.credits_cost)} />
                  <KV label="Triggered By" value={search.triggered_by ?? "Not available"} />
                  <KV label="Result Source" value={getResultSourceLabel(search.result_source ?? search.triggered_by)} />
                  <KV label="Created At" value={formatDateTime(createdAt)} />
                  <KV label="Updated At" value={formatDateTime(search.updated_at)} />
                  <KV label="Provider Observed" value={formatDateTime(search.provider_observed_at)} />
                </div>
              </Card>

              {/* Data Freshness */}
              <Card title="Data Freshness" action={<Badge className={FRESHNESS_STYLES[freshness]}>{freshness}</Badge>}>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Last Observed" value={<span className="text-sm">{provAge ? getRelativeAge(provAge) : "—"}</span>} />
                  <Metric label="Search Created" value={<span className="text-sm">{createdAt ? getRelativeAge(createdAt) : "—"}</span>} />
                </div>
                <p className="text-xs text-[#6B7B7B] mt-3">
                  {provAge
                    ? `Provider data was observed ${getRelativeAge(provAge)}.`
                    : "No provider observation timestamp is available."}
                </p>
              </Card>

              {/* GoWild Signal */}
              <Card title="GoWild Signal">
                {loading ? (
                  <div className="text-sm text-[#9CA3AF]">Loading snapshot details…</div>
                ) : metrics.total === 0 ? (
                  <div className="text-sm text-[#9CA3AF]">No GoWild fares were found in this search.</div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Availability Rate</span>
                      <span className="text-lg font-bold text-emerald-600">{formatPercent(metrics.gowildRate)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F0F1F1] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${Math.min(100, metrics.gowildRate * 100)}%` }} />
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <span className="text-xs text-[#6B7B7B] mr-2">Seat depth ({tier.label}):</span>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} className={cn("w-3 h-3 rounded-sm", i < tier.dots ? tier.color : "bg-[#F0F1F1]")} />
                      ))}
                    </div>
                    <p className="text-sm text-[#1A2E2E] mt-4">
                      {metrics.gowildCount > 0
                        ? <>{metrics.gowildCount} of {metrics.total} itineraries had GoWild fares, with an average of <strong>{formatNumber(metrics.avgGwSeats, 1)}</strong> seats.</>
                        : "No GoWild fares were found in this search."}
                    </p>
                  </>
                )}
              </Card>

              {/* Snapshot Summary */}
              <Card title="Snapshot Summary">
                {loading ? (
                  <div className="text-sm text-[#9CA3AF]">Loading snapshot details…</div>
                ) : error ? (
                  <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">Unable to load flight snapshots for this search.<div className="text-xs text-rose-500 mt-1">{error}</div></div>
                ) : metrics.totalSnapshots === 0 ? (
                  <div className="text-sm text-[#6B7B7B] bg-[#FAFBFB] rounded-lg p-3 border border-[#F0F1F1]">
                    No snapshots were stored for this search. This may indicate an older search, a cache-only result, or a failed snapshot write.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="Snapshot Rows" value={formatNumber(metrics.totalSnapshots)} />
                    <Metric label="Unique Itineraries" value={formatNumber(metrics.total)} />
                    <Metric label="GoWild Itins" value={<span className="text-emerald-600">{formatNumber(metrics.gowildCount)}</span>} />
                    <Metric label="GoWild Rate" value={formatPercent(metrics.gowildRate)} accent="text-emerald-600" />
                    <Metric label="Avg GW Seats" value={formatNumber(metrics.avgGwSeats, 1)} />
                    <Metric label="Max GW Seats" value={formatNumber(metrics.maxGwSeats)} />
                    <Metric label="Min GW Fare" value={formatCurrency(metrics.minGwFare)} />
                    <Metric label="Avg GW Fare" value={formatCurrency(metrics.avgGwFare)} />
                    <Metric label="Avg Std Fare" value={formatCurrency(metrics.avgStdFare)} />
                    <Metric label="Avg Savings" value={<span className="text-emerald-600">{formatCurrency(metrics.avgSavings)}</span>} />
                    <Metric label="Nonstop" value={formatNumber(metrics.nonstop)} />
                    <Metric label="Connecting" value={formatNumber(metrics.oneStop + metrics.twoPlus)} />
                  </div>
                )}
              </Card>

              {/* Result Composition */}
              {metrics.total > 0 && (
                <Card title="Result Composition">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">{metrics.nonstop} Nonstop</Badge>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">{metrics.oneStop} 1 stop</Badge>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">{metrics.twoPlus} 2+ stops</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{metrics.gowildCount} GoWild available</Badge>
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200">{metrics.gwUnavailable} GoWild unavailable</Badge>
                    {metrics.soldOut > 0 && <Badge className="bg-rose-100 text-rose-700 border-rose-200">{metrics.soldOut} sold out / limited</Badge>}
                  </div>
                </Card>
              )}

              {/* Top GoWild Results */}
              {topGw.length > 0 && (
                <Card title="Top GoWild Results">
                  <div className="space-y-2">
                    {topGw.map((i) => (
                      <div key={i.key} className="rounded-xl border border-[#F0F1F1] bg-[#FAFBFB] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono text-sm font-bold text-[#1A2E2E] flex items-center gap-1">
                            <span>{i.origin ?? "?"}</span>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="#6B7B7B" strokeWidth={2} />
                            <span>{i.destination ?? "?"}</span>
                          </div>
                          {i.has_go_wild ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{formatNumber(i.go_wild_available_seats)} seats</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500 border-gray-200">No GoWild</Badge>
                          )}
                        </div>
                        <div className="mt-1.5 text-xs text-[#6B7B7B] flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>{formatDateTime(i.departure_at)}</span>
                          <span>→ {formatDateTime(i.arrival_at)}</span>
                          <span>{i.stops === 0 ? "Nonstop" : `${i.stops} stop${i.stops === 1 ? "" : "s"}`}</span>
                          {i.flight_type && <span>{i.flight_type}</span>}
                          {i.availability_status && <span className="capitalize">{i.availability_status}</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span><span className="text-[#9CA3AF]">GoWild:</span> <strong className="text-emerald-600">{formatCurrency(i.go_wild_total)}</strong></span>
                          <span><span className="text-[#9CA3AF]">Standard:</span> <strong>{formatCurrency(i.standard_total)}</strong></span>
                          <span><span className="text-[#9CA3AF]">Savings:</span> <strong className="text-emerald-600">{formatCurrency(i.savings)}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Route Intelligence */}
              {routeIntel && (
                <Card title="Route Intelligence">
                  <div className="grid grid-cols-2 gap-3">
                    <KV label={isAllDest ? "Best Destination" : "Best Itinerary"} value={routeIntel.bestDest?.destination ?? "—"} />
                    <KV label={isAllDest ? "Cheapest GoWild Dest" : "Cheapest GoWild"} value={routeIntel.cheapest ? `${routeIntel.cheapest.destination} • ${formatCurrency(routeIntel.cheapest.go_wild_total)}` : "—"} />
                    <KV label="Highest Seat Count" value={routeIntel.seatiest ? `${routeIntel.seatiest.destination} • ${formatNumber(routeIntel.seatiest.go_wild_available_seats)} seats` : "—"} />
                    <KV label="Best Savings" value={routeIntel.savings ? `${routeIntel.savings.destination} • ${formatCurrency(routeIntel.savings.savings)}` : "—"} />
                    <KV label="Most Common Destination" value={routeIntel.mostCommonDest ?? "—"} />
                    <KV label="Most Common Stops" value={routeIntel.mostCommonStops != null ? (routeIntel.mostCommonStops === 0 ? "Nonstop" : `${routeIntel.mostCommonStops} stop${routeIntel.mostCommonStops === 1 ? "" : "s"}`) : "—"} />
                  </div>
                </Card>
              )}

              {/* Debug tabs */}
              <Card title="Debug">
                <div className="flex flex-wrap gap-1 mb-3 border-b border-[#F0F1F1]">
                  {([
                    ["summary", "Summary"],
                    ["snapshots", "Snapshots"],
                    ["params", "Search Params"],
                    ["request", "Raw Request"],
                    ["response", "Raw Response"],
                    ["errors", "Errors"],
                  ] as const).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setTab(k)}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 -mb-px border-b-2 transition-colors",
                        tab === k
                          ? "border-emerald-500 text-emerald-700"
                          : "border-transparent text-[#9CA3AF] hover:text-[#1A2E2E]",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {tab === "summary" && <JsonBlock value={metrics} />}
                {tab === "snapshots" && (
                  snapshots.length === 0
                    ? <div className="text-sm text-[#9CA3AF]">No snapshot rows were found for this search.</div>
                    : <div className="overflow-x-auto max-h-80 border border-[#EAECEC] rounded-xl">
                        <table className="w-full text-[11px]">
                          <thead className="bg-[#FAFBFB] sticky top-0">
                            <tr className="text-left text-[#9CA3AF]">
                              <th className="px-2 py-2">Route</th>
                              <th className="px-2 py-2">Dep</th>
                              <th className="px-2 py-2">Flt</th>
                              <th className="px-2 py-2">GW</th>
                              <th className="px-2 py-2">Seats</th>
                              <th className="px-2 py-2">GW $</th>
                              <th className="px-2 py-2">Std $</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshots.map((s) => (
                              <tr key={s.id} className="border-t border-[#F0F1F1]">
                                <td className="px-2 py-1.5 font-mono">{s.leg_origin_iata}→{s.leg_destination_iata}</td>
                                <td className="px-2 py-1.5">{s.departure_at?.slice(0, 16) ?? "—"}</td>
                                <td className="px-2 py-1.5">{s.flight_number ?? "—"}</td>
                                <td className="px-2 py-1.5">{s.has_go_wild ? "Y" : "—"}</td>
                                <td className="px-2 py-1.5">{s.go_wild_available_seats ?? "—"}</td>
                                <td className="px-2 py-1.5">{s.go_wild_total ?? "—"}</td>
                                <td className="px-2 py-1.5">{s.standard_total ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                )}
                {tab === "params" && <JsonBlock value={search.json_body ?? search.search_params} />}
                {tab === "request" && <JsonBlock value={search.request_body ?? search.raw_request} />}
                {tab === "response" && <JsonBlock value={search.raw_response} />}
                {tab === "errors" && (
                  search.error_message || search.status
                    ? <JsonBlock value={{ error_message: search.error_message, status: search.status }} />
                    : <div className="text-sm text-[#9CA3AF]">No data available.</div>
                )}
              </Card>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
