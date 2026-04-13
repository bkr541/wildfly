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

    const { target_user_id, user_info_updates, plan_id } = await req.json();
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

    const results: Record<string, unknown> = {};

    // Update user_info fields if provided
    if (user_info_updates && typeof user_info_updates === "object") {
      const allowedFields = [
        "first_name", "last_name", "email", "username", "display_name",
        "home_airport", "home_city", "status", "is_discoverable", "bio",
        "avatar_url", "mobile_number",
      ];
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(user_info_updates)) {
        if (allowedFields.includes(k)) filtered[k] = v;
      }

      if (Object.keys(filtered).length > 0) {
        const { error } = await serviceClient
          .from("user_info")
          .update(filtered)
          .eq("auth_user_id", target_user_id);
        if (error) {
          results.user_info_error = error.message;
        } else {
          results.user_info_updated = true;
        }
      }
    }

    // Update subscription plan if provided
    if (plan_id && typeof plan_id === "string") {
      const { error } = await serviceClient
        .from("user_subscriptions")
        .update({ plan_id, updated_at: new Date().toISOString() })
        .eq("user_id", target_user_id);
      if (error) {
        results.subscription_error = error.message;
      } else {
        results.subscription_updated = true;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
