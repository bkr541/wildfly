// messaging-unsubscribe — public endpoint, no user JWT required.
// Verifies HMAC token, records suppression, updates user_email_preferences.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUnsubscribeToken } from "../_shared/messagingUnsubscribe.ts";
import { normalizeEmail } from "../_shared/messagingRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { token, scope: requestedScope } = await req.json() as {
      token: string;
      scope?: string;
    };

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: { code: "MISSING_TOKEN", message: "token required" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await verifyUnsubscribeToken(token);
    if (!result.valid) {
      return new Response(JSON.stringify({ success: false, error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, scope: tokenScope } = result;
    const effectiveScope = requestedScope ?? tokenScope ?? "all_non_transactional";
    const normEmail = normalizeEmail(email);
    const now = new Date().toISOString();

    // Add suppression
    await db.from("messaging_suppressions").upsert({
      normalized_email: normEmail,
      scope: effectiveScope,
      reason: "unsubscribed",
      source: "user",
    }, { onConflict: "normalized_email,scope,reason", ignoreDuplicates: true });

    // If we can find a user, update email preferences
    const { data: userInfo } = await db
      .from("user_info")
      .select("auth_user_id")
      .ilike("email", normEmail)
      .maybeSingle();

    if (userInfo?.auth_user_id) {
      const prefUpdate: Record<string, unknown> = { unsubscribed_at: now };
      if (effectiveScope === "all_non_transactional" || effectiveScope === "all") {
        prefUpdate.email_product_updates = false;
        prefUpdate.email_gowild_updates = false;
        prefUpdate.email_beta_updates = false;
        prefUpdate.email_marketing = false;
      } else if (effectiveScope === "marketing") {
        prefUpdate.email_marketing = false;
      } else if (effectiveScope === "product_updates") {
        prefUpdate.email_product_updates = false;
      } else if (effectiveScope === "beta_updates") {
        prefUpdate.email_beta_updates = false;
      }

      await db.from("user_email_preferences").upsert({
        user_id: userInfo.auth_user_id,
        ...prefUpdate,
      }, { onConflict: "user_id" });
    }

    // Audit log
    await db.from("messaging_audit_log").insert({
      actor_id: null,
      action: "suppression_added",
      entity_type: "user_email_preferences",
      entity_id: null,
      metadata: { normalized_email: normEmail, scope: effectiveScope, reason: "unsubscribed" },
    });

    // Mask email for display
    const atIdx = normEmail.indexOf("@");
    const local = atIdx > 2 ? normEmail.slice(0, 2) + "***" + normEmail.slice(atIdx) : "***" + normEmail.slice(atIdx);

    return new Response(JSON.stringify({
      success: true,
      data: {
        email_masked: local,
        scope: effectiveScope,
        unsubscribed: true,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: { code: "SERVER_ERROR", message: (e as Error).message } }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
