// ─────────────────────────────────────────────────────────────────────────────
// Frontend types for the Admin Reporting system.
//
// These types mirror the public response contracts returned by the reporting
// Edge Functions. They are intentionally separate from the server-side Deno
// types in supabase/functions/_shared/reporting/reportTypes.ts — the frontend
// should never import from that path.
//
// Network boundary: `unknown` is used only where the Edge Function contract
// explicitly allows freeform data (output_config, row cell values).
// All other fields are fully typed.
// ─────────────────────────────────────────────────────────────────────────────

// ── Parameter schema (mirrors server-side ReportParameterField) ──────────────

export type ReportParameterType =
  | "date"
  | "number"
  | "select"
  | "boolean"
  | "airport"
  | "text";

export interface ReportParameterOption {
  label: string;
  value: string;
}

export interface ReportParameterField {
  key:          string;
  label:        string;
  type:         ReportParameterType;
  required?:    boolean;
  minimum?:     number;
  maximum?:     number;
  options?:     ReportParameterOption[];
  helperText?:  string;
}

export interface ReportParameterSchema {
  fields: ReportParameterField[];
}

// ── Column definition (mirrors server-side ReportColumn) ──────────────────────

export type ReportColumnType =
  | "text"
  | "number"
  | "percent"
  | "currency"
  | "date"
  | "datetime"
  | "duration"
  | "boolean";

export interface ReportColumn {
  key:              string;
  label:            string;
  type:             ReportColumnType;
  pii?:             boolean;
  hiddenByDefault?: boolean;
}

// ── Summary metric (mirrors server-side ReportSummaryMetric) ──────────────────

export type ReportMetricType =
  | "text"
  | "number"
  | "percent"
  | "currency"
  | "date"
  | "datetime"
  | "duration";

export interface ReportSummaryMetric {
  key:    string;
  label:  string;
  value:  string | number | null;
  type?:  ReportMetricType;
}

// ── Chart configuration ────────────────────────────────────────────────────────

export type ReportChartType = "none" | "line" | "bar" | "donut";

export interface ReportChartSeries {
  key:   string;
  label: string;
}

export interface ReportChart {
  type:    ReportChartType;
  xKey?:   string;
  series?: ReportChartSeries[];
}

// ── Pagination ─────────────────────────────────────────────────────────────────

export interface ReportPagination {
  page:       number;
  page_size:  number;
  total_rows: number | null;
  truncated:  boolean;
}

// ── Report definition (returned by admin-list-reports) ────────────────────────
//
// output_config is an opaque structure stored in the database. The frontend
// does not need to parse its contents; it is kept as `unknown` here.

export interface ReportDefinition {
  id:                 string;
  slug:               string;
  category:           string;
  name:               string;
  description:        string | null;
  parameter_schema:   ReportParameterSchema;
  default_parameters: Record<string, unknown>;
  output_config:      unknown;
  contains_pii:       boolean;
  version:            number;
}

// ── Report execution result (returned by admin-run-report) ────────────────────
//
// rows cells are `unknown` at the network boundary; formatters in
// reportingFormatters.ts narrow each value before rendering.

export type ReportRow = Record<string, unknown>;

export interface ReportResult {
  report: {
    slug:     string;
    name:     string;
    category: string;
    version:  number;
  };
  run_id:       string;
  generated_at: string;
  parameters:   Record<string, unknown>;
  summary:      ReportSummaryMetric[];
  columns:      ReportColumn[];
  rows:         ReportRow[];
  chart?:       ReportChart;
  pagination:   ReportPagination;
  duration_ms:  number;
}

// ── Run status ────────────────────────────────────────────────────────────────

export type ReportRunStatus = "running" | "completed" | "failed";

// ── Report run history entry (returned by admin-list-report-runs) ─────────────

export interface ReportRun {
  id:               string;
  report_slug:      string;
  report_version:   number;
  report_name:      string | null;
  report_category:  string | null;
  requested_by:     string;
  parameters:       Record<string, unknown>;
  status:           ReportRunStatus;
  started_at:       string;
  completed_at:     string | null;
  duration_ms:      number | null;
  row_count:        number | null;
  truncated:        boolean | null;
  error_code:       string | null;
  error_message:    string | null;
}

// ── Export format ──────────────────────────────────────────────────────────────

export type ExportFormat = "csv" | "xlsx" | "json";

// ── Export audit record (returned by admin-log-report-export) ─────────────────

export interface ReportExportRecord {
  id:            string;
  report_run_id: string;
  report_slug:   string;
  requested_by:  string;
  format:        ExportFormat;
  row_count:     number;
  created_at:    string;
}

// ── Parameters passed to admin-run-report ─────────────────────────────────────

export type ReportRunParams = Record<string, unknown>;

// ── Service-level list filters ────────────────────────────────────────────────

export interface ListRunsParams {
  slug?:       string;
  status?:     ReportRunStatus;
  date_from?:  string;   // YYYY-MM-DD filter on started_at (inclusive)
  date_to?:    string;   // YYYY-MM-DD filter on started_at (inclusive, end-of-day)
  page?:       number;
  page_size?:  number;
}

// ── Service-level list response shapes ────────────────────────────────────────

export interface ListReportsResult {
  reports:   ReportDefinition[];
  warnings:  string[];
  total:     number;
  excluded:  number;
}

export interface ListRunsResult {
  runs:      ReportRun[];
  total:     number;
  page:      number;
  page_size: number;
}

// ── Typed error surfaced by the service layer ─────────────────────────────────
//
// The service layer translates all Edge Function responses into typed errors
// of this class. UI components should never receive raw Supabase invocation
// errors or bare Error objects from the service layer.

export type ReportingErrorKind =
  | "UNAUTHENTICATED"   // 401 — session expired or missing
  | "FORBIDDEN"         // 403 — user lacks developer role
  | "REPORT_NOT_FOUND"  // report slug not registered
  | "VALIDATION"        // parameter validation failed
  | "REPORT_TIMEOUT"    // handler exceeded the 14s timeout
  | "VERSION_MISMATCH"  // registry version ≠ database version
  | "INVALID_RESPONSE"  // response shape was unexpected (should never happen)
  | "NETWORK"           // network / CORS failure
  | "SERVER_ERROR";     // all other server-side errors

export class AdminReportingError extends Error {
  readonly kind:  ReportingErrorKind;
  readonly code?: string;

  constructor(kind: ReportingErrorKind, message: string, code?: string) {
    super(message);
    this.name = "AdminReportingError";
    this.kind = kind;
    this.code = code;
  }
}
