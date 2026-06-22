// ─────────────────────────────────────────────────────────────────────────────
// Admin Reporting service layer.
//
// All methods call reporting Edge Functions via supabase.functions.invoke and
// return typed, unwrapped inner data objects.
//
// No raw Edge Function responses or Supabase invocation objects leak out of
// this module. All errors are translated into AdminReportingError so that
// UI components receive one coherent error type.
//
// Edge Function response envelope:
//   Success: { success: true,  data: <inner> }
//   Failure: { success: false, error: { code: string, message: string } }
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type {
  ListReportsResult,
  ListRunsParams,
  ListRunsResult,
  ReportResult,
  ReportRunParams,
  ExportFormat,
  ReportExportRecord,
} from "@/components/admin/reporting/reportingTypes";
import {
  AdminReportingError,
  type ReportingErrorKind,
} from "@/components/admin/reporting/reportingTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Translate an Edge Function error code into a frontend error kind. */
function codeToKind(code: string | undefined): ReportingErrorKind {
  switch (code) {
    case "UNAUTHORIZED":
    case "HTTP_401":
      return "UNAUTHENTICATED";
    case "FORBIDDEN":
    case "HTTP_403":
      return "FORBIDDEN";
    case "REPORT_NOT_FOUND":
    case "HTTP_404":
      return "REPORT_NOT_FOUND";
    case "PARAMETER_VALIDATION_ERROR":
    case "VALIDATION_ERROR":
    case "INVALID_REQUEST":
      return "VALIDATION";
    case "HANDLER_TIMEOUT":
      return "REPORT_TIMEOUT";
    case "VERSION_MISMATCH":
      return "VERSION_MISMATCH";
    default:
      return "SERVER_ERROR";
  }
}

/** Guard: narrows the `invoke` result to the inner `data` payload. */
function assertSuccess<T>(
  invokeData: unknown,
  invokeError: unknown,
): T {
  // Supabase-level error (network, CORS, unexpected status code).
  if (invokeError !== null && invokeError !== undefined) {
    const msg = invokeError instanceof Error
      ? invokeError.message
      : String(invokeError);
    // Heuristic: authentication-level messages from the Supabase client.
    if (/unauthorized|unauthenticated|jwt|token/i.test(msg)) {
      throw new AdminReportingError("UNAUTHENTICATED", msg);
    }
    if (/network|fetch|failed to fetch|connection/i.test(msg)) {
      throw new AdminReportingError("NETWORK", msg);
    }
    throw new AdminReportingError("NETWORK", msg);
  }

  // Application-level error from the Edge Function body.
  if (
    invokeData !== null &&
    typeof invokeData === "object" &&
    "success" in (invokeData as Record<string, unknown>) &&
    (invokeData as Record<string, unknown>).success === false
  ) {
    const body = invokeData as { success: false; error?: { code?: string; message?: string } };
    const code    = body.error?.code;
    const message = body.error?.message ?? "An unknown error occurred";
    throw new AdminReportingError(codeToKind(code), message, code);
  }

  // Unexpected response shape (should never happen in practice).
  if (
    invokeData === null ||
    invokeData === undefined ||
    typeof invokeData !== "object" ||
    !("success" in (invokeData as Record<string, unknown>)) ||
    (invokeData as Record<string, unknown>).success !== true ||
    !("data" in (invokeData as Record<string, unknown>))
  ) {
    throw new AdminReportingError(
      "INVALID_RESPONSE",
      "Unexpected response shape from reporting service",
    );
  }

  return (invokeData as { success: true; data: T }).data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all active, callable report definitions.
 *
 * Returns only reports that have a registered handler (slug in the registry).
 * `warnings` may contain developer-facing notes about version mismatches or
 * unregistered slugs; they are not surfaced to the UI but can be logged.
 */
export async function listReports(): Promise<ListReportsResult> {
  const { data: raw, error } = await supabase.functions.invoke(
    "admin-list-reports",
    { body: {} },
  );
  return assertSuccess<ListReportsResult>(raw, error);
}

/**
 * Execute a registered report with the given parameters.
 *
 * The server resolves the slug through the static REPORT_REGISTRY before
 * executing. No SQL, table names, or function names are accepted from the
 * caller — only a slug and user-provided parameters.
 *
 * The resolved inner data is `ReportResult` (the handler's execution result
 * with run_id, rows, columns, summary, chart, pagination, etc.).
 */
export async function runReport(
  slug: string,
  parameters: ReportRunParams,
  opts?: { page?: number; page_size?: number },
): Promise<ReportResult> {
  // _page / _page_size may be passed inline with the parameters object so that
  // pagination changes can be dispatched without modifying the hook's opts ref.
  // Strip them before sending to the report handler.
  const { _page, _page_size, ...cleanParams } = parameters as ReportRunParams & {
    _page?:      number;
    _page_size?: number;
  };
  const { data: raw, error } = await supabase.functions.invoke(
    "admin-run-report",
    {
      body: {
        report:     slug,
        parameters: cleanParams,
        page:       opts?.page      ?? _page      ?? 0,
        page_size:  opts?.page_size ?? _page_size ?? 100,
      },
    },
  );
  return assertSuccess<ReportResult>(raw, error);
}

/**
 * Fetch paginated report run history.
 *
 * Optionally filter by slug or status. Never returns full row data —
 * only run metadata (status, duration, row count, error details).
 */
export async function listReportRuns(
  params: ListRunsParams = {},
): Promise<ListRunsResult> {
  const { data: raw, error } = await supabase.functions.invoke(
    "admin-list-report-runs",
    { body: params },
  );
  return assertSuccess<ListRunsResult>(raw, error);
}

/**
 * Record an export event for a completed report run.
 *
 * Must be called immediately after the client generates a CSV/XLSX/JSON
 * download, before the data leaves the browser. The server validates that
 * the referenced run exists and is in `completed` status.
 */
export async function logReportExport(params: {
  run_id:    string;
  format:    ExportFormat;
  row_count: number;
}): Promise<ReportExportRecord> {
  const { data: raw, error } = await supabase.functions.invoke(
    "admin-log-report-export",
    { body: params },
  );
  const inner = assertSuccess<{ export: ReportExportRecord }>(raw, error);
  return inner.export;
}
