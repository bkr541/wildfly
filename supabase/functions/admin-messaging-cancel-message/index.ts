import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { userId, serviceClient } = ctx;

  try {
    const { message_id } = await req.json() as { message_id: string };
    if (!message_id) return jsonError("message_id required", 400);

    const { data: msg } = await serviceClient
      .from("messaging_messages")
      .select("status, internal_name")
      .eq("id", message_id)
      .maybeSingle();

    if (!msg) return jsonError("Message not found", 404);
    if (!["scheduled", "queued"].includes(msg.status as string)) {
      return jsonError(`Cannot cancel a message with status '${msg.status}'`, 409);
    }

    const now = new Date().toISOString();
    await serviceClient
      .from("messaging_messages")
      .update({ status: "cancelled", cancelled_at: now, updated_by: userId })
      .eq("id", message_id);

    await serviceClient
      .from("messaging_recipients")
      .update({ status: "cancelled" })
      .eq("message_id", message_id)
      .eq("status", "queued");

    await serviceClient.from("messaging_audit_log").insert({
      actor_id: userId, action: "message_cancelled",
      entity_type: "messaging_message", entity_id: message_id,
      metadata: { internal_name: msg.internal_name },
    });

    return jsonOk({ cancelled: true });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
