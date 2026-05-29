import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Credit pack metadata mapping — must stay in sync with credit_packs DB table
const CREDIT_PACKS: Record<string, number> = {
  credit_pack_10:  10,
  credit_pack_20:  20,
  credit_pack_25:  25,
  credit_pack_50:  50,
  credit_pack_100: 100,
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  // Use service-role client so ledger writes bypass RLS
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      // ── Subscription events ──────────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const planId = sub.metadata?.plan_id ?? "free";
        const status = sub.status === "active" ? "active"
          : sub.status === "trialing" ? "trialing"
          : sub.status === "past_due" ? "past_due"
          : "canceled";

        await supabase.from("user_subscriptions").upsert({
          user_id: userId,
          plan_id: planId,
          status,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items?.data?.[0]?.price?.id ?? null,
          current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: (sub as any).cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase.from("user_subscriptions").update({
          plan_id: "free",
          status: "canceled",
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        break;
      }

      // ── Credit pack purchase ─────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "payment") break;

        const userId = session.metadata?.user_id;
        const packType = session.metadata?.credit_pack;
        if (!userId || !packType) {
          console.warn(`Session ${session.id} missing user_id/credit_pack metadata — skipping`);
          break;
        }

        // Trusted server-side credit amount — never trust client input.
        const credits = CREDIT_PACKS[packType];
        if (!credits) {
          console.warn(`Unknown credit pack type ${packType} on session ${session.id}`);
          break;
        }

        // Atomic, idempotent fulfillment via SECURITY DEFINER RPC.
        const { data: result, error: rpcError } = await supabase.rpc("fulfill_stripe_credit_pack", {
          p_user_id: userId,
          p_stripe_session_id: session.id,
          p_credits: credits,
          p_pack_id: packType,
          p_stripe_customer_id: (session.customer as string) ?? null,
          p_stripe_event_id: event.id,
        });

        if (rpcError) {
          console.error(`Fulfillment RPC failed for session ${session.id}:`, rpcError);
          // Return 500 so Stripe retries the webhook.
          return new Response(
            JSON.stringify({ error: "Fulfillment failed", detail: rpcError.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const status = (result as { status?: string } | null)?.status;
        if (status === "fulfilled") {
          console.log(`Fulfilled ${credits} credits for user ${userId} (session ${session.id})`);
        } else if (status === "already_fulfilled") {
          console.log(`Session ${session.id} already fulfilled — no-op replay`);
        } else {
          console.error(`Unexpected fulfillment status for session ${session.id}:`, result);
          return new Response(
            JSON.stringify({ error: "Unexpected fulfillment status", result }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        break;
      }

    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
