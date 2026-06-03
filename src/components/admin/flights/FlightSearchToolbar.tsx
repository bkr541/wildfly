import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Cancel01Icon,
  FilterMailSquareIcon,
  ArrowReloadHorizontalIcon,
  GridViewIcon,
  ListViewIcon,
  Analytics01Icon,
  Layout01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { FlightSearchFiltersState, FlightSearchViewMode, ColumnKey } from "./types";
import { ALL_COLUMN_DEFS } from "./types";
import { countActiveFilters } from "./types";
import {
  SAVED_VIEWS,
  getActiveViewId,
  getTopOrigins,
  getFreshnessBreakdown,
} from "./flightSearchMetrics";
import type { FlightSearchSnapshotSummary } from "./types";
import type { FlightSearchRow } from "@/components/admin/FlightSearchDetailDrawer";
import { FlightSearchFilters } from "./FlightSearchFilters";

// ── Analytics panel (inline, collapsible) ─────────────────────────────────────

interface AnalyticsPanelProps {
  flights: FlightSearchRow[];
  snapshotSummaries: Record<string, FlightSearchSnapshotSummary>;
}

const FRESHNESS_CONFIG = [
  { key: "fresh",   label: "Fresh",   color: "#059669", bgColor: "#D1FAE5" },
  { key: "recent",  label: "Recent",  color: "#0891B2", bgColor: "#CFFAFE" },
  { key: "aging",   label: "Aging",   color: "#D97706", bgColor: "#FEF3C7" },
  { key: "stale",   label: "Stale",   color: "#E11D48", bgColor: "#FFE4E6" },
  { key: "unknown", label: "Unknown", color: "#9CA3AF", bgColor: "#F3F4F6" },
] as const;

function AnalyticsPanel({ flights, snapshotSummaries }: AnalyticsPanelProps) {
  const topOrigins = getTopOrigins(flights);
  const freshness = getFreshnessBreakdown(flights);
  const total = flights.length;

  // Derive insight
  let insightText = "";
  if (total === 0) {
    insightText = "No visible searches to analyze.";
  } else {
    const topOri = topOrigins[0];
    if (topOri && topOri.goWildRate > 0) {
      insightText = `${topOri.iata} shows the strongest visible GoWild signal with ${(topOri.goWildRate * 100).toFixed(1)}% of visible searches finding GoWild.`;
    }
    const staleCount = freshness.aging + freshness.stale;
    if (staleCount / total >= 0.1 && !insightText) {
      insightText = `${((staleCount / total) * 100).toFixed(1)}% of visible searches are aging or stale and may need a refresh.`;
    }
    if (!insightText) insightText = `${total} flight searches visible — GoWild found in ${topOrigins.filter(o => o.goWildCount > 0).length} of ${topOrigins.length} top origins.`;
  }

  const maxOriginCount = topOrigins[0]?.count ?? 1;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-3 border-t border-[#F0F1F1]">
      {/* Insight line */}
      <div className="sm:col-span-3">
        <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mr-1.5">Insight</span>
          {insightText}
          {total > 0 && <span className="text-[10px] text-emerald-400 ml-1">(current page)</span>}
        </p>
      </div>

      {/* Top Origins */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide">Top Origins</p>
        {topOrigins.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">No data</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {topOrigins.slice(0, 6).map((o) => (
              <div key={o.iata} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#2E4A4A] w-10 flex-shrink-0 font-mono">{o.iata}</span>
                <div className="flex-1 h-3 bg-[#F0F1F1] rounded-full overflow-hidden relative">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{
                      width: `${(o.count / maxOriginCount) * 100}%`,
                      background: "linear-gradient(90deg, #059669, #10b981)",
                    }}
                  />
                  {o.goWildCount > 0 && (
                    <div
                      className="absolute left-0 top-0 h-full rounded-full opacity-60"
                      style={{
                        width: `${(o.goWildCount / maxOriginCount) * 100}%`,
                        background: "linear-gradient(90deg, #10b981, #34d399)",
                      }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-[#9CA3AF] w-6 text-right flex-shrink-0">{o.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Freshness Breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide">Freshness Breakdown</p>
        <div className="flex flex-col gap-1.5">
          {FRESHNESS_CONFIG.map(({ key, label, color, bgColor }) => {
            const count = freshness[key as keyof typeof freshness];
            const pct = total ? (count / total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold w-14 flex-shrink-0" style={{ color }}>{label}</span>
                <div className="flex-1 h-2.5 bg-[#F0F1F1] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-[10px] text-[#9CA3AF] w-7 text-right flex-shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Donut / summary strip */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide">Quick Stats</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Visible", value: total.toString() },
            { label: "GoWild", value: flights.filter(f => f.gowild_found).length.toString() },
            { label: "All Dest", value: flights.filter(f => f.all_destinations === "Yes").length.toString() },
            { label: "Fresh", value: freshness.fresh.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-[#F8F9F9] border border-[#F0F1F1] px-2.5 py-2">
              <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
              <p className="text-base font-black text-[#1A2E2E] leading-tight">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Column picker popover ─────────────────────────────────────────────────────

interface ColumnPickerProps {
  visibleColumns: ColumnKey[];
  onToggle: (key: ColumnKey) => void;
}

function ColumnPicker({ visibleColumns, onToggle }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const optionalCols = ALL_COLUMN_DEFS.filter(c => c.optional);
  const requiredCols = ALL_COLUMN_DEFS.filter(c => !c.optional && c.key !== "actions");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle columns"
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors",
          open ? "bg-[#F2F3F3] text-emerald-600" : "text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]",
        )}
      >
        <HugeiconsIcon icon={Layout01Icon} size={15} color="currentColor" strokeWidth={2} />
        <span>Columns</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl bg-white border border-[#E3EBE8] shadow-xl p-3 w-56"
          style={{ boxShadow: "0 8px 32px 0 rgba(16,38,37,0.12)" }}
        >
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-2 px-1">Required</p>
          <div className="flex flex-col gap-0.5 mb-3">
            {requiredCols.map(col => (
              <div key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg opacity-60">
                <span className="w-3 h-3 rounded-sm border border-[#9CA3AF] bg-[#F2F3F3] flex-shrink-0" />
                <span className="text-xs text-[#6B7B7B]">{col.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-2 px-1">Optional</p>
          <div className="flex flex-col gap-0.5">
            {optionalCols.map(col => {
              const checked = visibleColumns.includes(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => onToggle(col.key)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#F2F3F3] transition-colors text-left w-full"
                >
                  <span
                    className={cn(
                      "w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center",
                      checked
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-[#D1D5DB] bg-white",
                    )}
                  >
                    {checked && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-xs text-[#2E4A4A]">{col.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main toolbar ──────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

interface ToolbarProps {
  filters: FlightSearchFiltersState;
  viewMode: FlightSearchViewMode;
  visibleColumns: ColumnKey[];
  loading: boolean;
  total: number;
  isFiltered: boolean;
  updatedLabel: string | null;
  flights: FlightSearchRow[];
  snapshotSummaries: Record<string, FlightSearchSnapshotSummary>;
  onSearchChange: (v: string) => void;
  onFilterChange: (patch: Partial<FlightSearchFiltersState>) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onViewModeChange: (m: FlightSearchViewMode) => void;
  onColumnToggle: (key: ColumnKey) => void;
}

export function FlightSearchToolbar({
  filters, viewMode, visibleColumns, loading, total, isFiltered, updatedLabel,
  flights, snapshotSummaries,
  onSearchChange, onFilterChange, onClearFilters, onRefresh, onViewModeChange, onColumnToggle,
}: ToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const activeFilterCount = countActiveFilters(filters);
  const activeViewId = getActiveViewId(filters);

  return (
    <div className="flex flex-col gap-2">
      {/* ── Main toolbar card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl px-4 py-3 flex flex-col gap-3" style={CARD_STYLE}>
        {/* Row 1: Search + controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9 flex-1 min-w-[180px] max-w-md">
            <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search routes, users, or search ID…"
              aria-label="Search flight searches"
              className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
            />
            {filters.search && (
              <button onClick={() => onSearchChange("")} aria-label="Clear search" className="text-[#9CA3AF] hover:text-[#6B7B7B]">
                <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Quick filters */}
          <select
            value={filters.goWildStatus}
            onChange={(e) => onFilterChange({ goWildStatus: e.target.value as FlightSearchFiltersState["goWildStatus"] })}
            aria-label="GoWild filter"
            className="h-9 bg-[#F2F3F3] rounded-xl px-2.5 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
          >
            <option value="all">All GoWild</option>
            <option value="found">GoWild Found</option>
            <option value="not_found">No GoWild</option>
          </select>

          <select
            value={filters.freshness}
            onChange={(e) => onFilterChange({ freshness: e.target.value as FlightSearchFiltersState["freshness"] })}
            aria-label="Freshness filter"
            className="h-9 bg-[#F2F3F3] rounded-xl px-2.5 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
          >
            <option value="all">All Freshness</option>
            <option value="fresh">Fresh</option>
            <option value="recent">Recent</option>
            <option value="aging">Aging</option>
            <option value="stale">Stale</option>
          </select>

          <select
            value={filters.resultSource}
            onChange={(e) => onFilterChange({ resultSource: e.target.value })}
            aria-label="Source filter"
            className="h-9 bg-[#F2F3F3] rounded-xl px-2.5 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer hidden sm:block"
          >
            <option value="">All Sources</option>
            <option value="cache">Cache Hit</option>
            <option value="admin_bulk">Admin Bulk</option>
            <option value="schedul">Scheduled Scan</option>
            <option value="provider">Live API</option>
          </select>

          {/* More filters */}
          <button
            onClick={() => setAdvancedOpen(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-xl text-xs font-semibold transition-colors",
              activeFilterCount > 0
                ? "bg-[#345C5A] text-white"
                : advancedOpen
                ? "bg-[#F2F3F3] text-emerald-600"
                : "text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]",
            )}
          >
            <HugeiconsIcon icon={FilterMailSquareIcon} size={15} color="currentColor" strokeWidth={2} />
            <span>More</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#345C5A] text-[9px] font-bold flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Analytics toggle */}
          <button
            onClick={() => setAnalyticsOpen(v => !v)}
            aria-label="Toggle analytics"
            title="Analytics panel"
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-xl transition-colors",
              analyticsOpen
                ? "bg-emerald-50 text-emerald-600"
                : "text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]",
            )}
          >
            <HugeiconsIcon icon={Analytics01Icon} size={16} color="currentColor" strokeWidth={2} />
          </button>

          {/* Column picker */}
          <ColumnPicker visibleColumns={visibleColumns} onToggle={onColumnToggle} />

          {/* View toggle */}
          <div className="flex items-center bg-[#F2F3F3] rounded-xl p-0.5 gap-0.5">
            {(["table", "timeline"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onViewModeChange(m)}
                aria-label={m === "table" ? "Table view" : "Timeline view"}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
                  viewMode === m ? "text-white" : "text-[#9CA3AF] hover:text-[#2E4A4A]",
                )}
                style={viewMode === m ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
              >
                <HugeiconsIcon icon={m === "table" ? GridViewIcon : ListViewIcon} size={15} color="currentColor" strokeWidth={2} />
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors disabled:opacity-40"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} color="currentColor" strokeWidth={2} />
          </button>

          {/* Count */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-semibold text-[#6B7B7B]">
              {total.toLocaleString()} {isFiltered ? "matching" : "total"}
            </span>
            {updatedLabel && <span className="text-[10px] text-[#9CA3AF] hidden sm:inline">· {updatedLabel}</span>}
          </div>
        </div>

        {/* Row 2: Saved view pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {SAVED_VIEWS.map((sv) => {
            const isActive = activeViewId === sv.id;
            return (
              <button
                key={sv.id}
                onClick={() => {
                  if (isActive) return;
                  onFilterChange(sv.filters);
                }}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap",
                  isActive
                    ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                    : "border-[#E3EBE8] text-[#7A8B8A] bg-white hover:border-emerald-300 hover:text-emerald-600",
                )}
              >
                {sv.label}
              </button>
            );
          })}
          {isFiltered && activeViewId === null && (
            <button
              onClick={onClearFilters}
              className="flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Analytics panel */}
        {analyticsOpen && (
          <AnalyticsPanel flights={flights} snapshotSummaries={snapshotSummaries} />
        )}
      </div>

      {/* Advanced filters panel */}
      {advancedOpen && (
        <FlightSearchFilters
          filters={filters}
          onChange={onFilterChange}
          onClear={onClearFilters}
        />
      )}
    </div>
  );
}
