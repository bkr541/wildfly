import { handleCors, requireReportingAccess, jsonOk, jsonError } from "../_shared/adminAuth.ts";
import { REPORT_REGISTRY } from "../_shared/reporting/reportRegistry.ts";

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
    const { data: definitions, error } = await serviceClient
      .from("admin_report_definitions")
      .select(
        "id, slug, category, name, description, parameter_schema, default_parameters, output_config, contains_pii, version, sort_order",
      )
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return jsonError(error.message, 500, "DB_ERROR");
    }

    const warnings: string[] = [];
    const reports: unknown[] = [];
    let excluded = 0;

    for (const def of (definitions ?? [])) {
      const entry = REPORT_REGISTRY.get(def.slug);

      if (!entry) {
        // Database has a definition that the code registry does not recognise.
        // Exclude it from the response — it is not callable.
        excluded++;
        warnings.push(
          `"${def.slug}" is active in the database but has no registered handler — excluded`,
        );
        continue;
      }

      if (entry.version !== def.version) {
        warnings.push(
          `"${def.slug}": registry version (${entry.version}) does not match database version (${def.version})`,
        );
      }

      // Never expose implementation details (handler names, SQL, table names).
      reports.push({
        id: def.id,
        slug: def.slug,
        category: def.category,
        name: def.name,
        description: def.description,
        parameter_schema: def.parameter_schema,
        default_parameters: def.default_parameters,
        output_config: def.output_config,
        contains_pii: def.contains_pii,
        version: def.version,
      });
    }

    return jsonOk({
      reports,
      warnings,
      total: reports.length,
      excluded,
    });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
