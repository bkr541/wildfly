import { useMemo, useState } from "react";
import { format, parseISO, formatDistanceToNowStrict } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  SquareArrowUpDownIcon,
  Copy01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { FlightSearchRow } from "@/components/admin/FlightSearchDetailDrawer";
import {
  getFreshnessStatus,
  getResultSourceBadgeClass,
  formatCurrency,
  formatNumber,
} from "@/components/admin/FlightSearchDetailDrawer";
import type { FlightSearchSnapshotSummary, ColumnKey, ColumnDef } from "./types";
import { ALL_COLUMN_DEFS } from "./types";
import { GoWildSignalMini } from "./GoWildSignalMini";
import {
  formatRouteLabel,
  formatSourceLabel,
  formatTripTypeLabel,
  sortFlights,
  type SortKey,
  type SortDirection,
} from "./flightSearchMetrics";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try { return format(parseISO(v), "MMM d, yyyy"); } catch { return v; }
}

function fmtRelative(v: string | null): string {
  if (!v) return "—";
  try { return formatDistanceToNowStrict(parseISO(v)) + " ago"; } catch { return "—"; }
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
}

// ── Freshness badge ───────────────────────────────────────────────────────────

const FRESHNESS_BADGE_CLS: Record<string, string> = {
  fresh:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  recent:  "bg-cyan-100 text-cyan-700 border-cyan-200",
  aging:   "bg-amber-100 text-amber-700 border-amber-200",
  stale:   "bg-rose-100 text-rose-700 border-rose-200",
  unknown: "bg-gray-100 text-gray-500 border-gray-200",
};

// ── Source badge (reuse existing) ─────────────────────────────────────────────

function SourceBadge({ row }: { row: FlightSearchRow }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        getResultSourceBadgeClass(row.result_source ?? row.triggered_by),
      )}
    >
      {formatSourceLabel(row)}
    </span>
  );
}

// ── User cell (initials avatar + id) ─────────────────────────────────────────

function UserCell({ row }: { row: FlightSearchRow }) {
  const isAdmin = (row.triggered_by ?? "").toLowerCase().includes("admin") ||
                  (row.result_source ?? "").toLowerCase().includes("admin");
  const isScheduled = (row.triggered_by ?? "").toLowerCase().includes("schedul") ||
                      (row.result_source ?? "").toLowerCase().includes("schedul");

  if (isAdmin) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white bg-amber-500">A</span>
        <span className="text-[10px] font-semibold text-amber-600 truncate">Admin Bulk</span>
      </div>
    );
  }
  if (isScheduled) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white bg-violet-500">S</span>
        <span className="text-[10px] font-semibold text-violet-600 truncate">Scheduled</span>
      </div>
    );
  }
  const letter = (row.user_id?.[0] ?? "U").toUpperCase();
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
        style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
      >
        {letter}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-[#7A8B8A] font-mono truncate leading-tight" title={row.user_id}>
          {row.user_id.slice(0, 8)}…
        </p>
      </div>
    </div>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <div className="flex gap-3 px-4 py-3 animate-pulse border-b border-[#F0F1F1]">
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className="rounded bg-[#F0F1F1]"
          style={{ height: 14, flex: i === 0 ? "2 2 0" : "1 1 0" }}
        />
      ))}
    </div>
  );
}

// ── Sortable column header ─────────────────────────────────────────────────────

interface SortableHeaderProps {
  children: React.ReactNode;
  sortKey?: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDirection;
  onSort: (k: SortKey) => void;
}

function SortableHeader({ children, sortKey, currentKey, currentDir, onSort }: SortableHeaderProps) {
  const active = sortKey != null && currentKey === sortKey;
  return (
    <button
      onClick={() => sortKey && onSort(sortKey)}
      disabled={!sortKey}
      className={cn(
        "flex items-center gap-1 text-left text-[10px] font-semibold uppercase tracking-wide transition-colors",
        sortKey ? "cursor-pointer hover:text-[#2E4A4A]" : "cursor-default",
        active ? "text-emerald-600" : "text-[#9CA3AF]",
      )}
    >
      {children}
      {sortKey && (
        <span className={cn("opacity-40", active && "opacity-100")}>
          <HugeiconsIcon icon={SquareArrowUpDownIcon} size={10} color="currentColor" strokeWidth={2} />
        </span>
      )}
    </button>
  );
}

// ── Row actions (copy menu) ───────────────────────────────────────────────────

function RowActions({ row, onSelect }: { row: FlightSearchRow; onSelect: (f: FlightSearchRow) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 justify-end">
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors opacity-0 group-hover:opacity-100"
          aria-label="More actions"
        >
          <span className="text-lg leading-none tracking-tighter" style={{ letterSpacing: "-0.05em", fontSize: 13 }}>•••</span>
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-50 rounded-xl bg-white border border-[#E3EBE8] shadow-xl py-1 w-44"
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: "View details", action: () => { setMenuOpen(false); onSelect(row); } },
              { label: "Copy Search ID", action: () => { copy(row.id); setMenuOpen(false); } },
              { label: "Copy User ID", action: () => { copy(row.user_id); setMenuOpen(false); } },
              { label: "Export row JSON", action: () => {
                const blob = new Blob([JSON.stringify(row, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `search-${row.id.slice(0, 8)}.json`;
                a.click();
                setMenuOpen(false);
              }},
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                className="w-full px-3 py-1.5 text-left text-xs text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single table row ──────────────────────────────────────────────────────────

interface RowProps {
  row: FlightSearchRow;
  summary: FlightSearchSnapshotSummary | null;
  visibleCols: Set<ColumnKey>;
  gridTemplate: string;
  onSelect: (f: FlightSearchRow) => void;
}

function FlightRow({ row, summary, visibleCols, gridTemplate, onSelect }: RowProps) {
  const isAllDest = row.all_destinations === "Yes";
  const freshness = getFreshnessStatus(row.provider_observed_at ?? row.created_at ?? row.search_timestamp);

  const rowTint = freshness === "stale"
    ? "bg-rose-50/40"
    : freshness === "aging"
    ? "bg-amber-50/30"
    : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(row)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(row); } }}
      className={cn(
        "grid gap-3 px-4 py-3 items-center cursor-pointer transition-colors group focus:outline-none",
        "hover:bg-[#F1FAF6] focus:bg-[#F1FAF6] border-b border-[#F0F1F1]",
        rowTint,
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {/* Route */}
      {visibleCols.has("route") && (
        <div className="flex items-center min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#102625] font-mono leading-tight truncate">
              {isAllDest
                ? `${row.departure_airport} → All Destinations`
                : `${row.departure_airport} → ${row.arrival_airport ?? "—"}`}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-[#9CA3AF] font-mono truncate" title={row.id}>
                {row.id.slice(0, 8)}…
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); copy(row.id); }}
                className="text-[#9CA3AF] hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                aria-label="Copy search ID"
              >
                <HugeiconsIcon icon={Copy01Icon} size={9} color="currentColor" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User */}
      {visibleCols.has("user") && <UserCell row={row} />}

      {/* Departure date */}
      {visibleCols.has("departure") && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[#2E4A4A] leading-tight">{fmtDate(row.departure_date)}</span>
          {row.return_date && (
            <span className="text-[10px] text-[#9CA3AF]">↩ {fmtDate(row.return_date)}</span>
          )}
        </div>
      )}

      {/* Trip type */}
      {visibleCols.has("trip") && (
        <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-slate-100 text-slate-600 border-slate-200 capitalize">
          {formatTripTypeLabel(row)}
        </span>
      )}

      {/* Source */}
      {visibleCols.has("source") && (
        <div className="min-w-0">
          <SourceBadge row={row} />
        </div>
      )}

      {/* GoWild signal */}
      {visibleCols.has("gowild_signal") && (
        <GoWildSignalMini goWildFound={row.gowild_found} summary={summary} />
      )}

      {/* Results / quality */}
      {visibleCols.has("results_quality") && (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-semibold text-[#2E4A4A]">
            {row.flight_results_count != null ? `${row.flight_results_count} results` : "—"}
          </span>
          {summary && summary.unique_itineraries > 0 && (
            <div className="text-[10px] text-[#9CA3AF] leading-tight">
              {summary.unique_itineraries} itins
              {summary.nonstop_count > 0 ? ` · ${summary.nonstop_count} nonstop` : ""}
              {isAllDest && summary.best_destination ? ` · ${summary.best_destination}` : ""}
              {summary.avg_savings != null && summary.avg_savings > 0
                ? ` · +$${Math.round(summary.avg_savings)}`
                : ""}
            </div>
          )}
        </div>
      )}

      {/* Freshness */}
      {visibleCols.has("freshness") && (
        <div className="flex flex-col gap-0.5">
          <span className={cn("inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", FRESHNESS_BADGE_CLS[freshness] ?? FRESHNESS_BADGE_CLS.unknown)}>
            {freshness}
          </span>
          <span className="text-[10px] text-[#9CA3AF]">{fmtRelative(row.search_timestamp)}</span>
        </div>
      )}

      {/* Optional columns */}
      {visibleCols.has("search_id") && (
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] font-mono text-[#9CA3AF] truncate">{row.id.slice(0, 12)}…</span>
          <button onClick={(e) => { e.stopPropagation(); copy(row.id); }} className="text-[#9CA3AF] hover:text-emerald-600 flex-shrink-0">
            <HugeiconsIcon icon={Copy01Icon} size={9} color="currentColor" strokeWidth={2} />
          </button>
        </div>
      )}
      {visibleCols.has("return_date") && (
        <span className="text-xs text-[#7A8B8A]">{fmtDate(row.return_date)}</span>
      )}
      {visibleCols.has("triggered_by") && (
        <span className="text-[10px] text-[#9CA3AF] truncate">{row.triggered_by ?? "—"}</span>
      )}
      {visibleCols.has("credits_cost") && (
        <span className="text-xs text-[#7A8B8A]">{row.credits_cost != null ? row.credits_cost : "—"}</span>
      )}
      {visibleCols.has("snapshot_count") && (
        <span className="text-xs text-[#7A8B8A]">{summary?.snapshot_rows ?? "—"}</span>
      )}
      {visibleCols.has("avg_savings") && (
        <span className="text-xs text-emerald-600 font-medium">
          {summary?.avg_savings != null && summary.avg_savings > 0 ? `+${formatCurrency(summary.avg_savings)}` : "—"}
        </span>
      )}
      {visibleCols.has("avg_seats") && (
        <span className="text-xs text-[#7A8B8A]">
          {summary?.avg_gowild_seats != null ? formatNumber(summary.avg_gowild_seats, 1) : "—"}
        </span>
      )}
      {visibleCols.has("best_destination") && (
        <span className="text-xs font-medium text-cyan-600">{summary?.best_destination ?? "—"}</span>
      )}

      {/* Actions */}
      {visibleCols.has("actions") && (
        <RowActions row={row} onSelect={onSelect} />
      )}
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function MobileCard({ row, summary, onSelect }: { row: FlightSearchRow; summary: FlightSearchSnapshotSummary | null; onSelect: (f: FlightSearchRow) => void }) {
  const isAllDest = row.all_destinations === "Yes";
  const freshness = getFreshnessStatus(row.provider_observed_at ?? row.created_at ?? row.search_timestamp);

  return (
    <button
      onClick={() => onSelect(row)}
      className={cn(
        "w-full text-left rounded-2xl border border-[#E3EBE8] bg-white px-4 py-3.5 hover:bg-[#F1FAF6] hover:border-emerald-200 transition-colors",
        "focus:outline-none focus:bg-[#F1FAF6]",
        freshness === "stale" ? "border-l-4 border-l-rose-400" : freshness === "aging" ? "border-l-4 border-l-amber-400" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#102625] font-mono leading-tight">
            {row.departure_airport}
            <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="#9CA3AF" strokeWidth={2} className="inline mx-1" />
            {isAllDest ? "All Destinations" : (row.arrival_airport ?? "—")}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <SourceBadge row={row} />
            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border", FRESHNESS_BADGE_CLS[freshness])}>
              {freshness}
            </span>
            {row.gowild_found ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">GoWild Found</span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-gray-100 text-gray-500 border-gray-200">No GoWild</span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-[#7A8B8A] flex flex-wrap gap-x-2 gap-y-0.5">
            <span>{formatTripTypeLabel(row)}</span>
            {row.flight_results_count != null && <span>· {row.flight_results_count} results</span>}
            {summary?.gowild_itineraries != null && summary.gowild_itineraries > 0 && (
              <span className="text-emerald-600">· {summary.gowild_itineraries}/{summary.unique_itineraries} GoWild</span>
            )}
            {summary?.avg_savings != null && summary.avg_savings > 0 && (
              <span className="text-emerald-600">· +${Math.round(summary.avg_savings)} avg</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-[#9CA3AF]">{fmtDate(row.departure_date)}</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 font-semibold">View →</span>
        </div>
      </div>
    </button>
  );
}

// ── Main table component ──────────────────────────────────────────────────────

interface FlightSearchTableProps {
  flights: FlightSearchRow[];
  snapshotSummaries: Record<string, FlightSearchSnapshotSummary>;
  visibleColumns: ColumnKey[];
  loading: boolean;
  isFiltered: boolean;
  onSelect: (f: FlightSearchRow) => void;
  onClearFilters: () => void;
  pagination?: React.ReactNode;
}

export function FlightSearchTable({
  flights,
  snapshotSummaries,
  visibleColumns,
  loading,
  isFiltered,
  onSelect,
  onClearFilters,
  pagination,
}: FlightSearchTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>("search_timestamp");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const handleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const visibleColSet = useMemo(() => new Set<ColumnKey>(visibleColumns), [visibleColumns]);

  // Build visible column defs in order
  const activeCols = useMemo(() =>
    ALL_COLUMN_DEFS.filter(c => visibleColSet.has(c.key)),
    [visibleColSet],
  );

  // Grid template from widths
  const gridTemplate = activeCols.map(c => c.width).join(" ");

  // Sorted flights
  const sortedFlights = useMemo(() =>
    sortKey ? sortFlights(flights, sortKey, sortDir) : flights,
    [flights, sortKey, sortDir],
  );

  // Column sortKey map
  const SORT_KEY_MAP: Partial<Record<ColumnKey, SortKey>> = {
    departure: "departure_date",
    freshness: "freshness",
    gowild_signal: "gowild_found",
    results_quality: "flight_results_count",
    source: "result_source",
    route: "departure_airport",
  };

  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden bg-white border border-[#E3EBE8]" style={{ boxShadow: "0 1px 4px rgba(16,38,37,0.06)" }}>
        <div className="px-4 py-2.5 border-b border-[#F0F1F1] bg-[#F8F9F9]" style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: "12px" }}>
          {activeCols.map(c => <div key={c.key} className="h-3 w-16 rounded bg-[#F0F1F1] animate-pulse" />)}
        </div>
        {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={activeCols.length} />)}
      </div>
    );
  }

  if (flights.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-[#E3EBE8] flex flex-col items-center gap-3 py-16 text-center px-6" style={{ boxShadow: "0 1px 4px rgba(16,38,37,0.06)" }}>
        <div className="h-12 w-12 rounded-full bg-[#F0FDF4] flex items-center justify-center">
          <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={22} color="#059669" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-semibold text-[#2E4A4A]">
          {isFiltered ? "No flight searches match these filters" : "No flight searches yet"}
        </p>
        <p className="text-xs text-[#9CA3AF] max-w-xs">
          {isFiltered
            ? "Try expanding the date range, changing the source, or clearing some filters."
            : "Flight searches will appear here once users start searching."}
        </p>
        {isFiltered && (
          <button
            onClick={onClearFilters}
            className="mt-1 px-4 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-[#E3EBE8]" style={{ boxShadow: "0 1px 4px rgba(16,38,37,0.06)" }}>
      {/* Desktop table */}
      <div className="hidden md:block">
        {/* Header */}
        <div
          className="px-4 py-2.5 border-b border-[#F0F1F1] bg-[#F8F9F9]"
          style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: "12px" }}
        >
          {activeCols.map((col) => (
            <SortableHeader
              key={col.key}
              sortKey={SORT_KEY_MAP[col.key]}
              currentKey={sortKey}
              currentDir={sortDir}
              onSort={handleSort}
            >
              {col.label}
            </SortableHeader>
          ))}
        </div>

        {/* Rows */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 380px)" }}>
          {sortedFlights.map((f) => (
            <FlightRow
              key={f.id}
              row={f}
              summary={snapshotSummaries[f.id] ?? null}
              visibleCols={visibleColSet}
              gridTemplate={gridTemplate}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {sortedFlights.map((f) => (
          <MobileCard
            key={f.id}
            row={f}
            summary={snapshotSummaries[f.id] ?? null}
            onSelect={onSelect}
          />
        ))}
      </div>

      {pagination}
    </div>
  );
}
