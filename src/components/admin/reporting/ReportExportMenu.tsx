import React, { useState, useCallback, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudDownloadIcon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useLogReportExport } from "@/hooks/useAdminReporting";
import {
  exportToXLSX,
  exportToCSV,
  exportToJSON,
  type ExportOptions,
} from "@/utils/adminReportExport";
import type { ExportFormat, ReportDefinition, ReportResult } from "./reportingTypes";

// ── Export format metadata ─────────────────────────────────────────────────────

const FORMATS: Array<{
  format:      ExportFormat;
  label:       string;
  description: string;
  ext:         string;
}> = [
  {
    format:      "xlsx",
    label:       "Excel (.xlsx)",
    description: "Spreadsheet with metadata worksheet",
    ext:         "xlsx",
  },
  {
    format:      "csv",
    label:       "CSV",
    description: "Comma-separated values, UTF-8",
    ext:         "csv",
  },
  {
    format:      "json",
    label:       "JSON",
    description: "Raw values, machine-readable",
    ext:         "json",
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportExportMenuProps {
  result:     ReportResult;
  definition: ReportDefinition;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportExportMenu({
  result,
  definition,
}: ReportExportMenuProps) {
  const logExport = useLogReportExport();

  const [open,                setOpen]                = useState(false);
  const [includeHidden,       setIncludeHidden]       = useState(false);
  const [exportingFormat,     setExportingFormat]     = useState<ExportFormat | null>(null);
  const [lastSuccess,         setLastSuccess]         = useState<ExportFormat | null>(null);
  const [auditFailed,         setAuditFailed]         = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasDebugCols = definition.parameter_schema?.fields ? false : false; // driven by columns
  const actualDebugCols = result.columns.some((c) => c.hiddenByDefault);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const opts: ExportOptions = { includeHiddenColumns: includeHidden };

      setExportingFormat(format);
      setLastSuccess(null);
      setAuditFailed(false);
      setOpen(false);

      // Download the file (synchronous)
      try {
        switch (format) {
          case "xlsx": exportToXLSX(result, opts); break;
          case "csv":  exportToCSV(result, opts);  break;
          case "json": exportToJSON(result, opts);  break;
        }
      } catch {
        setExportingFormat(null);
        return;
      }

      // Audit the export
      try {
        await logExport.mutateAsync({
          run_id:    result.run_id,
          format,
          row_count: result.rows.length,
        });
        setLastSuccess(format);
      } catch {
        // File was downloaded but audit failed — tell the admin
        setAuditFailed(true);
      } finally {
        setExportingFormat(null);
      }
    },
    [result, logExport, includeHidden],
  );

  const isExporting = exportingFormat !== null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isExporting}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Export report data"
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-[#E8EEEE] text-[#374151] hover:bg-[#F8F9F9] transition-colors",
          isExporting && "opacity-60 cursor-not-allowed",
        )}
      >
        {isExporting ? (
          <span className="h-3 w-3 rounded-full border border-[#9CA3AF] border-t-transparent animate-spin" />
        ) : (
          <HugeiconsIcon icon={CloudDownloadIcon} size={13} color="currentColor" strokeWidth={2} />
        )}
        Export
        <HugeiconsIcon icon={ArrowDown01Icon} size={11} color="#9CA3AF" strokeWidth={2.5} />
      </button>

      {/* Status badges */}
      {lastSuccess && !isExporting && (
        <span
          className="absolute -top-5 left-0 flex items-center gap-1 text-[10px] text-emerald-600 font-semibold whitespace-nowrap"
          role="status"
          aria-live="polite"
        >
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={10} color="currentColor" strokeWidth={2} />
          {lastSuccess.toUpperCase()} exported
        </span>
      )}

      {/* Drop-down menu */}
      {open && !isExporting && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border border-[#E8EEEE] bg-white shadow-lg py-1.5 overflow-hidden"
            role="menu"
            aria-label="Export options"
          >
            {/* Include debug columns toggle */}
            {actualDebugCols && (
              <div className="px-3 py-2 border-b border-[#F0F1F1] mb-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeHidden}
                  onClick={() => setIncludeHidden((v) => !v)}
                  className="flex items-center gap-2 w-full"
                >
                  <div
                    className={cn(
                      "relative h-4 w-7 rounded-full transition-colors",
                      includeHidden ? "bg-[#059669]" : "bg-[#D1D5DB]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                        includeHidden ? "left-3.5" : "left-0.5",
                      )}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-[#374151]">
                    Include debug columns
                  </span>
                </button>
              </div>
            )}

            {/* Format options */}
            {FORMATS.map(({ format, label, description }) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                onClick={() => handleExport(format)}
                className="flex flex-col items-start w-full px-3 py-2.5 hover:bg-[#F8F9F9] transition-colors"
              >
                <span className="text-xs font-bold text-[#1A2E2E]">{label}</span>
                <span className="text-[11px] text-[#9CA3AF] mt-0.5">{description}</span>
              </button>
            ))}

            {/* PII notice */}
            {definition.contains_pii && (
              <div className="border-t border-[#F0F1F1] mt-1 px-3 py-2">
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  This export may contain PII. Handle in accordance with your
                  organization's data policies.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Audit failure warning */}
      {auditFailed && !isExporting && (
        <div
          className="absolute top-full left-0 mt-1 z-20 w-72 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-2">
            <HugeiconsIcon icon={AlertCircleIcon} size={13} color="#D97706" strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">
                File downloaded — audit record failed
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                The file was created but the export audit record could not be
                saved. Please notify your administrator.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAuditFailed(false)}
              aria-label="Dismiss warning"
              className="flex-shrink-0"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} color="#D97706" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
