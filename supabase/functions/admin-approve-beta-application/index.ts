// admin-approve-beta-application
// Provisions a beta applicant's account and sends the welcome email via Gmail.
// Recovery links are held only in memory and are NEVER returned to the browser,
// stored in the database, or written to any log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { renderTemplate, escapeHtml } from "../_shared/messagingRenderer.ts";
import { MESSAGING_TEMPLATE_SLUGS } from "../_shared/messaging-template-slugs.ts";
import { sendEmail } from "../_shared/email-provider.ts";

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
  default_departure_to_home:  false,
} as const;

// Bounded pagination constants for Auth user lookup.
const AUTH_PAGE_SIZE = 50;
const AUTH_MAX_PAGES = 20; // upper bound: 1 000 users

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function assertOk(operation: string, error: { message: string } | null): void {
  if (error) throw new Error(`${operation} failed: ${error.message}`);
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

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
    const fullName  = (app.full_name as string).trim();

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
      authUserId    = existingInfo.auth_user_id;
      alreadyExisted = true;
    } else {
      // 2. Paginated Auth Admin search to avoid creating a duplicate
      let foundAuthUser: { id: string } | null = null;

      pageLoop: for (let page = 1; page <= AUTH_MAX_PAGES; page++) {
        const { data: authPage, error: listErr } = await serviceClient.auth.admin.listUsers({
          page,
          perPage: AUTH_PAGE_SIZE,
        });
        if (listErr) throw new Error(`Auth listUsers (page ${page}): ${listErr.message}`);

        const users = authPage?.users ?? [];
        for (const u of users) {
          if (u.email?.toLowerCase() === normalizedEmail) {
            foundAuthUser = { id: u.id };
            break pageLoop;
          }
        }
        if (users.length < AUTH_PAGE_SIZE) break; // no more pages
      }

      if (foundAuthUser) {
        authUserId    = foundAuthUser.id;
        alreadyExisted = true;
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
    if (!alreadyExisted) {
      const { error: uiErr } = await serviceClient.from("user_info").insert({
        auth_user_id:        authUserId,
        email:               normalizedEmail,
        first_name:          firstName,
        last_name:           lastName,
        home_airport:        app.home_airport,
        onboarding_complete: "No",
        image_file:          "",
        signup_type:         "Email",
        status:              "current",
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
          auth_user_id:        authUserId,
          email:               normalizedEmail,
          first_name:          firstName,
          last_name:           lastName,
          home_airport:        app.home_airport,
          onboarding_complete: "No",
          image_file:          "",
          signup_type:         "Email",
          status:              "current",
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
        user_id:              authUserId,
        plan_id:              "gold_monthly",
        status:               "active",
        current_period_start: new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    assertOk("user_subscriptions upsert", subErr);

    const { error: walletErr } = await serviceClient.from("user_credit_wallet").upsert(
      {
        user_id:              authUserId,
        monthly_used:         0,
        monthly_period_start: new Date().toISOString(),
        monthly_period_end:   new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        purchased_balance:    0,
      },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
    if (walletErr) {
      console.error("user_credit_wallet upsert error (non-fatal):", walletErr.message);
    }

    // ── Fetch messaging settings ──────────────────────────────────────────────
    const { data: settingsRows, error: settingsErr } = await serviceClient
      .from("messaging_settings")
      .select("key, value")
      .in("key", ["support_email", "physical_address"]);
    if (settingsErr) {
      console.error("messaging_settings select error (non-fatal):", settingsErr.message);
    }

    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows ?? []) {
      try { settingsMap[row.key as string] = JSON.parse(row.value as string); }
      catch { settingsMap[row.key as string] = String(row.value); }
    }

    const supportEmail   = settingsMap["support_email"]   ?? "wildflyapp@gmail.com";
    const physicalAddress = settingsMap["physical_address"] ?? "";
    const appUrl         = Deno.env.get("PUBLIC_APP_URL") || "https://wildfly.app";

    // ── Generate recovery link — hard requirement ─────────────────────────────
    let actionLink = "";
    try {
      const { data: linkData } = await serviceClient.auth.admin.generateLink({
        type:    "recovery",
        email:   normalizedEmail,
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
          status:                  "accepted",
          auth_user_id:            authUserId,
          provisioned_at:          new Date().toISOString(),
          selected_at:             app.selected_at ?? new Date().toISOString(),
          welcome_delivery_status: "link_failed",
          welcome_last_error:      "Activation link could not be generated",
        })
        .eq("id", application_id);

      return new Response(
        JSON.stringify({
          success:                 false,
          account_provisioned:     true,
          email_sent:              false,
          application_status:      "accepted",
          welcome_delivery_status: "link_failed",
          error_code:              "ACTIVATION_LINK_GENERATION_FAILED",
          message:                 "The account was provisioned, but the activation email could not be sent.",
          user_id:                 authUserId,
          email:                   normalizedEmail,
          already_existed:         alreadyExisted,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build template variable map ───────────────────────────────────────────
    // User-controlled values are HTML-escaped to prevent injection into the template.
    // URL values are kept raw — they are placed only inside href attributes we control.
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
      // Activation URL — consumed in local render scope only, never returned to browser
      account_cta_label: "Create your password and enter Wildfly",
      account_cta_url:   actionLink,
      action_link:       actionLink,
      support_email:     supportEmail,
      physical_address:  escapeHtml(physicalAddress),
      current_year:      String(new Date().getFullYear()),
    };

    // Validate required variables before attempting delivery
    const missingVars = REQUIRED_BETA_ACCEPTANCE_VARIABLES.filter((v) => !templateVariables[v]);
    if (missingVars.length > 0) {
      return new Response(
        JSON.stringify({
          success:                 false,
          account_provisioned:     true,
          email_sent:              false,
          application_status:      "accepted",
          error_code:              "MISSING_REQUIRED_VARIABLES",
          message:                 `Missing required template variables: ${missingVars.map((v) => `{{${v}}}`).join(", ")}`,
          user_id:                 authUserId,
          email:                   normalizedEmail,
          already_existed:         alreadyExisted,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    // Mark as accepted; delivery starts below
    await serviceClient
      .from("beta_applications")
      .update({
        status:                  "accepted",
        auth_user_id:            authUserId,
        provisioned_at:          now,
        selected_at:             app.selected_at ?? now,
        welcome_delivery_status: "sending",
      })
      .eq("id", application_id);

    // ── Fetch canonical template ──────────────────────────────────────────────
    const { data: template, error: templateErr } = await serviceClient
      .from("messaging_templates")
      .select("id, email_subject, email_html, email_text, version")
      .eq("slug", MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED)
      .eq("is_active", true)
      .maybeSingle();

    if (templateErr) {
      console.error("messaging_templates select error:", templateErr.message);
    }

    if (!template?.email_html || !template.email_subject) {
      await serviceClient
        .from("beta_applications")
        .update({
          welcome_delivery_status: "no_template",
          welcome_last_error:      `Active messaging template "${MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED}" was not found.`,
        })
        .eq("id", application_id);

      return new Response(
        JSON.stringify({
          success:                 false,
          account_provisioned:     true,
          email_sent:              false,
          application_status:      "accepted",
          welcome_delivery_status: "no_template",
          error_code:              "TEMPLATE_NOT_FOUND",
          message:                 `Active messaging template "${MESSAGING_TEMPLATE_SLUGS.BETA_APPLICATION_ACCEPTED}" was not found.`,
          user_id:                 authUserId,
          email:                   normalizedEmail,
          already_existed:         alreadyExisted,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Create audit records ──────────────────────────────────────────────────
    const { data: msgRow, error: msgErr } = await serviceClient
      .from("messaging_messages")
      .insert({
        internal_name:       `Beta welcome — ${fullName} (${normalizedEmail})`,
        category:            "transactional",
        classification:      "transactional",
        template_id:         template.id,
        template_version:    template.version,
        status:              "processing",
        channels:            ["email"],
        audience_definition: { sources: [{ type: "manual_emails", emails: [normalizedEmail] }], logic: "union" },
        recipient_count:     1,
        eligible_count:      1,
        reply_to:            "wildflyapp@gmail.com",
        created_by:          user.id,
        queued_at:           now,
        started_at:          now,
        // email_html intentionally null — transactional render happens inline only
      })
      .select("id")
      .maybeSingle();

    if (msgErr) {
      console.error("messaging_messages insert error (non-fatal):", msgErr.message);
    }

    const welcomeMessageId: string | null = msgRow?.id ?? null;

    let recipientId: string | null = null;
    if (welcomeMessageId) {
      const { data: recipRow, error: recipErr } = await serviceClient
        .from("messaging_recipients")
        .insert({
          message_id:          welcomeMessageId,
          channel:             "email",
          user_id:             authUserId,
          beta_application_id: application_id,
          email:               normalizedEmail,
          normalized_email:    normalizedEmail,
          recipient_name:      fullName,
          status:              "processing",
          queued_at:           now,
        })
        .select("id")
        .maybeSingle();

      if (recipErr) {
        console.error("messaging_recipients insert error (non-fatal):", recipErr.message);
      }
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

    let welcomeDeliveryStatus: string;

    if (sendResult.success) {
      welcomeDeliveryStatus = "sent";

      if (recipientId) {
        const { error: rUpErr } = await serviceClient.from("messaging_recipients").update({
          status:              "sent",
          provider:            sendResult.provider,
          provider_message_id: sendResult.providerMessageId ?? null,
          attempt_count:       1,
          sent_at:             new Date().toISOString(),
        }).eq("id", recipientId);
        if (rUpErr) console.error("messaging_recipients update (sent) error:", rUpErr.message);
      }

      if (welcomeMessageId) {
        const { error: mUpErr } = await serviceClient.from("messaging_messages").update({
          status:       "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", welcomeMessageId);
        if (mUpErr) console.error("messaging_messages update (completed) error:", mUpErr.message);
      }

      const { error: appUpErr } = await serviceClient
        .from("beta_applications")
        .update({
          invited_at:              new Date().toISOString(),
          welcome_sent_at:         new Date().toISOString(),
          welcome_delivery_status: "sent",
          welcome_message_id:      welcomeMessageId,
          welcome_last_error:      null,
        })
        .eq("id", application_id);
      if (appUpErr) console.error("beta_applications update (sent) error:", appUpErr.message);
    } else {
      welcomeDeliveryStatus = "failed";

      if (recipientId) {
        const { error: rUpErr } = await serviceClient.from("messaging_recipients").update({
          status:        "failed",
          attempt_count: 1,
          failed_at:     new Date().toISOString(),
          last_error:    sendResult.error ?? "Unknown error",
        }).eq("id", recipientId);
        if (rUpErr) console.error("messaging_recipients update (failed) error:", rUpErr.message);
      }

      if (welcomeMessageId) {
        const { error: mUpErr } = await serviceClient.from("messaging_messages").update({
          status:       "failed",
          completed_at: new Date().toISOString(),
        }).eq("id", welcomeMessageId);
        if (mUpErr) console.error("messaging_messages update (failed) error:", mUpErr.message);
      }

      const { error: appUpErr } = await serviceClient
        .from("beta_applications")
        .update({
          welcome_delivery_status: "failed",
          welcome_message_id:      welcomeMessageId,
          welcome_last_error:      sendResult.error ?? "Unknown error",
        })
        .eq("id", application_id);
      if (appUpErr) console.error("beta_applications update (failed) error:", appUpErr.message);
    }

    // account_cta_url / action_link are NOT returned to the browser
    return new Response(
      JSON.stringify({
        success:                 true,
        account_provisioned:     true,
        email_sent:              sendResult.success,
        application_status:      "accepted",
        welcome_delivery_status: welcomeDeliveryStatus,
        welcome_message_id:      welcomeMessageId,
        user_id:                 authUserId,
        email:                   normalizedEmail,
        already_existed:         alreadyExisted,
        message: sendResult.success
          ? "Account provisioned and welcome email sent."
          : "Account provisioned; welcome email delivery failed.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        success:             false,
        account_provisioned: false,
        email_sent:          false,
        error_code:          "INTERNAL_ERROR",
        message:             (e as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
