import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
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
}

const SubscriptionPage = ({ onBack, onTitleChange }: SubscriptionPageProps) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [showWallet, setShowWallet] = useState(false);

  const {
    planId,
    planName,
    isGold,
    plans,
    handleUpgrade,
    handleManageBilling,
    checkoutLoading,
    portalLoading,
    loading: billingLoading,
    refetch,
  } = useBilling();

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

  // Determine which plan IDs map to each tier based on billing cycle
  // Plans come from DB — we match by name pattern or billing_period
  const freePlan = plans.find((p) => p.id === "free" || p.name.toLowerCase() === "free");
  const goldPlan = plans.find(
    (p) =>
      p.name.toLowerCase().includes("gold") &&
      (billingCycle === "yearly" ? p.billingPeriod === "yearly" : p.billingPeriod === "monthly")
  ) ?? plans.find((p) => p.name.toLowerCase().includes("gold"));

  // Pricing display
  const goldMonthlyPrice = plans.find(
    (p) => p.name.toLowerCase().includes("gold") && p.billingPeriod === "monthly"
  );
  const goldYearlyPrice = plans.find(
    (p) => p.name.toLowerCase().includes("gold") && p.billingPeriod === "yearly"
  );

  const goldDisplayPrice =
    billingCycle === "yearly"
      ? goldYearlyPrice
        ? `$${goldYearlyPrice.features?.price_usd ?? "400"}`
        : "$400"
      : goldMonthlyPrice
      ? `$${goldMonthlyPrice.features?.price_usd ?? "40"}`
      : "$40";

  const isCurrentlyFree = planId === "free" || planName.toLowerCase() === "free";
  const isCurrentlyGold = isGold || planName.toLowerCase().includes("gold");

  const hasPaidSubscription = isCurrentlyGold;

  const handleUpgradeToGold = async () => {
    // Store current state snapshot for success page comparison
    sessionStorage.setItem("billing_prev_plan", planId);

    const targetPlan = goldPlan;
    if (!targetPlan) {
      // Fallback: use hard-coded plan IDs based on billing cycle
      const fallbackId = billingCycle === "yearly" ? "gold_yearly" : "gold_monthly";
      await handleUpgrade(fallbackId);
      return;
    }
    await handleUpgrade(targetPlan.id);
  };

  return (
    <>
      <div className="flex-1 flex flex-col items-center px-6 relative z-10 w-full animate-fade-in pt-4">
        {/* Billing cycle toggle */}
        <div className="bg-white rounded-xl p-1 flex shadow-sm border border-[#E3E6E6] relative w-full max-w-[200px] mb-5">
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
              "py-1.5 px-2 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 flex-1",
              billingCycle === "monthly" ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "py-1.5 px-2 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 flex-1",
              billingCycle === "yearly" ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]"
            )}
          >
            Yearly
          </button>
        </div>

        {/* Plan cards */}
        <div className="flex justify-center gap-3 w-full max-w-md mb-5">
          {/* Free plan */}
          <div
            className={cn(
              "bg-white rounded-2xl p-3 border-2 flex flex-col items-start w-1/2 relative shadow-sm",
              isCurrentlyFree ? "border-[#345C5A]" : "border-[#E3E6E6]"
            )}
          >
            <div className="absolute top-0 right-0 bg-[#345C5A] text-white text-[10px] uppercase font-bold py-0.5 px-2.5 rounded-bl-xl rounded-tr-xl">
              {isCurrentlyFree ? "Current" : "Free"}
            </div>
            <div className="mb-2 pt-3">
              <span className="text-2xl font-bold text-[#2E4A4A]">$0</span>
              <span className="text-[#6B7B7B] text-xs ml-1">
                {billingCycle === "yearly" ? "/yr" : "/mo"}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#6B7B7B]">
              <li className="flex items-start">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={14}
                  color="#345C5A"
                  strokeWidth={1.5}
                  className="mr-1.5 mt-0.5 shrink-0"
                />
                <span>20 searches / month</span>
              </li>
              <li className="flex items-start">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={14}
                  color="#345C5A"
                  strokeWidth={1.5}
                  className="mr-1.5 mt-0.5 shrink-0"
                />
                <span>Standard routes: 1 credit</span>
              </li>
              <li className="flex items-start">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={14}
                  color="#345C5A"
                  strokeWidth={1.5}
                  className="mr-1.5 mt-0.5 shrink-0"
                />
                <span>All Destinations: 5 credits</span>
              </li>
            </ul>
          </div>

          {/* Gold plan */}
          <div
            className={cn(
              "bg-white rounded-2xl p-3 border-2 flex flex-col items-start w-1/2 relative shadow-sm",
              isCurrentlyGold ? "border-[#FBBF24]" : "border-[#E3E6E6]"
            )}
          >
            <div className="absolute top-0 right-0 bg-[#FBBF24] text-white text-[10px] uppercase font-bold py-0.5 px-2.5 rounded-bl-xl rounded-tr-xl">
              {isCurrentlyGold ? "Current" : "Gold"}
            </div>
            <div className="mb-2 pt-3">
              <span className="text-2xl font-bold text-[#2E4A4A]">{goldDisplayPrice}</span>
              <span className="text-[#6B7B7B] text-xs ml-1">
                {billingCycle === "yearly" ? "/yr" : "/mo"}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#6B7B7B]">
              <li className="flex items-start">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={14}
                  color="#FBBF24"
                  strokeWidth={1.5}
                  className="mr-1.5 mt-0.5 shrink-0"
                />
                <span>Unlimited searches</span>
              </li>
              <li className="flex items-start">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={14}
                  color="#FBBF24"
                  strokeWidth={1.5}
                  className="mr-1.5 mt-0.5 shrink-0"
                />
                <span>All Destinations included</span>
              </li>
              <li className="flex items-start">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={14}
                  color="#FBBF24"
                  strokeWidth={1.5}
                  className="mr-1.5 mt-0.5 shrink-0"
                />
                <span>Priority support</span>
              </li>
            </ul>

            {/* Upgrade CTA */}
            {!isCurrentlyGold && (
              <button
                type="button"
                disabled={checkoutLoading || billingLoading}
                onClick={handleUpgradeToGold}
                className={cn(
                  "mt-3 w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1",
                  checkoutLoading || billingLoading
                    ? "bg-[#E3E6E6] text-[#9CA3AF] cursor-not-allowed"
                    : "bg-[#FBBF24] text-white hover:bg-[#F59E0B] active:scale-95"
                )}
              >
                {checkoutLoading ? (
                  <>
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={12}
                      color="#9CA3AF"
                      strokeWidth={2}
                      className="animate-spin"
                    />
                    Redirecting…
                  </>
                ) : (
                  "Upgrade to Gold"
                )}
              </button>
            )}
          </div>
        </div>

        {/* My Wallet link */}
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

        {/* Manage Billing — only shown when user has a paid subscription */}
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
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={14}
                      color="#9CA3AF"
                      strokeWidth={1.5}
                      className="animate-spin"
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={Settings01Icon}
                      size={14}
                      color="#345C5A"
                      strokeWidth={1.5}
                    />
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
    </>
  );
};

export default SubscriptionPage;
