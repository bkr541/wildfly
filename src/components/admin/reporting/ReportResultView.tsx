import React, { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, Timer02Icon, Analytics01Icon } from "@hugeicons/core-free-icons";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ReportSummaryCards } from "./ReportSummaryCards";
import { ReportChart }        from "./ReportChart";
import { ReportResultTable }  from "./ReportResultTable";
import { ReportPagination }   from "./ReportPagination";
import { ReportExportMenu }   from "./ReportExportMenu";
import { ReportFilterSummary } from "./ReportFilterSummary";
import { formatDuration }     from "./reportingFormatters";
import type { ReportDefinition, ReportResult } from "./reportingTypes";

// ── Meta strip ─────────────────────────────────────────────────────────────────

function MetaStrip({ result }: { result: ReportResult }) {
  const genAt = useMemo(() => {
    try {
      return formatDistanceToNow(parseISO(result.generated_at), { addSuffix: true });
    } catch {
      return result.generated_at;
    }
  }, [result.generated_at]);

  return (
    <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5">
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={Clock01Icon} size={12} color="#9CA3AF" strokeWidth={2} />
        <span className="text-[11px] text-[#9CA3AF]">Generated {genAt}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={Timer02Icon} size={12} color="#9CA3AF" strokeWidth={2} />
        <span className="text-[11px] text-[#9CA3AF]">
          {formatDuration(result.duration_ms)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={Analytics01Icon} size={12} color="#9CA3AF" strokeWidth={2} />
        <span className="text-[11px] text-[#9CA3AF]">
          {result.rows.length.toLocaleString()} row
          {result.rows.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportResultViewProps {
  result:        ReportResult;
  definition:    ReportDefinition;
  isRerunning:   boolean;
  onPageChange:  (page: number, pageSize: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportResultView({
  result,
  definition,
  isRerunning,
  onPageChange,
}: ReportResultViewProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Top row: meta + export */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <MetaStrip result={result} />
        <ReportExportMenu result={result} definition={definition} />
      </div>

      {/* Active filters */}
      <ReportFilterSummary
        definition={definition}
        parameters={result.parameters}
      />

      {/* Summary metric cards */}
      {result.summary && result.summary.length > 0 && (
        <ReportSummaryCards summary={result.summary} />
      )}

      {/* Chart */}
      {result.chart && (
        <ReportChart
          chart={result.chart}
          columns={result.columns}
          rows={result.rows}
          reportName={result.report.name}
        />
      )}

      {/* Result table */}
      <ReportResultTable
        columns={result.columns}
        rows={result.rows}
        truncated={result.pagination.truncated}
      />

      {/* Pagination */}
      {(result.pagination.truncated ||
        (result.pagination.total_rows !== null &&
          result.pagination.total_rows > result.pagination.page_size)) && (
        <ReportPagination
          pagination={result.pagination}
          isLoading={isRerunning}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
