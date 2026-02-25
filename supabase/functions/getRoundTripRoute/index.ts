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
    const { targetUrl } = await req.json();

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'targetUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL domain - only allow gowilder.net
    try {
      const parsed = new URL(targetUrl);
      if (!parsed.hostname.endsWith('gowilder.net')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid URL domain' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL format' }),
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

    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        waitFor: 8000,
        timeout: 120000,
        onlyMainContent: false,
        maxAge: 0,
        proxy: "auto",
        formats: [
          {
            type: "json",
            prompt: "Extract ALL flight options shown on the page. Return them as flights[]. For each flight: origin, destination, depart_time, arrive_time, duration, stops. For fares: extract numeric amounts ONLY (no $), Standard/Regular -> fares.standard, Discount Den -> fares.discount_den, GoWild -> fares.go_wild. Set fares.currency to USD. If a fare shows $0.00 return 0. If a fare is missing/unavailable, return -1. Do not invent flights.",
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
                          standard: { type: "number" },
                          discount_den: { type: "number" },
                          go_wild: { type: "number" },
                          currency: { type: "string" },
                        },
                        required: ["standard", "discount_den", "go_wild", "currency"],
                      },
                    },
                    required: ["origin", "destination", "depart_time", "arrive_time", "duration", "stops", "fares"],
                  },
                },
              },
              required: ["flights"],
            },
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
