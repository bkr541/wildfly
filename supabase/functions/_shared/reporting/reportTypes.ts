// ─────────────────────────────────────────────────────────────────────────────
// Shared reporting contracts.
// All report handlers MUST return AdminReportExecutionResult.
// No other response shapes are permitted.
// ─────────────────────────────────────────────────────────────────────────────

export type ReportCategory =
  | "Users"
  | "Flight Searches"
  | "GoWild Availability"
  | "Beta Program"
  | "Operations";

// ── Parameter field definition ────────────────────────────────────────────────

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
  key: string;
  label: string;
  type: ReportParameterType;
  required?: boolean;
  minimum?: number;
  maximum?: number;
  options?: ReportParameterOption[];
  helperText?: string;
}

export interface ReportParameterSchema {
  fields: ReportParameterField[];
}

// ── Output column definition ──────────────────────────────────────────────────

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
  key: string;
  label: string;
  type: ReportColumnType;
  pii?: boolean;
  hiddenByDefault?: boolean;
}

// ── Summary metric ────────────────────────────────────────────────────────────

export type ReportMetricType =
  | "text"
  | "number"
  | "percent"
  | "currency"
  | "date"
  | "datetime"
  | "duration";

export interface ReportSummaryMetric {
  key: string;
  label: string;
  value: string | number | null;
  type?: ReportMetricType;
}

// ── Chart ─────────────────────────────────────────────────────────────────────

export type ReportChartType = "none" | "line" | "bar" | "donut";

export interface ReportChartSeries {
  key: string;
  label: string;
}

export interface ReportChart {
  type: ReportChartType;
  xKey?: string;
  series?: ReportChartSeries[];
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface ReportPagination {
  page: number;
  page_size: number;
  total_rows: number | null;
  truncated: boolean;
}

// ── Execution result (the enforced handler return type) ───────────────────────

export interface AdminReportExecutionResult {
  report: {
    slug: string;
    name: string;
    category: string;
    version: number;
  };
  run_id: string;
  generated_at: string;
  parameters: Record<string, unknown>;
  summary: ReportSummaryMetric[];
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  chart?: ReportChart;
  pagination: ReportPagination;
  duration_ms: number;
}

// ── Handler context ───────────────────────────────────────────────────────────

export interface ReportHandlerContext {
  parameters: Record<string, unknown>;
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: any;
  requestedBy: string;
  includePii: boolean;
  page: number;
  pageSize: number;
}

// ── Handler function signature ────────────────────────────────────────────────

export type ReportHandler = (
  ctx: ReportHandlerContext,
) => Promise<AdminReportExecutionResult>;

// ── Parameter validation result ───────────────────────────────────────────────

export type ParameterValidationResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string };

// ── Registry entry ────────────────────────────────────────────────────────────

export interface ReportRegistryEntry {
  slug: string;
  handlerKey: string;
  version: number;
  parameterSchema: ReportParameterSchema;
  validateParameters: (raw: unknown) => ParameterValidationResult;
  columns: ReportColumn[];
  chart: ReportChart;
  containsPii: boolean;
  handler: ReportHandler;
}
