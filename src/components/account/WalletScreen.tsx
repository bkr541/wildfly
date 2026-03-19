import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Coins01Icon, CreditCardIcon, Infinity01Icon } from "@hugeicons/core-free-icons";
import { format } from "date-fns";

interface WalletScreenProps {
  onBack: () => void;
}

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

const WalletScreen = ({ onBack }: WalletScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<{ monthly_used: number; purchased_balance: number; monthly_period_start: string; monthly_period_end: string } | null>(null);
  const [planName, setPlanName] = useState("Free");
  const [monthlyAllowance, setMonthlyAllowance] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: w } = await supabase
        .from("user_credit_wallet")
        .select("monthly_used, purchased_balance, monthly_period_start, monthly_period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      if (w) setWallet(w);

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("plan_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (sub?.plan_id) {
        const { data: plan } = await supabase
          .from("plans")
          .select("name, monthly_allowance_credits")
          .eq("id", sub.plan_id)
          .maybeSingle();
        if (plan) {
          setPlanName(plan.name);
          setMonthlyAllowance(plan.monthly_allowance_credits ?? 0);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;

  const isGold = planName.toLowerCase() === "gold";
  const monthlyRemaining = Math.max(0, monthlyAllowance - (wallet?.monthly_used ?? 0));
  const purchasedBalance = wallet?.purchased_balance ?? 0;
  const totalCredits = monthlyRemaining + purchasedBalance;
  const totalMax = Math.max(monthlyAllowance + purchasedBalance, 1);
  const gaugeRatio = isGold ? 1 : totalCredits / totalMax;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">

        {/* Credit Gauge Card */}
        <div className="rounded-2xl p-5 text-center" style={{ background: "#2D6A4F" }}>
          <p className="text-white font-bold text-base mb-2">Your Credits</p>

          <div className="relative flex justify-center">
            <GaugeMeter ratio={gaugeRatio} size={220} />
            {/* Center overlay */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ paddingBottom: "8%" }}
            >
              <span className="text-[13px] font-semibold text-white/70 mb-0.5">⚡</span>
              {isGold ? (
                <HugeiconsIcon icon={Infinity01Icon} size={40} color="white" strokeWidth={2} />
              ) : (
                <span className="text-4xl font-black text-white leading-none">{totalCredits}</span>
              )}
              <span className="text-[13px] font-semibold text-white/80 mt-1">Credits Left</span>
            </div>
          </div>

          {/* Legend rows */}
          <div className="mt-1 space-y-2.5 px-1">
            {/* Monthly */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: "#4ADE80" }} />
                <span className="text-white font-semibold text-sm">Monthly</span>
              </div>
              <div className="flex items-center gap-2">
                {isGold ? (
                  <HugeiconsIcon icon={Infinity01Icon} size={16} color="white" strokeWidth={2} />
                ) : (
                  <span className="text-white font-bold text-sm">{monthlyRemaining}/{monthlyAllowance}</span>
                )}
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ border: "2px solid rgba(255,255,255,0.7)" }}
                >
                  <span className="text-white text-[10px] font-black leading-none">✓</span>
                </div>
              </div>
            </div>

            {/* Purchased */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: "#FBBF24" }} />
                <span className="text-white font-semibold text-sm">Purchased</span>
              </div>
              <div className="flex items-center gap-2">
                {isGold ? (
                  <HugeiconsIcon icon={Infinity01Icon} size={16} color="white" strokeWidth={2} />
                ) : (
                  <span className="text-white font-bold text-sm">{purchasedBalance}</span>
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
            {isGold ? "Unlimited credits / month" : `${monthlyAllowance} credits / month`}
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
            {isGold ? <HugeiconsIcon icon={Infinity01Icon} size={18} color="#345C5A" strokeWidth={2} /> : <span className="font-bold text-[#345C5A]">{monthlyRemaining}</span>}
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-[#6B7B7B]">Monthly used</span>
            {isGold ? <HugeiconsIcon icon={Infinity01Icon} size={18} color="#2E4A4A" strokeWidth={2} /> : <span className="font-semibold text-[#2E4A4A]">{wallet?.monthly_used ?? 0}</span>}
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-[#6B7B7B]">Purchased balance</span>
            {isGold ? <HugeiconsIcon icon={Infinity01Icon} size={18} color="#2E4A4A" strokeWidth={2} /> : <span className="font-semibold text-[#2E4A4A]">{purchasedBalance}</span>}
          </div>
          {wallet?.monthly_period_end && (
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7B7B]">Resets on</span>
              <span className="font-semibold text-[#2E4A4A]">
                {format(new Date(wallet.monthly_period_end), "MMM d, yyyy")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletScreen;
