const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('AIRLABS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'AIRLABS_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));

    // Build query params — at least one of dep_iata/arr_iata required
    const params: Record<string, string> = { api_key: apiKey };
    const allowed = [
      'dep_iata', 'dep_icao', 'arr_iata', 'arr_icao',
      'airline_iata', 'airline_icao', 'flight_number',
      'flight_iata', 'flight_icao', 'type',
    ];
    for (const key of allowed) {
      if (body[key] !== undefined && body[key] !== '') {
        params[key] = key === 'type' ? String(body[key]) : String(body[key]).toUpperCase();
      }
    }

    if (!params['dep_iata'] && !params['dep_icao'] && !params['arr_iata'] && !params['arr_icao'] && !params['flight_iata'] && !params['flight_icao'] && !params['airline_iata']) {
      return new Response(JSON.stringify({ success: false, error: 'At least one filter is required: dep_iata, arr_iata, airline_iata, flight_iata, etc.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const qs = new URLSearchParams(params).toString();
    const url = `https://airlabs.co/api/v9/schedules?${qs}`;

    console.log('AirLabs Schedules request:', url.replace(apiKey, '***'));

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: data?.error?.message ?? `HTTP ${response.status}`, raw: data }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('airlabsSchedules error:', err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
