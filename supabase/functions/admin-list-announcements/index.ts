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

    const [announcementsRes, viewsRes] = await Promise.all([
      serviceClient
        .from("announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      serviceClient
        .from("announcement_views")
        .select("announcement_id, user_id"),
    ]);

    if (announcementsRes.error) {
      return new Response(JSON.stringify({ error: announcementsRes.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const viewMap: Record<string, { count: number; userIds: string[] }> = {};
    for (const v of viewsRes.data ?? []) {
      if (!viewMap[v.announcement_id]) viewMap[v.announcement_id] = { count: 0, userIds: [] };
      viewMap[v.announcement_id].count += 1;
      viewMap[v.announcement_id].userIds.push(v.user_id);
    }

    const announcements = (announcementsRes.data ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      _view_count: viewMap[a.id as string]?.count ?? 0,
      _seen_by: viewMap[a.id as string]?.userIds ?? [],
    }));

    return new Response(JSON.stringify({ announcements }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
