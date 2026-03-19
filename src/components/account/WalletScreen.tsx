import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Coins01Icon,
  CreditCardIcon,
  Infinity01Icon,
  Loading03Icon,
  PlusSignIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  TimeQuarterPassIcon,
  RefreshIcon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { format } from "date-fns";
import { useBilling } from "@/hooks/useBilling";
import { useTransactionHistory, CreditTransaction } from "@/hooks/useTransactionHistory";
import { cn } from "@/lib/utils";

interface WalletScreenProps {
  onBack: () => void;
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

const GAUGE_SEGS = 15;
const GAUGE_START = 217;
const GAUGE_SWEEP = 252;
const GAP_DEG = 4;
const SEG_DEG = (GAUGE_SWEEP - GAP_DEG * GAUGE_SEGS) / GAUGE_SEGS;

function GaugeMeter({ ratio, size = 220 }: { ratio: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.42;
  const rInner = rOuter * 0.68;
  const filled = Math.round(Math.min(Math.max(ratio, 0), 1) * GAUGE_SEGS);

  const toXY = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as [number, number];
  };

  const arc = (startDeg: number, sweepDeg: number) => {
    const [x1, y1] = toXY(startDeg, rOuter);
    const [x2, y2] = toXY(startDeg + sweepDeg, rOuter);
    const [x3, y3] = toXY(startDeg + sweepDeg, rInner);
    const [x4, y4] = toXY(startDeg, rInner);
    const lg = sweepDeg > 180 ? 1 : 0;
    return `M${x1},${y1} A${rOuter},${rOuter} 0 ${lg} 1 ${x2},${y2} L${x3},${y3} A${rInner},${rInner} 0 ${lg} 0 ${x4},${y4} Z`;
  };

  return (
    <svg
      width={size}
      height={size * 0.65}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible" }}
    >
      {Array.from({ length: GAUGE_SEGS }, (_, i) => {
        const start = GAUGE_START + i * (SEG_DEG + GAP_DEG);
        return (
          <path
            key={i}
            d={arc(start, SEG_DEG)}
            fill={i < filled ? "#FBBF24" : "rgba(255,255,255,0.22)"}
            rx={3}
          />
        );
      })}
    </svg>
  );
}

// ─── Transaction row helpers ──────────────────────────────────────────────────

function txLabel(tx: CreditTransaction): string {
  switch (tx.transaction_type) {
    case "search_debit":
      return "Flight Search";
    case "purchase_credit":
      return "Credits Purchased";
    case "monthly_grant":
      return "Monthly Credits";
    case "adjustment":
      return "Adjustment";
    case "refund":
      return "Refund";
    default:
      // Humanise snake_case fallback
      return tx.transaction_type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function txSubLabel(tx: CreditTransaction): string {
  const bucketLabel = tx.bucket === "purchased" ? "Purchased" : "Monthly";
  return bucketLabel;
}

function TxIcon({ tx }: { tx: CreditTransaction }) {
  const isDebit = tx.amount < 0;
  const isGrant = tx.transaction_type === "monthly_grant";
  const isPurchase = tx.transaction_type === "purchase_credit";

  if (isGrant) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
        <HugeiconsIcon icon={RefreshIcon} size={15} color="#16A34A" strokeWidth={2} />
      </div>
    );
  }
  if (isPurchase) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(251,191,36,0.15)" }}>
        <HugeiconsIcon icon={ShoppingCart01Icon} size={15} color="#D97706" strokeWidth={2} />
      </div>
    );
  }
  if (isDebit) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.10)" }}>
        <HugeiconsIcon icon={ArrowUp01Icon} size={15} color="#DC2626" strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
      <HugeiconsIcon icon={ArrowDown01Icon} size={15} color="#16A34A" strokeWidth={2.5} />
    </div>
  );
}

function TxAmountBadge({ amount }: { amount: number }) {
  const isDebit = amount < 0;
  return (
    <span
      className={cn(
        "text-xs font-bold tabular-nums",
        isDebit ? "text-red-500" : "text-green-600"
      )}
    >
      {isDebit ? "" : "+"}{amount}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const WalletScreen = ({ onBack }: WalletScreenProps) => {
  const {
    loading,
    planName,
    isGold,
    wallet,
    creditPacks,
    handleBuyCredits,
    checkoutLoading,
  } = useBilling();

  const {
    transactions,
    loading: txLoading,
    error: txError,
    hasMore,
    loadMore,
  } = useTransactionHistory();

  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);

  const onBuyCredits = async (packId: string) => {
    sessionStorage.setItem("billing_prev_credits", String(wallet.purchasedBalance));
    setLoadingPackId(packId);
    await handleBuyCredits(packId);
    setLoadingPackId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#6B7B7B]">Loading…</p>
      </div>
    );
  }

  const totalCredits = wallet.totalCredits;
  const totalMax = Math.max(wallet.monthlyAllowance + wallet.purchasedBalance, 1);
  const gaugeRatio = isGold ? 1 : (totalCredits < 0 ? 1 : totalCredits / totalMax);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">

        {/* Credit Gauge Card */}
        <div className="rounded-2xl p-5 text-center" style={{ background: "#2D6A4F" }}>
          <p className="text-white font-bold text-base mb-2">Your Credits</p>

          <div className="relative flex justify-center">
            <GaugeMeter ratio={gaugeRatio} size={220} />
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ paddingBottom: "8%" }}
            >
              <span className="text-[13px] font-semibold text-white/70 mb-0.5">⚡</span>
              {isGold ? (
                <HugeiconsIcon icon={Infinity01Icon} size={40} color="white" strokeWidth={2} />
              ) : (
                <span className="text-4xl font-black text-white leading-none">
                  {totalCredits < 0 ? "∞" : totalCredits}
                </span>
              )}
              <span className="text-[13px] font-semibold text-white/80 mt-1">Credits Left</span>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-1 space-y-2.5 px-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: "#4ADE80" }} />
                <span className="text-white font-semibold text-sm">Monthly</span>
              </div>
              <div className="flex items-center gap-2">
                {isGold ? (
                  <HugeiconsIcon icon={Infinity01Icon} size={16} color="white" strokeWidth={2} />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {wallet.monthlyRemaining}/{wallet.monthlyAllowance}
                  </span>
                )}
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ border: "2px solid rgba(255,255,255,0.7)" }}
                >
                  <span className="text-white text-[10px] font-black leading-none">✓</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: "#FBBF24" }} />
                <span className="text-white font-semibold text-sm">Purchased</span>
              </div>
              <div className="flex items-center gap-2">
                {isGold ? (
                  <HugeiconsIcon icon={Infinity01Icon} size={16} color="white" strokeWidth={2} />
                ) : (
                  <span className="text-white font-bold text-sm">{wallet.purchasedBalance}</span>
                )}
                <span className="text-white/70 font-bold text-sm">×</span>
              </div>
            </div>
          </div>
        </div>

        {/* Plan Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <HugeiconsIcon icon={CreditCardIcon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Current Plan</p>
          </div>
          <p className="text-2xl font-bold text-[#345C5A]">{planName}</p>
          <p className="text-xs text-[#6B7B7B] mt-1">
            {isGold ? "Unlimited credits / month" : `${wallet.monthlyAllowance} credits / month`}
          </p>
        </div>

        {/* Credits Detail */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <HugeiconsIcon icon={Coins01Icon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Credits</p>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-[#6B7B7B]">Monthly remaining</span>
            {isGold ? (
              <HugeiconsIcon icon={Infinity01Icon} size={18} color="#345C5A" strokeWidth={2} />
            ) : (
              <span className="font-bold text-[#345C5A]">{wallet.monthlyRemaining}</span>
            )}
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-[#6B7B7B]">Monthly used</span>
            {isGold ? (
              <HugeiconsIcon icon={Infinity01Icon} size={18} color="#2E4A4A" strokeWidth={2} />
            ) : (
              <span className="font-semibold text-[#2E4A4A]">{wallet.monthlyUsed}</span>
            )}
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-[#6B7B7B]">Purchased balance</span>
            {isGold ? (
              <HugeiconsIcon icon={Infinity01Icon} size={18} color="#2E4A4A" strokeWidth={2} />
            ) : (
              <span className="font-semibold text-[#2E4A4A]">{wallet.purchasedBalance}</span>
            )}
          </div>
          {wallet.periodEnd && (
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7B7B]">Resets on</span>
              <span className="font-semibold text-[#2E4A4A]">
                {format(new Date(wallet.periodEnd), "MMM d, yyyy")}
              </span>
            </div>
          )}
        </div>

        {/* Buy Credit Packs */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <HugeiconsIcon icon={PlusSignIcon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Buy Credits</p>
          </div>

          {creditPacks.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] text-center py-2">
              No credit packs available right now.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {creditPacks.map((pack) => {
                const isThisPack = loadingPackId === pack.id;
                const isAnyLoading = checkoutLoading;

                return (
                  <button
                    key={pack.id}
                    type="button"
                    disabled={isAnyLoading}
                    onClick={() => onBuyCredits(pack.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all",
                      isAnyLoading
                        ? "border-[#E3E6E6] opacity-60 cursor-not-allowed"
                        : "border-[#E3E6E6] hover:border-[#FBBF24] active:scale-95 cursor-pointer"
                    )}
                  >
                    {isThisPack ? (
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={20}
                        color="#9CA3AF"
                        strokeWidth={2}
                        className="animate-spin mb-1"
                      />
                    ) : (
                      <span className="text-xl font-black text-[#2E4A4A] leading-none">
                        {pack.creditsAmount}
                      </span>
                    )}
                    <span className="text-[10px] text-[#6B7B7B] font-medium mt-0.5">credits</span>
                    <span className="text-xs font-bold text-[#FBBF24] mt-1">
                      ${pack.priceUsd.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-[#C4C9CA] text-center mt-3 leading-relaxed">
            Purchased credits never expire and are used after your monthly allowance.
          </p>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <HugeiconsIcon icon={TimeQuarterPassIcon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Transaction History</p>
          </div>

          {txLoading && transactions.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <HugeiconsIcon
                icon={Loading03Icon}
                size={20}
                color="#9CA3AF"
                strokeWidth={2}
                className="animate-spin"
              />
            </div>
          ) : txError ? (
            <p className="text-xs text-red-400 text-center py-4">{txError}</p>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <HugeiconsIcon icon={TimeQuarterPassIcon} size={28} color="#D1D5DB" strokeWidth={1.5} />
              <p className="text-xs text-[#9CA3AF] text-center">
                No transactions yet. Your search history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {transactions.map((tx, idx) => (
                <div
                  key={tx.id}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    idx < transactions.length - 1 && "border-b border-[#F3F4F6]"
                  )}
                >
                  <TxIcon tx={tx} />

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#2E4A4A] leading-tight truncate">
                      {txLabel(tx)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          tx.bucket === "purchased"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-green-50 text-green-700"
                        )}
                      >
                        {txSubLabel(tx)}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        {format(new Date(tx.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <TxAmountBadge amount={tx.amount} />
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5 tabular-nums">
                      → {tx.balance_after}
                    </p>
                  </div>
                </div>
              ))}

              {/* Load more */}
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={txLoading}
                  className="w-full mt-2 py-2 text-xs font-semibold text-[#345C5A] rounded-xl border border-[#E3E6E6] hover:bg-[#F9FAFB] active:scale-95 transition-all disabled:opacity-50"
                >
                  {txLoading ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default WalletScreen;
