import { cn } from "@/lib/utils";
import type { VisibleFlightMetrics } from "./flightSearchMetrics";

// ── Small KPI card ─────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "rose" | "cyan" | "default";
  icon: React.ReactNode;
}

function KpiCard({ label, value, sub, accent = "default", icon }: KpiCardProps) {
  const accentColor = {
    green:   "text-emerald-600",
    amber:   "text-amber-500",
    rose:    "text-rose-500",
    cyan:    "text-cyan-600",
    default: "text-[#102625]",
  }[accent];

  return (
    <div
      className="flex-1 min-w-[120px] rounded-2xl bg-white border border-[#E3EBE8] px-4 py-3 flex flex-col gap-1"
      style={{ boxShadow: "0 1px 4px 0 rgba(16,38,37,0.06)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-[#7A8B8A] uppercase tracking-wide leading-tight">{label}</span>
        <span className="flex-shrink-0 text-[#B0BDB9]">{icon}</span>
      </div>
      <p className={cn("text-xl font-black leading-none mt-0.5", accentColor)}>{value}</p>
      {sub && <p className="text-[10px] text-[#7A8B8A] leading-tight">{sub}</p>}
    </div>
  );
}

// ── Tiny inline SVG icons (avoids import risk) ────────────────────────────────

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconGW() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  );
}
function IconResults() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  metrics: VisibleFlightMetrics;
  serverTotal: number;
  isFiltered: boolean;
}

export function FlightSearchKpiStrip({ metrics, serverTotal, isFiltered }: Props) {
  const hitRatePct = (metrics.goWildHitRate * 100).toFixed(1);
  const avgResults = metrics.avgResults != null ? Math.round(metrics.avgResults).toString() : "—";
  const stalePct = metrics.totalVisible
    ? ((metrics.agingOrStaleCount / metrics.totalVisible) * 100).toFixed(0)
    : "0";

  const scope = isFiltered ? "filtered" : "total";

  return (
    <div className="flex gap-3 overflow-x-auto pb-0.5">
      <KpiCard
        label="Total Searches"
        value={serverTotal.toLocaleString()}
        sub={isFiltered ? `${metrics.totalVisible} visible` : "platform-wide"}
        accent="default"
        icon={<IconSearch />}
      />
      <KpiCard
        label="GoWild Hit Rate"
        value={`${hitRatePct}%`}
        sub={`${metrics.goWildFoundCount} of ${metrics.totalVisible} visible`}
        accent={metrics.goWildHitRate >= 0.4 ? "green" : metrics.goWildHitRate >= 0.2 ? "cyan" : "default"}
        icon={<IconGW />}
      />
      <KpiCard
        label="Avg Results"
        value={avgResults}
        sub={`per ${scope} search`}
        accent="default"
        icon={<IconResults />}
      />
      <KpiCard
        label="All-Destination"
        value={metrics.allDestinationCount.toString()}
        sub={`of ${metrics.totalVisible} visible searches`}
        accent={metrics.allDestinationCount > 0 ? "cyan" : "default"}
        icon={<IconGlobe />}
      />
      <KpiCard
        label="Aging / Stale"
        value={`${stalePct}%`}
        sub={`${metrics.agingOrStaleCount} searches need refresh`}
        accent={metrics.agingOrStaleCount > 0 ? (Number(stalePct) >= 30 ? "rose" : "amber") : "default"}
        icon={<IconClock />}
      />
      <KpiCard
        label="Top Origin"
        value={metrics.topOrigin ?? "—"}
        sub={metrics.topOrigin ? `${metrics.topOriginCount} searches` : "no data"}
        accent={metrics.topOrigin ? "green" : "default"}
        icon={<IconPin />}
      />
    </div>
  );
}
