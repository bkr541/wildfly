const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { departureAirport, departureDate } = await req.json();

    if (!departureAirport || !departureDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'departureAirport and departureDate are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate IATA code format
    const cleanAirport = (departureAirport as string).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cleanAirport)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid airport code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid date format, expected YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gowilderToken = Deno.env.get('GOWILDER_TOKEN');
    if (!gowilderToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'GOWILDER_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUrl = `https://gowilder.net/api/flights/search/stream?origin=${cleanAirport}&date=${departureDate}&max_workers=3&token=${gowilderToken}`;

    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        onlyMainContent: false,
        maxAge: 0,
        timeout: 120000,
        formats: [
          {
            type: "json",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                flights: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      origin: { type: "string" },
                      destination: { type: "string" },
                      depart_time: { type: "string" },
                      arrive_time: { type: "string" },
                      duration: { type: "string" },
                      stops: { anyOf: [{ type: "string" }, { type: "number" }] },
                      fares: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          standard: { type: ["number", "null"] },
                          discount_den: { type: ["number", "null"] },
                          go_wild: { type: ["number", "null"] },
                        },
                        required: ["standard", "discount_den", "go_wild"],
                      },
                    },
                    required: ["origin", "destination", "depart_time", "arrive_time", "duration", "stops", "fares"],
                  },
                },
              },
              required: ["flights"],
            },
            prompt: "Extract flights only from `event: flights` `data:` JSON and return {\"flights\": [...]} with origin,destination,depart_time,arrive_time,duration,stops and fares.standard,fares.discount_den,fares.go_wild; map depart_time=departure_time, arrive_time=arrival_time, duration=total_trip_time; set each fare to the corresponding fares.*.total number or null if missing; $0.00 becomes 0; do not invent flights.",
          },
        ],
      }),
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { status: response.ok ? 200 : response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
