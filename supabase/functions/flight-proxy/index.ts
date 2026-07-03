import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  MAX_PROVIDER_RESPONSE_BYTES,
  type CanonicalFlightCacheRequest,
  normalizeFlightCacheRequest,
  readFlightCache,
  validateProviderResponse,
  validateProviderResponseForRequest,
  writeFlightCache,
} from "../_shared/flightCache.ts";

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

function providerRequestFromCanonical(canonical: CanonicalFlightCacheRequest) {
  if (canonical.path === "/dayTrips") {
    return {
      params: {
        origin: canonical.origin,
        date: canonical.departureDate,
        nonstop: canonical.nonstop ?? "true",
        layovertime: canonical.layovertime ?? "6",
      },
      payload: undefined,
    };
  }
  if (canonical.path === "/roundTrip") {
    return {
      params: undefined,
      payload: {
        origin: canonical.origin,
        destination: canonical.destination,
        departureDate: canonical.departureDate,
        returnDate: canonical.returnDate,
      },
    };
  }
  return {
    params: undefined,
    payload: {
      origin: canonical.origin,
      departureDate: canonical.departureDate,
      ...(canonical.destination === "__ALL__" ? {} : { destination: canonical.destination }),
    },
  };
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

    const { path, method, billing } = body ?? {};
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
    let canonical: CanonicalFlightCacheRequest | null = null;

    if (isSearchRequest) {
      if (!UUID_PATTERN.test(requestId)) {
        return json({
          ok: false,
          error: "A valid requestId is required for flight searches",
          code: "MISSING_REQUEST_ID",
        }, 400);
      }

      try {
        canonical = normalizeFlightCacheRequest({
          path,
          method,
          params: body.params,
          payload: body.payload,
        });
      } catch (error) {
        return json({ ok: false, error: (error as Error).message }, 400);
      }

      // Entitlement is owned here. A deliberate cache hit follows the same
      // one-search product rule as a provider-backed result.
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

      try {
        const cached = await readFlightCache(adminClient, canonical);
        if (cached) {
          console.log(`[flight-proxy] cache hit: ${canonical.path} ${canonical.origin} ${canonical.departureDate}`);
          return json({
            ok: true,
            data: cached.response,
            billing: billingResult,
            cache: {
              hit: true,
              observedAt: cached.observedAt,
              expiresAt: cached.expiresAt,
            },
          });
        }
      } catch (error) {
        // A cache outage must not turn into a user-visible search outage. The
        // trusted provider path remains available and will repopulate the row.
        console.error("[flight-proxy] cache read failed:", (error as Error).message);
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

    let params = body.params;
    let payload = body.payload;
    if (canonical) {
      const normalizedProviderRequest = providerRequestFromCanonical(canonical);
      params = normalizedProviderRequest.params;
      payload = normalizedProviderRequest.payload;
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
    let responseData: unknown;
    try {
      upstream = await fetch(url, fetchOptions);
      const responseText = await upstream.text();
      if (new TextEncoder().encode(responseText).byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
        await refundAuthorization("PROVIDER_RESPONSE_TOO_LARGE");
        console.error(`[flight-proxy] provider response too large: ${method} ${path}`);
        return json({ ok: false, error: "Flight provider returned an oversized response" }, 502);
      }
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        await refundAuthorization("MALFORMED_PROVIDER_RESPONSE");
        console.error(`[flight-proxy] provider returned non-JSON: ${method} ${path}`);
        return json({ ok: false, error: "Flight provider returned an invalid response" }, 502);
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
      }, 502);
    }

    try {
      if (canonical) validateProviderResponseForRequest(canonical, responseData);
      else validateProviderResponse(responseData);
    } catch (error) {
      await refundAuthorization((error as Error).message);
      console.error("[flight-proxy] provider response rejected:", (error as Error).message);
      return json({ ok: false, error: "Flight provider returned an invalid response" }, 502);
    }

    let cacheMeta: Record<string, unknown> = { hit: false };
    if (canonical) {
      try {
        const written = await writeFlightCache(adminClient, canonical, responseData);
        cacheMeta = { hit: false, expiresAt: written.expiresAt };
        console.log(`[flight-proxy] cache write: ${canonical.path} ${canonical.origin} ${canonical.departureDate}`);
      } catch (error) {
        // Provider success remains usable even if cache persistence is degraded.
        console.error("[flight-proxy] cache write failed:", (error as Error).message);
      }
    }

    return json({ ok: true, data: responseData, billing: billingResult, cache: cacheMeta }, 200);
  } catch (error) {
    console.error("[flight-proxy] unhandled error:", (error as Error).message);
    return json({ ok: false, error: "Internal error" }, 500);
  }
});
