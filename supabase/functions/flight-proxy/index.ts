import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FLIGHT_API_BASE = "https://getmydata.fly.dev/api/flights";

const ALLOWED_PATHS = ["/search", "/inbound", "/dayTrips", "/roundTrip"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client – to verify the caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the request body
    const body = await req.json();
    const { path, method, params, payload } = body as {
      path: string;
      method: "GET" | "POST";
      params?: Record<string, string>;
      payload?: Record<string, unknown>;
    };

    if (!path || !ALLOWED_PATHS.includes(path)) {
      return new Response(
        JSON.stringify({ error: `Invalid path: ${path}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Admin client – bypasses RLS to read global app_config
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: configRow, error: configError } = await adminClient
      .from("app_config")
      .select("config_value")
      .eq("config_key", "gowilder_token")
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("[flight-proxy] gowilder_token lookup failed:", configError.message);
      return new Response(
        JSON.stringify({ error: "Failed to load gowilder_token from app_config" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!configRow?.config_value) {
      console.error("[flight-proxy] gowilder_token is missing or empty in app_config");
      return new Response(
        JSON.stringify({ error: "gowilder_token is not configured in app_config" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[flight-proxy] gowilder_token lookup ok");
    const gowilderToken = configRow.config_value;

    // Build upstream request
    let url = `${FLIGHT_API_BASE}${path}`;
    const upstreamHeaders: Record<string, string> = {
      Authorization: `Bearer ${gowilderToken}`,
    };

    const fetchOptions: RequestInit = { headers: upstreamHeaders };

    if (method === "GET") {
      if (params) {
        url += `?${new URLSearchParams(params).toString()}`;
      }
      fetchOptions.method = "GET";
    } else {
      fetchOptions.method = "POST";
      upstreamHeaders["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(payload ?? {});
    }

    console.log(`[flight-proxy] scraper request start: ${method} ${url}`);
    const upstream = await fetch(url, fetchOptions);
    const responseData = await upstream.json();

    if (!upstream.ok) {
      console.error(`[flight-proxy] scraper request failed: ${upstream.status} ${method} ${path}`);
    }

    return new Response(JSON.stringify(responseData), {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});