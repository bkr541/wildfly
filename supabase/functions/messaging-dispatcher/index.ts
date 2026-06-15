// messaging-dispatcher
// Processes queued messaging_recipients. Run via cron or on-demand.
// Secured by MESSAGING_DISPATCH_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendEmail, retryDelayMs, MAX_ATTEMPTS } from "../_shared/messagingProvider.ts";
import { renderTemplate } from "../_shared/messagingRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const dispatchSecret = Deno.env.get("MESSAGING_DISPATCH_SECRET");
  if (!dispatchSecret || presented !== dispatchSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const fromName = Deno.env.get("MESSAGING_FROM_NAME") || "Wildfly";
  const fromEmail = Deno.env.get("MESSAGING_FROM_EMAIL") || "";

  try {
    // 1. Promote due scheduled messages to queued
    const now = new Date().toISOString();
    await db
      .from("messaging_messages")
      .update({ status: "queued", queued_at: now })
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    // 2. Atomically claim a batch of queued recipients
    const { data: batch } = await db
      .from("messaging_recipients")
      .select("id, message_id, channel, email, personalization, attempt_count, provider_message_id")
      .eq("status", "queued")
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
      .limit(BATCH_SIZE);

    if (!batch?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark all as processing atomically
    const ids = batch.map((r: { id: string }) => r.id);
    await db.from("messaging_recipients").update({ status: "processing" }).in("id", ids);

    let processed = 0;
    let failed = 0;

    for (const recipient of batch) {
      const { data: msg } = await db
        .from("messaging_messages")
        .select("email_subject, email_html, email_text, reply_to, notification_type, notification_title, notification_body, notification_detail_text, notification_cta_label, notification_cta_url, status")
        .eq("id", recipient.message_id)
        .maybeSingle();

      if (!msg || ["cancelled", "failed"].includes(msg.status as string)) {
        await db.from("messaging_recipients").update({ status: "cancelled" }).eq("id", recipient.id);
        continue;
      }

      const vars = (recipient.personalization ?? {}) as Record<string, string>;
      const attemptCount = (recipient.attempt_count as number ?? 0) + 1;

      if (recipient.channel === "email") {
        const subject = renderTemplate((msg.email_subject as string) ?? "", vars);
        const html = renderTemplate((msg.email_html as string) ?? "", vars);
        const text = msg.email_text ? renderTemplate(msg.email_text as string, vars) : undefined;
        const replyTo = (msg.reply_to as string) || "wildflyapp@gmail.com";

        const result = await sendEmail({
          fromName,
          fromEmail,
          replyTo,
          to: recipient.email as string,
          subject,
          html,
          text,
          idempotencyKey: `${recipient.id}-attempt-${attemptCount}`,
        });

        if (result.success) {
          await db.from("messaging_recipients").update({
            status: "sent",
            provider: "resend",
            provider_message_id: result.providerMessageId ?? null,
            attempt_count: attemptCount,
            last_attempt_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
            last_error: null,
          }).eq("id", recipient.id);
          processed++;
        } else if (!result.retryable || attemptCount >= MAX_ATTEMPTS) {
          await db.from("messaging_recipients").update({
            status: "failed",
            attempt_count: attemptCount,
            last_attempt_at: new Date().toISOString(),
            failed_at: new Date().toISOString(),
            last_error: result.error ?? "Unknown error",
          }).eq("id", recipient.id);
          failed++;
        } else {
          const delay = retryDelayMs(attemptCount);
          await db.from("messaging_recipients").update({
            status: "queued",
            attempt_count: attemptCount,
            last_attempt_at: new Date().toISOString(),
            next_attempt_at: new Date(Date.now() + delay).toISOString(),
            last_error: result.error ?? null,
          }).eq("id", recipient.id);
        }
      }

      if (recipient.channel === "in_app") {
        const userId = recipient.user_id;
        if (!userId) {
          await db.from("messaging_recipients").update({
            status: "failed",
            last_error: "No user_id for in-app notification",
            failed_at: new Date().toISOString(),
          }).eq("id", recipient.id);
          failed++;
          continue;
        }

        const title = renderTemplate((msg.notification_title as string) ?? "", vars);
        const body = renderTemplate((msg.notification_body as string) ?? "", vars);

        const { error: notifError } = await db.from("notifications").insert({
          user_id: userId,
          type: msg.notification_type ?? "messaging_broadcast",
          title,
          body,
          detail_text: msg.notification_detail_text ? renderTemplate(msg.notification_detail_text as string, vars) : null,
          data: {
            cta_label: msg.notification_cta_label,
            cta_url: msg.notification_cta_url,
            source: "messaging",
            message_id: recipient.message_id,
          },
          notification_group: "Messaging",
          audience: "All",
          is_read: false,
        });

        if (notifError) {
          await db.from("messaging_recipients").update({
            status: "failed",
            attempt_count: attemptCount,
            last_error: notifError.message,
            failed_at: new Date().toISOString(),
          }).eq("id", recipient.id);
          failed++;
        } else {
          await db.from("messaging_recipients").update({
            status: "delivered",
            attempt_count: attemptCount,
            sent_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
          }).eq("id", recipient.id);
          processed++;
        }
      }
    }

    // Update aggregate message counts and status
    const messageIds = [...new Set(batch.map((r: { message_id: string }) => r.message_id))];
    for (const msgId of messageIds) {
      const { data: counts } = await db
        .from("messaging_recipients")
        .select("status")
        .eq("message_id", msgId);

      const statusList = (counts ?? []).map((r: { status: string }) => r.status);
      const total = statusList.length;
      const doneCount = statusList.filter((s: string) => ["sent", "delivered", "opened", "clicked", "failed", "bounced", "cancelled"].includes(s)).length;
      const failedCount = statusList.filter((s: string) => s === "failed").length;

      let msgStatus: string;
      if (doneCount < total) {
        msgStatus = "processing";
      } else if (failedCount === total) {
        msgStatus = "failed";
      } else if (failedCount > 0) {
        msgStatus = "partially_completed";
      } else {
        msgStatus = "completed";
      }

      const update: Record<string, unknown> = { status: msgStatus };
      if (msgStatus === "completed" || msgStatus === "partially_completed" || msgStatus === "failed") {
        update.completed_at = new Date().toISOString();
      }
      if (msgStatus === "processing") {
        update.started_at = update.started_at ?? new Date().toISOString();
      }

      await db.from("messaging_messages").update(update).eq("id", msgId);
    }

    return new Response(JSON.stringify({ ok: true, processed, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[messaging-dispatcher]", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
