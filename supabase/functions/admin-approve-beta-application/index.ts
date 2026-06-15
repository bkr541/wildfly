// admin-approve-beta-application
// Provisions a beta applicant's account and sends the welcome email via Resend.
// The password-reset action link is used ONLY in-memory during email rendering
// and is NEVER returned to the browser, stored in the DB, or written to any log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { renderTemplate } from "../_shared/messagingRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function sendWelcomeEmail(opts: {
  to: string;
  recipientName: string;
  homeAirport: string;
  actionLink: string;
  templateHtml: string;
  templateSubject: string;
  templateText: string | null;
}): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("MESSAGING_FROM_EMAIL");
  const fromName = Deno.env.get("MESSAGING_FROM_NAME") || "Wildfly";

  if (!apiKey || !fromEmail) {
    return { success: false, error: "Email provider not configured" };
  }

  // Build variables — action_link is injected only here, in-memory
  const vars: Record<string, string> = {
    recipient_name: opts.recipientName,
    recipient_email: opts.to,
    first_name: opts.recipientName.split(" ")[0] ?? opts.recipientName,
    home_airport: opts.homeAirport,
    app_name: "Wildfly",
    app_url: Deno.env.get("PUBLIC_APP_URL") || "https://wildfly.app",
    support_email: "support@wildfly.app",
    current_year: String(new Date().getFullYear()),
    // action_link is injected here and nowhere else
    action_link: opts.actionLink,
  };

  const renderedHtml = renderTemplate(opts.templateHtml, vars);
  const renderedSubject = renderTemplate(opts.templateSubject, vars);
  const renderedText = opts.templateText ? renderTemplate(opts.templateText, vars) : undefined;

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
  } finally {
    // The rendered HTML (containing action_link) is only in local scope and
    // is now eligible for GC. It was never written to DB or returned to client.
  }
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

    // Verify calling user
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

    // Fetch the beta application
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
        JSON.stringify({ error: "Account already provisioned for this application", already_provisioned: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = (app.email as string).trim().toLowerCase();
    let authUserId: string;
    let alreadyExisted = false;

    const { data: existingInfo } = await serviceClient
      .from("user_info")
      .select("auth_user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingInfo?.auth_user_id) {
      authUserId = existingInfo.auth_user_id;
      alreadyExisted = true;
    } else {
      const tempPassword = generateSecurePassword();
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError || !newUser?.user) {
        return new Response(JSON.stringify({ error: createError?.message ?? "Failed to create auth user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authUserId = newUser.user.id;
    }

    // Generate recovery link — stays in memory only, never returned to browser
    let actionLink = "";
    try {
      const { data: linkData } = await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: redirect_to ? { redirectTo: redirect_to } : undefined,
      });
      actionLink = (linkData as Record<string, unknown> | null)?.properties
        ? ((linkData as Record<string, Record<string, string>>).properties?.action_link ?? "")
        : "";
    } catch {
      // Non-fatal — user can still use Forgot Password
    }

    const nameParts = (app.full_name as string).trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    if (!alreadyExisted) {
      await serviceClient.from("user_info").insert({
        auth_user_id: authUserId,
        email,
        first_name: firstName,
        last_name: lastName,
        home_airport: app.home_airport,
        onboarding_complete: "No",
        image_file: "",
        signup_type: "Email",
        status: "current",
      });

      await serviceClient.from("user_homepage").insert([
        { user_id: authUserId, component_name: "upcoming_flights", order: 1, status: "active" },
        { user_id: authUserId, component_name: "recent_searches",  order: 2, status: "active" },
      ]);
    } else {
      await serviceClient
        .from("user_info")
        .update({ status: "current" })
        .eq("auth_user_id", authUserId);
    }

    await serviceClient.from("user_subscriptions").upsert(
      {
        user_id: authUserId,
        plan_id: "gold_monthly",
        status: "active",
        current_period_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

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

    const now = new Date().toISOString();

    // Mark as accepted (not yet invited — invited_at is set after email is accepted)
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

    // Fetch the welcome template
    const { data: template } = await serviceClient
      .from("messaging_templates")
      .select("id, email_subject, email_html, email_text, version")
      .eq("slug", "beta-applicant-selected")
      .eq("is_active", true)
      .maybeSingle();

    let welcomeDeliveryStatus = "not_started";
    let welcomeMessageId: string | null = null;

    if (template?.email_html && template.email_subject) {
      // Create a messaging_message record (without rendered HTML — action_link is never stored)
      const { data: msgRow } = await serviceClient
        .from("messaging_messages")
        .insert({
          internal_name: `Beta welcome — ${app.full_name} (${email})`,
          category: "transactional",
          classification: "transactional",
          template_id: template.id,
          template_version: template.version,
          status: "processing",
          channels: ["email"],
          audience_definition: { sources: [{ type: "manual_emails", emails: [email] }], logic: "union" },
          recipient_count: 1,
          eligible_count: 1,
          reply_to: "wildflyapp@gmail.com",
          created_by: user.id,
          queued_at: now,
          started_at: now,
          // email_html is intentionally null — transactional render happens inline
        })
        .select("id")
        .maybeSingle();

      welcomeMessageId = msgRow?.id ?? null;

      // Create recipient record
      let recipientId: string | null = null;
      if (welcomeMessageId) {
        const { data: recipRow } = await serviceClient
          .from("messaging_recipients")
          .insert({
            message_id: welcomeMessageId,
            channel: "email",
            user_id: authUserId,
            beta_application_id: application_id,
            email,
            normalized_email: email,
            recipient_name: app.full_name,
            status: "processing",
            queued_at: now,
          })
          .select("id")
          .maybeSingle();
        recipientId = recipRow?.id ?? null;
      }

      // Send the email — action_link is consumed here and does not leave this scope
      const sendResult = await sendWelcomeEmail({
        to: email,
        recipientName: app.full_name as string,
        homeAirport: (app.home_airport as string) ?? "",
        actionLink,
        templateHtml: template.email_html as string,
        templateSubject: template.email_subject as string,
        templateText: (template.email_text as string | null) ?? null,
      });

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

        // Set invited_at only after provider accepted the email
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
    } else {
      // No template configured — still mark application
      welcomeDeliveryStatus = "no_template";
      await serviceClient
        .from("beta_applications")
        .update({ welcome_delivery_status: "no_template" })
        .eq("id", application_id);
    }

    // action_link is NOT returned to the browser
    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        email,
        already_existed: alreadyExisted,
        welcome_delivery_status: welcomeDeliveryStatus,
        welcome_message_id: welcomeMessageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
