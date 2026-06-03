import { useMemo } from "react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import type { FlightSearchSnapshotSummary } from "./types";
import {
  getResultSourceLabel,
  getResultSourceBadgeClass,
  getGoWildBadgeClass,
  getFreshnessStatus,
  formatCurrency,
} from "@/components/admin/FlightSearchDetailDrawer";
import type { FlightSearchRow } from "@/components/admin/FlightSearchDetailDrawer";

// ── Freshness badge helper ─────────────────────────────────────────────────────

const FRESHNESS_BADGE: Record<string, string> = {
  fresh: "bg-emerald-100 text-emerald-700 border-emerald-200",
  recent: "bg-cyan-100 text-cyan-700 border-cyan-200",
  aging: "bg-amber-100 text-amber-700 border-amber-200",
  stale: "bg-rose-100 text-rose-700 border-rose-200",
  unknown: "bg-gray-100 text-gray-600 border-gray-200",
};

// ── Day group header label ─────────────────────────────────────────────────────

function dayLabel(iso: string): string {
  try {
    const d = parseISO(iso);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMM d, yyyy");
  } catch {
    return iso.slice(0, 10);
  }
}

function timeLabel(iso: string): string {
  try { return format(parseISO(iso), "h:mm a"); } catch { return "—"; }
}

function tripLabel(t: string): string {
  const s = (t || "").toLowerCase();
  if (s.includes("round")) return "Round-trip";
  if (s.includes("one")) return "One-way";
  if (s.includes("day")) return "Day trip";
  if (s.includes("plan")) return "Planner";
  return t || "—";
}

// ── Status dot color ──────────────────────────────────────────────────────────

function statusDotColor(found: boolean | null, freshness: string): string {
  if (found && (freshness === "fresh" || freshness === "recent")) return "bg-emerald-500";
  if (found) return "bg-cyan-500";
  if (freshness === "stale") return "bg-rose-400";
  return "bg-[#D1D5DB]";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  flights: FlightSearchRow[];
  snapshotSummaries: Record<string, FlightSearchSnapshotSummary>;
  onSelect: (f: FlightSearchRow) => void;
}

export function FlightSearchTimeline({ flights, snapshotSummaries, onSelect }: Props) {
  // Group by calendar day (YYYY-MM-DD from search_timestamp)
  const groups = useMemo(() => {
    const map = new Map<string, FlightSearchRow[]>();
    for (const f of flights) {
      const day = (f.search_timestamp ?? "").slice(0, 10) || "unknown";
      const arr = map.get(day) ?? [];
      arr.push(f);
      map.set(day, arr);
    }
    // Return sorted descending by day
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [flights]);

  if (flights.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([day, items]) => (
        <div key={day}>
          {/* Day header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wide">
              {dayLabel(day + "T00:00:00")}
            </span>
            <div className="flex-1 h-px bg-[#F0F1F1]" />
            <span className="text-[10px] text-[#9CA3AF]">{items.length} search{items.length !== 1 ? "es" : ""}</span>
          </div>

          {/* Timeline items */}
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#E8EEEE]" />

            <div className="flex flex-col gap-2">
              {items.map((f) => {
                const isAllDest = f.all_destinations === "Yes";
                const isAdmin = f.triggered_by === "admin_bulk_search";
                const sourceLbl = getResultSourceLabel(f.result_source ?? f.triggered_by);
                const freshness = getFreshnessStatus(f.provider_observed_at ?? f.created_at ?? f.search_timestamp);
                const summary = snapshotSummaries[f.id];
                const dotColor = statusDotColor(f.gowild_found ?? null, freshness);

                return (
                  <button
                    key={f.id}
                    onClick={() => onSelect(f)}
                    className="relative group text-left rounded-2xl border border-[#F0F1F1] bg-white/80 px-4 py-3 hover:bg-[#F1FAF6] hover:border-emerald-200 transition-colors focus:outline-none focus:bg-[#F1FAF6] focus:border-emerald-300"
                    aria-label={`Flight search ${f.departure_airport} to ${isAllDest ? "all destinations" : (f.arrival_airport ?? "all")}`}
                  >
                    {/* Status dot on timeline */}
                    <span
                      className={`absolute -left-[18px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white ${dotColor}`}
                    />

                    <div className="flex items-start gap-3">
                      {/* Time */}
                      <span className="text-xs font-semibold text-[#9CA3AF] w-16 flex-shrink-0 mt-0.5">
                        {timeLabel(f.search_timestamp)}
                      </span>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        {/* Route + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#1A2E2E] font-mono">
                            {f.departure_airport} → {isAllDest ? "ALL" : (f.arrival_airport ?? "ALL")}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${getResultSourceBadgeClass(f.result_source ?? f.triggered_by)}`}>
                            {sourceLbl}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${getGoWildBadgeClass(f.gowild_found)}`}>
                            {f.gowild_found ? "GoWild Found" : "No GoWild"}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${FRESHNESS_BADGE[freshness] ?? FRESHNESS_BADGE.unknown}`}>
                            {freshness}
                          </span>
                        </div>

                        {/* Detail line */}
                        <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-[#6B7B7B]">
                          <span>{tripLabel(f.trip_type)}</span>
                          <span>·</span>
                          <span>{f.flight_results_count != null ? `${f.flight_results_count} results` : "—"}</span>
                          {isAdmin
                            ? <><span>·</span><span className="text-amber-600 font-semibold">admin bulk</span></>
                            : <><span>·</span><span className="font-mono">{f.user_id.slice(0, 8)}…</span></>
                          }
                          {f.departure_date && (
                            <><span>·</span><span>Departs {f.departure_date}</span></>
                          )}
                        </div>

                        {/* Snapshot summary line */}
                        {summary && (
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                            {summary.gowild_itineraries > 0 && (
                              <span className="text-emerald-600 font-semibold">
                                {summary.gowild_itineraries}/{summary.unique_itineraries} GoWild
                                {summary.avg_gowild_seats != null
                                  ? ` · ${summary.avg_gowild_seats.toFixed(1)} avg seats`
                                  : ""}
                              </span>
                            )}
                            {summary.avg_savings != null && summary.avg_savings > 0 && (
                              <span className="text-emerald-600">+{formatCurrency(summary.avg_savings)} avg savings</span>
                            )}
                            {isAllDest && summary.best_destination && (
                              <span className="text-cyan-600 font-medium">Best: {summary.best_destination}</span>
                            )}
                            {(summary.nonstop_count > 0 || summary.connecting_count > 0) && (
                              <span className="text-[#9CA3AF]">
                                {summary.nonstop_count > 0 ? `${summary.nonstop_count} nonstop` : ""}
                                {summary.nonstop_count > 0 && summary.connecting_count > 0 ? " · " : ""}
                                {summary.connecting_count > 0 ? `${summary.connecting_count} connect` : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* View arrow on hover */}
                      <span className="text-[10px] font-semibold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                        View →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
