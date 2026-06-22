import { handleCors, requireReportingAccess, jsonOk, jsonError } from "../_shared/adminAuth.ts";
import { sanitizeText } from "../_shared/reporting/reportFormatting.ts";
import { LIMITS } from "../_shared/reporting/reportValidation.ts";

// ─────────────────────────────────────────────────────────────────────────────
// admin-list-report-runs
//
// Paginated history of report executions.
// Joins admin_report_definitions for report name and category.
// Never returns full report row data.
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const ctx = await requireReportingAccess(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const {
      slug,
      status,
      date_from,
      date_to,
      page     = 0,
      page_size = 25,
    } = await req.json().catch(() => ({})) as {
      slug?:      string;
      status?:    string;
      date_from?: string;
      date_to?:   string;
      page?:      number;
      page_size?: number;
    };

    const safePage     = Math.max(0, Math.floor(Number(page) || 0));
    const safePageSize = Math.min(
      Math.max(1, Math.floor(Number(page_size) || 25)),
      LIMITS.MAX_PAGE_SIZE,
    );
    const from = safePage * safePageSize;
    const to   = from + safePageSize - 1;

    let q = serviceClient
      .from("admin_report_runs")
      .select(
        `id,
         report_slug,
         report_version,
         requested_by,
         parameters,
         status,
         started_at,
         completed_at,
         duration_ms,
         row_count,
         truncated,
         error_code,
         error_message,
         admin_report_definitions!report_definition_id (name, category)`,
        { count: "exact" },
      )
      .order("started_at", { ascending: false })
      .range(from, to);

    if (slug?.trim()) q = q.eq("report_slug", slug.trim());
    if (status?.trim()) q = q.eq("status", status.trim());

    // Date range filters on started_at. Accept only YYYY-MM-DD strings to
    // prevent injection; Postgres casts them to midnight UTC automatically.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (date_from?.trim() && DATE_RE.test(date_from.trim())) {
      q = q.gte("started_at", date_from.trim() + "T00:00:00.000Z");
    }
    if (date_to?.trim() && DATE_RE.test(date_to.trim())) {
      q = q.lte("started_at", date_to.trim() + "T23:59:59.999Z");
    }

    const { data, error, count } = await q;
    if (error) return jsonError(error.message, 500, "DB_ERROR");

    // Shape each row: sanitize error messages and flatten embedded relation.
    const runs = (data ?? []).map((r) => {
      const def = r.admin_report_definitions as { name: string; category: string } | null;
      return {
        id:             r.id,
        report_slug:    r.report_slug,
        report_version: r.report_version,
        report_name:    def?.name ?? null,
        report_category:def?.category ?? null,
        requested_by:   r.requested_by,
        parameters:     r.parameters,
        status:         r.status,
        started_at:     r.started_at,
        completed_at:   r.completed_at,
        duration_ms:    r.duration_ms,
        row_count:      r.row_count,
        truncated:      r.truncated,
        error_code:     r.error_code ?? null,
        // Never surface raw DB errors or stack traces to the client.
        error_message:  r.error_message
          ? sanitizeText(r.error_message).slice(0, 500)
          : null,
      };
    });

    return jsonOk({ runs, total: count ?? 0, page: safePage, page_size: safePageSize });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
