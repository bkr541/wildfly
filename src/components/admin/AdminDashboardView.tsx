import { useState } from "react";
import { formatDistanceToNowStrict, parseISO, format } from "date-fns";
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
  ArrowRight01Icon,
  Analytics01Icon,
  ChartRoseIcon,
  Coins01Icon,
  InformationCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import {
  useAdminDashboardMetrics,
  TIME_RANGE_LABELS,
  type TimeRange,
  type ExtendedRouteStat,
  type FreshnessMetrics,
  type ScanJobRow,
  type DashboardData,
} from "@/hooks/useAdminDashboardMetrics";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDateTime,
  getFreshnessStatus,
  getRelativeAge,
} from "@/components/admin/FlightSearchDetailDrawer";

// ─── Styling constants ────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
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
    <div className="flex items-center gap-2 mb-1">
      <span className="text-xs font-black uppercase tracking-widest text-[#9CA3AF]">{children}</span>
      <div className="flex-1 h-px bg-[#F0F1F1]" />
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: "emerald" | "cyan" | "amber" | "rose" | "indigo" }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600",
    cyan: "text-cyan-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    indigo: "text-indigo-600",
  };
  return (
    <div className="rounded-xl p-4" style={CARD}>
      <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? colors[accent] : "text-[#1A2E2E]"}`}>{value}</p>
      {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
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
    <div className={`rounded-2xl p-5 ${className}`} style={CARD}>
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
    return <p className="text-sm font-bold text-[#2E4A4A] mb-3">{children}</p>;
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
          <p className="text-xs text-[#6B7B7B] mt-0.5">{subtitle}</p>
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

function OverviewTiles({ d }: { d: DashboardData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile
        label="Total Searches"
        value={d.overview.totalSearches.toLocaleString()}
        sub={`${d.searches.activeUsers} active users`}
        accent="cyan"
      />
      <StatTile
        label="GoWild Hit Rate"
        value={fmtPct(d.overview.goWildHitRate)}
        sub={`${d.searches.goWildHits.toLocaleString()} GoWild hits`}
        accent={d.overview.goWildHitRate >= 30 ? "emerald" : d.overview.goWildHitRate >= 10 ? "amber" : "rose"}
      />
      <StatTile
        label="Cache Rate"
        value={fmtPct(d.overview.cacheHitRate)}
        sub={`${d.cache.cacheHitCount} cache hits`}
        accent="indigo"
      />
      <StatTile
        label="Active Users"
        value={d.overview.activeUsers.toLocaleString()}
        sub={d.users.totalUsers != null ? `of ${d.users.totalUsers} total` : undefined}
        accent="emerald"
      />
    </div>
  );
}

// ─── Card: GoWild Availability Snapshot ───────────────────────────────────────

function GoWildAvailCard({ d }: { d: DashboardData }) {
  const { goWildAvail: ga } = d;
  const pct = ga.availabilityPct;
  const isHealthy = pct >= 40;
  const barColor = pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-rose-500";
  const textColor = pct >= 60 ? "text-emerald-600" : pct >= 30 ? "text-amber-600" : "text-rose-600";

  return (
    <CardShell>
      <CardTitle icon={Analytics01Icon} subtitle="Live availability across complete itineraries">GoWild Availability Snapshot</CardTitle>
      <div className="flex items-end gap-3 mb-3">
        <span className={`text-4xl font-black ${textColor}`}>{fmtPct(pct)}</span>
        <div className="pb-1">
          <Badge variant={pct >= 60 ? "emerald" : pct >= 30 ? "amber" : "rose"}>
            {pct >= 60 ? "Healthy" : pct >= 30 ? "Moderate" : "Low"}
          </Badge>
        </div>
      </div>
      <ProgressBar value={pct} colorClass={barColor} height={8} />
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Itineraries</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{ga.totalItineraries.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">GoWild</p>
          <p className="text-sm font-bold text-emerald-600">{ga.goWildItineraries.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Avg Seats</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{ga.avgSeats != null ? ga.avgSeats.toFixed(1) : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Seat Dist</p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            <Badge variant="rose">1-2: {ga.seatDistribution.low}</Badge>
            <Badge variant="amber">3-5: {ga.seatDistribution.medium}</Badge>
            <Badge variant="emerald">6+: {ga.seatDistribution.strong}</Badge>
          </div>
        </div>
      </div>
      {(ga.bestRoute || ga.worstRoute) && (
        <div className="mt-3 pt-3 border-t border-[#F0F1F1] flex flex-col gap-1.5">
          {ga.bestRoute && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Best</span>
              <span className="text-xs font-semibold text-[#2E4A4A]">{ga.bestRoute}</span>
            </div>
          )}
          {ga.worstRoute && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-rose-500 uppercase">Worst</span>
              <span className="text-xs font-semibold text-[#2E4A4A]">{ga.worstRoute}</span>
            </div>
          )}
        </div>
      )}
      {ga.totalItineraries === 0 && <EmptyState message="No snapshot data in this range." />}
    </CardShell>
  );
}

// ─── Card: GoWild Hits ────────────────────────────────────────────────────────

function GoWildHitsCard({ d }: { d: DashboardData }) {
  const { searches } = d;
  const rate = searches.goWildHitRate;
  const barColor = rate >= 30 ? "bg-emerald-500" : rate >= 10 ? "bg-amber-500" : "bg-rose-500";

  return (
    <CardShell>
      <CardTitle icon={ChartRoseIcon} subtitle="Searches that returned a GoWild fare">GoWild Hits</CardTitle>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-black text-emerald-600">{searches.goWildHits.toLocaleString()}</span>
        <span className="text-sm text-[#9CA3AF] pb-1">hits</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-[#2E4A4A]">{fmtPct(rate)} hit rate</span>
        <Badge variant={rate >= 30 ? "emerald" : rate >= 10 ? "amber" : "rose"}>
          {rate >= 30 ? "Strong" : rate >= 10 ? "Moderate" : "Low"}
        </Badge>
      </div>
      <ProgressBar value={rate} colorClass={barColor} height={6} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">No GoWild</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{(searches.total - searches.goWildHits).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Total Searches</p>
          <p className="text-sm font-bold text-[#2E4A4A]">{searches.total.toLocaleString()}</p>
        </div>
      </div>
      {searches.total === 0 && <EmptyState message="No flight searches found for this range." />}
    </CardShell>
  );
}

// ─── Card: Average GoWild Seats ───────────────────────────────────────────────

function AvgGoWildSeatsCard({ d }: { d: DashboardData }) {
  const { goWildAvail: ga } = d;
  const totalSeats = ga.seatDistribution.low + ga.seatDistribution.medium + ga.seatDistribution.strong;

  return (
    <CardShell>
      <CardTitle icon={Layers01Icon} subtitle="Bottleneck seat distribution per itinerary">Average GoWild Seats</CardTitle>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-4xl font-black text-cyan-600">
          {ga.avgSeats != null ? ga.avgSeats.toFixed(1) : "—"}
        </span>
        <span className="text-sm text-[#9CA3AF] pb-1">avg seats</span>
      </div>
      {totalSeats > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-16 text-[10px] font-bold text-rose-500">Low (1–2)</div>
            <div className="flex-1">
              <ProgressBar value={ga.seatDistribution.low} max={totalSeats} colorClass="bg-rose-400" height={5} />
            </div>
            <div className="text-[10px] font-semibold text-[#9CA3AF] w-8 text-right">{ga.seatDistribution.low}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 text-[10px] font-bold text-amber-500">Mid (3–5)</div>
            <div className="flex-1">
              <ProgressBar value={ga.seatDistribution.medium} max={totalSeats} colorClass="bg-amber-400" height={5} />
            </div>
            <div className="text-[10px] font-semibold text-[#9CA3AF] w-8 text-right">{ga.seatDistribution.medium}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 text-[10px] font-bold text-emerald-600">High (6+)</div>
            <div className="flex-1">
              <ProgressBar value={ga.seatDistribution.strong} max={totalSeats} colorClass="bg-emerald-500" height={5} />
            </div>
            <div className="text-[10px] font-semibold text-[#9CA3AF] w-8 text-right">{ga.seatDistribution.strong}</div>
          </div>
        </div>
      ) : (
        <EmptyState message="No GoWild snapshot seat data available." />
      )}
    </CardShell>
  );
}

// ─── Card: Estimated GoWild Savings ──────────────────────────────────────────

function EstimatedSavingsCard({ d }: { d: DashboardData }) {
  const { savings } = d;
  return (
    <CardShell>
      <CardTitle icon={Coins01Icon} subtitle="Dollars saved vs standard fares">Estimated GoWild Savings</CardTitle>
      {savings.itinerariesWithSavings === 0 ? (
        <EmptyState message="Savings cannot be calculated because fare fields are missing or no GoWild fares were observed." />
      ) : (
        <>
          <div className="flex items-end gap-2 mb-1">
            <span className="text-4xl font-black text-emerald-600">{fmtCur(savings.totalSavings)}</span>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-3">across {savings.itinerariesWithSavings} itineraries</p>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#F0F1F1]">
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Avg per Itinerary</p>
              <p className="text-sm font-bold text-[#2E4A4A]">{fmtCur(savings.avgSavings)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Max Savings</p>
              <p className="text-sm font-bold text-[#2E4A4A]">{fmtCur(savings.maxSavings)}</p>
            </div>
            {savings.topSavingsRoute && (
              <div className="col-span-2">
                <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Top Savings Route</p>
                <p className="text-sm font-bold text-emerald-600">{savings.topSavingsRoute}</p>
              </div>
            )}
          </div>
        </>
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

// ─── Card: Funnel ─────────────────────────────────────────────────────────────

function FunnelCard({ d }: { d: DashboardData }) {
  const { funnel } = d;
  const steps = [
    { label: "Total Searches", count: funnel.totalSearches, color: "bg-cyan-500" },
    { label: "GoWild Hits", count: funnel.goWildHits, color: "bg-emerald-500" },
    { label: "Saved Flights", count: funnel.savedFlights, color: "bg-indigo-500" },
  ];
  const max = funnel.totalSearches || 1;

  return (
    <CardShell>
      <CardTitle icon={FilterIcon} subtitle="Conversion from search to saved flight">Searches → Saved Flights Funnel</CardTitle>
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#2E4A4A]">{step.label}</span>
              <span className="text-sm font-black text-[#1A2E2E]">{step.count.toLocaleString()}</span>
            </div>
            <ProgressBar value={step.count} max={max} colorClass={step.color} height={10} />
            {i < steps.length - 1 && (
              <div className="flex justify-end mt-1">
                <span className="text-[10px] text-[#9CA3AF] font-semibold">
                  {steps[i + 1].count > 0 && step.count > 0
                    ? `${((steps[i + 1].count / step.count) * 100).toFixed(1)}% →`
                    : "—"}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="pt-3 mt-2 border-t border-[#F0F1F1] grid grid-cols-2 gap-2">
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
    <div className="flex flex-col gap-5">
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
        <div className="flex flex-col gap-5">
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
