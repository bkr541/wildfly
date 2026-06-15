import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const { include_archived = false } = await req.json().catch(() => ({})) as { include_archived?: boolean };

    let q = serviceClient
      .from("messaging_templates")
      .select("id, slug, name, description, category, is_active, is_transactional, supported_channels, available_variables, required_variables, version, created_at, updated_at, archived_at, email_subject, notification_type, notification_title, default_reply_to")
      .order("category")
      .order("name");

    if (!include_archived) q = q.is("archived_at", null);

    const { data, error } = await q;
    if (error) return jsonError(error.message, 500);
    return jsonOk({ templates: data ?? [] });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
