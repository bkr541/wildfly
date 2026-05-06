/**
 * create-checkout-session
 *
 * Creates a Stripe Checkout session for either:
 *  - A recurring subscription upgrade (purchaseType = "subscription")
 *  - A one-time credit pack purchase (purchaseType = "credit_pack")
 *
 * Security contract:
 *  - Requires a valid Supabase JWT (authentication required)
 *  - All product/price lookups happen server-side against DB records
 *  - Client never controls price amount or Stripe price ID
 *  - stripe_customer_id is created on first checkout and stored in user_subscriptions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_ORIGINS = [
  "https://wildfly.app",
  "https://wildfly.lovable.app",
];

function isAllowedUrl(url: string): boolean {
  try {
    const { origin, protocol } = new URL(url);
    if (protocol === "http:" && origin.startsWith("http://localhost")) return true;
    return ALLOWED_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

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

  // ── Authenticate the request ──────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use anon client to verify the user JWT
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

  // Service-role client for DB writes that bypass RLS
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: {
    purchaseType: "subscription" | "credit_pack";
    planId?: string;
    creditPackId?: string;
    successUrl: string;
    cancelUrl: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { purchaseType, planId, creditPackId, successUrl, cancelUrl } = body;

  if (!purchaseType || !successUrl || !cancelUrl) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isAllowedUrl(successUrl) || !isAllowedUrl(cancelUrl)) {
    return new Response(JSON.stringify({ error: "Invalid redirect URL" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Resolve Stripe price from DB (never trust client-provided IDs) ────────
  let stripePriceId: string | null = null;
  let productName = "";
  let sessionMode: "subscription" | "payment" = "subscription";
  let metadata: Record<string, string> = { user_id: user.id };

  if (purchaseType === "subscription") {
    if (!planId) {
      return new Response(JSON.stringify({ error: "planId is required for subscription" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, stripe_price_id, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plan.is_active) {
      return new Response(JSON.stringify({ error: "This plan is no longer available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plan.stripe_price_id) {
      return new Response(
        JSON.stringify({ error: "Plan is not yet configured for purchase. Please contact support." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    stripePriceId = plan.stripe_price_id;
    productName = plan.name;
    sessionMode = "subscription";
    metadata = { user_id: user.id, plan_id: planId, purchase_type: "subscription" };
  } else if (purchaseType === "credit_pack") {
    if (!creditPackId) {
      return new Response(JSON.stringify({ error: "creditPackId is required for credit_pack" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pack, error: packError } = await supabase
      .from("credit_packs")
      .select("id, name, credits_amount, stripe_price_id, is_active")
      .eq("id", creditPackId)
      .maybeSingle();

    if (packError || !pack) {
      return new Response(JSON.stringify({ error: "Credit pack not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pack.is_active) {
      return new Response(JSON.stringify({ error: "This credit pack is no longer available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pack.stripe_price_id) {
      return new Response(
        JSON.stringify({ error: "Credit pack is not yet configured for purchase. Please contact support." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    stripePriceId = pack.stripe_price_id;
    productName = pack.name;
    sessionMode = "payment";
    metadata = {
      user_id: user.id,
      credit_pack: creditPackId,
      purchase_type: "credit_pack",
    };
  } else {
    return new Response(JSON.stringify({ error: "Invalid purchaseType" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Get or create Stripe customer ─────────────────────────────────────────
  let stripeCustomerId: string | null = null;

  const { data: subRow } = await supabase
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  stripeCustomerId = subRow?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    // Look up user email from user_info
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

    // Persist the customer ID
    await supabase.from("user_subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        plan_id: subRow?.stripe_customer_id ? undefined : "free",
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    );
  }

  // ── Create Stripe Checkout session ────────────────────────────────────────
  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [{ price: stripePriceId!, quantity: 1 }],
      mode: sessionMode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      ...(sessionMode === "subscription" && {
        subscription_data: { metadata },
      }),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Stripe checkout session creation failed:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Failed to create checkout session" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
