import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Coins01Icon,
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

// ─── Transaction row helpers ──────────────────────────────────────────────────

function txLabel(tx: CreditTransaction): string {
  switch (tx.transaction_type) {
    case "search_debit":    return "Flight Search";
    case "purchase_credit": return "Credits Purchased";
    case "monthly_grant":   return "Monthly Credits";
    case "adjustment":      return "Adjustment";
    case "refund":          return "Refund";
    default:
      return tx.transaction_type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function txSubLabel(tx: CreditTransaction): string {
  return tx.bucket === "purchased" ? "Purchased" : "Monthly";
}

function TxIcon({ tx }: { tx: CreditTransaction }) {
  const isDebit    = tx.amount < 0;
  const isGrant    = tx.transaction_type === "monthly_grant";
  const isPurchase = tx.transaction_type === "purchase_credit";

  if (isGrant) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
      <HugeiconsIcon icon={RefreshIcon} size={15} color="#16A34A" strokeWidth={2} />
    </div>
  );
  if (isPurchase) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(251,191,36,0.15)" }}>
      <HugeiconsIcon icon={ShoppingCart01Icon} size={15} color="#D97706" strokeWidth={2} />
    </div>
  );
  if (isDebit) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.10)" }}>
      <HugeiconsIcon icon={ArrowUp01Icon} size={15} color="#DC2626" strokeWidth={2.5} />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
      <HugeiconsIcon icon={ArrowDown01Icon} size={15} color="#16A34A" strokeWidth={2.5} />
    </div>
  );
}

function TxAmountBadge({ amount }: { amount: number }) {
  const isDebit = amount < 0;
  return (
    <span className={cn("text-xs font-bold tabular-nums", isDebit ? "text-red-500" : "text-green-600")}>
      {isDebit ? "" : "+"}{amount}
    </span>
  );
}

// ─── Decorative sparkline ─────────────────────────────────────────────────────

function Sparkline() {
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" fill="none">
      <path
        d="M0 16 C6 16 10 8 16 10 C22 12 26 18 32 15 C38 12 42 7 48 10 C54 13 58 10 64 9"
        stroke="#34D399"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Wallet illustration ──────────────────────────────────────────────────────

function WalletIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      {/* Sparkles */}
      <path d="M12 10 L13.2 6 L14.4 10 L18 11 L14.4 12 L13.2 16 L12 12 L8 11 Z" fill="#4ADE80" opacity="0.7" />
      <path d="M56 8 L57 5 L58 8 L61 9 L58 10 L57 13 L56 10 L53 9 Z" fill="#4ADE80" opacity="0.5" />
      {/* Wallet body */}
      <rect x="10" y="22" width="46" height="34" rx="8" fill="#2D6A4F" />
      {/* Wallet top flap */}
      <rect x="10" y="22" width="46" height="14" rx="8" fill="#245C43" />
      <rect x="10" y="29" width="46" height="7" fill="#245C43" />
      {/* Coin */}
      <circle cx="55" cy="52" r="14" fill="#FBBF24" />
      <circle cx="55" cy="52" r="11" fill="#F59E0B" />
      {/* Lightning bolt on coin */}
      <path d="M57 45 L53 52 L56 52 L54 59 L58 51 L55 51 Z" fill="#FEF3C7" />
    </svg>
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
  const isUnlimited = isGold || wallet.isUnlimited;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">

        {/* ── Hero: Credits Left ── */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundImage: "url('/assets/mywallet/mywalletbackground.png')", backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="px-5 pt-5 pb-2 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#4B8A6A]">Credits Left</p>
              {isUnlimited ? (
                <HugeiconsIcon icon={Infinity01Icon} size={52} color="#1C3C30" strokeWidth={2.5} className="mt-0.5" />
              ) : (
                <p className="text-5xl font-black text-[#1C3C30] leading-tight tracking-tight mt-0.5">
                  {totalCredits.toLocaleString()}
                </p>
              )}
              <p className="text-sm text-[#6BA88A] mt-1">Your total available credits</p>
            </div>
            <WalletIllustration />
          </div>

          {/* Monthly / Purchased breakdown */}
          <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm">
            <div className="flex items-center px-4 py-3 gap-3">
              {/* Monthly */}
              <div className="flex-1">
                <p className="text-xs text-[#9CA3AF] mb-0.5">Monthly</p>
                {isGold ? (
                  <HugeiconsIcon icon={Infinity01Icon} size={22} color="#2E4A4A" strokeWidth={2} />
                ) : (
                  <p className="text-xl font-bold text-[#2E4A4A] leading-none">
                    {wallet.monthlyRemaining} / {wallet.monthlyAllowance}
                  </p>
                )}
                <p className="text-xs text-[#9CA3AF] mt-0.5">credits</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M10.5 2 L6 10 H9.5 L7.5 16 L13 8 H9.5 Z" fill="#16A34A" />
                </svg>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-gray-100 shrink-0" />

              {/* Purchased */}
              <div className="flex-1 pl-3">
                <p className="text-xs text-[#9CA3AF] mb-0.5">Purchased</p>
                {isGold ? (
                  <HugeiconsIcon icon={Infinity01Icon} size={22} color="#2E4A4A" strokeWidth={2} />
                ) : (
                  <p className="text-xl font-bold text-[#2E4A4A] leading-none">
                    {wallet.purchasedBalance.toLocaleString()}
                  </p>
                )}
                <p className="text-xs text-[#9CA3AF] mt-0.5">credits</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 1 L10.8 6.4 H16.5 L11.9 9.6 L13.7 15 L9 11.8 L4.3 15 L6.1 9.6 L1.5 6.4 H7.2 Z" fill="#16A34A" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Current Plan ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 14 L4 7 L8 11 L10 4 L12 11 L16 7 L18 14 Z" fill="#FBBF24" />
                <rect x="2" y="15" width="16" height="2.5" rx="1.25" fill="#FBBF24" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#9CA3AF] leading-none">Current Plan</p>
              <p className="text-xl font-bold text-[#2E4A4A] leading-tight">{planName}</p>
            </div>
            <div className="bg-gray-100 rounded-full px-3 py-1.5 shrink-0">
              <p className="text-xs font-semibold text-[#6B7B7B]">
                {isUnlimited ? "Unlimited" : `${wallet.monthlyAllowance} credits / month`}
              </p>
            </div>
          </div>
        </div>

        {/* ── Credits Summary ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-bold text-[#2E4A4A]">Credits Summary</p>
            <Sparkline />
          </div>
          <div className="space-y-0">
            <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
              <span className="text-sm text-[#9CA3AF]">Monthly remaining</span>
              {isUnlimited ? (
                <HugeiconsIcon icon={Infinity01Icon} size={16} color="#345C5A" strokeWidth={2} />
              ) : (
                <span className="text-sm font-semibold text-[#2E4A4A]">{wallet.monthlyRemaining}</span>
              )}
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
              <span className="text-sm text-[#9CA3AF]">Monthly used</span>
              {isUnlimited ? (
                <HugeiconsIcon icon={Infinity01Icon} size={16} color="#2E4A4A" strokeWidth={2} />
              ) : (
                <span className="text-sm font-semibold text-[#2E4A4A]">{wallet.monthlyUsed}</span>
              )}
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
              <span className="text-sm text-[#9CA3AF]">Purchased balance</span>
              {isUnlimited ? (
                <HugeiconsIcon icon={Infinity01Icon} size={16} color="#2E4A4A" strokeWidth={2} />
              ) : (
                <span className="text-sm font-semibold text-[#2E4A4A]">{wallet.purchasedBalance.toLocaleString()}</span>
              )}
            </div>
            {wallet.periodEnd && (
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-[#9CA3AF]">Resets on</span>
                <span className="text-sm font-semibold text-[#059669]">
                  {format(new Date(wallet.periodEnd), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Buy Credit Packs ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <HugeiconsIcon icon={PlusSignIcon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Buy Credits</p>
          </div>

          {creditPacks.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] text-center py-2">No credit packs available right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {creditPacks.map((pack) => {
                const isThisPack = loadingPackId === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    disabled={checkoutLoading}
                    onClick={() => onBuyCredits(pack.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all",
                      checkoutLoading
                        ? "border-[#E3E6E6] opacity-60 cursor-not-allowed"
                        : "border-[#E3E6E6] hover:border-[#FBBF24] active:scale-95 cursor-pointer"
                    )}
                  >
                    {isThisPack ? (
                      <HugeiconsIcon icon={Loading03Icon} size={20} color="#9CA3AF" strokeWidth={2} className="animate-spin mb-1" />
                    ) : (
                      <span className="text-xl font-black text-[#2E4A4A] leading-none">{pack.creditsAmount}</span>
                    )}
                    <span className="text-[10px] text-[#6B7B7B] font-medium mt-0.5">credits</span>
                    <span className="text-xs font-bold text-[#FBBF24] mt-1">${pack.priceUsd.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-[#C4C9CA] text-center mt-3 leading-relaxed">
            Purchased credits never expire and are used after your monthly allowance.
          </p>
        </div>

        {/* ── Transaction History ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <HugeiconsIcon icon={TimeQuarterPassIcon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Transaction History</p>
          </div>

          {txLoading && transactions.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <HugeiconsIcon icon={Loading03Icon} size={20} color="#9CA3AF" strokeWidth={2} className="animate-spin" />
            </div>
          ) : txError ? (
            <p className="text-xs text-red-400 text-center py-4">{txError}</p>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <HugeiconsIcon icon={TimeQuarterPassIcon} size={28} color="#D1D5DB" strokeWidth={1.5} />
              <p className="text-xs text-[#9CA3AF] text-center">No transactions yet. Your search history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {transactions.map((tx, idx) => (
                <div
                  key={tx.id}
                  className={cn("flex items-center gap-3 py-2.5", idx < transactions.length - 1 && "border-b border-[#F3F4F6]")}
                >
                  <TxIcon tx={tx} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#2E4A4A] leading-tight truncate">{txLabel(tx)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        tx.bucket === "purchased" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-700"
                      )}>
                        {txSubLabel(tx)}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">{format(new Date(tx.created_at), "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <TxAmountBadge amount={tx.amount} />
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5 tabular-nums">→ {tx.balance_after}</p>
                  </div>
                </div>
              ))}

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
