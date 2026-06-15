import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const { status, category, channel, search, page = 0, page_size = 25 } =
      await req.json().catch(() => ({})) as {
        status?: string; category?: string; channel?: string;
        search?: string; page?: number; page_size?: number;
      };

    let q = serviceClient
      .from("messaging_messages")
      .select(`
        id, internal_name, internal_description, category, classification,
        status, channels, recipient_count, eligible_count,
        created_by, created_at, scheduled_at, completed_at, cancelled_at,
        last_error, template_id, email_subject
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * page_size, (page + 1) * page_size - 1);

    if (status) q = q.eq("status", status);
    if (category) q = q.eq("category", category);
    if (channel) q = q.contains("channels", [channel]);
    if (search?.trim()) q = q.ilike("internal_name", `%${search.trim()}%`);

    const { data, error, count } = await q;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ messages: data ?? [], total: count ?? 0, page, page_size });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
