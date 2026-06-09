import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

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

    const body = await req.json() as { application_id?: string; redirect_to?: string };
    const { application_id, redirect_to } = body;

    if (!application_id || typeof application_id !== "string") {
      return new Response(JSON.stringify({ error: "application_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify calling user
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

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin check
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

    // Fetch the beta application
    const { data: app, error: appError } = await serviceClient
      .from("beta_applications")
      .select("*")
      .eq("id", application_id)
      .maybeSingle();

    if (appError || !app) {
      return new Response(JSON.stringify({ error: appError?.message ?? "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already provisioned
    if (app.provisioned_at) {
      return new Response(
        JSON.stringify({ error: "Account already provisioned for this application", already_provisioned: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = (app.email as string).trim().toLowerCase();
    let authUserId: string;
    let alreadyExisted = false;

    // Check if a user_info row already exists for this email (user signed up independently)
    const { data: existingInfo } = await (serviceClient.from("user_info") as any)
      .select("auth_user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingInfo?.auth_user_id) {
      authUserId = existingInfo.auth_user_id;
      alreadyExisted = true;
    } else {
      // Create a new auth user with a secure temporary password
      const tempPassword = generateSecurePassword();
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError || !newUser?.user) {
        return new Response(JSON.stringify({ error: createError?.message ?? "Failed to create auth user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authUserId = newUser.user.id;
    }

    // Generate a password-recovery link the admin can share with the user
    let actionLink: string | null = null;
    try {
      const { data: linkData } = await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: redirect_to ? { redirectTo: redirect_to } : undefined,
      });
      actionLink = (linkData as any)?.properties?.action_link ?? null;
    } catch {
      // Non-fatal — admin can use "Forgot Password" as fallback
    }

    // Parse first / last name from full_name
    const nameParts = (app.full_name as string).trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    if (!alreadyExisted) {
      // Create user_info row
      await (serviceClient.from("user_info") as any).insert({
        auth_user_id: authUserId,
        email,
        first_name: firstName,
        last_name: lastName,
        home_airport: app.home_airport,
        onboarding_complete: "No",
        image_file: "",
        signup_type: "Email",
        status: "current",
      });

      // Create default homepage components
      await serviceClient.from("user_homepage").insert([
        { user_id: authUserId, component_name: "upcoming_flights", order: 1, status: "active" },
        { user_id: authUserId, component_name: "recent_searches", order: 2, status: "active" },
      ]);
    } else {
      // Activate the existing account
      await (serviceClient.from("user_info") as any)
        .update({ status: "current" })
        .eq("auth_user_id", authUserId);
    }

    // Upgrade subscription to Gold (unlimited)
    await serviceClient.from("user_subscriptions").upsert(
      {
        user_id: authUserId,
        plan_id: "gold_monthly",
        status: "active",
        current_period_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    // Ensure credit wallet exists (DB trigger creates it on new users, but guard for existing)
    await serviceClient.from("user_credit_wallet").upsert(
      {
        user_id: authUserId,
        monthly_used: 0,
        monthly_period_start: new Date().toISOString(),
        monthly_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        purchased_balance: 0,
      },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

    // Mark application as provisioned
    const now = new Date().toISOString();
    await serviceClient
      .from("beta_applications")
      .update({
        status: "accepted",
        auth_user_id: authUserId,
        provisioned_at: now,
        selected_at: app.selected_at ?? now,
        invited_at: app.invited_at ?? now,
      })
      .eq("id", application_id);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        email,
        already_existed: alreadyExisted,
        action_link: actionLink,
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
