import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { ReportPagination as PaginationMeta } from "./reportingTypes";

// ── Page sizes on offer ────────────────────────────────────────────────────────

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportPaginationProps {
  pagination:   PaginationMeta;
  isLoading:    boolean;
  onPageChange: (page: number, pageSize: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportPagination({
  pagination,
  isLoading,
  onPageChange,
}: ReportPaginationProps) {
  const { page, page_size, total_rows, truncated } = pagination;

  const hasPrev = page > 1;
  const hasNext = truncated || (total_rows !== null && page * page_size < total_rows);

  const firstRow = (page - 1) * page_size + 1;
  const lastRow  = total_rows !== null
    ? Math.min(page * page_size, total_rows)
    : page * page_size;

  return (
    <div
      className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-[#F0F1F1]"
      role="navigation"
      aria-label="Report pagination"
    >
      {/* Row count */}
      <p className="text-xs text-[#9CA3AF]">
        {total_rows !== null ? (
          <>
            Showing{" "}
            <span className="font-semibold text-[#374151]">
              {firstRow.toLocaleString()}–{lastRow.toLocaleString()}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-[#374151]">
              {total_rows.toLocaleString()}
            </span>{" "}
            row{total_rows !== 1 ? "s" : ""}
          </>
        ) : (
          <>
            Page <span className="font-semibold text-[#374151]">{page}</span>
          </>
        )}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Page size selector */}
        <label className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
          Rows per page:
          <select
            value={page_size}
            disabled={isLoading}
            onChange={(e) => onPageChange(1, Number(e.target.value))}
            aria-label="Rows per page"
            className="border border-[#E8EEEE] rounded-lg px-2 py-1 text-xs font-semibold text-[#374151] bg-white focus:outline-none focus:border-[#059669] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {/* Prev button */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1, page_size)}
          disabled={!hasPrev || isLoading}
          aria-label="Previous page"
          aria-disabled={!hasPrev || isLoading}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
            hasPrev && !isLoading
              ? "border-[#E8EEEE] text-[#374151] hover:bg-[#F8F9F9]"
              : "border-[#F0F1F1] text-[#C4CACC] cursor-not-allowed",
          )}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={12} color="currentColor" strokeWidth={2.5} />
          Prev
        </button>

        {/* Page indicator */}
        <span
          className="text-xs font-semibold text-[#374151] min-w-[2rem] text-center"
          aria-live="polite"
          aria-atomic="true"
        >
          {page}
        </span>

        {/* Next button */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1, page_size)}
          disabled={!hasNext || isLoading}
          aria-label="Next page"
          aria-disabled={!hasNext || isLoading}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
            hasNext && !isLoading
              ? "border-[#E8EEEE] text-[#374151] hover:bg-[#F8F9F9]"
              : "border-[#F0F1F1] text-[#C4CACC] cursor-not-allowed",
          )}
        >
          Next
          <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="currentColor" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
