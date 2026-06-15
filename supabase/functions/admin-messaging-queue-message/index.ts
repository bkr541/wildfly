import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";
import { resolveAudience, AudienceFilter } from "../_shared/messagingAudience.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { userId, serviceClient } = ctx;

  try {
    const { message_id, scheduled_at } = await req.json() as {
      message_id: string;
      scheduled_at?: string;
    };

    if (!message_id) return jsonError("message_id required", 400);

    const { data: msg } = await serviceClient
      .from("messaging_messages")
      .select("*")
      .eq("id", message_id)
      .maybeSingle();

    if (!msg) return jsonError("Message not found", 404);

    const status = msg.status as string;
    if (status !== "draft" && status !== "scheduled") {
      return jsonError(`Cannot queue a message with status '${status}'`, 409);
    }

    const channels = (msg.channels as string[]) ?? ["email"];
    if (!channels.length) return jsonError("No channels selected", 400);
    if (!msg.email_subject && channels.includes("email")) return jsonError("Email subject required", 400);
    if (!msg.email_html && channels.includes("email")) return jsonError("Email HTML required", 400);

    const filterDef = (msg.audience_definition ?? {}) as AudienceFilter;
    const classification = (msg.classification as string) ?? "non_transactional";

    const { recipients, eligible_count, suppressed_count, invalid_count } =
      await resolveAudience(serviceClient, filterDef, classification as "transactional" | "non_transactional", channels);

    if (!eligible_count) return jsonError("No eligible recipients", 400);

    const now = new Date().toISOString();
    const newStatus = scheduled_at ? "scheduled" : "queued";

    // Update message
    await serviceClient
      .from("messaging_messages")
      .update({
        status: newStatus,
        recipient_count: recipients.length + suppressed_count + invalid_count,
        eligible_count,
        suppressed_count,
        invalid_count,
        scheduled_at: scheduled_at ?? null,
        queued_at: scheduled_at ? null : now,
        updated_by: userId,
      })
      .eq("id", message_id);

    // Snapshot recipients
    const recipientRows: Record<string, unknown>[] = [];
    for (const r of recipients) {
      for (const ch of channels) {
        if (ch === "in_app" && !r.user_id) continue;
        recipientRows.push({
          message_id,
          channel: ch,
          user_id: r.user_id,
          beta_application_id: r.beta_application_id,
          email: r.email,
          normalized_email: r.normalized_email,
          recipient_name: r.recipient_name,
          personalization: r.personalization,
          status: "queued",
          queued_at: now,
        });
      }
    }

    if (recipientRows.length > 0) {
      await serviceClient
        .from("messaging_recipients")
        .upsert(recipientRows, { onConflict: "message_id,normalized_email,channel", ignoreDuplicates: true });
    }

    await serviceClient.from("messaging_audit_log").insert({
      actor_id: userId,
      action: scheduled_at ? "message_scheduled" : "message_queued",
      entity_type: "messaging_message", entity_id: message_id,
      metadata: { eligible_count, suppressed_count, scheduled_at: scheduled_at ?? null },
    });

    return jsonOk({
      status: newStatus,
      eligible_count,
      suppressed_count,
      invalid_count,
      recipient_count: recipientRows.length,
    });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
