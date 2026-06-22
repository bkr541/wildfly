import { handleCors, requireReportingAccess, jsonOk, jsonError } from "../_shared/adminAuth.ts";
import { REPORT_REGISTRY } from "../_shared/reporting/reportRegistry.ts";
import { LIMITS } from "../_shared/reporting/reportValidation.ts";
import {
  ERROR_CODES,
  HANDLER_TIMEOUT_MS,
  withTimeout,
  mapErrorCode,
  sanitizeErrorMessage,
  mergeParameters,
  clampPage,
  clampPageSize,
  enforceRowLimit,
  shouldIncludePii,
  applyPiiMask,
} from "../_shared/reporting/reportEngine.ts";
import { sanitizeText } from "../_shared/reporting/reportFormatting.ts";

// ─────────────────────────────────────────────────────────────────────────────
// admin-run-report
//
// Executes a single registered report and records the run in admin_report_runs.
// Only slugs present in the static REPORT_REGISTRY are executable.
// No SQL, table names, or function names are accepted from the client.
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const ctx = await requireReportingAccess(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient, userId } = ctx;

  // ── 1. Parse body ─────────────────────────────────────────────────────────

  let body: {
    report?: unknown;
    parameters?: unknown;
    page?: unknown;
    page_size?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400, "INVALID_REQUEST");
  }

  // ── 2. Validate report slug (client-visible allowlist check only) ──────────

  const slug = typeof body.report === "string" ? body.report.trim() : "";
  if (!slug) {
    return jsonError("report is required", 400, "INVALID_REQUEST");
  }

  // ── 3. Resolve slug through the static registry ───────────────────────────

  const registryEntry = REPORT_REGISTRY.get(slug);
  if (!registryEntry) {
    return jsonError(`No registered handler for "${slug}"`, 404, ERROR_CODES.REPORT_NOT_FOUND);
  }

  // ── 4. Fetch active database definition ───────────────────────────────────

  const { data: dbDef, error: dbError } = await serviceClient
    .from("admin_report_definitions")
    .select("id, slug, is_active, handler_key, version, default_parameters, contains_pii, name, category")
    .eq("slug", slug)
    .maybeSingle();

  if (dbError) {
    return jsonError(dbError.message, 500, "DB_ERROR");
  }
  if (!dbDef) {
    return jsonError(`Report "${slug}" not found`, 404, ERROR_CODES.REPORT_NOT_FOUND);
  }
  if (!dbDef.is_active) {
    return jsonError(`Report "${slug}" is not active`, 400, ERROR_CODES.REPORT_INACTIVE);
  }
  if (dbDef.handler_key !== registryEntry.handlerKey) {
    return jsonError(
      `handler_key mismatch for "${slug}"`,
      500,
      ERROR_CODES.REPORT_VERSION_MISMATCH,
    );
  }
  if (dbDef.version !== registryEntry.version) {
    return jsonError(
      `Version mismatch for "${slug}": database v${dbDef.version}, registry v${registryEntry.version}`,
      409,
      ERROR_CODES.REPORT_VERSION_MISMATCH,
    );
  }

  // ── 5. Merge and validate parameters ─────────────────────────────────────

  const submitted = (body.parameters != null && typeof body.parameters === "object" && !Array.isArray(body.parameters))
    ? body.parameters as Record<string, unknown>
    : {};
  const dbDefaults = (dbDef.default_parameters != null && typeof dbDef.default_parameters === "object")
    ? dbDef.default_parameters as Record<string, unknown>
    : {};

  const merged = mergeParameters(dbDefaults, submitted);

  const paramValidation = registryEntry.validateParameters(merged);
  if (!paramValidation.success) {
    return jsonError(paramValidation.error, 400, ERROR_CODES.INVALID_PARAMETERS);
  }
  const validatedParams = paramValidation.data;

  // ── 6. Clamp pagination ───────────────────────────────────────────────────

  const page     = clampPage(body.page);
  const pageSize = clampPageSize(body.page_size);

  // ── 7. Determine PII mode ─────────────────────────────────────────────────

  const includePii = shouldIncludePii(
    dbDef.contains_pii,
    validatedParams.include_pii === true,
  );

  // Record actual PII mode in the stored parameters for audit purposes.
  const storedParams: Record<string, unknown> = {
    ...validatedParams,
    include_pii: includePii,
  };

  // ── 8. Insert run row (status = 'running') ────────────────────────────────

  const { data: runRow, error: insertError } = await serviceClient
    .from("admin_report_runs")
    .insert({
      report_definition_id: dbDef.id,
      report_slug:    slug,
      report_version: registryEntry.version,
      requested_by:   userId,
      parameters:     storedParams,
      status:         "running",
    })
    .select("id")
    .single();

  if (insertError || !runRow) {
    return jsonError(insertError?.message ?? "Failed to create run record", 500, "DB_ERROR");
  }

  const runId    = runRow.id as string;
  const startedAt = Date.now();

  // ── Helper: mark run failed and return an error response ─────────────────

  async function failRun(code: string, userMessage: string, devMessage: string): Promise<Response> {
    console.error(`[admin-run-report] run=${runId} slug=${slug} code=${code}: ${devMessage}`);
    await serviceClient
      .from("admin_report_runs")
      .update({
        status:       "failed",
        completed_at: new Date().toISOString(),
        duration_ms:  Date.now() - startedAt,
        error_code:   code,
        error_message: sanitizeText(userMessage).slice(0, 500),
      })
      .eq("id", runId);
    return jsonError(userMessage, 500, code);
  }

  // ── 9. Execute handler ────────────────────────────────────────────────────

  let result;
  try {
    result = await withTimeout(
      registryEntry.handler({
        parameters:   validatedParams,
        serviceClient,
        requestedBy:  userId,
        includePii,
        page,
        pageSize,
      }),
      HANDLER_TIMEOUT_MS,
    );
  } catch (err) {
    const code        = mapErrorCode(err as Error);
    const userMessage = sanitizeErrorMessage(err as Error);
    return await failRun(code, userMessage, (err as Error).message ?? String(err));
  }

  // ── 10. Post-process: PII masking ─────────────────────────────────────────

  const piiColumnKeys = registryEntry.columns.filter((c) => c.pii).map((c) => c.key);
  let rows = applyPiiMask(result.rows, piiColumnKeys, includePii);

  // ── 11. Post-process: enforce row cap (safety net) ────────────────────────

  const { rows: cappedRows, truncated } = enforceRowLimit(rows, pageSize);
  rows = cappedRows;

  // ── 12. Update run to completed ───────────────────────────────────────────

  const durationMs = Date.now() - startedAt;
  await serviceClient
    .from("admin_report_runs")
    .update({
      status:       "completed",
      completed_at: new Date().toISOString(),
      duration_ms:  durationMs,
      row_count:    rows.length,
      truncated:    truncated || result.pagination.truncated,
    })
    .eq("id", runId);

  // ── 13. Return result ─────────────────────────────────────────────────────

  return jsonOk({
    ...result,
    run_id:   runId,
    rows,
    pagination: {
      ...result.pagination,
      page,
      page_size: pageSize,
      truncated: truncated || result.pagination.truncated,
    },
    duration_ms: durationMs,
  });
});
