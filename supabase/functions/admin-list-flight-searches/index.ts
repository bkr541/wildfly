import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Snapshot types ─────────────────────────────────────────────────────────────

interface SnapRow {
  id: string;
  flight_search_id: string;
  stable_itinerary_key: string | null;
  source_itinerary_id: string | null;
  origin_iata: string | null;
  leg_origin_iata: string | null;
  leg_destination_iata: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  flight_number: string | null;
  leg_index: number | null;
  stops: number | null;
  has_go_wild: boolean | null;
  go_wild_available_seats: number | null;
  go_wild_total: number | null;
  standard_total: number | null;
  availability_status: string | null;
  snapshot_at: string;
}

interface SnapSummary {
  flight_search_id: string;
  snapshot_rows: number;
  unique_itineraries: number;
  gowild_itineraries: number;
  gowild_rate: number;
  avg_gowild_seats: number | null;
  max_gowild_seats: number | null;
  min_gowild_fare: number | null;
  avg_savings: number | null;
  nonstop_count: number;
  connecting_count: number;
  sold_out_count: number;
  best_destination: string | null;
  best_destination_score: number | null;
  last_snapshot_at: string | null;
}

// ── Itinerary key ──────────────────────────────────────────────────────────────

function itinKey(s: SnapRow): string {
  return (
    s.stable_itinerary_key ||
    s.source_itinerary_id ||
    `${s.origin_iata ?? "?"}-${s.leg_destination_iata ?? "?"}-${s.departure_at ?? "?"}-${s.arrival_at ?? "?"}-${s.flight_number ?? "?"}`
  );
}

// ── Build per-search snapshot summaries ────────────────────────────────────────

function buildSummaries(snaps: SnapRow[], searchIds: string[]): Record<string, SnapSummary> {
  // Bucket rows by search ID
  const bySearch = new Map<string, SnapRow[]>();
  for (const id of searchIds) bySearch.set(id, []);
  for (const s of snaps) {
    const bucket = bySearch.get(s.flight_search_id);
    if (bucket) bucket.push(s);
  }

  const result: Record<string, SnapSummary> = {};

  for (const [searchId, rows] of bySearch.entries()) {
    if (rows.length === 0) continue;

    // Group into itineraries by key
    const groups = new Map<string, SnapRow[]>();
    for (const row of rows) {
      const k = itinKey(row);
      const arr = groups.get(k) ?? [];
      arr.push(row);
      groups.set(k, arr);
    }

    // Derive per-itinerary metrics (take first leg as representative)
    const itins: {
      destination: string | null;
      stops: number;
      hasGw: boolean;
      gwSeats: number | null;
      gwTotal: number | null;
      savings: number | null;
      isSoldOut: boolean;
    }[] = [];

    for (const legs of groups.values()) {
      legs.sort((a, b) => (a.leg_index ?? 0) - (b.leg_index ?? 0));
      const first = legs[0];
      const last = legs[legs.length - 1];
      const hasGw = legs.some((l) => !!l.has_go_wild);
      const rawMin = Math.min(...legs.map((l) => l.go_wild_available_seats ?? Infinity));
      const gwSeats = isFinite(rawMin) ? rawMin : null;
      const gwTotal = first.go_wild_total ?? null;
      const stdTotal = first.standard_total ?? null;
      const savings = gwTotal != null && stdTotal != null && stdTotal > gwTotal
        ? stdTotal - gwTotal
        : null;
      const stops = first.stops ?? Math.max(0, legs.length - 1);
      const avStatus = first.availability_status ?? "";
      itins.push({
        destination: last.leg_destination_iata,
        stops,
        hasGw,
        gwSeats,
        gwTotal,
        savings,
        isSoldOut: /sold|unavailable|limited/i.test(avStatus),
      });
    }

    const gwItins = itins.filter((i) => i.hasGw);
    const gwSeatsList = gwItins.map((i) => i.gwSeats).filter((x): x is number => x != null);
    const gwFares = gwItins.map((i) => i.gwTotal).filter((x): x is number => x != null);
    const savingsList = gwItins.map((i) => i.savings).filter((x): x is number => x != null);
    const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

    // Best destination by seat count + savings score
    let bestDest: string | null = null;
    let bestScore = -Infinity;
    for (const i of gwItins) {
      const score = (i.gwSeats ?? 0) + (i.savings ?? 0) / 100;
      if (score > bestScore) { bestScore = score; bestDest = i.destination; }
    }

    const lastTs = rows.reduce<string | null>((acc, r) =>
      !acc || r.snapshot_at > acc ? r.snapshot_at : acc, null);

    result[searchId] = {
      flight_search_id: searchId,
      snapshot_rows: rows.length,
      unique_itineraries: itins.length,
      gowild_itineraries: gwItins.length,
      gowild_rate: itins.length ? gwItins.length / itins.length : 0,
      avg_gowild_seats: avg(gwSeatsList),
      max_gowild_seats: gwSeatsList.length ? Math.max(...gwSeatsList) : null,
      min_gowild_fare: gwFares.length ? Math.min(...gwFares) : null,
      avg_savings: avg(savingsList),
      nonstop_count: itins.filter((i) => i.stops === 0).length,
      connecting_count: itins.filter((i) => i.stops > 0).length,
      sold_out_count: itins.filter((i) => i.isSoldOut).length,
      best_destination: bestDest,
      best_destination_score: bestScore === -Infinity ? null : bestScore,
      last_snapshot_at: lastTs,
    };
  }

  return result;
}

// ── Safe ilike escape (strip % _ for admin inputs) ─────────────────────────────

function safeIlike(v: string): string {
  return String(v).trim().replace(/[%_]/g, "");
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      page = 0,
      page_size = 20,
      search = "",
      origin = "",
      destination = "",
      trip_type = "",
      result_source = "",
      triggered_by = "",
      gowild_status = "all",
      all_destinations = "all",
      date_from = "",
      date_to = "",
      departure_date_from = "",
      departure_date_to = "",
      freshness = "all",
      min_results = "",
      max_results = "",
    } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: dev } = await serviceClient
      .from("developer_allowlist")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!dev) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from = Number(page) * Number(page_size);
    const to = from + Number(page_size) - 1;

    // Build query
    // Using 'any' cast because Supabase generated types don't reflect our full column set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (serviceClient as any)
      .from("flight_searches")
      .select("*", { count: "exact" })
      .order("search_timestamp", { ascending: false });

    // Free-text search across key columns
    if (search && search.trim()) {
      const q = safeIlike(search.trim());
      if (q) {
        query = query.or(
          `departure_airport.ilike.%${q}%,arrival_airport.ilike.%${q}%,trip_type.ilike.%${q}%,result_source.ilike.%${q}%,triggered_by.ilike.%${q}%`
        );
      }
    }

    // Exact/partial column filters
    if (origin && origin.trim()) {
      query = query.eq("departure_airport", origin.trim().toUpperCase());
    }
    if (destination && destination.trim()) {
      query = query.eq("arrival_airport", destination.trim().toUpperCase());
    }
    if (trip_type && trip_type.trim()) {
      query = query.eq("trip_type", trip_type.trim());
    }

    // result_source and triggered_by – search both columns with ilike
    if (result_source && result_source.trim()) {
      const q = safeIlike(result_source.trim());
      if (q) {
        query = query.or(`result_source.ilike.%${q}%,triggered_by.ilike.%${q}%`);
      }
    }
    if (triggered_by && triggered_by.trim()) {
      query = query.eq("triggered_by", triggered_by.trim());
    }

    // GoWild status
    if (gowild_status === "found") query = query.eq("gowild_found", true);
    if (gowild_status === "not_found") query = query.eq("gowild_found", false);

    // All destinations (stored as "Yes" / "No" / other strings)
    if (all_destinations === "yes") query = query.eq("all_destinations", "Yes");
    if (all_destinations === "no") query = query.neq("all_destinations", "Yes");

    // Search timestamp range
    if (date_from) query = query.gte("search_timestamp", date_from);
    if (date_to) query = query.lte("search_timestamp", date_to + "T23:59:59.999Z");

    // Departure date range
    if (departure_date_from) query = query.gte("departure_date", departure_date_from);
    if (departure_date_to) query = query.lte("departure_date", departure_date_to);

    // Result count range
    if (min_results !== "" && min_results !== null && !isNaN(Number(min_results))) {
      query = query.gte("flight_results_count", Number(min_results));
    }
    if (max_results !== "" && max_results !== null && !isNaN(Number(max_results))) {
      query = query.lte("flight_results_count", Number(max_results));
    }

    // Freshness filter via search_timestamp proxy
    // Fresh: <30min, Recent: 30min–3h, Aging: 3h–12h, Stale: >12h
    if (freshness && freshness !== "all" && freshness !== "unknown") {
      const now = Date.now();
      if (freshness === "fresh") {
        query = query.gte("search_timestamp", new Date(now - 30 * 60 * 1000).toISOString());
      } else if (freshness === "recent") {
        query = query
          .gte("search_timestamp", new Date(now - 180 * 60 * 1000).toISOString())
          .lt("search_timestamp", new Date(now - 30 * 60 * 1000).toISOString());
      } else if (freshness === "aging") {
        query = query
          .gte("search_timestamp", new Date(now - 720 * 60 * 1000).toISOString())
          .lt("search_timestamp", new Date(now - 180 * 60 * 1000).toISOString());
      } else if (freshness === "stale") {
        query = query.lt("search_timestamp", new Date(now - 720 * 60 * 1000).toISOString());
      }
    }

    // Paginate
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flights = data ?? [];
    const searchIds: string[] = flights.map((f: { id: string }) => f.id).filter(Boolean);

    // Fetch snapshot summaries for current page (batched, not per-row)
    let snapshotSummaries: Record<string, SnapSummary> = {};
    if (searchIds.length > 0) {
      const { data: snaps } = await serviceClient
        .from("flight_snapshots")
        .select(
          "id, flight_search_id, stable_itinerary_key, source_itinerary_id, origin_iata, leg_origin_iata, leg_destination_iata, departure_at, arrival_at, flight_number, leg_index, stops, has_go_wild, go_wild_available_seats, go_wild_total, standard_total, availability_status, snapshot_at"
        )
        .in("flight_search_id", searchIds)
        .limit(5000); // Cap to prevent timeouts; typically << 5000 for a page of 20

      if (snaps) {
        snapshotSummaries = buildSummaries(snaps as SnapRow[], searchIds);
      }
    }

    // Summarise which filters were applied (for debugging / UI awareness)
    const filtersApplied: Record<string, unknown> = {};
    if (search) filtersApplied.search = search;
    if (origin) filtersApplied.origin = origin;
    if (destination) filtersApplied.destination = destination;
    if (trip_type) filtersApplied.trip_type = trip_type;
    if (result_source) filtersApplied.result_source = result_source;
    if (triggered_by) filtersApplied.triggered_by = triggered_by;
    if (gowild_status !== "all") filtersApplied.gowild_status = gowild_status;
    if (all_destinations !== "all") filtersApplied.all_destinations = all_destinations;
    if (freshness !== "all") filtersApplied.freshness = freshness;
    if (date_from) filtersApplied.date_from = date_from;
    if (date_to) filtersApplied.date_to = date_to;
    if (departure_date_from) filtersApplied.departure_date_from = departure_date_from;
    if (departure_date_to) filtersApplied.departure_date_to = departure_date_to;
    if (min_results) filtersApplied.min_results = min_results;
    if (max_results) filtersApplied.max_results = max_results;

    return new Response(
      JSON.stringify({
        flights,
        total: count ?? 0,
        page: Number(page),
        page_size: Number(page_size),
        filters_applied: filtersApplied,
        snapshot_summaries_by_search_id: snapshotSummaries,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
