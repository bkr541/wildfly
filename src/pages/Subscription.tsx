import React, { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  ArrowDown01Icon,
  Settings01Icon,
  Loading03Icon,
  Search01Icon,
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
  "5 searches each calendar month",
  "Every search counts as one search",
  "All Destinations searches included",
  "Today's GoWild home feed does not use searches",
];

const PAID_FEATURES = [
  "Unlimited user-initiated searches",
  "All Destinations and route searches included",
  "Today's GoWild home feed included",
  "Monthly or yearly billing",
  "Manage or cancel billing anytime",
];

const SubscriptionPage = ({ onBack, onTitleChange, backRef }: SubscriptionPageProps) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [showUsage, setShowUsage] = useState(false);
  const [freeExpanded, setFreeExpanded] = useState(true);
  const [paidExpanded, setPaidExpanded] = useState(true);

  const {
    planStatus,
    isPaid,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    entitlement,
    plans,
    handleUpgrade,
    handleManageBilling,
    checkoutLoading,
    portalLoading,
    loading,
    refetch,
  } = useBilling();

  useEffect(() => {
    if (!backRef) return;
    if (showUsage) {
      backRef.current = () => {
        setShowUsage(false);
        onTitleChange?.("Subscription");
      };
    } else {
      backRef.current = onBack ?? null;
    }
  }, [backRef, onBack, onTitleChange, showUsage]);

  const paidPlans = useMemo(
    () => plans.filter((plan) => plan.entitlementTier === "paid"),
    [plans],
  );
  const selectedPaidPlan = paidPlans.find((plan) => plan.billingPeriod === billingCycle) ?? paidPlans[0];
  const monthlyPlan = paidPlans.find((plan) => plan.billingPeriod === "monthly");
  const yearlyPlan = paidPlans.find((plan) => plan.billingPeriod === "yearly");
  const monthlyPrice = Number(monthlyPlan?.features?.price_usd ?? 12.99);
  const yearlyPrice = Number(yearlyPlan?.features?.price_usd ?? 74.99);
  const yearlySavingsPct = Math.max(0, Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100));

  const periodEndDisplay = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const usageResetDisplay = entitlement.periodEnd
    ? new Date(`${entitlement.periodEnd}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
      })
    : null;

  const handleUpgradeToPaid = async () => {
    const targetId = selectedPaidPlan?.id ?? (billingCycle === "yearly" ? "gold_yearly" : "gold_monthly");
    await handleUpgrade(targetId);
  };

  if (showUsage) {
    return (
      <WalletScreen
        onBack={() => {
          setShowUsage(false);
          onTitleChange?.("Subscription");
          refetch();
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-5 relative z-10 w-full animate-fade-in pt-4">
      {planStatus === "trialing" && periodEndDisplay && (
        <div className="w-full max-w-md mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          Your Paid trial ends on <span className="font-semibold">{periodEndDisplay}</span>.
        </div>
      )}
      {planStatus === "past_due" && (
        <div className="w-full max-w-md mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          Your last payment failed. Update your payment method to keep unlimited searches.
        </div>
      )}
      {planStatus === "active" && cancelAtPeriodEnd && periodEndDisplay && (
        <div className="w-full max-w-md mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Your Paid plan ends on <span className="font-semibold">{periodEndDisplay}</span>. You will move to Free after that.
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setShowUsage(true);
          onTitleChange?.("Search Usage");
        }}
        className="w-full max-w-md mb-4 rounded-2xl border border-[#DCE7E5] bg-white px-4 py-4 text-left shadow-sm active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#E6F7F2] flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={Search01Icon} size={19} color="#059669" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#2E4A4A]">Search Usage</p>
            <p className="text-xs text-[#7A8E8E] mt-0.5">
              {isPaid
                ? "Unlimited searches are active"
                : `${entitlement.remainingThisMonth ?? 0} of ${entitlement.monthlyLimit ?? 5} searches remaining${usageResetDisplay ? ` until ${usageResetDisplay}` : ""}`}
            </p>
          </div>
          <span className="text-xs font-semibold text-[#059669]">View</span>
        </div>
      </button>

      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E3E6E6] overflow-hidden shadow-sm mb-4">
        <div>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-4 text-left"
            onClick={() => setFreeExpanded((value) => !value)}
          >
            <div className="w-1 self-stretch rounded-full bg-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#2E4A4A]">Free</p>
              <p className="text-xs text-[#9CA3AF]">Five searches per month</p>
            </div>
            {!isPaid && (
              <span className="text-xs font-semibold text-amber-600 border border-amber-200 bg-amber-50 px-2.5 py-0.5 rounded-full">
                Current
              </span>
            )}
            <div className={cn("transition-transform duration-300", freeExpanded && "rotate-180")}>
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
            </div>
          </button>
          <div className={cn("grid transition-all duration-300", freeExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="px-4 pb-4 ml-4">
                <div className="mb-3">
                  <span className="text-2xl font-bold text-[#2E4A4A]">$0</span>
                  <span className="text-xs text-[#9CA3AF] ml-1">/ month</span>
                </div>
                <ul className="space-y-2">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color="#D97706" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                      <span className="text-xs text-[#6B7B7B]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#E3E6E6]" />

        <div className={cn(isPaid && "border-2 border-[#345C5A] rounded-b-2xl -mb-px")}>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-4 text-left"
            onClick={() => setPaidExpanded((value) => !value)}
          >
            <div className="w-1 self-stretch rounded-full bg-[#345C5A] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#2E4A4A]">Paid</p>
              <p className="text-xs text-[#9CA3AF]">Unlimited searches</p>
            </div>
            {isPaid ? (
              <span className="text-xs font-semibold text-[#345C5A] border border-[#345C5A] bg-[#F0F5F5] px-2.5 py-0.5 rounded-full">
                Current
              </span>
            ) : (
              <div className="text-right">
                <p className="text-base font-bold text-[#2E4A4A]">
                  ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}
                </p>
                <p className="text-[10px] text-[#9CA3AF]">/ {billingCycle === "yearly" ? "year" : "month"}</p>
              </div>
            )}
            <div className={cn("transition-transform duration-300", paidExpanded && "rotate-180")}>
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
            </div>
          </button>

          <div className={cn("grid transition-all duration-300", paidExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="px-4 pb-4 ml-4">
                {!isPaid && (
                  <div className="mb-4 bg-[#F4F8F8] rounded-xl p-1 flex relative">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-semibold transition-colors",
                        billingCycle === "monthly" ? "bg-[#345C5A] text-white shadow-sm" : "text-[#7A8E8E]",
                      )}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-semibold transition-colors",
                        billingCycle === "yearly" ? "bg-[#345C5A] text-white shadow-sm" : "text-[#7A8E8E]",
                      )}
                    >
                      Yearly{yearlySavingsPct > 0 ? ` · Save ${yearlySavingsPct}%` : ""}
                    </button>
                  </div>
                )}

                <ul className="space-y-2 mb-4">
                  {PAID_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color="#059669" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                      <span className="text-xs text-[#6B7B7B]">{feature}</span>
                    </li>
                  ))}
                </ul>

                {!isPaid ? (
                  <button
                    type="button"
                    onClick={handleUpgradeToPaid}
                    disabled={checkoutLoading || loading}
                    className="w-full h-11 rounded-xl bg-[#345C5A] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {checkoutLoading ? (
                      <>
                        <HugeiconsIcon icon={Loading03Icon} size={16} color="white" strokeWidth={2} className="animate-spin" />
                        Opening checkout…
                      </>
                    ) : (
                      "Upgrade to Paid"
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="w-full h-11 rounded-xl border border-[#345C5A] text-[#345C5A] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <HugeiconsIcon icon={Settings01Icon} size={16} color="#345C5A" strokeWidth={1.8} />
                    {portalLoading ? "Opening…" : "Manage Billing"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="w-full max-w-md text-center text-[11px] text-[#9CA3AF] px-4 pb-6">
        Search limits apply only when you deliberately run a flight search. Scheduled background collection and the Today's GoWild feed do not consume searches.
      </p>
    </div>
  );
};

export default SubscriptionPage;
