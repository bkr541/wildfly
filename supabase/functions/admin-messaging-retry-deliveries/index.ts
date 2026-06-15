import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";
import { MAX_ATTEMPTS } from "../_shared/messagingProvider.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { userId, serviceClient } = ctx;

  try {
    const { recipient_ids, message_id } = await req.json() as {
      recipient_ids?: string[];
      message_id?: string;
    };

    if (!recipient_ids?.length && !message_id) {
      return jsonError("recipient_ids or message_id required", 400);
    }

    let q = serviceClient
      .from("messaging_recipients")
      .select("id, attempt_count")
      .in("status", ["failed", "bounced"])
      .lt("attempt_count", MAX_ATTEMPTS);

    if (recipient_ids?.length) q = q.in("id", recipient_ids);
    if (message_id) q = q.eq("message_id", message_id);

    const { data: eligible } = await q;
    if (!eligible?.length) return jsonOk({ retried: 0 });

    const now = new Date().toISOString();
    const ids = eligible.map((r: { id: string }) => r.id);

    await serviceClient
      .from("messaging_recipients")
      .update({ status: "queued", next_attempt_at: now, last_error: null })
      .in("id", ids);

    await serviceClient.from("messaging_audit_log").insert({
      actor_id: userId, action: "delivery_retried",
      entity_type: "messaging_recipient",
      entity_id: message_id ?? null,
      metadata: { count: ids.length },
    });

    return jsonOk({ retried: ids.length });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
