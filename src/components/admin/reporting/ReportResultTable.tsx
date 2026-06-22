import React, { useState, useMemo, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SortingUpIcon,
  SortingDownIcon,
  ArrowUpDownIcon,
  ViewIcon,
  ViewOffSlashIcon,
  Copy01Icon,
  Alert01Icon,
  Table01Icon,
  More01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { ReportColumn, ReportRow } from "./reportingTypes";
import { formatCell, NULL_DISPLAY } from "./reportingFormatters";

// ── Pure logic helpers (exported for tests) ───────────────────────────────────

type SortDirection = "asc" | "desc";

export interface SortConfig {
  key:       string;
  direction: SortDirection;
}

/** Numeric column types — sorted as numbers rather than strings. */
const NUMERIC_TYPES = new Set(["number", "percent", "currency", "duration"]);

/**
 * Sort rows by a column with stable null ordering (nulls always last).
 * Exported for testing.
 */
export function sortRows(
  rows:   ReportRow[],
  col:    ReportColumn,
  config: SortConfig,
): ReportRow[] {
  const { key, direction } = config;
  const mul = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];

    // Stable null ordering: nulls always sort to the bottom.
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    if (NUMERIC_TYPES.has(col.type)) {
      const an = Number(av), bn = Number(bv);
      const aFin = Number.isFinite(an), bFin = Number.isFinite(bn);
      if (!aFin && !bFin) return 0;
      if (!aFin) return 1;
      if (!bFin) return -1;
      return mul * (an - bn);
    }

    // Date / datetime — sort by ISO string (lexicographic works for ISO 8601)
    if (col.type === "date" || col.type === "datetime") {
      const as = String(av), bs = String(bv);
      return mul * as.localeCompare(bs);
    }

    return mul * String(av).localeCompare(String(bv));
  });
}

/**
 * Build the default visibility set: all non-hidden columns are visible.
 * Exported for testing.
 */
export function buildDefaultVisibility(columns: ReportColumn[]): Set<string> {
  return new Set(columns.filter((c) => !c.hiddenByDefault).map((c) => c.key));
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportResultTableProps {
  columns:   ReportColumn[];
  rows:      ReportRow[];
  truncated: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportResultTable({
  columns,
  rows,
  truncated,
}: ReportResultTableProps) {
  // ── Column visibility ──────────────────────────────────────────────────────
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    () => buildDefaultVisibility(columns),
  );
  const [showColMenu, setShowColMenu] = useState(false);

  // Reset visibility when columns definition changes (new report run)
  const colsKey = columns.map((c) => c.key).join("|");
  const prevColsKey = React.useRef(colsKey);
  if (colsKey !== prevColsKey.current) {
    prevColsKey.current = colsKey;
    const next = buildDefaultVisibility(columns);
    // Only update if different to avoid infinite loop
    if (!setsEqual(next, visibleKeys)) {
      setVisibleKeys(next);
    }
  }

  const visibleColumns = useMemo(
    () => columns.filter((c) => visibleKeys.has(c.key)),
    [columns, visibleKeys],
  );

  function toggleColumn(key: string) {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Sorting ────────────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  function handleHeaderClick(col: ReportColumn) {
    setSortConfig((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, direction: "asc" };
      if (prev.direction === "asc") return { key: col.key, direction: "desc" };
      return null; // third click clears sort
    });
  }

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const col = columns.find((c) => c.key === sortConfig.key);
    if (!col) return rows;
    return sortRows(rows, col, sortConfig);
  }, [rows, columns, sortConfig]);

  // ── Copy cell ──────────────────────────────────────────────────────────────
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const copyCell = useCallback(async (value: string, cellId: string) => {
    try {
      await navigator.clipboard.writeText(value === NULL_DISPLAY ? "" : value);
      setCopiedCell(cellId);
      setTimeout(() => setCopiedCell(null), 1500);
    } catch {
      // Clipboard not available (not HTTPS or permission denied) — ignore silently
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const hasDebugCols = columns.some((c) => c.hiddenByDefault);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: row count + column menu */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Table01Icon} size={13} color="#9CA3AF" strokeWidth={2} aria-hidden="true" />
          <span className="text-xs font-semibold text-[#9CA3AF]">
            {rows.length.toLocaleString()} row{rows.length !== 1 ? "s" : ""}
            {truncated && " (truncated)"}
          </span>
          {truncated && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold"
              role="alert"
              aria-live="polite"
            >
              <HugeiconsIcon icon={Alert01Icon} size={10} color="currentColor" strokeWidth={2} />
              Results truncated
            </span>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColMenu((v) => !v)}
            aria-expanded={showColMenu}
            aria-label="Show/hide columns"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7280] hover:text-[#1A2E2E] border border-[#E8EEEE] rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[#F8F9F9]"
          >
            <HugeiconsIcon icon={More01Icon} size={12} color="currentColor" strokeWidth={2} />
            Columns
          </button>

          {showColMenu && (
            <>
              {/* Click-outside overlay */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowColMenu(false)}
                aria-hidden="true"
              />
              <div
                className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-xl border border-[#E8EEEE] bg-white shadow-lg py-1"
                role="menu"
                aria-label="Column visibility"
              >
                <div className="px-3 pt-1.5 pb-1 border-b border-[#F0F1F1] mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">
                    Columns
                  </span>
                </div>
                {columns.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={visibleKeys.has(col.key)}
                    onClick={() => toggleColumn(col.key)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-[#F8F9F9] transition-colors"
                  >
                    <HugeiconsIcon
                      icon={visibleKeys.has(col.key) ? ViewIcon : ViewOffSlashIcon}
                      size={12}
                      color={visibleKeys.has(col.key) ? "#059669" : "#9CA3AF"}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-[#374151]">{col.label}</span>
                    {col.hiddenByDefault && (
                      <span className="ml-auto text-[10px] text-[#C4CACC] font-mono">debug</span>
                    )}
                  </button>
                ))}
                {hasDebugCols && (
                  <div className="border-t border-[#F0F1F1] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = new Set(columns.map((c) => c.key));
                        setVisibleKeys(
                          setsEqual(allKeys, visibleKeys)
                            ? buildDefaultVisibility(columns)
                            : allKeys,
                        );
                      }}
                      className="w-full px-3 py-1.5 text-left text-[11px] text-[#059669] font-semibold hover:bg-[#ECFDF5] transition-colors"
                    >
                      {setsEqual(new Set(columns.map((c) => c.key)), visibleKeys)
                        ? "Hide debug columns"
                        : "Show all columns"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {visibleColumns.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <HugeiconsIcon icon={ViewOffSlashIcon} size={22} color="#D1D5DB" strokeWidth={1.5} />
          <p className="text-sm text-[#9CA3AF]">All columns are hidden.</p>
          <button
            type="button"
            onClick={() => setVisibleKeys(buildDefaultVisibility(columns))}
            className="text-xs font-semibold text-[#059669] hover:underline"
          >
            Restore defaults
          </button>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center border border-[#F0F1F1] rounded-xl">
          <HugeiconsIcon icon={Table01Icon} size={22} color="#D1D5DB" strokeWidth={1.5} />
          <p className="text-sm text-[#9CA3AF]">No results matched your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#F0F1F1]">
          <table
            className="w-full text-sm min-w-max"
            role="table"
            aria-label="Report results"
            aria-rowcount={sortedRows.length}
          >
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[#F0F1F1] bg-[#F8F9F9]">
                {visibleColumns.map((col) => {
                  const isSorted = sortConfig?.key === col.key;
                  const dir      = isSorted ? sortConfig?.direction : undefined;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={isSorted ? (dir === "asc" ? "ascending" : "descending") : "none"}
                      className="px-3 py-2.5 text-left whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleHeaderClick(col)}
                        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] hover:text-[#374151] transition-colors"
                      >
                        {col.label}
                        <HugeiconsIcon
                          icon={
                            isSorted
                              ? dir === "asc"
                                ? SortingUpIcon
                                : SortingDownIcon
                              : ArrowUpDownIcon
                          }
                          size={11}
                          color={isSorted ? "#059669" : "currentColor"}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn(
                    "border-b border-[#F0F1F1] last:border-0 hover:bg-[#F8F9F9]/80 transition-colors group",
                    ri % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]",
                  )}
                  aria-rowindex={ri + 1}
                >
                  {visibleColumns.map((col) => {
                    const raw      = row[col.key];
                    const formatted = formatCell(raw, col.type);
                    const cellId    = `cell-${ri}-${col.key}`;
                    const isCopied  = copiedCell === cellId;
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-2 whitespace-nowrap text-xs font-mono relative"
                        aria-label={`${col.label}: ${formatted}`}
                      >
                        <span
                          className={cn(
                            "select-all",
                            formatted === NULL_DISPLAY
                              ? "text-[#C4CACC]"
                              : col.type === "number" ||
                                  col.type === "percent" ||
                                  col.type === "currency"
                                ? "text-[#1A2E2E] tabular-nums"
                                : "text-[#374151]",
                          )}
                        >
                          {formatted}
                        </span>
                        {formatted !== NULL_DISPLAY && (
                          <button
                            type="button"
                            onClick={() => copyCell(formatted, cellId)}
                            aria-label={isCopied ? "Copied!" : `Copy ${col.label}`}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                          >
                            <HugeiconsIcon
                              icon={Copy01Icon}
                              size={11}
                              color={isCopied ? "#059669" : "#9CA3AF"}
                              strokeWidth={2}
                            />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Utility ────────────────────────────────────────────────────────────────────

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
