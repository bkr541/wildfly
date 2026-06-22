import React, { useState, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterIcon,
  Loading03Icon,
  Alert01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useReportRuns }  from "@/hooks/useAdminReporting";
import { formatDuration } from "./reportingFormatters";
import type { ReportDefinition, ReportRun, ReportRunStatus, ListRunsParams } from "./reportingTypes";

// ── PII masking for parameter display ────────────────────────────────────────

const PII_KEY_PATTERNS = /^(email|.*_email|user_id|userId|uid|include_pii|pii)$/i;

export function maskParamValue(key: string, value: unknown): string {
  if (PII_KEY_PATTERNS.test(key)) return "[redacted]";
  if (typeof value === "string") {
    // Mask values that look like email addresses regardless of key name.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      const at   = value.indexOf("@");
      const local = value.slice(0, at);
      return `${local[0] ?? ""}***@${value.slice(at + 1)}`;
    }
  }
  if (value === null || value === undefined) return "—";
  return String(value);
}

/** Returns whether the stored parameters include PII access. */
export function hasPiiAccess(params: Record<string, unknown>): boolean {
  return params.include_pii === true;
}

/** Safe one-line summary of non-PII parameters for the history table. */
export function buildParamSummary(
  params: Record<string, unknown>,
  maxChars = 80,
): string {
  const parts = Object.entries(params)
    .filter(([key]) => !PII_KEY_PATTERNS.test(key))
    .map(([key, val]) => {
      const display = maskParamValue(key, val);
      return `${key}: ${display}`;
    });
  const joined = parts.join(" · ");
  return joined.length > maxChars ? joined.slice(0, maxChars - 1) + "…" : joined;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReportRunStatus }) {
  const config = {
    running:   { label: "Running",   color: "bg-amber-100 text-amber-800",  icon: Loading03Icon },
    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800", icon: CheckmarkCircle01Icon },
    failed:    { label: "Failed",    color: "bg-red-100 text-red-700",      icon: Alert01Icon },
  }[status] ?? { label: status, color: "bg-gray-100 text-gray-700", icon: Clock01Icon };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.color}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <HugeiconsIcon icon={config.icon} size={10} color="currentColor" strokeWidth={2.5} />
      {config.label}
    </span>
  );
}

// ── Category badge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className="text-[10px] font-semibold text-[#9CA3AF] bg-[#F0F1F1] px-1.5 py-0.5 rounded-full">
      {category}
    </span>
  );
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ReportRunHistoryProps {
  /** Currently selected report — used to pre-filter the slug dropdown. */
  selectedSlug: string | null;
  /** All known report definitions (for the slug filter list). */
  definitions:  ReportDefinition[];
  /** Called when the user clicks a row to view full run details. */
  onSelectRun:  (run: ReportRun) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportRunHistory({
  selectedSlug,
  definitions,
  onSelectRun,
}: ReportRunHistoryProps) {
  const [filterSlug,     setFilterSlug]     = useState<string>(selectedSlug ?? "");
  const [filterStatus,   setFilterStatus]   = useState<ReportRunStatus | "">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [page,           setPage]           = useState(0);
  const PAGE_SIZE = 25;

  const queryParams: ListRunsParams = useMemo(() => ({
    slug:      filterSlug  || undefined,
    status:    (filterStatus as ReportRunStatus) || undefined,
    date_from: filterDateFrom || undefined,
    date_to:   filterDateTo   || undefined,
    page,
    page_size: PAGE_SIZE,
  }), [filterSlug, filterStatus, filterDateFrom, filterDateTo, page]);

  const { data, isLoading, error, refetch } = useReportRuns(queryParams);

  function resetFilters() {
    setFilterSlug(selectedSlug ?? "");
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(0);
  }

  const hasActiveFilters =
    filterSlug !== (selectedSlug ?? "") ||
    filterStatus !== "" ||
    filterDateFrom !== "" ||
    filterDateTo !== "";

  const total      = data?.total      ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const firstRow   = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRow    = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-4" role="region" aria-label="Report run history">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-3 items-end"
        role="group"
        aria-label="History filters"
      >
        {/* Report filter */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">
            Report
          </label>
          <select
            value={filterSlug}
            onChange={(e) => { setFilterSlug(e.target.value); setPage(0); }}
            className="text-xs border border-[#E8EEEE] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Filter by report"
          >
            <option value="">All reports</option>
            {definitions.map((d) => (
              <option key={d.slug} value={d.slug}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as ReportRunStatus | ""); setPage(0); }}
            className="text-xs border border-[#E8EEEE] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">
            From
          </label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(0); }}
            className="text-xs border border-[#E8EEEE] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            style={{ colorScheme: "light" }}
            aria-label="Filter from date"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">
            To
          </label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(0); }}
            className="text-xs border border-[#E8EEEE] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            style={{ colorScheme: "light" }}
            aria-label="Filter to date"
          />
        </div>

        {/* Reset + refresh */}
        <div className="flex items-center gap-2 pb-0.5">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-[#9CA3AF] hover:text-[#374151] transition-colors"
              aria-label="Reset history filters"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            aria-label="Refresh run history"
            className="flex items-center gap-1 text-xs font-semibold text-[#9CA3AF] hover:text-[#374151] transition-colors"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} color="currentColor" strokeWidth={2.5} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          className="flex items-center justify-center py-12 text-[#9CA3AF] text-sm gap-2"
          role="status"
          aria-label="Loading run history"
        >
          <HugeiconsIcon icon={Loading03Icon} size={16} color="currentColor" strokeWidth={2} />
          Loading history…
        </div>
      )}

      {error && !isLoading && (
        <div
          className="flex items-center gap-2 py-4 text-red-600 text-sm"
          role="alert"
        >
          <HugeiconsIcon icon={Alert01Icon} size={14} color="currentColor" strokeWidth={2} />
          Failed to load history: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border border-[#E8EEEE]">
          <table
            className="min-w-full text-xs"
            aria-label="Report run history table"
          >
            <thead className="bg-[#F8F9F9] border-b border-[#E8EEEE]">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-bold text-[#374151] min-w-[140px]">Report</th>
                <th scope="col" className="px-3 py-2.5 text-left font-bold text-[#374151]">Status</th>
                <th scope="col" className="px-3 py-2.5 text-left font-bold text-[#374151]">Started</th>
                <th scope="col" className="px-3 py-2.5 text-left font-bold text-[#374151]">Duration</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold text-[#374151]">Rows</th>
                <th scope="col" className="px-3 py-2.5 text-center font-bold text-[#374151]">PII</th>
                <th scope="col" className="px-3 py-2.5 text-left font-bold text-[#374151] min-w-[100px]">Parameters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F1F1]">
              {(data?.runs ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-[#9CA3AF]"
                  >
                    <HugeiconsIcon icon={FilterIcon} size={16} color="currentColor" strokeWidth={1.5} className="mx-auto mb-2 opacity-40" />
                    No runs match the current filters.
                  </td>
                </tr>
              ) : (
                (data?.runs ?? []).map((run) => (
                  <RunRow key={run.id} run={run} onSelect={onSelectRun} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {!isLoading && !error && total > 0 && (
        <div
          className="flex items-center justify-between gap-4 text-xs text-[#9CA3AF]"
          role="navigation"
          aria-label="History pagination"
        >
          <span>
            Showing {firstRow}–{lastRow} of {total} run{total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="px-2.5 py-1.5 rounded-lg border border-[#E8EEEE] font-semibold text-[#374151] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8F9F9] transition-colors"
            >
              Prev
            </button>
            <span aria-live="polite" aria-atomic="true" className="min-w-[4rem] text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages}
              aria-label="Next page"
              className="px-2.5 py-1.5 rounded-lg border border-[#E8EEEE] font-semibold text-[#374151] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8F9F9] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Individual row ─────────────────────────────────────────────────────────────

function RunRow({
  run,
  onSelect,
}: {
  run:      ReportRun;
  onSelect: (run: ReportRun) => void;
}) {
  const piiRequested = hasPiiAccess(run.parameters);
  const paramSummary = buildParamSummary(run.parameters);

  return (
    <tr
      className="hover:bg-[#F8F9F9] cursor-pointer transition-colors"
      onClick={() => onSelect(run)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(run); }}
      aria-label={`View details for run of ${run.report_name ?? run.report_slug}`}
    >
      {/* Report name + category */}
      <td className="px-3 py-2.5">
        <div className="font-semibold text-[#1A2E2E] leading-tight">
          {run.report_name ?? run.report_slug}
        </div>
        <div className="mt-0.5">
          <CategoryBadge category={run.report_category} />
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <StatusBadge status={run.status} />
        {run.error_code && (
          <div className="text-[10px] text-red-500 mt-0.5 font-mono">{run.error_code}</div>
        )}
      </td>

      {/* Started */}
      <td className="px-3 py-2.5 whitespace-nowrap text-[#9CA3AF]">
        {relTime(run.started_at)}
      </td>

      {/* Duration */}
      <td className="px-3 py-2.5 whitespace-nowrap text-[#9CA3AF]">
        {run.duration_ms !== null ? formatDuration(run.duration_ms) : "—"}
      </td>

      {/* Row count */}
      <td className="px-3 py-2.5 text-right text-[#374151] tabular-nums">
        {run.row_count !== null ? run.row_count.toLocaleString() : "—"}
        {run.truncated && (
          <span className="ml-1 text-amber-600 font-bold" title="Results were truncated">+</span>
        )}
      </td>

      {/* PII badge */}
      <td className="px-3 py-2.5 text-center">
        {piiRequested ? (
          <span
            className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"
            title="PII was included in this run"
          >
            PII
          </span>
        ) : (
          <span className="text-[#D1D5DB]">—</span>
        )}
      </td>

      {/* Param summary — no PII values shown */}
      <td className="px-3 py-2.5 text-[#9CA3AF] max-w-[200px] truncate">
        {paramSummary || <span className="italic opacity-50">No params</span>}
      </td>
    </tr>
  );
}
