import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FLIGHT_API_BASE = "https://getmydata.fly.dev/api/flights";
const ALLOWED_PATHS = ["/search", "/inbound", "/dayTrips", "/roundTrip"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    // Parse request body
    let body: any;
    try { body = await req.json(); } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }
    const { path, method, params, payload } = body ?? {};

    if (!path || !ALLOWED_PATHS.includes(path)) {
      return json({ ok: false, error: `Invalid path: ${path}` }, 400);
    }
    if (method !== "GET" && method !== "POST") {
      return json({ ok: false, error: `Invalid method: ${method}` }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── gowilder_token lookup ─────────────────────────────────────────────
    const { data: configRow, error: configError } = await adminClient
      .from("app_config")
      .select("config_value")
      .eq("config_key", "gowilder_token")
      .limit(1)
      .maybeSingle();

    if (configError || !configRow?.config_value) {
      console.error("[flight-proxy] gowilder_token unavailable");
      return json({ ok: false, error: "Flight provider unavailable" }, 500);
    }

    const gowilderToken = configRow.config_value;

    // ── Build upstream request ────────────────────────────────────────────
    let url = `${FLIGHT_API_BASE}${path}`;
    const upstreamHeaders: Record<string, string> = {
      Authorization: `Bearer ${gowilderToken}`,
    };
    const fetchOptions: RequestInit = { headers: upstreamHeaders };
    if (method === "GET") {
      if (params) url += `?${new URLSearchParams(params).toString()}`;
      fetchOptions.method = "GET";
    } else {
      fetchOptions.method = "POST";
      upstreamHeaders["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(payload ?? {});
    }

    console.log(`[flight-proxy] scraper request start: ${method} ${url}`);
    let upstream: Response;
    let responseData: any;
    try {
      upstream = await fetch(url, fetchOptions);
      responseData = await upstream.json();
    } catch (e) {
      console.error("[flight-proxy] upstream fetch threw:", (e as Error).message);
      return json({ ok: false, error: "Flight provider request failed" }, 502);
    }

    if (!upstream.ok) {
      console.error(`[flight-proxy] scraper failed: ${upstream.status} ${method} ${path}`);
      return json({
        ok: false,
        error: "Flight provider returned an error",
        upstreamStatus: upstream.status,
        data: responseData,
      }, 502);
    }

    return json({ ok: true, data: responseData, billing: null }, 200);
  } catch (err) {
    console.error("[flight-proxy] unhandled error:", (err as Error).message);
    return json({ ok: false, error: (err as Error).message ?? "Internal error" }, 500);
  }
});
