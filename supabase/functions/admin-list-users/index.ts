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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller with anon client
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

    // Check developer_allowlist
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

    // Fetch users, subscriptions, and auth users in parallel
    const [usersRes, subsRes, authUsersRes] = await Promise.all([
      serviceClient
        .from("user_info")
        .select("id, auth_user_id, first_name, last_name, email, username, avatar_url, display_name, home_airport, home_city, is_discoverable, signup_type, status, last_login, onboarding_complete, bio, dob, mobile_number, locations(name, city, state, country)")
        .order("id", { ascending: true })
        .limit(500),
      serviceClient
        .from("user_subscriptions")
        .select("user_id, plan_id, status")
        .limit(500),
      serviceClient.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (usersRes.error) {
      return new Response(JSON.stringify({ error: usersRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build lookup maps
    const subMap: Record<string, { plan_id: string; status: string }> = {};
    for (const s of subsRes.data ?? []) {
      subMap[s.user_id] = { plan_id: s.plan_id, status: s.status };
    }

    const authDateMap: Record<string, string> = {};
    for (const au of authUsersRes.data?.users ?? []) {
      authDateMap[au.id] = au.created_at;
    }

    // Merge into user list
    const users = (usersRes.data ?? []).map((u: any) => ({
      ...u,
      date_joined: u.auth_user_id ? authDateMap[u.auth_user_id] ?? null : null,
      plan_id: u.auth_user_id ? subMap[u.auth_user_id]?.plan_id ?? null : null,
      plan_status: u.auth_user_id ? subMap[u.auth_user_id]?.status ?? null : null,
    }));

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
