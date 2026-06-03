import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FlightSearchRow } from "@/components/admin/FlightSearchDetailDrawer";
import { FlightSearchDetailDrawer } from "@/components/admin/FlightSearchDetailDrawer";
import { FlightSearchTimeline } from "./FlightSearchTimeline";
import { FlightSearchToolbar } from "./FlightSearchToolbar";
import { FlightSearchKpiStrip } from "./FlightSearchKpiStrip";
import { FlightSearchTable } from "./FlightSearchTable";
import {
  type FlightSearchFiltersState,
  type FlightSearchViewMode,
  type ColumnKey,
  DEFAULT_FILTERS,
  DEFAULT_VISIBLE_COLUMNS,
  COLUMNS_STORAGE_KEY,
  hasActiveFilters,
  countActiveFilters,
} from "./types";
import type { FlightSearchSnapshotSummary } from "./types";
import { computeVisibleFlightMetrics } from "./flightSearchMetrics";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

// ── Pagination (local, avoids shared-state complexity) ────────────────────────

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const getPages = () => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 2) pages.push("…");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 3) pages.push("…");
      pages.push(totalPages - 1);
    }
    return pages;
  };
  const btn = "h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors";
  return (
    <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-[#F0F1F1]">
      <button onClick={() => onPage(page - 1)} disabled={page === 0}
        className={`${btn} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}>
        Previous
      </button>
      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="text-xs text-[#9CA3AF] px-1">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            className={`${btn} ${p === page ? "text-white" : "border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3]"}`}
            style={p === page ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
          >
            {(p as number) + 1}
          </button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}
        className={`${btn} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}>
        Next
      </button>
    </div>
  );
}

// ── Load/persist column visibility ────────────────────────────────────────────

function loadColumns(): ColumnKey[] {
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_VISIBLE_COLUMNS];
}

function saveColumns(cols: ColumnKey[]) {
  try { localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(cols)); } catch { /* ignore */ }
}

// ── FlightsView ───────────────────────────────────────────────────────────────

export function FlightsView() {
  const [flights, setFlights]               = useState<FlightSearchRow[]>([]);
  const [total, setTotal]                   = useState(0);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [page, setPage]                     = useState(0);
  const [viewMode, setViewMode]             = useState<FlightSearchViewMode>("table");
  const [filters, setFilters]               = useState<FlightSearchFiltersState>(DEFAULT_FILTERS);
  const [snapshotSummaries, setSnapSumms]   = useState<Record<string, FlightSearchSnapshotSummary>>({});
  const [selected, setSelected]             = useState<FlightSearchRow | null>(null);
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadColumns);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (p: number, f: FlightSearchFiltersState) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setFlights([]); setTotal(0); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-list-flight-searches`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            page: p, page_size: PAGE_SIZE,
            search: f.search, origin: f.origin, destination: f.destination,
            trip_type: f.tripType, result_source: f.resultSource, triggered_by: f.triggeredBy,
            gowild_status: f.goWildStatus, all_destinations: f.allDestinations,
            freshness: f.freshness, date_from: f.dateFrom, date_to: f.dateTo,
            departure_date_from: f.departureDateFrom, departure_date_to: f.departureDateTo,
            min_results: f.minResults, max_results: f.maxResults,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setFlights((json?.flights ?? []) as FlightSearchRow[]);
      setTotal(json?.total ?? 0);
      setSnapSumms(json?.snapshot_summaries_by_search_id ?? {});
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load flight searches");
      setFlights([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(0, DEFAULT_FILTERS); }, [fetchPage]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFilterChange = useCallback((patch: Partial<FlightSearchFiltersState>) => {
    const next = { ...filtersRef.current, ...patch };
    setFilters(next);
    setPage(0);
    fetchPage(0, next);
  }, [fetchPage]);

  const handleSearchChange = useCallback((value: string) => {
    const next = { ...filtersRef.current, search: value };
    setFilters(next);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(0);
      fetchPage(0, { ...filtersRef.current, search: value });
    }, 400);
  }, [fetchPage]);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    fetchPage(p, filtersRef.current);
  }, [fetchPage]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
    fetchPage(0, DEFAULT_FILTERS);
  }, [fetchPage]);

  const handleRefresh = useCallback(() => {
    fetchPage(page, filtersRef.current);
  }, [fetchPage, page]);

  const handleColumnToggle = useCallback((key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      saveColumns(next);
      return next;
    });
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const totalPages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered    = hasActiveFilters(filters);

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return null;
    const secs = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
    if (secs < 10) return "just now";
    if (secs < 60) return `${secs}s ago`;
    return `${Math.round(secs / 60)}m ago`;
  }, [lastUpdated]);

  const kpiMetrics = useMemo(
    () => computeVisibleFlightMetrics(flights, snapshotSummaries),
    [flights, snapshotSummaries],
  );

  // Always include required columns + any extras
  const effectiveColumns = useMemo<ColumnKey[]>(() => {
    const required: ColumnKey[] = ["route", "user", "departure", "trip", "source", "gowild_signal", "results_quality", "freshness", "actions"];
    const optionals = visibleColumns.filter(c => !required.includes(c));
    // Insert optionals before "actions"
    const base = required.filter(c => c !== "actions");
    return [...base, ...optionals, "actions"];
  }, [visibleColumns]);

  const paginationNode = totalPages > 1 && !loading
    ? <Pagination page={page} totalPages={totalPages} onPage={handlePageChange} />
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <FlightSearchKpiStrip metrics={kpiMetrics} serverTotal={total} isFiltered={isFiltered} />

      {/* Toolbar + saved views + analytics */}
      <FlightSearchToolbar
        filters={filters}
        viewMode={viewMode}
        visibleColumns={effectiveColumns}
        loading={loading}
        total={total}
        isFiltered={isFiltered}
        updatedLabel={updatedLabel}
        flights={flights}
        snapshotSummaries={snapshotSummaries}
        onSearchChange={handleSearchChange}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onRefresh={handleRefresh}
        onViewModeChange={setViewMode}
        onColumnToggle={handleColumnToggle}
      />

      {/* Error state */}
      {error && !loading && (
        <div
          className="rounded-2xl px-5 py-4 flex items-start gap-4"
          style={{ ...CARD_STYLE, borderLeft: "4px solid #e11d48" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-600">Unable to load flight searches</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5 break-all">{error}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table / Timeline */}
      {viewMode === "table" ? (
        <FlightSearchTable
          flights={flights}
          snapshotSummaries={snapshotSummaries}
          visibleColumns={effectiveColumns}
          loading={loading}
          isFiltered={isFiltered}
          onSelect={setSelected}
          onClearFilters={handleClearFilters}
          pagination={paginationNode}
        />
      ) : (
        <div className="rounded-2xl p-5" style={CARD_STYLE}>
          {loading ? (
            <div className="flex flex-col gap-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-3 w-24 rounded bg-[#F0F1F1]" />
                  <div className="h-14 w-full rounded-2xl bg-[#F0F1F1]" />
                  <div className="h-14 w-full rounded-2xl bg-[#F0F1F1]" />
                </div>
              ))}
            </div>
          ) : flights.length === 0 && !error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm font-semibold text-[#2E4A4A]">
                {isFiltered ? "No flight searches match these filters" : "No flight searches yet"}
              </p>
              {isFiltered && (
                <button onClick={handleClearFilters} className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <FlightSearchTimeline flights={flights} snapshotSummaries={snapshotSummaries} onSelect={setSelected} />
          )}
          {paginationNode}
        </div>
      )}

      {/* Detail drawer */}
      <FlightSearchDetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        search={selected}
      />
    </div>
  );
}
