import { requireDeveloper, jsonOk, jsonError, handleCors } from "../_shared/adminAuth.ts";

// Statements that return rows — route to exec_sql_admin.
// Everything else (DDL, DML without RETURNING) goes to admin_exec_ddl.
const SELECT_PATTERN = /^\s*(select|with|explain|table|values)\b/i;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;

  let body: { sql?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const sql = (body.sql ?? "").trim();
  if (!sql) {
    return jsonError("sql is required", 400);
  }

  const startedAt = Date.now();

  if (SELECT_PATTERN.test(sql)) {
    // Read query — use exec_sql_admin (service_role, no gateway timeout)
    const { data, error } = await ctx.serviceClient.rpc("exec_sql_admin", { query: sql });
    if (error) {
      return jsonError(error.message || "Query failed", 400, "SQL_ERROR");
    }
    return jsonOk({
      status: "ok",
      durationMs: Date.now() - startedAt,
      rows: data,
    });
  }

  // DDL / DML — use admin_exec_ddl
  const { data, error } = await ctx.serviceClient.rpc("admin_exec_ddl", { p_sql: sql });
  if (error) {
    return jsonError(error.message || "SQL execution failed", 400, "SQL_ERROR");
  }

  return jsonOk({
    status: "ok",
    durationMs: Date.now() - startedAt,
    result: data,
  });
});
