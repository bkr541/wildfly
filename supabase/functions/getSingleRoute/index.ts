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
    const { targetUrl } = await req.json();

    if (!targetUrl) {
      return new Response(JSON.stringify({ success: false, error: "targetUrl is required" }), {
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

    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        waitFor: 12000,
        timeout: 140000,
        onlyMainContent: false,
        maxAge: 0,
        proxy: "auto",
        formats: [
          {
            type: "json",
            prompt:
              "Extract all flights from the page. Use a legs array for segments: nonstop has one leg, 1-stop has two legs based on the sequence of airport codes. Derive parameters from sourceURL: origin=o1, destination=d1, date=dd1. Normalize departure_time and arrival_time to YYYY-MM-DDTHH:MM:SS format using the dd1 date as base; add +1 day to arrival if (+1 day) is present. Map fare columns in order to basic, economy, premium, and business, using null if Unavailable. Include total_trip_time as HH:MM:SS. Create booking_links by modifying ftype in sourceURL: standard (STD), discount_den (DD), go_wild (GW), and miles (STD).",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["destination_airports", "origin_airports", "flights", "search_parameters", "summary"],
              properties: {
                destination_airports: { type: "array", items: { type: "string", pattern: "^[A-Z0-9]{3}$" } },
                origin_airports: { type: "array", items: { type: "string", pattern: "^[A-Z0-9]{3}$" } },
                flights: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "arrival_time",
                      "booking_links",
                      "departure_time",
                      "destination",
                      "fares",
                      "flight_type",
                      "origin",
                      "segments",
                      "stops",
                      "total_trip_time",
                    ],
                    properties: {
                      arrival_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$" },
                      departure_time: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$" },
                      destination: { type: "string", pattern: "^[A-Z0-9]{3}$" },
                      origin: { type: "string", pattern: "^[A-Z0-9]{3}$" },
                      flight_type: { type: "string", enum: ["NonStop", "Connect"] },
                      stops: { type: "integer", minimum: 0 },
                      total_trip_time: { type: "string", pattern: "^\\d{2}:\\d{2}:\\d{2}$" },
                      booking_links: {
                        type: "object",
                        required: ["discount_den", "go_wild", "miles", "standard"],
                        properties: {
                          discount_den: { type: ["string", "null"] },
                          go_wild: { type: ["string", "null"] },
                          miles: { type: ["string", "null"] },
                          standard: { type: ["string", "null"] },
                        },
                      },
                      fares: {
                        type: "object",
                        required: ["discount_den", "go_wild", "miles", "standard"],
                        properties: {
                          discount_den: { $ref: "#/definitions/fare_info" },
                          go_wild: { $ref: "#/definitions/fare_info" },
                          miles: { $ref: "#/definitions/fare_info" },
                          standard: { $ref: "#/definitions/fare_info" },
                        },
                      },
                      segments: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["arrival_airport", "arrival_time", "departure_airport", "departure_time"],
                          properties: {
                            arrival_airport: { type: "string" },
                            arrival_time: { type: "string" },
                            departure_airport: { type: "string" },
                            departure_time: { type: "string" },
                            carrier_code: { type: ["string", "null"] },
                            flight_number: { type: ["string", "null"] },
                          },
                        },
                      },
                    },
                  },
                },
                search_parameters: {
                  type: "object",
                  required: ["date", "destination", "origin"],
                  properties: {
                    date: { type: "string" },
                    destination: { type: "string" },
                    origin: { type: "string" },
                  },
                },
                summary: {
                  type: "object",
                  required: ["total_flights", "search_timestamp"],
                  properties: {
                    total_flights: { type: "integer" },
                    search_timestamp: { type: "string" },
                  },
                },
              },
              definitions: {
                fare_info: {
                  type: "object",
                  required: ["fare_status", "total"],
                  properties: {
                    available_seats: { type: ["integer", "null"] },
                    fare_status: { type: "integer" },
                    loyalty_points: { type: ["number", "null"] },
                    total: { type: ["number", "null"] },
                  },
                },
              },
            },
          },
        ],
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
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
