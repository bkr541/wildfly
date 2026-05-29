import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FLIGHT_API_BASE = "https://getmydata.fly.dev/api/flights";

const ALLOWED_PATHS = ["/search", "/inbound", "/dayTrips", "/roundTrip"];
// Paid endpoints that hit the upstream provider and must be billed server-side.
const PAID_PATHS = new Set(["/search", "/dayTrips", "/roundTrip"]);

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
    const userId = user.id;

    // Parse request body
    let body: any;
    try { body = await req.json(); } catch {
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

    // ── Server-side billing authorization for paid endpoints ──────────────
    let billingResult: any = null;
    let chargedSourceId: string | null = null;
    const isPaid = PAID_PATHS.has(path);

    if (isPaid) {
      // Allow developers/admins to bypass billing for tools like AdminBulkSearch.
      const { data: dev } = await adminClient
        .from("developer_allowlist")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      const isDeveloper = !!dev;

      const allowSkip = isDeveloper && billing?.skip === true;

      if (!allowSkip) {
        // Validate billing metadata
        if (!billing || typeof billing !== "object") {
          return json({ ok: false, error: "Billing metadata required for paid endpoints" }, 400);
        }
        const { requestId, tripType, arrivalAirportsCount, allDestinations } = billing;
        if (typeof requestId !== "string" || requestId.length < 8) {
          return json({ ok: false, error: "Invalid billing.requestId" }, 400);
        }
        if (typeof tripType !== "string") {
          return json({ ok: false, error: "Invalid billing.tripType" }, 400);
        }
        if (typeof arrivalAirportsCount !== "number" || arrivalAirportsCount < 0) {
          return json({ ok: false, error: "Invalid billing.arrivalAirportsCount" }, 400);
        }
        if (typeof allDestinations !== "boolean") {
          return json({ ok: false, error: "Invalid billing.allDestinations" }, 400);
        }

        const { data: authRes, error: authErr } = await adminClient.rpc(
          "authorize_paid_search",
          {
            p_user_id: userId,
            p_trip_type: tripType,
            p_arrival_airports_count: arrivalAirportsCount,
            p_all_destinations: allDestinations,
            p_source_id: requestId,
          } as any,
        );

        if (authErr) {
          console.error("[flight-proxy] authorize_paid_search failed:", authErr.message);
          return json({ ok: false, error: "Credit authorization failed" }, 500);
        }

        const ar = authRes as any;
        if (!ar?.allowed) {
          return json({
            ok: false,
            code: ar?.reason ?? "INSUFFICIENT_CREDITS",
            billing: {
              cost: ar?.cost ?? 0,
              remaining_monthly: ar?.remaining_monthly ?? 0,
              purchased_balance: ar?.purchased_balance ?? 0,
              plan_id: ar?.plan_id ?? null,
              request_id: requestId,
            },
          }, 402);
        }

        billingResult = ar;
        // Only mark as chargedSourceId when an actual new charge happened
        // (so a duplicate request that returned ALREADY_PROCESSED is never refunded).
        if (ar?.reason !== "ALREADY_PROCESSED" && (ar?.cost ?? 0) > 0) {
          chargedSourceId = requestId;
        }
      }
    }

    // ── gowilder_token lookup ─────────────────────────────────────────────
    const { data: configRow, error: configError } = await adminClient
      .from("app_config")
      .select("config_value")
      .eq("config_key", "gowilder_token")
      .limit(1)
      .maybeSingle();

    if (configError || !configRow?.config_value) {
      console.error("[flight-proxy] gowilder_token unavailable");
      // Refund if we charged
      if (chargedSourceId) {
        await adminClient.rpc("refund_paid_search", {
          p_user_id: userId, p_source_id: chargedSourceId, p_reason: "token_unavailable",
        } as any);
      }
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
      if (chargedSourceId) {
        await adminClient.rpc("refund_paid_search", {
          p_user_id: userId, p_source_id: chargedSourceId, p_reason: "upstream_network_error",
        } as any);
      }
      return json({ ok: false, error: "Flight provider request failed" }, 502);
    }

    if (!upstream.ok) {
      console.error(`[flight-proxy] scraper failed: ${upstream.status} ${method} ${path}`);
      if (chargedSourceId) {
        await adminClient.rpc("refund_paid_search", {
          p_user_id: userId, p_source_id: chargedSourceId, p_reason: `upstream_${upstream.status}`,
        } as any);
      }
      return json({
        ok: false,
        error: "Flight provider returned an error",
        upstreamStatus: upstream.status,
        data: responseData,
      }, 502);
    }

    return json({
      ok: true,
      data: responseData,
      billing: billingResult ? {
        charged: billingResult.cost ?? 0,
        used_from_monthly: billingResult.used_from_monthly ?? 0,
        used_from_purchased: billingResult.used_from_purchased ?? 0,
        remaining_monthly: billingResult.remaining_monthly ?? null,
        purchased_balance: billingResult.purchased_balance ?? null,
        plan_id: billingResult.plan_id ?? null,
        request_id: billing?.requestId ?? null,
        already_processed: billingResult.reason === "ALREADY_PROCESSED",
      } : null,
    }, 200);
  } catch (err) {
    console.error("[flight-proxy] unhandled error:", (err as Error).message);
    return json({ ok: false, error: (err as Error).message ?? "Internal error" }, 500);
  }
});
