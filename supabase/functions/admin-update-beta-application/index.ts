import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_STATUSES = ["new", "shortlisted", "invited", "accepted", "rejected"] as const;
type AllowedStatus = typeof ALLOWED_STATUSES[number];

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

    const body = await req.json();
    const { id, status, internal_notes } = body as {
      id?: string;
      status?: string;
      internal_notes?: string | null;
    };

    if (!id || typeof id !== "string") {
      return new Response(JSON.stringify({ error: "id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status !== undefined && !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
      return new Response(
        JSON.stringify({ error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Build the update payload
    const updatePayload: Record<string, unknown> = {};

    if (status !== undefined) {
      updatePayload.status = status;

      // Fetch current row to conditionally set timestamps
      if (status === "invited" || status === "accepted") {
        const { data: current } = await serviceClient
          .from("beta_applications")
          .select("invited_at, selected_at")
          .eq("id", id)
          .maybeSingle();

        if (status === "invited" && current && !current.invited_at) {
          updatePayload.invited_at = new Date().toISOString();
        }
        if (status === "accepted" && current && !current.selected_at) {
          updatePayload.selected_at = new Date().toISOString();
        }
      }
    }

    // internal_notes: allow explicit null to clear
    if ("internal_notes" in body) {
      updatePayload.internal_notes = internal_notes ?? null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("beta_applications")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, full_name, email, home_airport, gowild_status, gowild_pass_duration, " +
        "gowild_search_frequency, frontier_flight_frequency, uses_gowild_search_tool, " +
        "gowild_search_tool_name, beta_testing_experience, beta_testing_details, " +
        "feedback_commitment, primary_device, preferred_feedback_method, " +
        "frequent_destinations, interested_features, value_expectation, additional_notes, " +
        "source, utm_source, utm_medium, utm_campaign, referrer, " +
        "status, internal_notes, selected_at, invited_at, created_at, updated_at, auth_user_id, provisioned_at"
      )
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, application: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
