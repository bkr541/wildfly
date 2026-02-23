const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      return new Response(JSON.stringify({ success: false, error: "destination must be a valid 3-character IATA code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extractionPrompt = `Extract ${cleanOrigin}-${cleanDestination} flights. Return flights[] only per the provided schema. For each flight: include legs[] in order (each leg has origin, destination, departure_time, arrival_time). Include total_duration as a string (e.g. HH:MM or HH:MM:SS, whatever is shown on the page). If the UI shows (+1 day) or similar on the arrival, set is_plus_one_day to true, otherwise false. For fares, extract numbers only (no currency symbols); map displayed fare columns in order to basic, economy, premium, and business. If a fare is unavailable or unlisted, use null.`;

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
          prompt: extractionPrompt,
          schema: {
            type: "object",
            required: [],
            properties: {
              flights: {
                type: "array",
                items: {
                  type: "object",
                  required: [],
                  properties: {
                    total_duration: { type: "string" },
                    is_plus_one_day: { type: "boolean" },
                    fares: {
                      type: "object",
                      required: ["basic", "economy", "premium", "business"],
                      properties: {
                        basic: { type: ["number", "null"] },
                        economy: { type: ["number", "null"] },
                        premium: { type: ["number", "null"] },
                        business: { type: ["number", "null"] },
                      },
                    },
                    legs: {
                      type: "array",
                      items: {
                        type: "object",
                        required: [],
                        properties: {
                          origin: { type: "string" },
                          destination: { type: "string" },
                          departure_time: { type: "string" },
                          arrival_time: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
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
