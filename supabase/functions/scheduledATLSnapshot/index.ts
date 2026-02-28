const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const departureAirport = 'ATL';

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) throw new Error('FIRECRAWL_API_KEY not configured');

    const gowilderToken = Deno.env.get('GOWILDER_TOKEN');
    if (!gowilderToken) throw new Error('GOWILDER_TOKEN not configured');

    const targetUrl = `https://gowilder.net/api/flights/search/stream?origin=${departureAirport}&date=${today}&max_workers=3&token=${gowilderToken}`;

    const firecrawlRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
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
            type: 'json',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                flights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      origin: { type: 'string' },
                      destination: { type: 'string' },
                      depart_time: { type: 'string' },
                      arrive_time: { type: 'string' },
                      duration: { type: 'string' },
                      stops: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                      fares: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          standard: { type: ['number', 'null'] },
                          discount_den: { type: ['number', 'null'] },
                          go_wild: { type: ['number', 'null'] },
                        },
                        required: ['standard', 'discount_den', 'go_wild'],
                      },
                    },
                    required: ['origin', 'destination', 'depart_time', 'arrive_time', 'duration', 'stops', 'fares'],
                  },
                },
              },
              required: ['flights'],
            },
            prompt: "Extract flights only from `event: flights` `data:` JSON and return {\"flights\": [...]} with origin,destination,depart_time,arrive_time,duration,stops and fares.standard,fares.discount_den,fares.go_wild; map depart_time=departure_time, arrive_time=arrival_time, duration=total_trip_time; set each fare to the corresponding fares.*.total number or null if missing; $0.00 becomes 0; do not invent flights.",
          },
        ],
      }),
    });

    const firecrawlData = await firecrawlRes.json();
    const flights: any[] = firecrawlData?.data?.json?.flights ?? firecrawlData?.json?.flights ?? [];

    if (!flights.length) {
      console.warn('No flights returned from Firecrawl', JSON.stringify(firecrawlData).slice(0, 500));
      return new Response(JSON.stringify({ success: false, error: 'No flights in response', raw: firecrawlData }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group flights by destination
    const byDest: Record<string, any[]> = {};
    for (const f of flights) {
      const dest = (f.destination ?? '').trim().toUpperCase();
      if (!dest) continue;
      if (!byDest[dest]) byDest[dest] = [];
      byDest[dest].push(f);
    }

    // Build snapshot rows
    const rows = Object.entries(byDest).map(([dest, destFlights]) => {
      const isNonstop = (f: any) => {
        const s = String(f.stops ?? '').toLowerCase();
        return s === '0' || s === 'nonstop' || s === '0 stops';
      };
      const total_flights = destFlights.length;
      const gowild_flights = destFlights.filter(f => f.fares?.go_wild != null).length;
      const nonstop_total = destFlights.filter(isNonstop).length;
      const nonstop_gowild = destFlights.filter(f => isNonstop(f) && f.fares?.go_wild != null).length;
      const standardFares = destFlights.map(f => f.fares?.standard).filter(v => v != null) as number[];
      const gowildFares = destFlights.map(f => f.fares?.go_wild).filter(v => v != null) as number[];
      const min_fare = standardFares.length ? Math.min(...standardFares) : null;
      const min_gowild_fare = gowildFares.length ? Math.min(...gowildFares) : null;

      return {
        origin_iata: departureAirport,
        destination_iata: dest,
        travel_date: today,
        total_flights,
        gowild_flights,
        nonstop_total,
        nonstop_gowild,
        min_fare,
        min_gowild_fare,
        gowild_avalseats: null,
        raw_response: destFlights,
      };
    });

    // Write to gowild_snapshots using service role
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: insertError } = await supabase
      .from('gowild_snapshots')
      .upsert(rows, { onConflict: 'observed_date,origin_iata,destination_iata,travel_date' });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ success: false, error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Inserted ${rows.length} snapshot rows for ${today}`);
    return new Response(JSON.stringify({ success: true, rows_inserted: rows.length, travel_date: today }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
