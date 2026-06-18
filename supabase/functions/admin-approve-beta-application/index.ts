// admin-approve-beta-application
// Provisions a beta applicant's account and sends the welcome email via Resend.
// Recovery links are held only in memory and are NEVER returned to the browser,
// stored in the database, or written to any log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { renderTemplate, escapeHtml } from "../_shared/messagingRenderer.ts";
import { MESSAGING_TEMPLATE_SLUGS } from "../_shared/messaging-template-slugs.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Variables the beta-application-accepted template requires to be non-empty.
const REQUIRED_BETA_ACCEPTANCE_VARIABLES = [
  "first_name",
  "account_cta_label",
  "account_cta_url",
  "support_email",
] as const;

// Default user_settings values — must stay in sync with src/hooks/useUserSettings.ts DEFAULTS.
const USER_SETTINGS_DEFAULTS = {
  notifications_enabled:      false,
  notify_gowild_availability: false,
  notify_new_features:        true,
  notify_new_routes:          false,
  notify_pass_sales:          false,
  theme_preference:           "system",
} as const;

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function assertOk(operation: string, error: { message: string } | null): void {
  if (error) throw new Error(`${operation} failed: ${error.message}`);
}

async function sendWelcomeEmail(opts: {
  to: string;
  templateHtml: string;
  templateSubject: string;
  templateText: string | null;
  vars: Record<string, string>;
}): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("MESSAGING_FROM_EMAIL");
  const fromName = Deno.env.get("MESSAGING_FROM_NAME") || "Wildfly";

  if (!apiKey || !fromEmail) {
    return { success: false, error: "Email provider not configured" };
  }

  // All rendering and URL-consumption stays in local scope only.
  const renderedHtml = renderTemplate(opts.templateHtml, opts.vars);
  const renderedSubject = renderTemplate(opts.templateSubject, opts.vars);
  const renderedText = opts.templateText ? renderTemplate(opts.templateText, opts.vars) : undefined;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [opts.to],
        subject: renderedSubject,
        html: renderedHtml,
        ...(renderedText ? { text: renderedText } : {}),
        reply_to: "wildflyapp@gmail.com",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = await res.json() as { id?: string };
    return { success: true, providerMessageId: data.id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
  // renderedHtml (containing account_cta_url) is only in local scope and GC-able after return.
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { application_id?: string; redirect_to?: string };
    const { application_id, redirect_to } = body;

    if (!application_id || typeof application_id !== "string") {
      return new Response(JSON.stringify({ error: "application_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin check
    const { data: dev } = await serviceClient
      .from("developer_allowlist")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!dev) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch the beta application ────────────────────────────────────────────
    const { data: app, error: appError } = await serviceClient
      .from("beta_applications")
      .select("*")
      .eq("id", application_id)
      .maybeSingle();

    if (appError || !app) {
      return new Response(JSON.stringify({ error: appError?.message ?? "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (app.provisioned_at) {
      return new Response(
        JSON.stringify({
          error: "Account already provisioned for this application",
          already_provisioned: true,
          account_provisioned: true,
          email_sent: false,
          application_status: app.status,
          welcome_delivery_status: app.welcome_delivery_status,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = (app.email as string).trim().toLowerCase();

    // ── Parse name ───────────────────────────────────────────────────────────
    const nameParts = (app.full_name as string).trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
    const fullName = (app.full_name as string).trim();

    // ── Find or create Auth user ─────────────────────────────────────────────
    let authUserId: string;
    let alreadyExisted = false;

    // 1. Look up by user_info (fastest path)
    const { data: existingInfo } = await serviceClient
      .from("user_info")
      .select("auth_user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingInfo?.auth_user_id) {
      authUserId = existingInfo.auth_user_id;
      alreadyExisted = true;
    } else {
      // 2. Check Auth Admin for an existing user with this email to avoid duplicate creation
      const { data: authUsers } = await serviceClient.auth.admin.listUsers();
      const existingAuthUser = (authUsers?.users ?? []).find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        alreadyExisted = true;
        // user_info may be missing — provisioning below will create/repair it
      } else {
        const tempPassword = generateSecurePassword();
        const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
          email: normalizedEmail,
          password: tempPassword,
          email_confirm: true,
        });

        if (createError || !newUser?.user) {
          return new Response(
            JSON.stringify({
              error: createError?.message ?? "Failed to create auth user",
              account_provisioned: false,
              email_sent: false,
              application_status: app.status,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        authUserId = newUser.user.id;
      }
    }

    // ── Provision user records ────────────────────────────────────────────────
    // user_info: create if missing; for existing users, only set status to current
    // without overwriting existing name/airport data.
    if (!alreadyExisted) {
      const { error: uiErr } = await serviceClient.from("user_info").insert({
        auth_user_id: authUserId,
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName,
        home_airport: app.home_airport,
        onboarding_complete: "No",
        image_file: "",
        signup_type: "Email",
        status: "current",
      });
      assertOk("user_info insert", uiErr);

      const { error: hpErr } = await serviceClient.from("user_homepage").insert([
        { user_id: authUserId, component_name: "upcoming_flights", order: 1, status: "active" },
        { user_id: authUserId, component_name: "recent_searches",  order: 2, status: "active" },
      ]);
      assertOk("user_homepage insert", hpErr);
    } else {
      // Repair missing user_info for an existing Auth user
      const { data: infoCheck } = await serviceClient
        .from("user_info")
        .select("auth_user_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!infoCheck) {
        const { error: uiErr } = await serviceClient.from("user_info").insert({
          auth_user_id: authUserId,
          email: normalizedEmail,
          first_name: firstName,
          last_name: lastName,
          home_airport: app.home_airport,
          onboarding_complete: "No",
          image_file: "",
          signup_type: "Email",
          status: "current",
        });
        assertOk("user_info repair insert", uiErr);

        const { error: hpErr } = await serviceClient.from("user_homepage").insert([
          { user_id: authUserId, component_name: "upcoming_flights", order: 1, status: "active" },
          { user_id: authUserId, component_name: "recent_searches",  order: 2, status: "active" },
        ]);
        assertOk("user_homepage repair insert", hpErr);
      } else {
        // Only update status — do not overwrite existing profile data
        await serviceClient
          .from("user_info")
          .update({ status: "current" })
          .eq("auth_user_id", authUserId);
      }
    }

    // user_settings: upsert with defaults; DO NOTHING on conflict preserves existing preferences
    const { error: settErr } = await serviceClient.from("user_settings").upsert(
      { user_id: authUserId, ...USER_SETTINGS_DEFAULTS },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
    assertOk("user_settings upsert", settErr);

    const { error: subErr } = await serviceClient.from("user_subscriptions").upsert(
      {
        user_id: authUserId,
        plan_id: "gold_monthly",
        status: "active",
        current_period_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    assertOk("user_subscriptions upsert", subErr);

    await serviceClient.from("user_credit_wallet").upsert(
      {
        user_id: authUserId,
        monthly_used: 0,
        monthly_period_start: new Date().toISOString(),
        monthly_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        purchased_balance: 0,
      },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

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

    // ── Generate recovery link — hard requirement ─────────────────────────────
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
      // Fall through to the empty-check below
    }

    if (!actionLink) {
      await serviceClient
        .from("beta_applications")
        .update({
          status: "accepted",
          auth_user_id: authUserId,
          provisioned_at: new Date().toISOString(),
          selected_at: app.selected_at ?? new Date().toISOString(),
          welcome_delivery_status: "link_failed",
          welcome_last_error: "Activation link could not be generated",
        })
        .eq("id", application_id);

      return new Response(
        JSON.stringify({
          success: false,
          account_provisioned: true,
          email_sent: false,
          application_status: "accepted",
          welcome_delivery_status: "link_failed",
          error_code: "ACTIVATION_LINK_GENERATION_FAILED",
          message: "The account was provisioned, but the activation email could not be sent.",
          user_id: authUserId,
          email: normalizedEmail,
          already_existed: alreadyExisted,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build template variable map ───────────────────────────────────────────
    // User-controlled plain-text values are HTML-escaped when inserted into the
    // HTML template to prevent attribute injection. URL values are kept raw since
    // they are placed only inside href attributes we control.
    const templateVariables: Record<string, string> = {
      recipient_name:   escapeHtml(fullName),
      recipient_email:  normalizedEmail,
      first_name:       escapeHtml(firstName),
      last_name:        escapeHtml(lastName ?? ""),
      full_name:        escapeHtml(fullName),
      email:            normalizedEmail,
      home_airport:     escapeHtml((app.home_airport as string) ?? ""),
      app_name:         "Wildfly",
      app_url:          appUrl,
      // CTA fields — activation URL is consumed in local scope only
      account_cta_label: "Create your password and enter Wildfly",
      account_cta_url:  actionLink,
      action_link:      actionLink,
      support_email:    supportEmail,
      physical_address: escapeHtml(physicalAddress),
      current_year:     String(new Date().getFullYear()),
    };

    // Validate required variables before attempting delivery
    const missingVars = REQUIRED_BETA_ACCEPTANCE_VARIABLES.filter((v) => !templateVariables[v]);
    if (missingVars.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          account_provisioned: true,
          email_sent: false,
          application_status: "accepted",
          error_code: "MISSING_REQUIRED_VARIABLES",
          message: `Missing required template variables: ${missingVars.map((v) => `{{${v}}}`).join(", ")}`,
          user_id: authUserId,
          email: normalizedEmail,
          already_existed: alreadyExisted,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    // Mark as accepted; delivery starts below
    await serviceClient
      .from("beta_applications")
      .update({
        status: "accepted",
        auth_user_id: authUserId,
        provisioned_at: now,
        selected_at: app.selected_at ?? now,
        welcome_delivery_status: "sending",
      })
      .eq("id", application_id);

    // ── Fetch canonical template ──────────────────────────────────────────────
    const { data: template } = await serviceClient
      .from("messaging_templates")
      .select("id, email_subject, email_html, email_text, version")
      .eq("slug", MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED)
      .eq("is_active", true)
      .maybeSingle();

    if (!template?.email_html || !template.email_subject) {
      await serviceClient
        .from("beta_applications")
        .update({
          welcome_delivery_status: "no_template",
          welcome_last_error: `Active messaging template "${MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED}" was not found.`,
        })
        .eq("id", application_id);

      return new Response(
        JSON.stringify({
          success: false,
          account_provisioned: true,
          email_sent: false,
          application_status: "accepted",
          welcome_delivery_status: "no_template",
          error_code: "TEMPLATE_NOT_FOUND",
          message: `Active messaging template "${MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED}" was not found.`,
          user_id: authUserId,
          email: normalizedEmail,
          already_existed: alreadyExisted,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Create audit records ──────────────────────────────────────────────────
    const { data: msgRow } = await serviceClient
      .from("messaging_messages")
      .insert({
        internal_name: `Beta welcome — ${fullName} (${normalizedEmail})`,
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
        // email_html intentionally null — transactional render happens inline only
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
          user_id: authUserId,
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

    // ── Send email — activation URL consumed here, never leaves scope ─────────
    const sendResult = await sendWelcomeEmail({
      to: normalizedEmail,
      templateHtml: template.email_html as string,
      templateSubject: template.email_subject as string,
      templateText: (template.email_text as string | null) ?? null,
      vars: templateVariables,
    });

    let welcomeDeliveryStatus: string;

    if (sendResult.success) {
      welcomeDeliveryStatus = "sent";

      if (recipientId) {
        await serviceClient.from("messaging_recipients").update({
          status: "sent",
          provider: "resend",
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

      await serviceClient
        .from("beta_applications")
        .update({
          invited_at: new Date().toISOString(),
          welcome_sent_at: new Date().toISOString(),
          welcome_delivery_status: "sent",
          welcome_message_id: welcomeMessageId,
          welcome_last_error: null,
        })
        .eq("id", application_id);
    } else {
      welcomeDeliveryStatus = "failed";

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

      await serviceClient
        .from("beta_applications")
        .update({
          welcome_delivery_status: "failed",
          welcome_message_id: welcomeMessageId,
          welcome_last_error: sendResult.error ?? "Unknown error",
        })
        .eq("id", application_id);
    }

    // account_cta_url / action_link are NOT returned to the browser
    return new Response(
      JSON.stringify({
        success: true,
        account_provisioned: true,
        email_sent: sendResult.success,
        application_status: "accepted",
        welcome_delivery_status: welcomeDeliveryStatus,
        welcome_message_id: welcomeMessageId,
        user_id: authUserId,
        email: normalizedEmail,
        already_existed: alreadyExisted,
        message: sendResult.success
          ? "Account provisioned and welcome email sent."
          : "Account provisioned; welcome email delivery failed.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        account_provisioned: false,
        email_sent: false,
        error_code: "INTERNAL_ERROR",
        message: (e as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
