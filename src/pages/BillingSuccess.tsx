/**
 * Stripe redirects here before the subscription webhook is guaranteed to have
 * landed, so the page briefly polls for the updated plan.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, CreditCardIcon, Tick01Icon } from "@hugeicons/core-free-icons";

type Phase = "polling" | "success" | "delayed" | "unauthenticated";

const MAX_POLLS = 8;
const POLL_INTERVAL_MS = 2000;

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("polling");
  const [planName, setPlanName] = useState("Paid");
  const pollCount = useRef(0);
  const previousPlan = useRef<string | null>(sessionStorage.getItem("billing_prev_plan"));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setPhase("unauthenticated");
        return;
      }

      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("plan_id, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      const currentPlan = subscription?.plan_id ?? "free";
      const activePaidPlan = currentPlan !== "free" && ["active", "trialing", "past_due"].includes(subscription?.status ?? "");
      const planChanged = previousPlan.current !== null && currentPlan !== previousPlan.current;

      if (activePaidPlan && (planChanged || previousPlan.current === currentPlan)) {
        const { data: plan } = await supabase
          .from("plans")
          .select("name")
          .eq("id", currentPlan)
          .maybeSingle();
        if (!cancelled) {
          setPlanName(plan?.name ?? "Paid");
          setPhase("success");
          sessionStorage.removeItem("billing_prev_plan");
        }
        return;
      }

      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) {
        setPhase("delayed");
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9F9] px-6">
      <div className="w-full max-w-sm text-center">
        {phase === "polling" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse bg-[#E6F0EE]">
              <HugeiconsIcon icon={CreditCardIcon} size={28} color="#345C5A" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-bold text-[#2E4A4A]">Activating unlimited searches…</h1>
            <p className="text-sm text-[#6B7B7B]">We are confirming your subscription with Stripe.</p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-[#D1FAE5]">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={40} color="#059669" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-[#2E4A4A]">Unlimited Searches Activated</h1>
            <p className="text-sm text-[#6B7B7B]">
              Your <span className="font-semibold text-[#345C5A]">{planName}</span> subscription is ready.
            </p>
            <button onClick={() => navigate("/")} className="mt-4 w-full py-3 rounded-xl font-semibold text-white text-sm bg-[#345C5A]">
              Back to App
            </button>
          </div>
        )}

        {phase === "delayed" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-[#FEF3C7]">
              <HugeiconsIcon icon={Tick01Icon} size={36} color="#D97706" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-bold text-[#2E4A4A]">Payment Received</h1>
            <p className="text-sm text-[#6B7B7B] leading-relaxed">
              Stripe confirmed the payment. Your Paid entitlement is still syncing and should appear shortly.
            </p>
            <button onClick={() => navigate("/")} className="mt-4 w-full py-3 rounded-xl font-semibold text-white text-sm bg-[#345C5A]">
              Back to App
            </button>
          </div>
        )}

        {phase === "unauthenticated" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-[#6B7B7B]">Please sign in to view your subscription status.</p>
            <button onClick={() => navigate("/")} className="mt-2 w-full py-3 rounded-xl font-semibold text-white text-sm bg-[#345C5A]">
              Go to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
