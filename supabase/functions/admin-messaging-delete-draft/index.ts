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
    if (msg.status !== "draft") return jsonError("Only drafts can be deleted", 409);

    await serviceClient.from("messaging_messages").delete().eq("id", message_id);

    await serviceClient.from("messaging_audit_log").insert({
      actor_id: userId, action: "message_deleted",
      entity_type: "messaging_message", entity_id: message_id,
      metadata: { internal_name: msg.internal_name },
    });

    return jsonOk({ deleted: true });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
