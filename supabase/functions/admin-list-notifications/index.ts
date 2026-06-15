import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const { search, type, page = 0, page_size = 50 } = await req.json().catch(() => ({})) as {
      search?: string; type?: string; page?: number; page_size?: number;
    };

    let q = serviceClient
      .from("notifications")
      .select(`
        id, user_id, type, title, body, notification_group, audience,
        is_read, created_at
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * page_size, (page + 1) * page_size - 1);

    if (type) q = q.eq("type", type);
    if (search?.trim()) {
      q = q.or(`title.ilike.%${search.trim()}%,type.ilike.%${search.trim()}%`);
    }

    const { data, error, count } = await q;
    if (error) return jsonError(error.message, 500);

    // Fetch stats via a direct aggregate — no SECURITY DEFINER needed
    const { data: stats } = await serviceClient.rpc("get_notification_type_stats");

    return jsonOk({
      notifications: data ?? [],
      stats: stats ?? [],
      total: count ?? 0,
      page,
      page_size,
    });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
