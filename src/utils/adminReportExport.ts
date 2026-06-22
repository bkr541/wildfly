/**
 * Report export utilities for XLSX, CSV, and JSON.
 *
 * Security notes:
 *  - Formula injection is prevented by prefixing dangerous strings with a
 *    single quote before writing to CSV/XLSX cells.
 *  - Raw values are used for JSON because JSON parsers do not execute formulas.
 *  - PII status is derived from result.parameters.include_pii; the server
 *    already masks or omits PII fields when that flag is false.
 *  - Hidden debug columns are excluded by default.
 *  - SQL INSERT export is intentionally NOT implemented here.
 */

import * as XLSX from "xlsx";
import type { ExportFormat, ReportColumn, ReportResult } from "@/components/admin/reporting/reportingTypes";
import { formatCell, NULL_DISPLAY } from "@/components/admin/reporting/reportingFormatters";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  /** Include columns that are hidden-by-default (debug columns). Default: false. */
  includeHiddenColumns?: boolean;
}

// ── Formula injection protection ───────────────────────────────────────────────

/** Characters that trigger formula execution in Excel / Google Sheets. */
const FORMULA_PREFIXES = ["=", "+", "-", "@"] as const;

/**
 * Escape a string value that would be treated as a spreadsheet formula.
 * Prefixes dangerous strings with a single quote, which Excel and Sheets
 * display as plain text rather than evaluating.
 */
export function sanitizeFormulaInjection(value: string): string {
  if (FORMULA_PREFIXES.some((p) => value.startsWith(p))) {
    return `'${value}`;
  }
  return value;
}

// ── Column selection ───────────────────────────────────────────────────────────

export function getExportColumns(
  columns: ReportColumn[],
  opts: ExportOptions,
): ReportColumn[] {
  return columns.filter((c) => opts.includeHiddenColumns || !c.hiddenByDefault);
}

// ── Filename ───────────────────────────────────────────────────────────────────

export function buildFilename(slug: string, format: ExportFormat): string {
  const date     = new Date().toISOString().slice(0, 10);
  const safeName = slug.replace(/\./g, "-");
  return `wildfly-report_${safeName}_${date}.${format}`;
}

// ── Formatted-row builder (used by CSV and XLSX) ───────────────────────────────

export type ExportRowRecord = Record<string, string>;

/**
 * Build export rows using formatted, formula-injection-safe string values.
 * Empty/null cells are exported as empty strings (not the "—" sentinel).
 */
export function buildFormattedRows(
  result: ReportResult,
  opts: ExportOptions,
): { headers: string[]; rows: ExportRowRecord[] } {
  const cols    = getExportColumns(result.columns, opts);
  const headers = cols.map((c) => c.label);
  const rows    = result.rows.map((row) => {
    const out: ExportRowRecord = {};
    for (const col of cols) {
      const raw       = row[col.key];
      const formatted = formatCell(raw, col.type);
      const display   = formatted === NULL_DISPLAY ? "" : formatted;
      out[col.label]  = sanitizeFormulaInjection(display);
    }
    return out;
  });
  return { headers, rows };
}

// ── XLSX metadata ──────────────────────────────────────────────────────────────

export function buildXLSXMetadata(result: ReportResult): Record<string, string> {
  const piiIncluded = result.parameters?.include_pii === true;
  return {
    "Report Name":    result.report.name,
    "Report Slug":    result.report.slug,
    "Report Version": String(result.report.version),
    "Generated At":   result.generated_at,
    "Exported At":    new Date().toISOString(),
    "Run ID":         result.run_id,
    "Row Count":      String(result.rows.length),
    "PII Included":   piiIncluded ? "Yes" : "No",
    "Parameters":     JSON.stringify(result.parameters ?? {}),
  };
}

// ── Download trigger ───────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── CSV ────────────────────────────────────────────────────────────────────────

/**
 * RFC 4180 CSV cell escaping: wraps values containing commas, quotes, or
 * line-breaks in double quotes and doubles any embedded double quotes.
 */
export function escapeCSVCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCSV(
  result:    ReportResult,
  opts:      ExportOptions,
  filename?: string,
): void {
  const { headers, rows } = buildFormattedRows(result, opts);
  const lines = [
    headers.map(escapeCSVCell).join(","),
    ...rows.map((row) =>
      headers.map((h) => escapeCSVCell(String(row[h] ?? ""))).join(","),
    ),
  ];
  // UTF-8 BOM so Excel opens the file without a charset dialog.
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, filename ?? buildFilename(result.report.slug, "csv"));
}

// ── JSON ───────────────────────────────────────────────────────────────────────

/** Build the raw (unformatted) row array for a JSON export. Exported for testing. */
export function buildJSONRows(
  result: ReportResult,
  opts:   ExportOptions,
): Record<string, unknown>[] {
  const cols = getExportColumns(result.columns, opts);
  return result.rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of cols) {
      out[col.label] = row[col.key] ?? null;
    }
    return out;
  });
}

export function exportToJSON(
  result:    ReportResult,
  opts:      ExportOptions,
  filename?: string,
): void {
  // Raw unformatted values — JSON parsers do not evaluate formulas.
  const jsonRows = buildJSONRows(result, opts);
  const blob = new Blob([JSON.stringify(jsonRows, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, filename ?? buildFilename(result.report.slug, "json"));
}

// ── XLSX ───────────────────────────────────────────────────────────────────────

export function exportToXLSX(
  result:    ReportResult,
  opts:      ExportOptions,
  filename?: string,
): void {
  const { headers, rows } = buildFormattedRows(result, opts);

  // Data sheet (sheet name truncated to Excel's 31-char limit)
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Metadata sheet
  const metadata = buildXLSXMetadata(result);
  const metaRows = Object.entries(metadata).map(([Field, Value]) => ({ Field, Value }));
  const metaWs   = XLSX.utils.json_to_sheet(metaRows, { header: ["Field", "Value"] });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, result.report.name.slice(0, 31));
  XLSX.utils.book_append_sheet(wb, metaWs, "Metadata");

  XLSX.writeFile(wb, filename ?? buildFilename(result.report.slug, "xlsx"));
}

// ── performExport (pure — exported for testing) ────────────────────────────────

export interface ExportAuditParams {
  run_id:    string;
  format:    ExportFormat;
  row_count: number;
}

export type AuditLogger = (params: ExportAuditParams) => Promise<unknown>;

export type ExportOutcome =
  | { success: true }
  | { success: false; auditFailed: true };

/**
 * Execute the export (downloads the file) then audit the action.
 * If auditing fails the file has already been downloaded; callers should
 * surface a warning rather than treating the export as fully failed.
 */
export async function performExport(
  result:   ReportResult,
  format:   ExportFormat,
  opts:     ExportOptions,
  logAudit: AuditLogger,
): Promise<ExportOutcome> {
  // Download the file first (synchronous in the browser).
  switch (format) {
    case "xlsx": exportToXLSX(result, opts); break;
    case "csv":  exportToCSV(result, opts);  break;
    case "json": exportToJSON(result, opts); break;
  }

  // Audit asynchronously.
  try {
    await logAudit({
      run_id:    result.run_id,
      format,
      row_count: result.rows.length,
    });
    return { success: true };
  } catch {
    return { success: false, auditFailed: true };
  }
}
