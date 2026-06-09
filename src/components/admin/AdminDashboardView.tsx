import { useState, useRef, useMemo } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RefreshIcon,
  AirplaneTakeOff01Icon,
  UserGroupIcon,
  Layers01Icon,
  Clock01Icon,
  DatabaseIcon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  FilterIcon,
  Analytics01Icon,
  ChartRoseIcon,
  Coins01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { isGoWild, type FlightSnapshot } from "@/components/insights/airportHelpers";
import {
  useAdminDashboardMetrics,
  TIME_RANGE_LABELS,
  type TimeRange,
  type ExtendedRouteStat,
  type DashboardData,
} from "@/hooks/useAdminDashboardMetrics";
import { getFreshnessStatus } from "@/components/admin/FlightSearchDetailDrawer";

// ─── Styling constants ────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(203,213,225,0.5)",
  boxShadow: "0 2px 16px 0 rgba(52,92,90,0.07)",
};

// ─── Micro utilities ──────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtNum(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function fmtCur(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  try { return `${formatDistanceToNowStrict(parseISO(iso))} ago`; } catch { return "—"; }
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-[#EEF0F0]" />
    </div>
  );
}

// ─── Sparkline (lightweight SVG, no external lib) ────────────────────────────

function Sparkline({
  data,
  color = "#059669",
  width = 56,
  height = 28,
  dashed = false,
  ariaLabel,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  dashed?: boolean;
  ariaLabel?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" role="img" aria-label={ariaLabel ?? "Trend sparkline"}>
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.75"
        strokeDasharray={dashed ? "3 3" : undefined}
      />
    </svg>
  );
}

function MiniBarChart({
  data,
  color = "#059669",
  width = 56,
  height = 28,
  ariaLabel,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const max = Math.max(...data, 1);
  const gap = 2;
  const barW = Math.max(3, Math.floor((width - gap * (data.length - 1)) / data.length));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" role="img" aria-label={ariaLabel ?? "Bar chart"}>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - barH}
            width={barW}
            height={barH}
            rx={2}
            fill={color}
            opacity={i === data.length - 1 ? 1 : 0.3}
          />
        );
      })}
    </svg>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  helper,
  icon,
  iconBg,
  iconColor,
  valueColor = "text-[#1A2E2E]",
  badge,
  badgeVariant = "neutral",
  visual,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon: typeof Analytics01Icon;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  badge?: string;
  badgeVariant?: "emerald" | "cyan" | "amber" | "rose" | "indigo" | "neutral" | "purple";
  visual?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl px-5 py-4" style={CARD}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}
          >
            <HugeiconsIcon icon={icon} size={14} color={iconColor} strokeWidth={2} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] leading-none">{label}</p>
        </div>
        {visual && <div className="flex-shrink-0 opacity-70">{visual}</div>}
      </div>
      <p className={`text-[34px] font-black leading-none mb-2 ${valueColor}`}>{value}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {helper != null ? <p className="text-xs text-[#9CA3AF]">{helper}</p> : <span />}
        {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max = 100, colorClass = "bg-emerald-500", height = 6 }: { value: number; max?: number; colorClass?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`w-full rounded-full bg-[#F0F1F1]`} style={{ height }}>
      <div
        className={`${colorClass} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%`, height }}
      />
    </div>
  );
}

function Badge({ children, variant = "neutral" }: { children: React.ReactNode; variant?: "emerald" | "cyan" | "amber" | "rose" | "indigo" | "neutral" | "purple" }) {
  const cls: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    neutral: "bg-gray-100 text-gray-600 border-gray-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls[variant]}`}>
      {children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
      <div className="w-8 h-8 rounded-full bg-[#F0FDF4] flex items-center justify-center">
        <HugeiconsIcon icon={InformationCircleIcon} size={16} color="#059669" strokeWidth={2} />
      </div>
      <p className="text-xs text-[#9CA3AF]">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
        <HugeiconsIcon icon={AlertCircleIcon} size={16} color="#e11d48" strokeWidth={2} />
      </div>
      <p className="text-xs text-rose-500 font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-[#059669] hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#F0F1F1] ${className}`} />;
}

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={CARD}>
      {children}
    </div>
  );
}

function CardTitle({
  icon,
  children,
  subtitle,
}: {
  icon?: typeof Analytics01Icon;
  children: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  if (!icon && !subtitle) {
    return <p className="text-base font-bold text-[#2E4A4A] mb-3">{children}</p>;
  }
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon && (
        <HugeiconsIcon
          icon={icon}
          size={28}
          color="#059669"
          strokeWidth={1.5}
          className="shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-[#059669] uppercase tracking-wider leading-tight">
          {children}
        </p>
        {subtitle && (
          <p className="text-[13px] text-[#6B7B7B] mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={CARD}>
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-48 mb-1" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

// ─── Overview tiles ────────────────────────────────────────────────────────────

// Placeholder sparkline shapes — replace with real time-series data when
// the metrics hook exposes daily/hourly buckets.
const _TREND_SEARCHES = [4, 7, 5, 12, 8, 14, 11];
const _TREND_GOWILD   = [72, 78, 75, 80, 82, 79, 80];
const _TREND_CACHE    = [0, 0, 0, 0, 0, 0, 0];
const _TREND_USERS    = [1, 1, 2, 1, 2, 2, 2];

function OverviewTiles({ d }: { d: DashboardData }) {
  const gwRate    = d.overview.goWildHitRate;
  const cacheRate = d.overview.cacheHitRate;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Searches"
        value={d.overview.totalSearches.toLocaleString()}
        helper={`${d.searches.activeUsers} active user${d.searches.activeUsers !== 1 ? "s" : ""}`}
        icon={AirplaneTakeOff01Icon}
        iconBg="#ECFEFF"
        iconColor="#0891B2"
        valueColor="text-cyan-700"
        badge="Recent activity"
        badgeVariant="cyan"
        visual={<Sparkline data={_TREND_SEARCHES} color="#0891B2" />}
      />
      <MetricCard
        label="GoWild Hit Rate"
        value={fmtPct(gwRate)}
        helper={`${d.searches.goWildHits.toLocaleString()} GoWild hits`}
        icon={Analytics01Icon}
        iconBg="#F0FDF4"
        iconColor="#059669"
        valueColor={gwRate >= 30 ? "text-emerald-600" : gwRate >= 10 ? "text-amber-600" : "text-rose-600"}
        badge={gwRate >= 70 ? "Strong" : gwRate >= 30 ? "Healthy" : gwRate >= 10 ? "Moderate" : "Low"}
        badgeVariant={gwRate >= 70 ? "emerald" : gwRate >= 30 ? "emerald" : gwRate >= 10 ? "amber" : "rose"}
        visual={<Sparkline data={_TREND_GOWILD} color="#059669" />}
      />
      <MetricCard
        label="Cache Rate"
        value={fmtPct(cacheRate)}
        helper={`${d.cache.cacheHitCount} cache hit${d.cache.cacheHitCount !== 1 ? "s" : ""}`}
        icon={DatabaseIcon}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        valueColor="text-purple-700"
        badge={cacheRate === 0 ? "Needs setup" : cacheRate >= 50 ? "Efficient" : "Building up"}
        badgeVariant={cacheRate === 0 ? "amber" : cacheRate >= 50 ? "emerald" : "indigo"}
        visual={<Sparkline data={_TREND_CACHE} color="#7C3AED" dashed />}
      />
      <MetricCard
        label="Active Users"
        value={d.overview.activeUsers.toLocaleString()}
        helper={d.users.totalUsers != null ? `of ${d.users.totalUsers} total` : undefined}
        icon={UserGroupIcon}
        iconBg="#EFF6FF"
        iconColor="#2563EB"
        valueColor="text-blue-700"
        badge="Active"
        badgeVariant="indigo"
        visual={<MiniBarChart data={_TREND_USERS} color="#2563EB" />}
      />
    </div>
  );
}

// ─── Semi-circle gauge (SVG, no external lib) ────────────────────────────────

function SemiGauge({
  pct,
  color = "#F59E0B",
  width = 148,
}: {
  pct: number;
  color?: string;
  width?: number;
}) {
  const sw = Math.round(width * 0.09);
  const r  = Math.round(width * 0.40);
  const cx = width / 2;
  const h  = r + sw + 8;
  const cy = h - Math.round(sw / 2) - 4;

  const sx = cx - r;
  const ex = cx + r;

  const clamped = Math.min(Math.max(pct, 0), 100);
  const fillRad = Math.PI + (clamped / 100) * Math.PI;
  const fx = cx + r * Math.cos(fillRad);
  const fy = cy + r * Math.sin(fillRad);
  const largeArc = 0;

  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} fill="none" role="img" aria-label={`GoWild availability gauge: ${clamped.toFixed(0)}%`}>
      {/* track */}
      <path
        d={`M ${sx} ${cy} A ${r} ${r} 0 0 1 ${ex} ${cy}`}
        stroke="#E5E7EB"
        strokeWidth={sw}
        strokeLinecap="round"
      />
      {/* fill */}
      {clamped > 0 && (
        <path
          d={`M ${sx} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${fx.toFixed(1)} ${fy.toFixed(1)}`}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// ─── Route chip ───────────────────────────────────────────────────────────────

function RouteChip({ label, route, variant }: { label: string; route: string; variant: "emerald" | "rose" }) {
  const parts = route.split("→").map((s) => s.trim());
  const bg   = variant === "emerald" ? "bg-emerald-50" : "bg-rose-50";
  const lbl  = variant === "emerald" ? "text-emerald-600" : "text-rose-500";
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${bg}`}>
      <span className={`text-[9px] font-bold uppercase tracking-wide w-8 flex-shrink-0 ${lbl}`}>{label}</span>
      {parts.length === 2 ? (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black text-[#1A2E2E]">{parts[0]}</span>
          <span className="text-[11px] text-[#9CA3AF]">→</span>
          <span className="text-sm font-black text-[#1A2E2E]">{parts[1]}</span>
        </div>
      ) : (
        <span className="text-xs font-semibold text-[#2E4A4A]">{route}</span>
      )}
    </div>
  );
}

// ─── Card: GoWild Availability Snapshot ───────────────────────────────────────

function GoWildAvailCard({ d }: { d: DashboardData }) {
  const { goWildAvail: ga } = d;
  const pct           = ga.availabilityPct;
  const gaugeColor    = pct >= 60 ? "#059669" : pct >= 30 ? "#F59E0B" : "#E11D48";
  const statusLabel   = pct >= 60 ? "Healthy" : pct >= 30 ? "Moderate" : "Low";
  const statusVariant = (pct >= 60 ? "emerald" : pct >= 30 ? "amber" : "rose") as "emerald" | "amber" | "rose";
  const valueColor    = pct >= 60 ? "text-emerald-600" : pct >= 30 ? "text-amber-600" : "text-rose-600";

  return (
    <CardShell>
      <CardTitle icon={Analytics01Icon} subtitle="Live availability across complete itineraries">
        GoWild Availability Snapshot
      </CardTitle>

      {/* Gauge + mini stats */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-3">

        {/* Gauge */}
        <div className="flex flex-col items-center flex-shrink-0">
          <SemiGauge pct={pct} color={gaugeColor} width={148} />
          <div className="-mt-3 flex flex-col items-center gap-1.5">
            <span className={`text-[26px] font-black leading-none ${valueColor}`}>{fmtPct(pct)}</span>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex sm:flex-col gap-4 sm:gap-3 flex-wrap justify-center sm:justify-start sm:pt-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
              <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={14} color="#2563EB" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF] leading-none mb-0.5">Itineraries</p>
              <p className="text-base font-black text-[#1A2E2E] leading-none">{ga.totalItineraries.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color="#059669" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF] leading-none mb-0.5">GoWild</p>
              <p className="text-base font-black text-emerald-600 leading-none">{ga.goWildItineraries.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
              <HugeiconsIcon icon={Layers01Icon} size={14} color="#EA580C" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF] leading-none mb-0.5">Avg Seats</p>
              <p className="text-base font-black text-[#1A2E2E] leading-none">
                {ga.avgSeats != null ? ga.avgSeats.toFixed(1) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seat distribution */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF] mr-0.5">Seats</span>
        <Badge variant="rose">1–2: {ga.seatDistribution.low}</Badge>
        <Badge variant="amber">3–5: {ga.seatDistribution.medium}</Badge>
        <Badge variant="emerald">6+: {ga.seatDistribution.strong}</Badge>
      </div>

      {/* Best / Worst routes */}
      {(ga.bestRoute || ga.worstRoute) && (
        <div className="pt-3 border-t border-[#F0F1F1] flex flex-col gap-2">
          {ga.bestRoute  && <RouteChip label="Best"  route={ga.bestRoute}  variant="emerald" />}
          {ga.worstRoute && <RouteChip label="Worst" route={ga.worstRoute} variant="rose"    />}
        </div>
      )}

      {ga.totalItineraries === 0 && <EmptyState message="No snapshot data in this range." />}
    </CardShell>
  );
}

// ─── Donut chart (SVG, stroke-dasharray technique) ───────────────────────────

function DonutChart({
  hits,
  total,
  hitColor = "#059669",
  size = 156,
}: {
  hits: number;
  total: number;
  hitColor?: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.355;
  const sw = size * 0.115;
  const circ = 2 * Math.PI * r;
  const dash = total > 0 ? (hits / total) * circ : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" role="img" aria-label={`GoWild hit rate donut: ${total > 0 ? ((hits / total) * 100).toFixed(0) : 0}% (${hits} of ${total})`}>
      {/* track */}
      <circle cx={cx} cy={cy} r={r} stroke="#E5E7EB" strokeWidth={sw} />
      {/* hit arc — rotated so it starts at 12 o'clock */}
      {dash > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={hitColor}
          strokeWidth={sw}
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
    </svg>
  );
}

// ─── Card: GoWild Hits ────────────────────────────────────────────────────────

function GoWildHitsCard({ d }: { d: DashboardData }) {
  const { searches } = d;
  const hits     = searches.goWildHits;
  const total    = searches.total;
  const noHits   = total - hits;
  const rate     = searches.goWildHitRate;

  const statusLabel   = rate >= 70 ? "Strong" : rate >= 40 ? "Moderate" : "Low";
  const statusVariant = (rate >= 70 ? "emerald" : rate >= 40 ? "amber" : "rose") as "emerald" | "amber" | "rose";
  const rateColor     = rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-amber-600" : "text-rose-600";
  const hitColor      = rate >= 70 ? "#059669" : rate >= 40 ? "#F59E0B" : "#E11D48";

  return (
    <CardShell>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <HugeiconsIcon icon={ChartRoseIcon} size={15} color="#059669" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#059669] uppercase tracking-wider leading-tight">GoWild Hits</p>
            <p className="text-xs text-[#6B7B7B] mt-0.5">Searches that returned a GoWild fare</p>
          </div>
        </div>
        {total > 0 && <Badge variant={statusVariant}>{statusLabel}</Badge>}
      </div>

      {total === 0 ? (
        <EmptyState message="No flight searches found for this range." />
      ) : (
        <>
          {/* Donut + center label */}
          <div className="relative flex items-center justify-center mb-4">
            <DonutChart hits={hits} total={total} hitColor={hitColor} size={156} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={`text-[28px] font-black leading-none ${rateColor}`}>{fmtPct(rate)}</span>
              <span className="text-[11px] text-[#9CA3AF] mt-0.5 font-semibold">hit rate</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 border-t border-[#F0F1F1] pt-3">
            <div className="flex flex-col items-center gap-0.5 border-r border-[#F0F1F1] px-2">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} color="#059669" strokeWidth={2} />
              <span className="text-lg font-black text-emerald-600 leading-tight">{hits.toLocaleString()}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">Hits</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-r border-[#F0F1F1] px-2">
              <HugeiconsIcon icon={AlertCircleIcon} size={13} color="#9CA3AF" strokeWidth={2} />
              <span className="text-lg font-black text-[#9CA3AF] leading-tight">{noHits.toLocaleString()}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">No GoWild</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2">
              <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={13} color="#6B7B7B" strokeWidth={2} />
              <span className="text-lg font-black text-[#2E4A4A] leading-tight">{total.toLocaleString()}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">Total</span>
            </div>
          </div>
        </>
      )}

    </CardShell>
  );
}

// ─── Card: Average GoWild Seats ───────────────────────────────────────────────

function AvgGoWildSeatsCard({ d }: { d: DashboardData }) {
  const { goWildAvail: ga } = d;
  const { low, medium: mid, strong: high } = ga.seatDistribution;
  const total = low + mid + high;

  const lowPct  = total > 0 ? (low  / total) * 100 : 0;
  const midPct  = total > 0 ? (mid  / total) * 100 : 0;
  const highPct = total > 0 ? (high / total) * 100 : 0;

  const segments = [
    { key: "low",  label: "Low",  range: "1–2", count: low,  pct: lowPct,  bg: "bg-rose-400",    dot: "bg-rose-400",    labelCls: "text-rose-500"   },
    { key: "mid",  label: "Mid",  range: "3–5", count: mid,  pct: midPct,  bg: "bg-amber-400",   dot: "bg-amber-400",   labelCls: "text-amber-500"  },
    { key: "high", label: "High", range: "6+",  count: high, pct: highPct, bg: "bg-emerald-500", dot: "bg-emerald-500", labelCls: "text-emerald-600" },
  ] as const;

  return (
    <CardShell>
      <CardTitle icon={Layers01Icon} subtitle="Bottleneck seat distribution per itinerary">
        Average GoWild Seats
      </CardTitle>

      {/* Primary stat */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-[38px] font-black text-cyan-600 leading-none">
          {ga.avgSeats != null ? ga.avgSeats.toFixed(1) : "—"}
        </span>
        <span className="text-sm text-[#9CA3AF] font-medium">avg seats</span>
      </div>

      {total === 0 ? (
        <EmptyState message="No seat distribution data yet." />
      ) : (
        <>
          {/* Stacked distribution bar */}
          <div className="flex h-9 rounded-xl overflow-hidden mb-4">
            {segments.filter(s => s.count > 0).map(s => (
              <div
                key={s.key}
                className={`${s.bg} flex items-center justify-center`}
                style={{ width: `${s.pct}%`, minWidth: 6 }}
              >
                {s.pct >= 15 && (
                  <span className="text-[10px] font-bold text-white select-none leading-none">
                    {s.pct.toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-col divide-y divide-[#F8F9F9]">
            {segments.map(s => (
              <div key={s.key} className="flex items-center gap-2.5 py-2">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <span className={`text-xs font-semibold flex-shrink-0 ${s.labelCls}`}>{s.label}</span>
                <span className="text-[11px] text-[#9CA3AF] flex-shrink-0">({s.range})</span>
                <div className="flex-1" />
                <span className="text-sm font-black text-[#2E4A4A]">{s.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </CardShell>
  );
}

// ─── Savings trend area chart (SVG) ──────────────────────────────────────────

// Placeholder cumulative trend shape — replace with real daily/hourly buckets
// when the metrics hook exposes time-series savings data.
const _TREND_SAVINGS = [4200, 9800, 15400, 22100, 31500, 44200, 56365];

function SavingsTrendChart({
  data,
  height = 80,
  color = "#059669",
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;

  const W    = 300;
  const H    = height;
  const padX = 4;
  const padY = 8;

  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const step  = (W - padX * 2) / (data.length - 1);

  const pts = data.map((v, i) => ({
    x: padX + i * step,
    y: H - padY - ((v - min) / range) * (H - padY * 2),
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} fill="none" className="overflow-visible" role="img" aria-label="Estimated GoWild savings trend">
      <defs>
        <linearGradient id="savingsAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* grid lines */}
      {[0.25, 0.5, 0.75].map(t => {
        const y = (padY + t * (H - padY * 2)).toFixed(1);
        return <line key={t} x1={padX} y1={y} x2={W - padX} y2={y} stroke="#F0F1F1" strokeWidth="1" />;
      })}

      {/* area fill */}
      <path d={area} fill="url(#savingsAreaGrad)" />

      {/* line */}
      <path d={line} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* final point marker */}
      <circle cx={last.x} cy={last.y} r="6"   fill={color} fillOpacity="0.15" />
      <circle cx={last.x} cy={last.y} r="3.5" fill={color} />
    </svg>
  );
}

// ─── Card: Estimated GoWild Savings ──────────────────────────────────────────

function EstimatedSavingsCard({ d }: { d: DashboardData }) {
  const { savings } = d;

  const avgPerItinerary: number | null =
    savings.avgSavings != null
      ? savings.avgSavings
      : savings.itinerariesWithSavings > 0
        ? savings.totalSavings / savings.itinerariesWithSavings
        : null;

  return (
    <CardShell>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <HugeiconsIcon icon={Coins01Icon} size={15} color="#059669" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#059669] uppercase tracking-wider leading-tight">
              Estimated GoWild Savings
            </p>
            <p className="text-xs text-[#6B7B7B] mt-0.5">Dollars saved vs standard fares</p>
          </div>
        </div>

        {/* Avg savings badge */}
        {avgPerItinerary != null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
          >
            <HugeiconsIcon icon={Coins01Icon} size={11} color="#059669" strokeWidth={2} />
            <span className="text-[10px] font-bold text-emerald-700 whitespace-nowrap">
              {fmtCur(avgPerItinerary)} avg / itinerary
            </span>
          </div>
        )}
      </div>

      {savings.itinerariesWithSavings === 0 ? (
        <EmptyState message="Savings cannot be calculated because fare fields are missing or no GoWild fares were observed." />
      ) : (
        <>
          {/* Primary value */}
          <div className="mb-0.5">
            <span className="text-[38px] font-black text-emerald-600 leading-none">
              {fmtCur(savings.totalSavings)}
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">
            across {savings.itinerariesWithSavings.toLocaleString()} itineraries
          </p>

          {/* Trend chart */}
          <div className="mb-4">
            <SavingsTrendChart data={_TREND_SAVINGS} height={80} />
          </div>

          {/* Supporting stats */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#F0F1F1]">
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Max Savings</p>
              <p className="text-sm font-bold text-[#2E4A4A]">{fmtCur(savings.maxSavings)}</p>
            </div>
            {savings.topSavingsRoute && (
              <div>
                <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Top Route</p>
                <p className="text-sm font-bold text-emerald-600">{savings.topSavingsRoute}</p>
              </div>
            )}
          </div>
        </>
      )}

    </CardShell>
  );
}

// ─── Heatmap: types, computation, helpers ────────────────────────────────────

interface HeatmapCell {
  day: number;      // 0=Mon … 6=Sun
  bucket: number;   // 0="6a" … 5="9p"
  total: number;
  goWild: number;
  availPct: number; // 0–100
}

const HEATMAP_DAYS    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_BUCKETS = ["6a", "9a", "12p", "3p", "6p", "9p"];

function hourToBucket(h: number): number {
  if (h < 9)  return 0;
  if (h < 12) return 1;
  if (h < 15) return 2;
  if (h < 18) return 3;
  if (h < 21) return 4;
  return 5;
}

function computeHeatmapData(snapshots: FlightSnapshot[]): HeatmapCell[][] {
  const cells: HeatmapCell[][] = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 6 }, (_, bucket) => ({ day, bucket, total: 0, goWild: 0, availPct: 0 }))
  );

  for (const s of snapshots) {
    if (!s.snapshot_at) continue;
    const dt = new Date(s.snapshot_at);
    if (isNaN(dt.getTime())) continue;

    // JS getDay(): 0=Sun…6=Sat → remap to Mon=0…Sun=6
    const jsDay = dt.getDay();
    const day   = jsDay === 0 ? 6 : jsDay - 1;
    const bucket = hourToBucket(dt.getHours());

    cells[day][bucket].total++;
    if (isGoWild(s.has_go_wild)) cells[day][bucket].goWild++;
  }

  for (const row of cells) {
    for (const cell of row) {
      cell.availPct = cell.total > 0 ? (cell.goWild / cell.total) * 100 : 0;
    }
  }

  return cells;
}

function heatmapCellStyle(pct: number, total: number): { bg: string; textCls: string } {
  if (total === 0) return { bg: "#F9FAFB", textCls: "text-[#D1D5DB]" };
  if (pct >= 70)   return { bg: "#065F46", textCls: "text-white" };
  if (pct >= 50)   return { bg: "#059669", textCls: "text-white" };
  if (pct >= 30)   return { bg: "#34D399", textCls: "text-[#064E3B]" };
  if (pct >= 10)   return { bg: "#A7F3D0", textCls: "text-[#065F46]" };
  return                  { bg: "#ECFDF5", textCls: "text-[#6EE7B7]" };
}

// ─── Card: GoWild Availability Heatmap ───────────────────────────────────────

function GoWildHeatmapCard({ d }: { d: DashboardData }) {
  const [tooltip, setTooltip] = useState<{
    cell: HeatmapCell;
    top: number;
    left: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cells = useMemo(() => computeHeatmapData(d.snapshots), [d.snapshots]);
  const totalDataPoints = cells.flat().reduce((sum, c) => sum + c.total, 0);

  const handleCellEnter = (cell: HeatmapCell, e: React.MouseEvent) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!cRect) return;
    setTooltip({
      cell,
      top:  eRect.bottom - cRect.top + 6,
      left: eRect.left   - cRect.left + eRect.width / 2,
    });
  };

  return (
    <CardShell>
      <CardTitle icon={Analytics01Icon} subtitle="Availability patterns by day and search window">
        GoWild Availability Heatmap
      </CardTitle>

      {totalDataPoints < 5 ? (
        <EmptyState message="Not enough search history to build an availability heatmap yet." />
      ) : (
        <div className="flex flex-col gap-4">

          {/* Grid + tooltip anchor */}
          <div className="relative" ref={containerRef} onMouseLeave={() => setTooltip(null)}>
            <div className="overflow-x-auto">
              <div
                className="grid gap-1 min-w-[420px]"
                style={{ gridTemplateColumns: "48px repeat(6, 1fr)" }}
              >
                {/* Corner */}
                <div />
                {/* Header row: time-bucket labels */}
                {HEATMAP_BUCKETS.map((b) => (
                  <div
                    key={b}
                    className="text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] pb-1"
                  >
                    {b}
                  </div>
                ))}

                {/* Data rows — each day emits [label, ...6 cells] as a flat array */}
                {cells.map((row, dayIdx) => [
                  <div
                    key={`label-${dayIdx}`}
                    className="flex items-center justify-end pr-2"
                  >
                    <span className="text-[11px] font-bold text-[#6B7B7B]">
                      {HEATMAP_DAYS[dayIdx]}
                    </span>
                  </div>,
                  ...row.map((cell) => {
                    const { bg, textCls } = heatmapCellStyle(cell.availPct, cell.total);
                    return (
                      <div
                        key={`cell-${dayIdx}-${cell.bucket}`}
                        className={`rounded-lg h-9 flex items-center justify-center cursor-default transition-transform hover:scale-105 ${textCls}`}
                        style={{ background: bg }}
                        onMouseEnter={(e) => handleCellEnter(cell, e)}
                        aria-label={
                          cell.total === 0
                            ? `${HEATMAP_DAYS[dayIdx]} ${HEATMAP_BUCKETS[cell.bucket]}: no data`
                            : `${HEATMAP_DAYS[dayIdx]} ${HEATMAP_BUCKETS[cell.bucket]}: ${cell.availPct.toFixed(0)}% availability, ${cell.total} itineraries`
                        }
                      >
                        {cell.total > 0 && (
                          <span className="text-[10px] font-bold leading-none select-none">
                            {cell.availPct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    );
                  }),
                ])}
              </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  top:       tooltip.top,
                  left:      Math.max(74, tooltip.left),
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="rounded-xl px-3 py-2 shadow-lg"
                  style={{
                    background: "rgba(26,46,46,0.95)",
                    border:     "1px solid rgba(255,255,255,0.12)",
                    minWidth:   148,
                  }}
                >
                  <p className="text-xs font-bold text-white mb-1">
                    {HEATMAP_DAYS[tooltip.cell.day]} · {HEATMAP_BUCKETS[tooltip.cell.bucket]}
                  </p>
                  {tooltip.cell.total === 0 ? (
                    <p className="text-[11px] text-[#9CA3AF]">No data</p>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold text-emerald-300">
                        {tooltip.cell.availPct.toFixed(1)}% availability
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                        {tooltip.cell.goWild} GoWild · {tooltip.cell.total} total
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] mr-1">
              Availability
            </span>
            {[
              { label: "No data",  bg: "#F9FAFB", border: "#E5E7EB" },
              { label: "Low",      bg: "#A7F3D0", border: "#6EE7B7" },
              { label: "Moderate", bg: "#34D399", border: "#10B981" },
              { label: "High",     bg: "#059669", border: "#047857" },
              { label: "Peak",     bg: "#065F46", border: "#064E3B" },
            ].map(({ label, bg, border }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="w-3.5 h-3.5 rounded"
                  style={{ background: bg, border: `1px solid ${border}` }}
                />
                <span className="text-[10px] text-[#6B7B7B]">{label}</span>
              </div>
            ))}
          </div>

        </div>
      )}
    </CardShell>
  );
}

// ─── Card: Route Performance Leaderboard ─────────────────────────────────────

function RouteLeaderboardCard({ d }: { d: DashboardData }) {
  const [tab, setTab] = useState<"best" | "worst">("best");

  const isBest = tab === "best";

  // Re-sort by pure GoWild availability rate (distinct from bookabilityScore).
  const sorted = useMemo(() => {
    const src = isBest ? d.bestRoutes : d.worstRoutes;
    return isBest
      ? [...src].sort((a, b) => b.goWildRate - a.goWildRate)
      : [...src].sort((a, b) => a.goWildRate - b.goWildRate);
  }, [d.bestRoutes, d.worstRoutes, isBest]);

  const barFill  = isBest ? "#059669" : "#F87171";
  const barTrack = isBest ? "#F0FDF4" : "#FFF1F2";
  const pctCls   = isBest ? "text-emerald-600" : "text-rose-500";

  return (
    <CardShell>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider leading-tight">
            Route Performance
          </p>
          <p className="text-xs text-[#6B7B7B] mt-0.5">Best and weakest GoWild availability by route</p>
        </div>
      </div>

      {/* Segmented toggle */}
      <div className="flex rounded-xl bg-[#F2F3F3] p-0.5 mb-4">
        {(["best", "worst"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
              tab === t
                ? "bg-white text-[#2E4A4A] shadow-sm"
                : "text-[#9CA3AF] hover:text-[#6B7B7B]"
            }`}
          >
            {t === "best" ? "Best Routes" : "Worst Routes"}
          </button>
        ))}
      </div>

      {/* Route list */}
      {sorted.length === 0 ? (
        <EmptyState message="Route leaderboard needs more route analytics data." />
      ) : (
        <div className="flex flex-col divide-y divide-[#F8F9F9]">
          {sorted.map((r, i) => {
            const parts = r.route.split("→").map((s) => s.trim());
            return (
              <div key={r.route} className="flex items-center gap-2.5 py-2.5">

                {/* Rank */}
                <span className="text-[10px] font-black text-[#9CA3AF] w-3.5 flex-shrink-0 text-right leading-none">
                  {i + 1}
                </span>

                {/* Route pair + leg count */}
                <div className="w-[84px] flex-shrink-0">
                  {parts.length === 2 ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-[#1A2E2E]">{parts[0]}</span>
                      <span className="text-[10px] text-[#9CA3AF] leading-none">→</span>
                      <span className="text-xs font-black text-[#1A2E2E]">{parts[1]}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-[#2E4A4A]">{r.route}</span>
                  )}
                  <p className="text-[9px] text-[#9CA3AF] mt-0.5 leading-none">
                    {r.totalLegs} leg{r.totalLegs !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Availability bar */}
                <div className="flex-1 rounded-full h-2.5" style={{ background: barTrack }}>
                  <div
                    className="rounded-full h-2.5 transition-all duration-500"
                    style={{
                      width:      `${Math.min(100, Math.max(0, r.goWildRate))}%`,
                      background: barFill,
                    }}
                  />
                </div>

                {/* Percentage */}
                <span className={`text-xs font-black flex-shrink-0 w-9 text-right leading-none ${pctCls}`}>
                  {r.goWildRate.toFixed(0)}%
                </span>

              </div>
            );
          })}
        </div>
      )}

    </CardShell>
  );
}

// ─── Route status badge helpers ───────────────────────────────────────────────

function routeStatusBadge(status: ExtendedRouteStat["statusBadge"]) {
  const map: Record<string, { label: string; variant: "emerald" | "cyan" | "amber" | "rose" }> = {
    "Book Now": { label: "Book Now", variant: "emerald" },
    "Strong":   { label: "Strong",   variant: "cyan" },
    "Watch":    { label: "Watch",     variant: "amber" },
    "Weak":     { label: "Weak",      variant: "rose" },
  };
  const b = map[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={b.variant}>{b.label}</Badge>;
}

// ─── Card: Best Routes ────────────────────────────────────────────────────────

function BestRoutesCard({ d }: { d: DashboardData }) {
  return (
    <CardShell>
      <CardTitle icon={AirplaneTakeOff01Icon} subtitle="Highest bookability in this window">Best Routes Right Now</CardTitle>
      {d.bestRoutes.length === 0 ? (
        <EmptyState message="Not enough snapshot data to rank routes." />
      ) : (
        <div className="flex flex-col gap-2">
          {d.bestRoutes.map((r, i) => (
            <div key={r.route} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FFFE] border border-[#E8F5F0]">
              <span className="text-xs font-black text-[#9CA3AF] w-4 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-[#1A2E2E]">{r.route}</span>
                  {routeStatusBadge(r.statusBadge)}
                </div>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-[#6B7B7B]">{fmtPct(r.goWildRate)} avail</span>
                  {r.avgSeats != null && <span className="text-[10px] text-[#6B7B7B]">{r.avgSeats.toFixed(1)} seats</span>}
                  {r.avgSavings != null && <span className="text-[10px] text-emerald-600">{fmtCur(r.avgSavings)} avg savings</span>}
                  {r.latestSnapshotAt && <span className="text-[10px] text-[#9CA3AF]">{relTime(r.latestSnapshotAt)}</span>}
                </div>
              </div>
              <span
                className="text-sm font-black flex-shrink-0 w-8 text-right"
                style={{
                  color: r.bookabilityScore >= 60 ? "#059669" : r.bookabilityScore >= 40 ? "#d97706" : "#e11d48",
                }}
              >
                {r.bookabilityScore}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

// ─── Card: Worst Routes ───────────────────────────────────────────────────────

function worstRouteReason(r: ExtendedRouteStat): string {
  if (r.goWildRate === 0) return "No GoWild found";
  if (r.goWildRate < 15) return "Low availability";
  if (r.avgSeats != null && r.avgSeats < 2) return "Very few seats";
  const fresh = getFreshnessStatus(r.latestSnapshotAt);
  if (fresh === "stale" || fresh === "unknown") return "Stale data";
  return "Low bookability";
}

function WorstRoutesCard({ d }: { d: DashboardData }) {
  return (
    <CardShell>
      <CardTitle icon={AlertCircleIcon} subtitle="Routes to watch or avoid right now">Worst Routes Right Now</CardTitle>
      {d.worstRoutes.length === 0 ? (
        <EmptyState message="Not enough snapshot data to rank routes." />
      ) : (
        <div className="flex flex-col gap-2">
          {d.worstRoutes.map((r, i) => (
            <div key={r.route} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FFF9F9] border border-[#FFE4E4]">
              <span className="text-xs font-black text-[#9CA3AF] w-4 flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-[#1A2E2E]">{r.route}</span>
                  <Badge variant="rose">{worstRouteReason(r)}</Badge>
                </div>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-[#6B7B7B]">{fmtPct(r.goWildRate)} avail</span>
                  <span className="text-[10px] text-[#6B7B7B]">{r.totalLegs} searches</span>
                  {r.latestSnapshotAt && <span className="text-[10px] text-[#9CA3AF]">{relTime(r.latestSnapshotAt)}</span>}
                </div>
              </div>
              <span className="text-sm font-black text-rose-500 flex-shrink-0 w-8 text-right">
                {r.bookabilityScore}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

// ─── Card: Top Origin Airports ────────────────────────────────────────────────

function TopOriginsCard({ d }: { d: DashboardData }) {
  const items = d.searches.topOrigins;
  return (
    <CardShell>
      <CardTitle icon={AirplaneTakeOff01Icon} subtitle="Most searched departure airports">Top Origin Airports</CardTitle>
      {items.length === 0 ? (
        <EmptyState message="No origin airport data in this range." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item, i) => {
            const rate = item.count > 0 ? (item.goWildCount / item.count) * 100 : 0;
            return (
              <div key={item.airport} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-[#9CA3AF] w-3">{i + 1}</span>
                <div
                  className="rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ width: 32, height: 24, background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  {item.airport}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2E4A4A]">{item.count} searches</span>
                    <span className="text-[10px] text-emerald-600 font-bold">{fmtPct(rate)}</span>
                  </div>
                  <ProgressBar value={rate} colorClass="bg-emerald-400" height={4} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

// ─── Card: Top Destination Airports ──────────────────────────────────────────

function TopDestinationsCard({ d }: { d: DashboardData }) {
  const items = d.searches.topDestinations;
  return (
    <CardShell>
      <CardTitle icon={AirplaneTakeOff01Icon} subtitle="Most searched arrival airports">Top Destination Airports</CardTitle>
      {items.length === 0 ? (
        <EmptyState message="No destination data in this range. All-destination searches may show no specific airport." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item, i) => {
            const rate = item.count > 0 ? (item.goWildCount / item.count) * 100 : 0;
            return (
              <div key={item.airport} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-[#9CA3AF] w-3">{i + 1}</span>
                <div
                  className="rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ width: 32, height: 24, background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)" }}
                >
                  {item.airport}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2E4A4A]">{item.count} searches</span>
                    <span className="text-[10px] text-cyan-600 font-bold">{fmtPct(rate)}</span>
                  </div>
                  <ProgressBar value={rate} colorClass="bg-cyan-400" height={4} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

// ─── Card: Search Volume ──────────────────────────────────────────────────────

function SearchVolumeCard({ d }: { d: DashboardData }) {
  const { searches, cache } = d;
  const sourceRows = [
    { label: "Live API",       count: cache.liveApiCount,       color: "bg-cyan-400",    badge: "cyan" as const },
    { label: "Cache Hit",      count: cache.cacheHitCount,      color: "bg-indigo-400",  badge: "indigo" as const },
    { label: "Admin Bulk",     count: cache.adminBulkCount,     color: "bg-amber-400",   badge: "amber" as const },
    { label: "Scheduled Scan", count: cache.scheduledBulkCount, color: "bg-emerald-400", badge: "emerald" as const },
    { label: "Other",          count: cache.otherCount,         color: "bg-gray-300",    badge: "neutral" as const },
  ].filter((r) => r.count > 0);

  return (
    <CardShell>
      <CardTitle icon={Analytics01Icon} subtitle="Total searches and source breakdown">Search Volume</CardTitle>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-4xl font-black text-cyan-600">{searches.total.toLocaleString()}</span>
        <span className="text-sm text-[#9CA3AF] pb-1">searches</span>
      </div>
      <div className="mb-3">
        <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold mb-1">Avg Results per Search</p>
        <p className="text-sm font-bold text-[#2E4A4A]">{searches.avgResultsPerSearch.toFixed(1)}</p>
      </div>
      {sourceRows.length > 0 && (
        <div className="pt-3 border-t border-[#F0F1F1]">
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold mb-2">Source Breakdown</p>
          <div className="flex flex-col gap-1.5">
            {sourceRows.map((r) => (
              <div key={r.label} className="flex items-center gap-2">
                <div className="w-20 text-[10px] font-semibold text-[#6B7B7B] truncate">{r.label}</div>
                <div className="flex-1">
                  <ProgressBar value={r.count} max={searches.total} colorClass={r.color} height={5} />
                </div>
                <div className="text-[10px] font-bold text-[#9CA3AF] w-8 text-right">{r.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {searches.total === 0 && <EmptyState message="No flight searches found for this range." />}
    </CardShell>
  );
}

// ─── Card: Cache Efficiency ───────────────────────────────────────────────────

function CacheEfficiencyCard({ d }: { d: DashboardData }) {
  const { cache } = d;
  const barColor = cache.cacheHitRate >= 40 ? "bg-indigo-500" : cache.cacheHitRate >= 20 ? "bg-amber-500" : "bg-gray-400";

  return (
    <CardShell>
      <CardTitle icon={DatabaseIcon} subtitle="Share of searches served from cache">Cache Efficiency</CardTitle>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-black text-indigo-600">{fmtPct(cache.cacheHitRate)}</span>
        <span className="text-sm text-[#9CA3AF] pb-1">cache rate</span>
      </div>
      <ProgressBar value={cache.cacheHitRate} colorClass={barColor} height={8} />
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Cache Hits</p>
          <p className="text-sm font-bold text-indigo-600">{cache.cacheHitCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Live API</p>
          <p className="text-sm font-bold text-cyan-600">{cache.liveApiCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Scheduled Bulk</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{cache.scheduledBulkCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">API Calls Saved</p>
          <p className="text-sm font-bold text-emerald-600">~{cache.estimatedApiCallsSaved.toLocaleString()}</p>
        </div>
      </div>
      {cache.total === 0 && <EmptyState message="No search source data in this range." />}
    </CardShell>
  );
}

// ─── Funnel trapezoid (SVG) ───────────────────────────────────────────────────

function FunnelTrap({
  topFrac,
  botFrac,
  color,
}: {
  topFrac: number;
  botFrac: number;
  color: string;
}) {
  // viewBox is 100×100; preserveAspectRatio="none" stretches it to fill the
  // container exactly, so x-coords are always % of rendered width.
  const W   = 100;
  const H   = 100;
  const MIN = 0.05; // never narrower than 5% so zero-count stages stay visible
  const t   = Math.max(topFrac, MIN);
  const b   = Math.max(botFrac, MIN);
  const x1  = ((1 - t) / 2) * W;
  const x2  = ((1 + t) / 2) * W;
  const x3  = ((1 + b) / 2) * W;
  const x4  = ((1 - b) / 2) * W;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={`M ${x1.toFixed(1)} 0 L ${x2.toFixed(1)} 0 L ${x3.toFixed(1)} ${H} L ${x4.toFixed(1)} ${H} Z`}
        fill={color}
        opacity="0.82"
      />
    </svg>
  );
}

// ─── Card: Funnel ─────────────────────────────────────────────────────────────

function FunnelCard({ d }: { d: DashboardData }) {
  const { funnel } = d;

  // All percentages are relative to totalSearches (top of funnel).
  function pctOfTotal(count: number): string {
    if (funnel.totalSearches === 0 || count === 0) return "—";
    return `${((count / funnel.totalSearches) * 100).toFixed(1)}%`;
  }

  const stages = [
    {
      label: "Total Searches",
      sub:   "All searches performed",
      count: funnel.totalSearches,
      color: "#0891B2", // cyan-600
    },
    {
      label: "GoWild Hits",
      sub:   "Returned a GoWild fare",
      count: funnel.goWildHits,
      color: "#0D9488", // teal-600
    },
    {
      label: "Saved Flights",
      sub:   "Saved to trips",
      count: funnel.savedFlights,
      color: "#6366F1", // indigo-500
    },
    {
      // TODO: wire in real watched-flights count once exposed by the metrics hook
      label: "Watched Flights",
      sub:   "Watching for changes",
      count: 0,
      color: "#8B5CF6", // violet-500
    },
  ] as const;

  const max   = funnel.totalSearches || 1;
  const fracs = stages.map(s => s.count / max);

  return (
    <CardShell>

      {/* Header */}
      <div className="flex items-start gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
          <HugeiconsIcon icon={FilterIcon} size={15} color="#0891B2" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-bold text-[#2E4A4A] uppercase tracking-wider leading-tight">
            Searches → Saved Flights Funnel
          </p>
          <p className="text-xs text-[#6B7B7B] mt-0.5">Conversion from search to saved flight</p>
        </div>
      </div>

      {funnel.totalSearches === 0 ? (
        <EmptyState message="No search data found for this range." />
      ) : (
        /* rows stack with no vertical gap so trapezoid edges connect */
        <div className="flex flex-col">
          {stages.map((stage, i) => {
            const topFrac = fracs[i];
            const botFrac = i < stages.length - 1 ? fracs[i + 1] : fracs[i];
            const isFirst = i === 0;
            return (
              <div key={stage.label} className="flex items-stretch h-[52px] gap-3">
                {/* Label */}
                <div className="w-[100px] flex-shrink-0 flex flex-col justify-center">
                  <p className="text-[11px] font-bold text-[#1A2E2E] leading-tight">{stage.label}</p>
                  <p className="text-[9px] text-[#9CA3AF] leading-tight mt-0.5">{stage.sub}</p>
                </div>

                {/* Trapezoid fills full cell height */}
                <div className="flex-1">
                  <FunnelTrap topFrac={topFrac} botFrac={botFrac} color={stage.color} />
                </div>

                {/* Count + conversion % */}
                <div className="w-14 flex-shrink-0 flex flex-col justify-center text-right">
                  <p className="text-sm font-black text-[#1A2E2E] leading-tight">
                    {stage.count > 0 ? stage.count.toLocaleString() : "—"}
                  </p>
                  {!isFirst && (
                    <p className="text-[10px] text-[#9CA3AF] font-semibold leading-tight">
                      {pctOfTotal(stage.count)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom conversion rates */}
      {funnel.totalSearches > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-[#F0F1F1]">
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Save Rate</p>
            <p className="text-sm font-bold text-indigo-600">{fmtPct(funnel.saveRate)}</p>
          </div>
          {funnel.goWildSaveRate != null && (
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">GW Save Rate</p>
              <p className="text-sm font-bold text-emerald-600">{fmtPct(funnel.goWildSaveRate)}</p>
            </div>
          )}
        </div>
      )}

    </CardShell>
  );
}

// ─── Card: Scheduled Scan Health ─────────────────────────────────────────────

function scanStatusVariant(status: string): "emerald" | "amber" | "rose" | "cyan" | "neutral" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "success") return "emerald";
  if (s === "running" || s === "in_progress") return "cyan";
  if (s === "failed" || s === "error") return "rose";
  if (s === "partial") return "amber";
  return "neutral";
}

function fmtDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function ScanHealthCard({ d }: { d: DashboardData }) {
  const { scanJobs } = d;
  const latest = scanJobs[0] ?? null;

  if (!latest) {
    return (
      <CardShell>
        <CardTitle icon={CheckmarkCircle01Icon} subtitle="Latest bulk scan job status">Scheduled Scan Health</CardTitle>
        <EmptyState message="No scan jobs found." />
      </CardShell>
    );
  }

  const successRate = latest.airports_total > 0
    ? (latest.airports_succeeded / latest.airports_total) * 100
    : 0;
  const statusV = scanStatusVariant(latest.status);

  return (
    <CardShell>
      <CardTitle icon={CheckmarkCircle01Icon} subtitle="Latest bulk scan job status">Scheduled Scan Health</CardTitle>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl font-black text-[#1A2E2E]">{latest.timezone_group}</span>
        <Badge variant={statusV}>{latest.status}</Badge>
      </div>
      <ProgressBar value={latest.airports_succeeded} max={latest.airports_total || 1} colorClass="bg-emerald-500" height={8} />
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Total</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{latest.airports_total}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">OK</p>
          <p className="text-sm font-bold text-emerald-600">{latest.airports_succeeded}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Failed</p>
          <p className={`text-sm font-bold ${latest.airports_failed > 0 ? "text-rose-500" : "text-[#9CA3AF]"}`}>{latest.airports_failed}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">GoWild Found</p>
          <p className="text-sm font-bold text-emerald-600">{latest.gowild_found_count}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Duration</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{fmtDurationMs(latest.duration_ms)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Target Date</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{latest.target_date}</p>
        </div>
      </div>
      {latest.error_message && (
        <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-100">
          <p className="text-[10px] text-rose-600 font-medium">{latest.error_message}</p>
        </div>
      )}
      {scanJobs.length > 1 && (
        <div className="mt-3 pt-3 border-t border-[#F0F1F1]">
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold mb-2">Recent Scans</p>
          <div className="flex flex-col gap-1">
            {scanJobs.slice(1, 5).map((job) => (
              <div key={job.id} className="flex items-center gap-2 text-[10px]">
                <Badge variant={scanStatusVariant(job.status)}>{job.status}</Badge>
                <span className="text-[#6B7B7B] flex-1">{job.target_date} · {job.timezone_group}</span>
                <span className="text-[#9CA3AF]">{fmtDurationMs(job.duration_ms)}</span>
                <span className="text-emerald-600 font-bold">{job.gowild_found_count} GW</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}

// ─── Card: Data Freshness ─────────────────────────────────────────────────────

function getFreshnessBarColor(status: string): string {
  switch (status) {
    case "fresh":   return "bg-emerald-500";
    case "recent":  return "bg-cyan-500";
    case "aging":   return "bg-amber-500";
    case "stale":   return "bg-rose-500";
    default:        return "bg-gray-300";
  }
}

function DataFreshnessCard({ d }: { d: DashboardData }) {
  const { freshness } = d;
  const { total } = freshness;

  const dominant = (() => {
    const items = [
      { key: "fresh", count: freshness.fresh },
      { key: "recent", count: freshness.recent },
      { key: "aging", count: freshness.aging },
      { key: "stale", count: freshness.stale },
    ];
    return items.reduce((a, b) => (b.count > a.count ? b : a), items[0]).key;
  })();

  const overallBadge = { fresh: "emerald", recent: "cyan", aging: "amber", stale: "rose" }[dominant] as "emerald" | "cyan" | "amber" | "rose";

  return (
    <CardShell>
      <CardTitle icon={Clock01Icon} subtitle="Snapshot age distribution">Data Freshness</CardTitle>
      {total === 0 ? (
        <EmptyState message="No snapshot data available." />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl font-black text-[#1A2E2E] capitalize">{dominant}</span>
            <Badge variant={overallBadge}>
              {dominant === "fresh" ? "✓ Up to Date" : dominant === "recent" ? "Recent" : dominant === "aging" ? "Aging" : "⚠ Stale"}
            </Badge>
          </div>
          {/* Freshness distribution bar */}
          <div className="flex rounded-full overflow-hidden h-3 mb-2">
            {freshness.fresh > 0   && <div className="bg-emerald-500" style={{ flex: freshness.fresh }} />}
            {freshness.recent > 0  && <div className="bg-cyan-400"    style={{ flex: freshness.recent }} />}
            {freshness.aging > 0   && <div className="bg-amber-400"   style={{ flex: freshness.aging }} />}
            {freshness.stale > 0   && <div className="bg-rose-400"    style={{ flex: freshness.stale }} />}
            {freshness.unknown > 0 && <div className="bg-gray-200"    style={{ flex: freshness.unknown }} />}
          </div>
          <div className="flex gap-3 flex-wrap mb-3">
            {[
              { label: "Fresh",   val: freshness.fresh,   color: "emerald" as const },
              { label: "Recent",  val: freshness.recent,  color: "cyan" as const },
              { label: "Aging",   val: freshness.aging,   color: "amber" as const },
              { label: "Stale",   val: freshness.stale,   color: "rose" as const },
              { label: "Unknown", val: freshness.unknown, color: "neutral" as const },
            ]
              .filter((x) => x.val > 0)
              .map((x) => (
                <div key={x.label} className="flex items-center gap-1">
                  <Badge variant={x.color}>{x.label}</Badge>
                  <span className="text-[10px] text-[#9CA3AF] font-semibold">{x.val}</span>
                </div>
              ))}
          </div>
          {freshness.mostRecentAt && (
            <p className="text-xs text-[#6B7B7B]">
              Most recent snapshot: <span className="font-semibold">{relTime(freshness.mostRecentAt)}</span>
            </p>
          )}
          {freshness.stale > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {freshness.stale} snapshots may need refresh.
            </p>
          )}
        </>
      )}
    </CardShell>
  );
}

// ─── Card: User Activity ──────────────────────────────────────────────────────

function UserActivityCard({ d }: { d: DashboardData }) {
  const { users } = d;
  return (
    <CardShell>
      <CardTitle icon={UserGroupIcon} subtitle="Active users and engagement">User Activity</CardTitle>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Active Users</p>
          <p className="text-2xl font-black text-[#1A2E2E]">{users.activeUsers.toLocaleString()}</p>
          {users.totalUsers != null && (
            <p className="text-[10px] text-[#9CA3AF]">of {users.totalUsers} total</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Searches / User</p>
          <p className="text-2xl font-black text-cyan-600">
            {users.searchesPerUser != null ? users.searchesPerUser.toFixed(1) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Saved Flights</p>
          <p className="text-2xl font-black text-indigo-600">{users.savedFlightsInRange.toLocaleString()}</p>
          <p className="text-[10px] text-[#9CA3AF]">{users.savedFlightsTotal} all time</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Saves / User</p>
          <p className="text-2xl font-black text-emerald-600">
            {users.savedPerUser != null ? users.savedPerUser.toFixed(2) : "—"}
          </p>
        </div>
      </div>
      {users.activeUsers === 0 && <EmptyState message="No active users in this range." />}
    </CardShell>
  );
}

// ─── Card: Blackout Impact ────────────────────────────────────────────────────

function BlackoutImpactCard({ d }: { d: DashboardData }) {
  const { blackout } = d;
  const { nextPeriod, daysUntil, affectedSearchCount } = blackout;
  const isImminent = daysUntil != null && daysUntil <= 7;
  const badgeVariant = isImminent ? "rose" : daysUntil != null && daysUntil <= 30 ? "amber" : "neutral";

  return (
    <CardShell>
      <CardTitle icon={AlertCircleIcon} subtitle="Upcoming GoWild blackout windows">Blackout Date Impact</CardTitle>
      {!nextPeriod ? (
        <EmptyState message="No upcoming blackout dates in the database." />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-2xl font-black ${isImminent ? "text-rose-600" : "text-amber-600"}`}>
              {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d away`}
            </span>
            <Badge variant={badgeVariant}>{isImminent ? "Imminent" : "Upcoming"}</Badge>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 mb-3">
            <p className="text-xs font-bold text-amber-700">{nextPeriod.description}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              {nextPeriod.start === nextPeriod.end
                ? nextPeriod.start
                : `${nextPeriod.start} – ${nextPeriod.end}`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7B7B]">Searches with blackout departure dates</span>
              <span className={`text-sm font-black ${affectedSearchCount > 0 ? "text-amber-600" : "text-[#9CA3AF]"}`}>
                {affectedSearchCount}
              </span>
            </div>
          </div>
          {affectedSearchCount > 0 && (
            <p className="text-xs text-amber-700 mt-2">
              {affectedSearchCount} searched route{affectedSearchCount !== 1 ? "s have" : " has"} departure dates inside a GoWild blackout window.
            </p>
          )}
        </>
      )}
    </CardShell>
  );
}

// ─── Time range selector ──────────────────────────────────────────────────────

const TIME_RANGE_OPTIONS: TimeRange[] = ["today", "24h", "7d", "30d", "all"];

function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        className="appearance-none rounded-full bg-white border border-[#E8EEEE] pl-3 pr-8 py-1.5 text-xs font-semibold text-[#2E4A4A] focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
      >
        {TIME_RANGE_OPTIONS.map((r) => (
          <option key={r} value={r}>{TIME_RANGE_LABELS[r]}</option>
        ))}
      </select>
      <FontAwesomeIcon
        icon={faChevronDown}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#9CA3AF] pointer-events-none"
      />
    </div>
  );
}

// ─── Skeleton grid ────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </>
  );
}

// ─── Main AdminDashboardView ──────────────────────────────────────────────────

export default function AdminDashboardView() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const { data, loading, error, lastUpdated, refetch } = useAdminDashboardMetrics(timeRange);

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full border border-[#E8EEEE] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B7B7B] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] disabled:opacity-50 transition-colors"
          >
            <HugeiconsIcon icon={RefreshIcon} size={13} color="currentColor" strokeWidth={2.5} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        {lastUpdated && (
          <p className="text-xs text-[#9CA3AF]">
            Updated {formatDistanceToNowStrict(lastUpdated)} ago
          </p>
        )}
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-2xl p-5" style={CARD}>
          <ErrorState message={`Failed to load dashboard: ${error}`} onRetry={refetch} />
        </div>
      )}

      {/* Loading skeletons */}
      {loading && <SkeletonGrid />}

      {/* Dashboard content */}
      {!loading && !error && data && (
        <div className="flex flex-col gap-6">
          {/* A: Overview tiles */}
          <OverviewTiles d={data} />

          {/* B: GoWild Intelligence */}
          <div>
            <SectionLabel>GoWild Intelligence</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <GoWildAvailCard d={data} />
              <GoWildHitsCard d={data} />
              <AvgGoWildSeatsCard d={data} />
            </div>
          </div>

          {/* B2: GoWild Availability Patterns */}
          <div>
            <SectionLabel>GoWild Availability Patterns</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GoWildHeatmapCard d={data} />
              <RouteLeaderboardCard d={data} />
            </div>
          </div>

          {/* C: Savings */}
          <div>
            <SectionLabel>GoWild Value</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EstimatedSavingsCard d={data} />
              <FunnelCard d={data} />
            </div>
          </div>

          {/* D: Routes */}
          <div>
            <SectionLabel>Route Opportunities</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BestRoutesCard d={data} />
              <WorstRoutesCard d={data} />
            </div>
          </div>

          {/* E: Airports */}
          <div>
            <SectionLabel>Airport Intelligence</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TopOriginsCard d={data} />
              <TopDestinationsCard d={data} />
            </div>
          </div>

          {/* F: Search & Cache Health */}
          <div>
            <SectionLabel>Search &amp; Cache Health</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SearchVolumeCard d={data} />
              <CacheEfficiencyCard d={data} />
              <UserActivityCard d={data} />
            </div>
          </div>

          {/* G: Operations */}
          <div>
            <SectionLabel>Operations &amp; Health</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ScanHealthCard d={data} />
              <DataFreshnessCard d={data} />
              <BlackoutImpactCard d={data} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
