/**
 * create-customer-portal-session
 *
 * Creates a Stripe Billing Portal session for the authenticated user.
 * Allows them to manage payment methods, cancel subscriptions, etc.
 *
 * Security contract:
 *  - Requires a valid Supabase JWT
 *  - Only creates portal for the authenticated user's Stripe customer
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAnon = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let returnUrl = `${req.headers.get("origin") ?? "https://wildfly.lovable.app"}/billing/cancel`;
  try {
    const body = await req.json();
    if (body.returnUrl) returnUrl = body.returnUrl;
  } catch {
    // use default returnUrl
  }

  // ── Resolve Stripe customer ───────────────────────────────────────────────
  const { data: subRow } = await supabase
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let stripeCustomerId = subRow?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    // No Stripe customer yet — create one so the portal can be opened
    const { data: userInfo } = await supabase
      .from("user_info")
      .select("email, first_name, last_name, display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const customerName =
      userInfo?.display_name ??
      [userInfo?.first_name, userInfo?.last_name].filter(Boolean).join(" ") ??
      undefined;

    const customer = await stripe.customers.create({
      email: userInfo?.email ?? user.email ?? undefined,
      name: customerName || undefined,
      metadata: { supabase_user_id: user.id },
    });

    stripeCustomerId = customer.id;

    await supabase.from("user_subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        plan_id: "free",
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    );
  }

  // ── Create portal session ─────────────────────────────────────────────────
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe portal session creation failed:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Failed to create billing portal session" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
