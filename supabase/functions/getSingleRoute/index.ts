const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) {
    return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { targetUrl, origin, destination } = await req.json();

    if (!targetUrl) {
      return new Response(JSON.stringify({ success: false, error: "targetUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate origin
    const cleanOrigin = (origin ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(cleanOrigin)) {
      return new Response(JSON.stringify({ success: false, error: "origin must be a valid 3-character IATA code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate destination
    const cleanDestination = (destination ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(cleanDestination)) {
      return new Response(
        JSON.stringify({ success: false, error: "destination must be a valid 3-character IATA code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firecrawlBody = {
      url: targetUrl,
      waitFor: 12000,
      timeout: 140000,
      onlyMainContent: false,
      maxAge: 0,
      proxy: "auto",
      formats: [
        {
          type: "json",
          prompt: `Return anchor(o1, d1) and flights[]. flight_numbers: CRITICAL - extract 'F9' codes from radio attributes (e.g. 'F9 123, F9 456'). Fares L->R: basic,economy,premium,business. is_plus_one_day: true if '(+1 day)'. Legs: 1 (nonstop) or 2 (1-stop). Extract origin, dest, and times per leg. Do not invent data.`,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              anchor: {
                type: "object",
                properties: {
                  origin: { type: "string" },
                  destination: { type: "string" },
                },
                required: ["origin", "destination"],
              },
              flights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    total_duration: { type: "string" },
                    is_plus_one_day: { type: "boolean" },
                    flight_numbers: { type: "string" },
                    fares: {
                      type: "object",
                      properties: {
                        basic: { type: ["number", "null"] },
                        economy: { type: ["number", "null"] },
                        premium: { type: ["number", "null"] },
                        business: { type: ["number", "null"] },
                      },
                      required: ["basic", "economy", "premium", "business"],
                    },
                    legs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          origin: { type: "string" },
                          destination: { type: "string" },
                          departure_time: { type: "string" },
                          arrival_time: { type: "string" },
                        },
                        required: ["origin", "destination", "departure_time", "arrival_time"],
                      },
                    },
                  },
                  required: ["total_duration", "is_plus_one_day", "flight_numbers", "fares", "legs"],
                },
              },
            },
            required: ["anchor", "flights"],
          },
        },
      ],
    };

    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firecrawlBody),
    });

    const data = await response.json();

    return new Response(JSON.stringify({ ...data, _firecrawlRequestBody: firecrawlBody }), {
      status: response.ok ? 200 : response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
