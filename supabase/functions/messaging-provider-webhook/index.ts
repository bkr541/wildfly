// messaging-provider-webhook
// Handles Resend webhook events. Does not require a user JWT.
// Verifies the webhook signature using RESEND_WEBHOOK_SECRET (Svix).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Status ordering — never regress to an earlier status.
const STATUS_ORDER: Record<string, number> = {
  pending: 0, queued: 1, processing: 2, sent: 3,
  delivered: 4, opened: 5, clicked: 6,
  failed: 7, bounced: 7, complained: 7, unsubscribed: 7, cancelled: 7,
};

function shouldUpdate(current: string, next: string): boolean {
  return (STATUS_ORDER[next] ?? 0) > (STATUS_ORDER[current] ?? 0);
}

async function verifySignature(req: Request): Promise<boolean> {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("[webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }

  const msgId = req.headers.get("svix-id") ?? "";
  const msgTs = req.headers.get("svix-timestamp") ?? "";
  const msgSig = req.headers.get("svix-signature") ?? "";

  if (!msgId || !msgTs || !msgSig) return false;

  const body = await req.text();
  const toSign = `${msgId}.${msgTs}.${body}`;

  const enc = new TextEncoder();
  // Svix base64-decodes the secret (strip the "whsec_" prefix)
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyData = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(toSign));
  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

  const provided = msgSig.split(" ")
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice(3));

  return provided.some((p) => p === computedB64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Clone to allow reading body twice if needed
  const cloned = req.clone();

  try {
    const valid = await verifySignature(cloned);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json() as Record<string, unknown>;
    const eventType = payload.type as string;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const providerMessageId = (data.email_id ?? data.message_id) as string | undefined;
    const providerEventId = (payload.id ?? payload.event_id) as string | undefined;

    if (!providerMessageId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_message_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the recipient
    const { data: recipient } = await db
      .from("messaging_recipients")
      .select("id, status, message_id")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();

    // Store provider event (deduplicate)
    const { error: insertErr } = await db.from("messaging_provider_events").insert({
      recipient_id: recipient?.id ?? null,
      message_id: recipient?.message_id ?? null,
      provider: "resend",
      provider_message_id: providerMessageId,
      event_type: eventType,
      provider_event_id: providerEventId ?? null,
      event_payload: data,
      occurred_at: data.created_at ?? new Date().toISOString(),
    });

    if (insertErr?.code === "23505") {
      // Duplicate event — already processed
      return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!recipient) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_recipient" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventToStatus: Record<string, string> = {
      "email.sent":        "sent",
      "email.delivered":   "delivered",
      "email.opened":      "opened",
      "email.clicked":     "clicked",
      "email.bounced":     "bounced",
      "email.complained":  "complained",
      "email.failed":      "failed",
    };

    const nextStatus = eventToStatus[eventType];
    if (!nextStatus) {
      return new Response(JSON.stringify({ ok: true, skipped: "unknown_event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!shouldUpdate(recipient.status as string, nextStatus)) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_regression" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = { status: nextStatus };
    const ts = new Date().toISOString();
    if (nextStatus === "delivered") update.delivered_at = ts;
    else if (nextStatus === "opened") update.opened_at = ts;
    else if (nextStatus === "clicked") update.clicked_at = ts;
    else if (nextStatus === "bounced") { update.bounced_at = ts; update.failed_at = ts; }
    else if (nextStatus === "complained") update.complained_at = ts;
    else if (nextStatus === "failed") update.failed_at = ts;

    await db.from("messaging_recipients").update(update).eq("id", recipient.id);

    // Hard bounce or complaint → add suppression
    if (nextStatus === "bounced" || nextStatus === "complained") {
      const { data: rec } = await db
        .from("messaging_recipients")
        .select("normalized_email")
        .eq("id", recipient.id)
        .maybeSingle();

      if (rec?.normalized_email) {
        await db.from("messaging_suppressions").upsert({
          normalized_email: rec.normalized_email,
          scope: "all_non_transactional",
          reason: nextStatus === "bounced" ? "hard_bounce" : "complaint",
          source: "provider",
          provider: "resend",
        }, { onConflict: "normalized_email,scope,reason", ignoreDuplicates: true });
      }
    }

    return new Response(JSON.stringify({ ok: true, status: nextStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[webhook]", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
