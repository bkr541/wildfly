import React, { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  Coins01Icon,
  Settings01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import WalletScreen from "@/components/account/WalletScreen";
import { useBilling } from "@/hooks/useBilling";

interface SubscriptionPageProps {
  onBack?: () => void;
  onTitleChange?: (title: string) => void;
  backRef?: React.MutableRefObject<(() => void) | null>;
}

const FREE_FEATURES = [
  "15 searches / month",
  "Standard routes: 1 credit",
  "All Destinations: 5 credits",
  "Purchase additional credits anytime",
];

const GOLD_FEATURES = [
  "Unlimited searches",
  "All Destinations included",
  "No credits deducted per search",
  "Priority access to premium features",
  "Manage billing anytime",
  "Best value for power users",
];

const SubscriptionPage = ({ onBack, onTitleChange, backRef }: SubscriptionPageProps) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [showWallet, setShowWallet] = useState(false);

  // While the wallet is open, override the header back button so it closes
  // the wallet instead of navigating all the way back to the Account hub.
  useEffect(() => {
    if (!backRef) return;
    if (showWallet) {
      backRef.current = () => {
        setShowWallet(false);
        onTitleChange?.("Subscription");
      };
    } else {
      backRef.current = onBack ?? null;
    }
  }, [showWallet, backRef, onBack, onTitleChange]);

  const {
    planId,
    planName,
    planStatus,
    isGold,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    plans,
    handleUpgrade,
    handleManageBilling,
    checkoutLoading,
    portalLoading,
    loading: billingLoading,
    refetch,
  } = useBilling();

  const isCurrentlyFree = planId === "free" || planName.toLowerCase() === "free";
  const isCurrentlyGold = isGold || planName.toLowerCase().includes("gold");
  const hasPaidSubscription = isCurrentlyGold || planStatus === "past_due";

  const [freeExpanded, setFreeExpanded] = useState(isCurrentlyFree);
  const [goldExpanded, setGoldExpanded] = useState(!isCurrentlyFree);

  const periodEndDisplay = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

  const goldPlan = plans.find(
    (p) =>
      p.name.toLowerCase().includes("gold") &&
      (billingCycle === "yearly" ? p.billingPeriod === "yearly" : p.billingPeriod === "monthly")
  ) ?? plans.find((p) => p.name.toLowerCase().includes("gold"));

  const goldMonthlyPlan = plans.find(
    (p) => p.name.toLowerCase().includes("gold") && p.billingPeriod === "monthly"
  );
  const goldYearlyPlan = plans.find(
    (p) => p.name.toLowerCase().includes("gold") && p.billingPeriod === "yearly"
  );

  const goldMonthlyPrice = Number(goldMonthlyPlan?.features?.price_usd ?? 12.99);
  const goldYearlyPrice = Number(goldYearlyPlan?.features?.price_usd ?? 74.99);
  const yearlySavingsPct = Math.round((1 - goldYearlyPrice / (goldMonthlyPrice * 12)) * 100);

  const goldDisplayPrice =
    billingCycle === "yearly" ? `$${goldYearlyPrice.toFixed(2)}` : `$${goldMonthlyPrice.toFixed(2)}`;
  const goldDisplayPeriod = billingCycle === "yearly" ? "/ year" : "/ month";

  const handleUpgradeToGold = async () => {
    sessionStorage.setItem("billing_prev_plan", planId);
    const targetPlan = goldPlan;
    if (!targetPlan) {
      const fallbackId = billingCycle === "yearly" ? "gold_yearly" : "gold_monthly";
      await handleUpgrade(fallbackId);
      return;
    }
    await handleUpgrade(targetPlan.id);
  };

  if (showWallet) {
    return (
      <WalletScreen
        onBack={() => {
          setShowWallet(false);
          onTitleChange?.("Subscription");
          refetch();
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-5 relative z-10 w-full animate-fade-in pt-4">

      {/* Status banners */}
      {planStatus === "trialing" && periodEndDisplay && (
        <div className="w-full max-w-md mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          Your free trial ends on <span className="font-semibold">{periodEndDisplay}</span>. You won't be charged until then.
        </div>
      )}
      {planStatus === "past_due" && (
        <div className="w-full max-w-md mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          Your last payment failed. Update your payment method via <span className="font-semibold">Manage Billing</span> to keep Gold access.
        </div>
      )}
      {planStatus === "active" && cancelAtPeriodEnd && periodEndDisplay && (
        <div className="w-full max-w-md mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Your Gold plan will end on <span className="font-semibold">{periodEndDisplay}</span>. You'll move to Free after that.
        </div>
      )}

      {/* Plan group */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E3E6E6] overflow-hidden shadow-sm mb-4">

        {/* ── Free Plan row ── */}
        <div>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-4 text-left select-none"
            onClick={() => setFreeExpanded((v) => !v)}
          >
            <div className="w-1 self-stretch rounded-full bg-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#2E4A4A]">Free Plan</p>
              <p className="text-xs text-[#9CA3AF]">Best for casual travelers</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isCurrentlyFree && (
                <span className="text-xs font-semibold text-amber-500 border border-amber-200 bg-amber-50 px-2.5 py-0.5 rounded-full">
                  Current
                </span>
              )}
              <div className={cn("transition-transform duration-300", freeExpanded ? "rotate-180" : "")}>
                <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
              </div>
            </div>
          </button>

          <div className={cn("grid transition-all duration-300 ease-in-out", freeExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="px-4 pb-4 ml-4">
                <div className="mb-3">
                  <span className="text-2xl font-bold text-[#2E4A4A]">$0</span>
                  <span className="text-xs text-[#9CA3AF] ml-1">/ month</span>
                </div>
                <ul className="space-y-2">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color="#D97706" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                      <span className="text-xs text-[#6B7B7B]">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#E3E6E6]" />

        {/* ── Gold Plan row ── */}
        <div className={cn(isCurrentlyGold ? "border-2 border-[#345C5A] rounded-b-2xl -mb-px" : "")}>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-4 text-left select-none"
            onClick={() => setGoldExpanded((v) => !v)}
          >
            <div className="w-1 self-stretch rounded-full bg-[#345C5A] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#2E4A4A]">Gold</p>
              <p className="text-xs text-[#9CA3AF]">Best for frequent travelers</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isCurrentlyGold ? (
                <span className="text-xs font-semibold text-[#345C5A] border border-[#345C5A] bg-[#F0F5F5] px-2.5 py-0.5 rounded-full">
                  Current
                </span>
              ) : (
                <>
                  <span className="text-base font-bold text-[#2E4A4A]">{goldDisplayPrice}</span>
                  <span className="text-xs text-[#9CA3AF]">{goldDisplayPeriod}</span>
                </>
              )}
              <div className={cn("transition-transform duration-300 ml-1", goldExpanded ? "rotate-180" : "")}>
                <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
              </div>
            </div>
          </button>

          <div className={cn("grid transition-all duration-300 ease-in-out", goldExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="px-4 pb-4 ml-4">
                {/* Billing cycle toggle */}
                {!isCurrentlyGold && (
                  <div className="mb-3">
                    <div className="bg-[#F4F8F8] rounded-xl p-1 flex relative w-full">
                      <div
                        className="absolute top-1 bottom-1 rounded-lg bg-[#345C5A] shadow-sm transition-all duration-300 ease-in-out"
                        style={{
                          width: "calc(50% - 4px)",
                          left: billingCycle === "monthly" ? "4px" : "calc(50% + 0px)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setBillingCycle("monthly")}
                        className={cn(
                          "py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 flex-1",
                          billingCycle === "monthly" ? "text-white" : "text-[#9CA3AF]"
                        )}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle("yearly")}
                        className={cn(
                          "py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 flex-1",
                          billingCycle === "yearly" ? "text-white" : "text-[#9CA3AF]"
                        )}
                      >
                        Yearly
                      </button>
                    </div>

                    {/* Savings callout */}
                    {billingCycle === "yearly" ? (
                      <div className="mt-2 flex flex-col items-center gap-0.5">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#345C5A] bg-[#E6F0EE] px-2.5 py-1 rounded-full">
                          Save {yearlySavingsPct}%
                        </span>
                        <p className="text-xs text-[#9CA3AF] mt-1">
                          Switch to Monthly:{" "}
                          <span className="text-[#345C5A] font-semibold">${goldMonthlyPrice.toFixed(2)}/month</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#9CA3AF] mt-2 text-center">
                        Switch to Yearly:{" "}
                        <span className="text-[#345C5A] font-semibold">${goldYearlyPrice.toFixed(2)}/year</span>
                        {" "}· Save {yearlySavingsPct}%
                      </p>
                    )}
                  </div>
                )}

                {/* Feature list */}
                <ul className="space-y-2 mb-4">
                  {GOLD_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color="#345C5A" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                      <span className="text-xs text-[#6B7B7B]">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {!isCurrentlyGold && (
                  <button
                    type="button"
                    disabled={checkoutLoading || billingLoading}
                    onClick={handleUpgradeToGold}
                    className={cn(
                      "w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                      checkoutLoading || billingLoading
                        ? "bg-[#E3E6E6] text-[#9CA3AF] cursor-not-allowed"
                        : "bg-[#345C5A] text-white hover:bg-[#2E4A4A] active:scale-[0.98]"
                    )}
                  >
                    {checkoutLoading ? (
                      <>
                        <HugeiconsIcon icon={Loading03Icon} size={14} color="#9CA3AF" strokeWidth={2} className="animate-spin" />
                        Redirecting…
                      </>
                    ) : (
                      "Upgrade to Gold"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* My Wallet */}
      <div className="w-full max-w-md mb-3">
        <button
          type="button"
          onClick={() => {
            setShowWallet(true);
            onTitleChange?.("My Wallet");
          }}
          className="flex items-center justify-between w-full bg-white rounded-xl p-3 border border-[#E3E6E6] hover:border-[#345C5A] transition-colors shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Coins01Icon} size={14} color="#345C5A" strokeWidth={1.5} />
            </span>
            <span className="text-sm font-semibold text-[#2E4A4A]">My Wallet</span>
          </div>
          <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="#C4CACA" strokeWidth={1.5} />
        </button>
      </div>

      {/* Manage Billing */}
      {hasPaidSubscription && (
        <div className="w-full max-w-md mb-3">
          <button
            type="button"
            disabled={portalLoading}
            onClick={handleManageBilling}
            className={cn(
              "flex items-center justify-between w-full bg-white rounded-xl p-3 border transition-colors shadow-sm",
              portalLoading
                ? "border-[#E3E6E6] cursor-not-allowed opacity-60"
                : "border-[#E3E6E6] hover:border-[#345C5A]"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center shrink-0">
                {portalLoading ? (
                  <HugeiconsIcon icon={Loading03Icon} size={14} color="#9CA3AF" strokeWidth={1.5} className="animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Settings01Icon} size={14} color="#345C5A" strokeWidth={1.5} />
                )}
              </span>
              <span className="text-sm font-semibold text-[#2E4A4A]">
                {portalLoading ? "Opening portal…" : "Manage Billing"}
              </span>
            </div>
            {!portalLoading && (
              <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="#C4CACA" strokeWidth={1.5} />
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
