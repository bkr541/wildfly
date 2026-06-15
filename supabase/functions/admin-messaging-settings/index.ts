import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

// Safe public keys that can be returned to the browser. Never include secrets.
const SAFE_KEYS = [
  "from_name",
  "reply_to",
  "support_email",
  "unsubscribe_base",
  "physical_address",
];

const ENV_STATUS = ["RESEND_API_KEY", "MESSAGING_FROM_EMAIL", "MESSAGING_REPLY_TO", "MESSAGING_UNSUBSCRIBE_SECRET"];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { userId, serviceClient } = ctx;

  if (req.method === "POST") {
    try {
      const body = await req.json() as Record<string, unknown>;

      // Only allow updating non-secret DB settings
      const { updates } = body as { updates?: Record<string, unknown> };
      if (updates) {
        for (const [key, value] of Object.entries(updates)) {
          if (!SAFE_KEYS.includes(key)) continue;
          await serviceClient
            .from("messaging_settings")
            .upsert({ key, value: JSON.stringify(value), updated_by: userId });
        }

        await serviceClient.from("messaging_audit_log").insert({
          actor_id: userId, action: "settings_updated",
          entity_type: "messaging_settings", entity_id: null,
          metadata: { keys: Object.keys(updates).filter((k) => SAFE_KEYS.includes(k)) },
        });
      }
      return jsonOk({ updated: true });
    } catch (e) {
      return jsonError((e as Error).message, 500);
    }
  }

  // GET - read safe settings + provider status
  try {
    const { data: settings } = await serviceClient
      .from("messaging_settings")
      .select("key, value")
      .in("key", SAFE_KEYS);

    const settingsMap: Record<string, unknown> = {};
    for (const row of settings ?? []) {
      try {
        settingsMap[row.key as string] = JSON.parse(row.value as string);
      } catch {
        settingsMap[row.key as string] = row.value;
      }
    }

    // Report which secrets are configured (true/false, never the values)
    const envStatus: Record<string, boolean> = {};
    for (const key of ENV_STATUS) {
      envStatus[key] = !!Deno.env.get(key);
    }

    // Verified from address (safe to show)
    const fromEmail = Deno.env.get("MESSAGING_FROM_EMAIL") || null;
    const fromName = Deno.env.get("MESSAGING_FROM_NAME") || null;
    const replyTo = Deno.env.get("MESSAGING_REPLY_TO") || "wildflyapp@gmail.com";

    return jsonOk({
      settings: settingsMap,
      env_status: envStatus,
      provider: {
        name: "Resend",
        from_email: fromEmail,
        from_name: fromName,
        reply_to: replyTo,
        configured: envStatus["RESEND_API_KEY"] && !!fromEmail,
      },
    });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
