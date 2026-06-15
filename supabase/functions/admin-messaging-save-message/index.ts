import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { userId, serviceClient } = ctx;

  try {
    const body = await req.json() as Record<string, unknown>;
    const { message_id } = body;

    const payload: Record<string, unknown> = {
      internal_name:          body.internal_name,
      internal_description:   body.internal_description ?? null,
      category:               body.category ?? "General",
      classification:         body.classification ?? "non_transactional",
      template_id:            body.template_id ?? null,
      template_version:       body.template_version ?? null,
      channels:               body.channels ?? ["email"],
      audience_id:            body.audience_id ?? null,
      audience_definition:    body.audience_definition ?? {},
      email_subject:          body.email_subject ?? null,
      email_preheader:        body.email_preheader ?? null,
      email_html:             body.email_html ?? null,
      email_text:             body.email_text ?? null,
      email_cta_label:        body.email_cta_label ?? null,
      email_cta_url:          body.email_cta_url ?? null,
      reply_to:               body.reply_to ?? "wildflyapp@gmail.com",
      notification_type:      body.notification_type ?? null,
      notification_title:     body.notification_title ?? null,
      notification_body:      body.notification_body ?? null,
      notification_detail_text: body.notification_detail_text ?? null,
      notification_cta_label: body.notification_cta_label ?? null,
      notification_cta_url:   body.notification_cta_url ?? null,
      scheduled_at:           body.scheduled_at ?? null,
      updated_by:             userId,
    };

    let data: Record<string, unknown>;
    let error: { message: string } | null;

    if (message_id) {
      // Update existing draft
      const { data: existing } = await serviceClient
        .from("messaging_messages")
        .select("status")
        .eq("id", message_id)
        .maybeSingle();

      if (!existing) return jsonError("Message not found", 404);
      if (existing.status !== "draft" && existing.status !== "scheduled") {
        return jsonError("Only draft or scheduled messages can be edited", 409);
      }

      const res = await serviceClient
        .from("messaging_messages")
        .update(payload)
        .eq("id", message_id)
        .select()
        .single();
      data = res.data as Record<string, unknown>;
      error = res.error as { message: string } | null;
    } else {
      // Create new draft
      const res = await serviceClient
        .from("messaging_messages")
        .insert({ ...payload, status: "draft", created_by: userId })
        .select()
        .single();
      data = res.data as Record<string, unknown>;
      error = res.error as { message: string } | null;

      if (!error && data) {
        await serviceClient.from("messaging_audit_log").insert({
          actor_id: userId, action: "message_created",
          entity_type: "messaging_message", entity_id: data.id,
          metadata: { internal_name: payload.internal_name },
        });
      }
    }

    if (error) return jsonError(error.message, 500);
    return jsonOk({ message: data });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
