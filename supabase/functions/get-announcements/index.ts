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
    const now = new Date().toISOString();

    // Determine user's plan
    const { data: sub } = await serviceClient
      .from("user_subscriptions")
      .select("plan_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const planId: string = sub?.plan_id ?? "free";

    // Audiences that apply to this user: always "all", plus their specific plan tier
    const applicableAudiences = Array.from(new Set(["all", planId]));

    // IDs already seen by this user
    const { data: views } = await serviceClient
      .from("announcement_views")
      .select("announcement_id")
      .eq("user_id", user.id);

    const seenIds = new Set((views ?? []).map((v: { announcement_id: string }) => v.announcement_id));

    // Published, non-expired, within publish window
    const { data: announcements, error: annError } = await serviceClient
      .from("announcements")
      .select("id, title, body, cta_label, cta_url, image_url, audience, priority")
      .eq("is_published", true)
      .in("audience", applicableAudiences)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .or(`publish_at.is.null,publish_at.lte.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (annError) {
      return new Response(JSON.stringify({ error: annError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unread = (announcements ?? []).filter(
      (a: { id: string }) => !seenIds.has(a.id),
    );

    return new Response(JSON.stringify({ announcements: unread }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
