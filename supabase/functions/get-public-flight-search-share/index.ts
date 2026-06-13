import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Token validation ───────────────────────────────────────────────────────────

// A valid raw token is exactly 64 hex characters (32 bytes / 256 bits).
const RAW_TOKEN_RE  = /^[0-9a-f]{64}$/;
const MAX_TOKEN_LEN = 128; // hard upper bound before regex test

/** SHA-256 hash of rawToken, returned as a 64-char lowercase hex string. */
async function hashToken(rawToken: string): Promise<string> {
  const data        = new TextEncoder().encode(rawToken);
  const hashBuffer  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Sanitized response type ────────────────────────────────────────────────────
// Owner_user_id and public_token_hash are deliberately excluded from the RPC
// return value (enforced in SQL) and are never placed in this response.
interface PublicShareRow {
  model_version: number;
  share_model:   unknown;
  created_at:    string;
  expires_at:    string | null;
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Extract raw token ─────────────────────────────────────
    // Accept token from query string (?token=…) or POST body ({token: "…"}).
    let rawToken: string | null = null;

    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken) {
      rawToken = queryToken;
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

    // ── Validate token shape before hashing ───────────────────
    if (rawToken.length > MAX_TOKEN_LEN || !RAW_TOKEN_RE.test(rawToken)) {
      return json({ ok: false, error: "Invalid token" }, 400);
    }

    // ── Hash using the same SHA-256 implementation as create ──
    const tokenHash = await hashToken(rawToken);

    // ── Atomic fetch + view increment via service-role RPC ────
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient    = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient.rpc(
      "record_flight_search_share_view",
      { p_token_hash: tokenHash },
    );

    if (error) {
      console.error("[get-public-flight-search-share] RPC error:", error);
      return json({ ok: false, error: "Internal server error" }, 500);
    }

    // The RPC returns NULL when the record does not exist, is expired, or is revoked.
    // We do not distinguish these cases in the public response for security.
    if (data == null) {
      return json({ ok: false, error: "Share not found or no longer available" }, 404);
    }

    const row = data as PublicShareRow;

    // ── Guard against future unsupported schema versions ──────
    if (typeof row.model_version !== "number" || row.model_version !== 1) {
      return json({ ok: false, error: "Unsupported share version" }, 422);
    }

    // ── Sanitized public response ─────────────────────────────
    // owner_user_id and public_token_hash are never present in `row`
    // because the SQL function selects only model_version, share_model,
    // created_at, and expires_at.
    return json({
      ok:           true,
      modelVersion: row.model_version,
      shareModel:   row.share_model,
      createdAt:    row.created_at,
      expiresAt:    row.expires_at ?? null,
    });
  } catch (err) {
    console.error("[get-public-flight-search-share] Unexpected error:", err);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
