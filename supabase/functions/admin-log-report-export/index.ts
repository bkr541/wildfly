import { handleCors, requireReportingAccess, jsonOk, jsonError } from "../_shared/adminAuth.ts";

// ─────────────────────────────────────────────────────────────────────────────
// admin-log-report-export
//
// Records an export event for a completed report run.
// Validates that the referenced run exists and is in 'completed' status
// before inserting into admin_report_exports.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_FORMATS = ["csv", "xlsx", "json"] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

function isValidFormat(f: unknown): f is ExportFormat {
  return typeof f === "string" && (VALID_FORMATS as readonly string[]).includes(f);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const ctx = await requireReportingAccess(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient, userId } = ctx;

  let body: { run_id?: unknown; format?: unknown; row_count?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, "INVALID_REQUEST");
  }

  // ── Validate run_id ───────────────────────────────────────────────────────

  const runId = typeof body.run_id === "string" ? body.run_id.trim() : "";
  if (!runId) {
    return jsonError("run_id is required", 400, "INVALID_REQUEST");
  }
  // Basic UUID format check
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(runId)) {
    return jsonError("run_id must be a valid UUID", 400, "INVALID_REQUEST");
  }

  // ── Validate format ───────────────────────────────────────────────────────

  if (!isValidFormat(body.format)) {
    return jsonError(
      `format must be one of: ${VALID_FORMATS.join(", ")}`,
      400,
      "INVALID_FORMAT",
    );
  }
  const format: ExportFormat = body.format;

  // ── Validate row_count ────────────────────────────────────────────────────

  const rowCountRaw = Number(body.row_count);
  if (!Number.isInteger(rowCountRaw) || rowCountRaw < 0) {
    return jsonError("row_count must be a non-negative integer", 400, "INVALID_REQUEST");
  }
  const rowCount = rowCountRaw;

  // ── Confirm run exists and is completed ───────────────────────────────────

  const { data: run, error: runError } = await serviceClient
    .from("admin_report_runs")
    .select("id, status, report_slug")
    .eq("id", runId)
    .maybeSingle();

  if (runError) {
    return jsonError(runError.message, 500, "DB_ERROR");
  }
  if (!run) {
    return jsonError(`Report run "${runId}" not found`, 404, "RUN_NOT_FOUND");
  }
  if (run.status !== "completed") {
    return jsonError(
      `Cannot log export for a run with status "${run.status}" — only completed runs may be exported`,
      409,
      "RUN_NOT_COMPLETED",
    );
  }

  // ── Insert export audit record ────────────────────────────────────────────

  const { data: exportRow, error: insertError } = await serviceClient
    .from("admin_report_exports")
    .insert({
      report_run_id: runId,
      requested_by:  userId,
      format,
      row_count:     rowCount,
    })
    .select("id, report_run_id, requested_by, format, row_count, created_at")
    .single();

  if (insertError || !exportRow) {
    return jsonError(
      insertError?.message ?? "Failed to record export",
      500,
      "DB_ERROR",
    );
  }

  return jsonOk({
    export: {
      id:            exportRow.id,
      report_run_id: exportRow.report_run_id,
      report_slug:   run.report_slug,
      requested_by:  exportRow.requested_by,
      format:        exportRow.format,
      row_count:     exportRow.row_count,
      created_at:    exportRow.created_at,
    },
  });
});
