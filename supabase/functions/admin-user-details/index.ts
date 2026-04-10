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

    const { target_user_id } = await req.json();
    if (!target_user_id || typeof target_user_id !== "string") {
      return new Response(JSON.stringify({ error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
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

    // Check developer_allowlist
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

    // Fetch all details in parallel
    const [subRes, settingsRes, walletRes, txRes, searchesRes] = await Promise.all([
      serviceClient
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", target_user_id)
        .maybeSingle(),
      serviceClient
        .from("user_settings")
        .select("*")
        .eq("user_id", target_user_id)
        .maybeSingle(),
      serviceClient
        .from("user_credit_wallet")
        .select("*")
        .eq("user_id", target_user_id)
        .maybeSingle(),
      serviceClient
        .from("credit_transactions")
        .select("*")
        .eq("user_id", target_user_id)
        .order("created_at", { ascending: false })
        .limit(50),
      serviceClient
        .from("flight_searches")
        .select("id,departure_airport,arrival_airport,departure_date,return_date,trip_type,all_destinations,flight_results_count,gowild_found,credits_cost,search_timestamp")
        .eq("user_id", target_user_id)
        .order("search_timestamp", { ascending: false })
        .limit(100),
    ]);

    return new Response(
      JSON.stringify({
        subscription: subRes.data ?? null,
        settings: settingsRes.data ?? null,
        wallet: walletRes.data ?? null,
        transactions: txRes.data ?? [],
        searches: searchesRes.data ?? [],
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
