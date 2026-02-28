const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Flight {
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  total_trip_time: string;
  stops: string | number;
  fares: {
    standard?: { total?: number } | null;
    discount_den?: { total?: number } | null;
    go_wild?: { total?: number } | null;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const departureAirport = 'ATL';

    const gowilderToken = Deno.env.get('GOWILDER_TOKEN');
    if (!gowilderToken) throw new Error('GOWILDER_TOKEN not configured');

    const targetUrl = `https://gowilder.net/api/flights/search/stream?origin=${departureAirport}&date=${today}&max_workers=3&token=${gowilderToken}`;

    console.log('Fetching SSE stream:', targetUrl.replace(gowilderToken, '[REDACTED]'));

    // Directly consume the SSE stream
    const streamRes = await fetch(targetUrl, {
      headers: { 'Accept': 'text/event-stream' },
      signal: AbortSignal.timeout(90000),
    });

    if (!streamRes.ok) {
      throw new Error(`GoWildr stream responded ${streamRes.status}`);
    }

    const text = await streamRes.text();
    console.log('SSE text length:', text.length, 'preview:', text.slice(0, 200));

    // Parse SSE: extract all `event: flights\ndata: {...}` blocks
    const allFlights: Flight[] = [];
    const eventBlocks = text.split(/\n\n+/);

    for (const block of eventBlocks) {
      const lines = block.split('\n');
      let eventType = '';
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('event:')) eventType = line.replace('event:', '').trim();
        if (line.startsWith('data:')) dataLine = line.replace('data:', '').trim();
      }
      if (eventType === 'flights' && dataLine) {
        try {
          const parsed = JSON.parse(dataLine);
          // Could be a single flight object or an array
          if (Array.isArray(parsed)) {
            allFlights.push(...parsed);
          } else if (parsed && typeof parsed === 'object') {
            allFlights.push(parsed);
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    console.log(`Parsed ${allFlights.length} flights from SSE stream`);

    if (!allFlights.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No flights in SSE stream', preview: text.slice(0, 500) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Normalise fare values from GoWildr structure
    const getFare = (fareObj: any): number | null => {
      if (fareObj == null) return null;
      if (typeof fareObj === 'number') return fareObj;
      if (typeof fareObj?.total === 'number') return fareObj.total;
      return null;
    };

    const isNonstop = (f: Flight) => {
      const s = String(f.stops ?? '').toLowerCase();
      return s === '0' || s === 'nonstop' || s === '0 stops' || s === 'direct';
    };

    // Group by destination
    const byDest: Record<string, Flight[]> = {};
    for (const f of allFlights) {
      const dest = (f.destination ?? '').trim().toUpperCase();
      if (!dest || !/^[A-Z]{3}$/.test(dest)) continue;
      if (!byDest[dest]) byDest[dest] = [];
      byDest[dest].push(f);
    }

    const rows = Object.entries(byDest).map(([dest, destFlights]) => {
      const total_flights = destFlights.length;
      const gowild_flights = destFlights.filter(f => getFare(f.fares?.go_wild) != null).length;
      const nonstop_total = destFlights.filter(isNonstop).length;
      const nonstop_gowild = destFlights.filter(f => isNonstop(f) && getFare(f.fares?.go_wild) != null).length;
      const standardFares = destFlights.map(f => getFare(f.fares?.standard)).filter(v => v != null) as number[];
      const gowildFares = destFlights.map(f => getFare(f.fares?.go_wild)).filter(v => v != null) as number[];
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

    console.log(`Built ${rows.length} snapshot rows`);

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
    return new Response(
      JSON.stringify({ success: true, rows_inserted: rows.length, travel_date: today, destinations: Object.keys(byDest) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
