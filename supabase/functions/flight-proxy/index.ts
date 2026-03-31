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
    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

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

    // Read gowilder_token from app_config for this user
    const { data: configRow, error: configError } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "gowilder_token")
      .eq("user_id", userId)
      .single();

    if (configError || !configRow?.config_value) {
      return new Response(
        JSON.stringify({ error: "Missing gowilder_token in app_config" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    const upstream = await fetch(url, fetchOptions);
    const responseData = await upstream.json();

    return new Response(JSON.stringify(responseData), {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
