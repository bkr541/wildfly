// get-public-shared-flight-result
//
// Public endpoint — no authentication required (verify_jwt = false in config.toml).
// Accepts a raw 64-hex-char token, hashes it, and calls the get_shared_flight_result
// SECURITY DEFINER RPC which atomically increments view_count and returns the
// sanitized display model. raw_search_payload and owner identity are never returned.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Token validation ───────────────────────────────────────────────────────────

const RAW_TOKEN_RE  = /^[0-9a-f]{64}$/;
const MAX_TOKEN_LEN = 128;

async function hashToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Sanitized RPC result type ─────────────────────────────────────────────────
// The get_shared_flight_result SQL function explicitly selects only these fields.
// owner_user_id, public_token_hash, raw_search_payload, and the row id are
// never included in the SQL RETURN statement.

interface PublicShareRpcResult {
  display_model_version: number;
  display_model:         unknown;
  created_at:            string;
  expires_at:            string | null;
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── Extract token ─────────────────────────────────────────
    // Accept token from ?token= query param (GET) or { token } POST body.
    let rawToken: string | null = null;

    const url   = new URL(req.url);
    const qTok  = url.searchParams.get("token");
    if (qTok) {
      rawToken = qTok;
    } else if (req.method === "POST") {
      let bodyObj: unknown;
      try {
        bodyObj = await req.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
      }
      if (
        bodyObj != null &&
        typeof bodyObj === "object" &&
        "token" in (bodyObj as object) &&
        typeof (bodyObj as { token: unknown }).token === "string"
      ) {
        rawToken = (bodyObj as { token: string }).token;
      }
    }

    if (!rawToken) {
      return json({ ok: false, error: "Missing token" }, 400);
    }

    // ── Validate token shape ──────────────────────────────────
    if (rawToken.length > MAX_TOKEN_LEN || !RAW_TOKEN_RE.test(rawToken)) {
      return json({ ok: false, error: "Invalid token" }, 400);
    }

    // ── Hash token (same SHA-256 as create function) ──────────
    const tokenHash = await hashToken(rawToken);

    // ── Call service-role RPC ─────────────────────────────────
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient    = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient.rpc("get_shared_flight_result", {
      p_token_hash: tokenHash,
    });

    if (error) {
      console.error("[get-public-shared-flight-result] RPC error:", error);
      return json({ ok: false, error: "Internal server error" }, 500);
    }

    // RPC returns NULL when record is missing, revoked, or expired.
    // We intentionally do not distinguish these cases in the public response.
    if (data == null) {
      return json({ ok: false, error: "Share not found or no longer available" }, 404);
    }

    const row = data as PublicShareRpcResult;

    // Guard against unsupported display model versions from future migrations.
    if (typeof row.display_model_version !== "number" || row.display_model_version !== 1) {
      return json({ ok: false, error: "Unsupported share version" }, 422);
    }

    // ── Sanitized public response ─────────────────────────────
    // The RPC never returns owner_user_id, public_token_hash, raw_search_payload,
    // or the row id; the SQL function's RETURN statement selects only the four
    // fields below. We re-project here to make that contract explicit in code.
    return json({
      ok:                  true,
      displayModelVersion: row.display_model_version,
      displayModel:        row.display_model,
      createdAt:           row.created_at,
      expiresAt:           row.expires_at ?? null,
    });
  } catch (err) {
    console.error("[get-public-shared-flight-result] unexpected error:", err);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
