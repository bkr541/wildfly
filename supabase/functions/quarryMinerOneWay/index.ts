import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchRequest {
  origin: string;       // 3-letter IATA code from the Origin input field
  destination: string;  // 3-letter IATA code from the Destination input field
  departureDate: string; // YYYY-MM-DD from the Departure Date input field
}

interface NormalizedFlight {
  airline?: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: string;
  fareType?: string;
  price?: number | null;
  currency?: string;
  notes?: string;
  raw?: unknown;
}

interface SearchResult {
  ok: boolean;
  flights: NormalizedFlight[];
  provider: string;
  error?: string;
}

// ─── Provider interface ───────────────────────────────────────────────────────
// Drop a real provider here by implementing this signature:
//   searchOneWayFlights(params: SearchRequest): Promise<SearchResult>

// ─── URL builder ─────────────────────────────────────────────────────────────
// TODO: Replace this function's return value with the real upstream base URL
//       when a live provider is wired in (e.g. https://api.myprovider.com).
function buildUpstreamUrl(origin: string, destination: string, departureDate: string): string {
  const base = Deno.env.get("QUARRYMINER_BASE_URL") ?? "http://localhost:3000";
  // TODO: Adjust the path and query param names to match the real upstream API spec.
  return (
    `${base}/api/v1/data/frontier/oneWayFares` +
    `?o=${encodeURIComponent(origin)}` +
    `&d=${encodeURIComponent(destination)}` +
    `&date=${encodeURIComponent(departureDate)}` +
    `&ftype=GW`
  );
}

// ─── Real provider ────────────────────────────────────────────────────────────
// Calls the upstream QuarryMiner API using origin/destination/departureDate
// received from the frontend form.
async function realProvider(params: SearchRequest): Promise<SearchResult> {
  const apiKey = Deno.env.get("QUARRYMINER_API_KEY");
  if (!apiKey) {
    return { ok: false, flights: [], provider: "quarryminer", error: "QUARRYMINER_API_KEY secret not configured" };
  }

  // Build the upstream URL dynamically from the form values.
  // origin      → ?o=
  // destination → ?d=
  // departureDate → ?date=
  const url = buildUpstreamUrl(params.origin, params.destination, params.departureDate);

  console.log(`[quarryMinerOneWay] realProvider → ${url}`);

  // TODO: Add any additional upstream headers, cookies, or session tokens here.
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X_API_Key": apiKey,   // <-- provider-specific auth header
      "Content-Type": "application/json",
      // TODO: Add more headers as required by the upstream API.
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[quarryMinerOneWay] upstream error ${response.status}: ${text}`);
    return { ok: false, flights: [], provider: "quarryminer", error: `Upstream ${response.status}: ${text}` };
  }

  const json = await response.json();
  console.log(`[quarryMinerOneWay] upstream raw response received`);

  // ─── Normalize upstream response to NormalizedFlight[] ───────────────────
  // TODO: Update this section when the real upstream response shape changes.
  const rawFlights: unknown[] = json?.data?.lowFareData?.[0]?.flights ?? [];

  const flights: NormalizedFlight[] = (rawFlights as any[]).map((f: any) => {
    const firstLeg = f.legs?.[0];
    const lastLeg  = f.legs?.[f.legs.length - 1];
    return {
      airline:       "Frontier",
      flightNumber:  f.legs?.map((l: any) => l.flightNumber).filter(Boolean).join(", "),
      origin:        params.origin,
      destination:   params.destination,
      departureTime: firstLeg?.departureDateFormatted,
      arrivalTime:   lastLeg?.arrivalDateFormatted,
      duration:      f.durationFormatted ?? f.duration,
      stops:         f.stopsText ?? "Nonstop",
      fareType:      f.goWildFare != null ? "GoWild" : f.standardFare != null ? "Standard" : undefined,
      price:         f.goWildFare ?? f.standardFare ?? null,
      currency:      "USD",
      notes:         f.goWildFareSeatsRemaining != null ? `${f.goWildFareSeatsRemaining} seats left` : undefined,
      raw:           f,
    };
  });

  // Sort by price ascending (cheapest first)
  flights.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  return { ok: true, flights, provider: "quarryminer" };
}

// ─── Mock provider ────────────────────────────────────────────────────────────
// Returns deterministic fake flights built from the real form values.
// Swap this out by setting QUARRYMINER_USE_MOCK=false once the real upstream
// is reachable from the edge environment.
function mockProvider(params: SearchRequest): SearchResult {
  console.log(`[quarryMinerOneWay] mockProvider called for ${params.origin}→${params.destination} on ${params.departureDate}`);

  // Mock flights are generated dynamically using the real origin/destination/date
  // passed in from the frontend form — no hardcoded ATL/LAS here.
  const flights: NormalizedFlight[] = [
    {
      airline:       "Frontier (mock)",
      flightNumber:  "F9 001",
      origin:        params.origin,       // ← value from Origin input field
      destination:   params.destination, // ← value from Destination input field
      departureTime: `${params.departureDate}T06:00:00`,
      arrivalTime:   `${params.departureDate}T08:30:00`,
      duration:      "2h 30m",
      stops:         "Nonstop",
      fareType:      "GoWild",
      price:         0,
      currency:      "USD",
      notes:         "Mock result — real upstream not yet reachable",
    },
    {
      airline:       "Frontier (mock)",
      flightNumber:  "F9 002",
      origin:        params.origin,
      destination:   params.destination,
      departureTime: `${params.departureDate}T12:00:00`,
      arrivalTime:   `${params.departureDate}T14:45:00`,
      duration:      "2h 45m",
      stops:         "Nonstop",
      fareType:      "Standard",
      price:         89,
      currency:      "USD",
      notes:         "Mock result — real upstream not yet reachable",
    },
  ];

  return { ok: true, flights, provider: "mock" };
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
// Set the QUARRYMINER_USE_MOCK secret/env to "true" to use the mock provider.
// When "false" (or unset), the real QuarryMiner upstream is called.
async function searchOneWayFlights(params: SearchRequest): Promise<SearchResult> {
  const useMock = Deno.env.get("QUARRYMINER_USE_MOCK") === "true";
  if (useMock) {
    return mockProvider(params);
  }
  return await realProvider(params);
}

// ─── Edge Function handler ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed — use POST" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse the JSON body sent by the frontend form handler.
    const body = await req.json() as Partial<SearchRequest>;

    // --- Form value extraction ---
    // These three values map directly from the frontend form inputs:
    //   body.origin       ← Origin input field (IATA code)
    //   body.destination  ← Destination input field (IATA code)
    //   body.departureDate← Departure Date input field (YYYY-MM-DD)
    const { origin, destination, departureDate } = body;

    // Validate all three form values are present and well-formed.
    if (!origin || !destination || !departureDate) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: origin, destination, departureDate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^[A-Z]{3}$/.test(origin.toUpperCase()) || !/^[A-Z]{3}$/.test(destination.toUpperCase())) {
      return new Response(
        JSON.stringify({ ok: false, error: "origin and destination must be 3-letter IATA codes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (origin.toUpperCase() === destination.toUpperCase()) {
      return new Response(
        JSON.stringify({ ok: false, error: "origin and destination must be different" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalised params passed to the provider.
    const params: SearchRequest = {
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate,
    };

    console.log(`[quarryMinerOneWay] search request:`, JSON.stringify(params));

    const result = await searchOneWayFlights(params);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[quarryMinerOneWay] unhandled error:`, message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
