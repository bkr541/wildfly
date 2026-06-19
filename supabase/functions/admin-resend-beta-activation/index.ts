// admin-resend-beta-activation
// Re-sends the beta welcome email for a previously provisioned application.
// A fresh recovery link is generated and consumed in memory only —
// it is NEVER returned to the browser, stored in the database, or logged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { renderTemplate, escapeHtml } from "../_shared/messagingRenderer.ts";
import { MESSAGING_TEMPLATE_SLUGS } from "../_shared/messaging-template-slugs.ts";
import { sendEmail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Missing authorization" }, 401);

    const body = await req.json() as { application_id?: string; redirect_to?: string };
    const { application_id, redirect_to } = body;

    if (!application_id || typeof application_id !== "string") {
      return respond({ error: "application_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) return respond({ error: "Unauthorized" }, 401);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: dev } = await serviceClient
      .from("developer_allowlist")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!dev) return respond({ error: "Forbidden" }, 403);

    // ── Fetch application ────────────────────────────────────────────────────
    const { data: app, error: appError } = await serviceClient
      .from("beta_applications")
      .select("*")
      .eq("id", application_id)
      .maybeSingle();

    if (appError || !app) return respond({ error: appError?.message ?? "Application not found" }, 404);

    if (!app.provisioned_at || !app.auth_user_id) {
      return respond({
        error: "Application account has not been provisioned yet. Use the Approve action instead.",
        application_status: app.status,
      }, 409);
    }

    const normalizedEmail = (app.email as string).trim().toLowerCase();
    const nameParts = (app.full_name as string).trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
    const fullName = (app.full_name as string).trim();

    // ── Fetch messaging settings ──────────────────────────────────────────────
    const { data: settingsRows } = await serviceClient
      .from("messaging_settings")
      .select("key, value")
      .in("key", ["support_email", "physical_address"]);

    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows ?? []) {
      try { settingsMap[row.key as string] = JSON.parse(row.value as string); }
      catch { settingsMap[row.key as string] = String(row.value); }
    }

    const supportEmail = settingsMap["support_email"] ?? "wildflyapp@gmail.com";
    const physicalAddress = settingsMap["physical_address"] ?? "";
    const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://wildfly.app";

    // ── Generate fresh recovery link — hard requirement ────────────────────────
    let actionLink = "";
    try {
      const { data: linkData } = await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: redirect_to ? { redirectTo: redirect_to } : undefined,
      });
      actionLink = (linkData as Record<string, unknown> | null)?.properties
        ? ((linkData as Record<string, Record<string, string>>).properties?.action_link ?? "")
        : "";
    } catch {
      // Fall through to empty-check below
    }

    if (!actionLink) {
      await serviceClient
        .from("beta_applications")
        .update({
          welcome_delivery_status: "link_failed",
          welcome_last_error: "Activation link could not be generated",
        })
        .eq("id", application_id);

      return respond({
        success: false,
        email_sent: false,
        application_status: app.status,
        welcome_delivery_status: "link_failed",
        error_code: "ACTIVATION_LINK_GENERATION_FAILED",
        message: "A new activation link could not be generated. The account was not changed.",
      }, 500);
    }

    // ── Fetch canonical template ──────────────────────────────────────────────
    const { data: template } = await serviceClient
      .from("messaging_templates")
      .select("id, email_subject, email_html, email_text, version")
      .eq("slug", MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED)
      .eq("is_active", true)
      .maybeSingle();

    if (!template?.email_html || !template.email_subject) {
      return respond({
        success: false,
        email_sent: false,
        error_code: "TEMPLATE_NOT_FOUND",
        message: `Active messaging template "${MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED}" was not found.`,
      }, 500);
    }

    const templateVariables: Record<string, string> = {
      recipient_name:    escapeHtml(fullName),
      recipient_email:   normalizedEmail,
      first_name:        escapeHtml(firstName),
      last_name:         escapeHtml(lastName ?? ""),
      full_name:         escapeHtml(fullName),
      email:             normalizedEmail,
      home_airport:      escapeHtml((app.home_airport as string) ?? ""),
      app_name:          "Wildfly",
      app_url:           appUrl,
      account_cta_label: "Create your password and enter Wildfly",
      account_cta_url:   actionLink,
      action_link:       actionLink,
      support_email:     supportEmail,
      physical_address:  escapeHtml(physicalAddress),
      current_year:      String(new Date().getFullYear()),
    };

    // ── Create audit records ──────────────────────────────────────────────────
    const now = new Date().toISOString();

    const { data: msgRow } = await serviceClient
      .from("messaging_messages")
      .insert({
        internal_name: `Beta welcome resend — ${fullName} (${normalizedEmail})`,
        category: "transactional",
        classification: "transactional",
        template_id: template.id,
        template_version: template.version,
        status: "processing",
        channels: ["email"],
        audience_definition: { sources: [{ type: "manual_emails", emails: [normalizedEmail] }], logic: "union" },
        recipient_count: 1,
        eligible_count: 1,
        reply_to: "wildflyapp@gmail.com",
        created_by: user.id,
        queued_at: now,
        started_at: now,
      })
      .select("id")
      .maybeSingle();

    const welcomeMessageId: string | null = msgRow?.id ?? null;

    let recipientId: string | null = null;
    if (welcomeMessageId) {
      const { data: recipRow } = await serviceClient
        .from("messaging_recipients")
        .insert({
          message_id: welcomeMessageId,
          channel: "email",
          user_id: app.auth_user_id as string,
          beta_application_id: application_id,
          email: normalizedEmail,
          normalized_email: normalizedEmail,
          recipient_name: fullName,
          status: "processing",
          queued_at: now,
        })
        .select("id")
        .maybeSingle();
      recipientId = recipRow?.id ?? null;
    }

    // ── Render template — activation URL stays in local scope only ────────────
    const renderedHtml    = renderTemplate(template.email_html    as string, templateVariables);
    const renderedSubject = renderTemplate(template.email_subject as string, templateVariables);
    const renderedText    = template.email_text
      ? renderTemplate(template.email_text as string, templateVariables)
      : undefined;

    // ── Send via shared Gmail provider ────────────────────────────────────────
    const sendResult = await sendEmail({
      to:      normalizedEmail,
      subject: renderedSubject,
      html:    renderedHtml,
      text:    renderedText,
      replyTo: "wildflyapp@gmail.com",
    });

    // actionLink / account_cta_url / renderedHtml are out of scope after this point

    const deliveryStatus = sendResult.success ? "sent" : "failed";

    if (sendResult.success) {
      if (recipientId) {
        await serviceClient.from("messaging_recipients").update({
          status: "sent",
          provider: sendResult.provider,
          provider_message_id: sendResult.providerMessageId ?? null,
          attempt_count: 1,
          sent_at: new Date().toISOString(),
        }).eq("id", recipientId);
      }
      if (welcomeMessageId) {
        await serviceClient.from("messaging_messages").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", welcomeMessageId);
      }
      await serviceClient.from("beta_applications").update({
        invited_at: new Date().toISOString(),
        welcome_sent_at: new Date().toISOString(),
        welcome_delivery_status: "sent",
        welcome_message_id: welcomeMessageId,
        welcome_last_error: null,
      }).eq("id", application_id);
    } else {
      if (recipientId) {
        await serviceClient.from("messaging_recipients").update({
          status: "failed",
          attempt_count: 1,
          failed_at: new Date().toISOString(),
          last_error: sendResult.error ?? "Unknown error",
        }).eq("id", recipientId);
      }
      if (welcomeMessageId) {
        await serviceClient.from("messaging_messages").update({
          status: "failed",
          completed_at: new Date().toISOString(),
        }).eq("id", welcomeMessageId);
      }
      await serviceClient.from("beta_applications").update({
        welcome_delivery_status: "failed",
        welcome_message_id: welcomeMessageId,
        welcome_last_error: sendResult.error ?? "Unknown error",
      }).eq("id", application_id);
    }

    return respond({
      success: sendResult.success,
      email_sent: sendResult.success,
      application_status: app.status,
      welcome_delivery_status: deliveryStatus,
      welcome_message_id: welcomeMessageId,
      email: normalizedEmail,
      message: sendResult.success
        ? "Activation email re-sent successfully."
        : `Activation email delivery failed: ${sendResult.error}`,
    });
  } catch (e) {
    return respond({
      success: false,
      email_sent: false,
      error_code: "INTERNAL_ERROR",
      message: (e as Error).message,
    }, 500);
  }
});
