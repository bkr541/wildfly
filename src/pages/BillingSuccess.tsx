/**
 * BillingSuccess
 *
 * Shown after Stripe redirects back on a successful checkout.
 *
 * Important: Stripe redirecting here does NOT guarantee the webhook has landed.
 * We poll the DB for a few seconds and show feedback accordingly.
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Coins01Icon, Tick01Icon } from "@hugeicons/core-free-icons";

type Phase =
  | "polling"     // checking DB for updated state
  | "success"     // DB reflects updated purchase
  | "delayed"     // webhook hasn't landed after polling window
  | "unauthenticated"; // user not signed in

const MAX_POLLS = 8;
const POLL_INTERVAL_MS = 2000;

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const purchaseType = searchParams.get("type") ?? "subscription";
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("polling");
  const [planName, setPlanName] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const pollCount = useRef(0);

  // Snapshot of state before this page loaded (stored in sessionStorage by
  // the checkout initiation code so we can detect "something changed").
  const prevPlanRef = useRef<string | null>(sessionStorage.getItem("billing_prev_plan"));
  const prevCreditsRef = useRef<number | null>(
    sessionStorage.getItem("billing_prev_credits")
      ? Number(sessionStorage.getItem("billing_prev_credits"))
      : null
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPhase("unauthenticated");
        return;
      }

      const [subRes, walletRes] = await Promise.all([
        supabase
          .from("user_subscriptions")
          .select("plan_id, status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_credit_wallet")
          .select("purchased_balance, monthly_used")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const currentPlan = subRes.data?.plan_id ?? "free";
      const currentCredits = walletRes.data?.purchased_balance ?? 0;

      // Detect change: either plan changed or purchased credits grew
      const planChanged = prevPlanRef.current !== null && currentPlan !== prevPlanRef.current;
      const creditsGrew =
        prevCreditsRef.current !== null && currentCredits > prevCreditsRef.current;

      if (planChanged || creditsGrew || purchaseType === "credit_pack" && creditsGrew) {
        // Fetch plan name for display
        if (currentPlan !== "free") {
          const { data: plan } = await supabase
            .from("plans")
            .select("name")
            .eq("id", currentPlan)
            .maybeSingle();
          if (!cancelled) setPlanName(plan?.name ?? currentPlan);
        }
        if (!cancelled) {
          setCredits(currentCredits);
          setPhase("success");
        }
        // Clear snapshot
        sessionStorage.removeItem("billing_prev_plan");
        sessionStorage.removeItem("billing_prev_credits");
        return;
      }

      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) {
        if (!cancelled) setPhase("delayed");
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    // First poll might detect immediate success if webhook landed fast
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [purchaseType]);

  const goToAccount = () => navigate("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9F9] px-6">
      <div className="w-full max-w-sm text-center">

        {/* ── Polling ───────────────────────────────────────────────────── */}
        {phase === "polling" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
              style={{ background: "#E6F0EE" }}
            >
              <HugeiconsIcon icon={Coins01Icon} size={28} color="#345C5A" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-bold text-[#2E4A4A]">Finalizing your purchase…</h1>
            <p className="text-sm text-[#6B7B7B]">
              Please wait while we confirm your payment with Stripe.
            </p>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#345C5A] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Success ───────────────────────────────────────────────────── */}
        {phase === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "#D1FAE5" }}
            >
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={40} color="#059669" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-[#2E4A4A]">
              {purchaseType === "subscription" ? "Subscription Activated!" : "Credits Added!"}
            </h1>
            {purchaseType === "subscription" && planName && (
              <p className="text-sm text-[#6B7B7B]">
                You're now on the <span className="font-semibold text-[#345C5A]">{planName}</span> plan.
              </p>
            )}
            {purchaseType === "credit_pack" && credits !== null && (
              <p className="text-sm text-[#6B7B7B]">
                Your purchased credit balance is now{" "}
                <span className="font-semibold text-[#345C5A]">{credits}</span>.
              </p>
            )}
            <button
              onClick={goToAccount}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-white text-sm"
              style={{ background: "#345C5A" }}
            >
              Back to App
            </button>
          </div>
        )}

        {/* ── Delayed webhook ───────────────────────────────────────────── */}
        {phase === "delayed" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "#FEF3C7" }}
            >
              <HugeiconsIcon icon={Tick01Icon} size={36} color="#D97706" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-bold text-[#2E4A4A]">Payment Received</h1>
            <p className="text-sm text-[#6B7B7B] leading-relaxed">
              Your payment was successful! Your account will be updated shortly —
              this usually takes less than a minute. You can return to the app and
              refresh your billing screen in a moment.
            </p>
            <button
              onClick={goToAccount}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-white text-sm"
              style={{ background: "#345C5A" }}
            >
              Back to App
            </button>
          </div>
        )}

        {/* ── Unauthenticated ───────────────────────────────────────────── */}
        {phase === "unauthenticated" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-[#6B7B7B]">Please sign in to view your purchase status.</p>
            <button
              onClick={goToAccount}
              className="mt-2 w-full py-3 rounded-xl font-semibold text-white text-sm"
              style={{ background: "#345C5A" }}
            >
              Go to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
