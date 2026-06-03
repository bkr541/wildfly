import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const since: string | null = body.since ?? null;

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

    // Helper to add date filter
    const withSince = <T>(q: T & { gte: (col: string, val: string) => T }): T =>
      since ? q.gte("search_timestamp", since) : q;

    const withSinceSaved = <T>(q: T & { gte: (col: string, val: string) => T }): T =>
      since ? q.gte("created_at", since) : q;

    const [
      totalSearchesResult,
      goWildHitsResult,
      savedInRangeResult,
      savedTotalResult,
      totalUsersResult,
      searchSampleResult,
      scanJobsResult,
    ] = await Promise.all([
      withSince(
        serviceClient.from("flight_searches").select("id", { count: "exact", head: true })
      ),
      withSince(
        serviceClient.from("flight_searches").select("id", { count: "exact", head: true }).eq("gowild_found", true)
      ),
      withSinceSaved(
        serviceClient.from("user_flights").select("id", { count: "exact", head: true })
      ),
      serviceClient.from("user_flights").select("id", { count: "exact", head: true }),
      serviceClient.from("user_info").select("id", { count: "exact", head: true }),
      withSince(
        serviceClient
          .from("flight_searches")
          .select(
            "id,user_id,departure_airport,arrival_airport,gowild_found,result_source,flight_results_count,departure_date,triggered_by"
          )
          .order("search_timestamp", { ascending: false })
          .limit(2000)
      ),
      serviceClient
        .from("bulk_search_job_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10),
    ]);

    return new Response(
      JSON.stringify({
        totalSearches: totalSearchesResult.count ?? 0,
        goWildHits: goWildHitsResult.count ?? 0,
        savedFlightsInRange: savedInRangeResult.count ?? 0,
        savedFlightsTotal: savedTotalResult.count ?? 0,
        totalUsersCount: totalUsersResult.count ?? null,
        searchSample: searchSampleResult.data ?? [],
        scanJobs: scanJobsResult.data ?? [],
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
