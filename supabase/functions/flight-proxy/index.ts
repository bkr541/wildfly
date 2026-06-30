import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FLIGHT_API_BASE = "https://getmydata.fly.dev/api/flights";
const ALLOWED_PATHS = ["/search", "/inbound", "/dayTrips", "/roundTrip"];
const SEARCH_PATHS = new Set(["/search", "/dayTrips", "/roundTrip"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const { path, method, params, payload, billing } = body ?? {};
    if (!path || !ALLOWED_PATHS.includes(path)) {
      return json({ ok: false, error: `Invalid path: ${path}` }, 400);
    }
    if (method !== "GET" && method !== "POST") {
      return json({ ok: false, error: `Invalid method: ${method}` }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const isSearchRequest = SEARCH_PATHS.has(path);
    const requestId = typeof billing?.requestId === "string" ? billing.requestId : "";
    let billingResult: any = null;

    if (isSearchRequest) {
      if (!UUID_PATTERN.test(requestId)) {
        return json({
          ok: false,
          error: "A valid requestId is required for flight searches",
          code: "MISSING_REQUEST_ID",
        }, 400);
      }

      const { data: authorization, error: authorizationError } = await userClient.rpc(
        "authorize_user_search",
        {
          p_request_id: requestId,
          p_search_source: "flight_proxy",
        },
      );

      if (authorizationError) {
        console.error("[flight-proxy] search authorization failed:", authorizationError.message);
        return json({ ok: false, error: "Could not verify search allowance" }, 500);
      }

      billingResult = authorization;
      if (!billingResult?.allowed) {
        return json({
          ok: false,
          code: "MONTHLY_SEARCH_LIMIT_REACHED",
          error: "Monthly search limit reached",
          billing: billingResult,
        }, 402);
      }
    }

    const refundAuthorization = async (reason: string) => {
      if (!isSearchRequest || !requestId || !billingResult?.allowed) return;
      const { error } = await adminClient.rpc("refund_authorized_search", {
        p_user_id: user.id,
        p_request_id: requestId,
        p_reason: reason,
      });
      if (error) console.error("[flight-proxy] search refund failed:", error.message);
    };

    const { data: configRow, error: configError } = await adminClient
      .from("app_config")
      .select("config_value")
      .eq("config_key", "gowilder_token")
      .limit(1)
      .maybeSingle();

    if (configError || !configRow?.config_value) {
      await refundAuthorization("PROVIDER_TOKEN_UNAVAILABLE");
      console.error("[flight-proxy] gowilder_token unavailable");
      return json({ ok: false, error: "Flight provider unavailable" }, 500);
    }

    let url = `${FLIGHT_API_BASE}${path}`;
    const upstreamHeaders: Record<string, string> = {
      Authorization: `Bearer ${configRow.config_value}`,
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

    console.log(`[flight-proxy] provider request start: ${method} ${path}`);
    let upstream: Response;
    let responseData: any;
    try {
      upstream = await fetch(url, fetchOptions);
      const responseText = await upstream.text();
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = { raw: responseText };
      }
    } catch (error) {
      await refundAuthorization("UPSTREAM_NETWORK_FAILURE");
      console.error("[flight-proxy] upstream fetch threw:", (error as Error).message);
      return json({ ok: false, error: "Flight provider request failed" }, 502);
    }

    if (!upstream.ok) {
      await refundAuthorization(`UPSTREAM_${upstream.status}`);
      console.error(`[flight-proxy] provider failed: ${upstream.status} ${method} ${path}`);
      return json({
        ok: false,
        error: "Flight provider returned an error",
        upstreamStatus: upstream.status,
        data: responseData,
      }, 502);
    }

    return json({ ok: true, data: responseData, billing: billingResult }, 200);
  } catch (error) {
    console.error("[flight-proxy] unhandled error:", (error as Error).message);
    return json({ ok: false, error: (error as Error).message ?? "Internal error" }, 500);
  }
});
