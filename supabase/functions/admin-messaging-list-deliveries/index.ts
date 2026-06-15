import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const {
      message_id,
      status,
      channel,
      search,
      page = 0,
      page_size = 50,
    } = await req.json().catch(() => ({})) as {
      message_id?: string;
      status?: string;
      channel?: string;
      search?: string;
      page?: number;
      page_size?: number;
    };

    let q = serviceClient
      .from("messaging_recipients")
      .select(`
        id, message_id, channel, user_id, beta_application_id,
        email, normalized_email, recipient_name,
        status, provider, provider_message_id,
        attempt_count, last_error,
        queued_at, sent_at, delivered_at, opened_at, clicked_at,
        failed_at, bounced_at, unsubscribed_at, created_at
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * page_size, (page + 1) * page_size - 1);

    if (message_id) q = q.eq("message_id", message_id);
    if (status) q = q.eq("status", status);
    if (channel) q = q.eq("channel", channel);
    if (search?.trim()) q = q.ilike("email", `%${search.trim()}%`);

    const { data, error, count } = await q;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ recipients: data ?? [], total: count ?? 0, page, page_size });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
