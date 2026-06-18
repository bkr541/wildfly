import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { userId, serviceClient } = ctx;

  try {
    const body = await req.json() as Record<string, unknown>;

    // Accept template_id (canonical) or id (legacy frontend shape) interchangeably.
    const resolvedTemplateId = (body.template_id ?? body.id) as string | undefined;
    const archive = body.archive as boolean | undefined;

    // Archive action
    if (archive && resolvedTemplateId) {
      const { data: usages } = await serviceClient
        .from("messaging_messages")
        .select("id")
        .eq("template_id", resolvedTemplateId)
        .not("status", "in", '("draft")');

      const now = new Date().toISOString();
      const { error } = await serviceClient
        .from("messaging_templates")
        .update({ archived_at: now, is_active: false })
        .eq("id", resolvedTemplateId);
      if (error) return jsonError(error.message, 500);

      await serviceClient.from("messaging_audit_log").insert({
        actor_id: userId, action: "template_archived",
        entity_type: "messaging_template", entity_id: resolvedTemplateId,
        metadata: { had_active_messages: (usages?.length ?? 0) > 0 },
      });
      return jsonOk({ archived: true });
    }

    let data: Record<string, unknown>;
    let error: { message: string } | null;
    let action: string;

    if (resolvedTemplateId) {
      // UPDATE — only include fields that were explicitly sent in the body.
      // This prevents partial saves (e.g. editing only HTML) from silently
      // erasing available_variables, required_variables, is_active, etc.
      const updates: Record<string, unknown> = {};
      const textFields = [
        "name", "slug", "description", "category",
        "email_subject", "email_preheader", "email_html", "email_text",
        "email_cta_label", "email_cta_url", "default_reply_to",
        "notification_type", "notification_title", "notification_body",
        "notification_detail_text", "notification_cta_label", "notification_cta_url",
      ];
      for (const field of textFields) {
        if (field in body) updates[field] = body[field] ?? null;
      }
      if ("is_active" in body)          updates.is_active          = body.is_active;
      if ("is_transactional" in body)   updates.is_transactional   = body.is_transactional;
      if ("supported_channels" in body) updates.supported_channels = body.supported_channels ?? ["email"];
      if ("available_variables" in body) updates.available_variables = body.available_variables ?? [];
      if ("required_variables" in body)  updates.required_variables  = body.required_variables ?? [];

      // Fetch current version and increment
      const { data: existing } = await serviceClient
        .from("messaging_templates")
        .select("version")
        .eq("id", resolvedTemplateId)
        .maybeSingle();
      updates.version = ((existing?.version as number) ?? 1) + 1;

      const res = await serviceClient
        .from("messaging_templates")
        .update(updates)
        .eq("id", resolvedTemplateId)
        .select()
        .single();
      data = res.data as Record<string, unknown>;
      error = res.error as { message: string } | null;
      action = "template_updated";
    } else {
      // INSERT — use complete defaults for all fields
      const payload: Record<string, unknown> = {
        name:                    body.name,
        slug:                    body.slug,
        description:             body.description ?? null,
        category:                body.category ?? "General",
        is_active:               body.is_active ?? true,
        is_transactional:        body.is_transactional ?? false,
        supported_channels:      body.supported_channels ?? ["email"],
        email_subject:           body.email_subject ?? null,
        email_preheader:         body.email_preheader ?? null,
        email_html:              body.email_html ?? null,
        email_text:              body.email_text ?? null,
        email_cta_label:         body.email_cta_label ?? null,
        email_cta_url:           body.email_cta_url ?? null,
        default_reply_to:        body.default_reply_to ?? "wildflyapp@gmail.com",
        notification_type:       body.notification_type ?? null,
        notification_title:      body.notification_title ?? null,
        notification_body:       body.notification_body ?? null,
        notification_detail_text: body.notification_detail_text ?? null,
        notification_cta_label:  body.notification_cta_label ?? null,
        notification_cta_url:    body.notification_cta_url ?? null,
        available_variables:     body.available_variables ?? [],
        required_variables:      body.required_variables ?? [],
        created_by:              userId,
        version:                 1,
      };
      const res = await serviceClient
        .from("messaging_templates")
        .insert(payload)
        .select()
        .single();
      data = res.data as Record<string, unknown>;
      error = res.error as { message: string } | null;
      action = "template_created";
    }

    if (error) return jsonError(error.message, 500);

    await serviceClient.from("messaging_audit_log").insert({
      actor_id: userId, action,
      entity_type: "messaging_template", entity_id: data?.id ?? resolvedTemplateId,
      metadata: { name: data?.name ?? body.name },
    });

    return jsonOk({ template: data });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
