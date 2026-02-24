import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Credit pack metadata mapping
const CREDIT_PACKS: Record<string, number> = {
  credit_pack_10: 10,
  credit_pack_20: 20,
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  // In production, verify Stripe signature here using STRIPE_WEBHOOK_SECRET

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      // ── Subscription events ──
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
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
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase.from("user_subscriptions").update({
          plan_id: "free",
          status: "canceled",
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        break;
      }

      // ── Credit pack purchase ──
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "payment") break;

        const userId = session.metadata?.user_id;
        const packType = session.metadata?.credit_pack;
        if (!userId || !packType) break;

        const credits = CREDIT_PACKS[packType];
        if (!credits) break;

        // Increment purchased_balance
        const { data: wallet } = await supabase
          .from("user_credit_wallet")
          .select("purchased_balance")
          .eq("user_id", userId)
          .single();

        if (wallet) {
          await supabase.from("user_credit_wallet").update({
            purchased_balance: wallet.purchased_balance + credits,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
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
