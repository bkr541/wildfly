import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const { data, error } = await serviceClient
      .from("messaging_audiences")
      .select("id, name, description, filter_definition, is_active, last_estimated_count, last_estimated_at, created_at, archived_at")
      .is("archived_at", null)
      .order("name");

    if (error) return jsonError(error.message, 500);
    return jsonOk({ audiences: data ?? [] });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
