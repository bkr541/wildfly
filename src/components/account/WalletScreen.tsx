import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Coins01Icon, CreditCardIcon } from "@hugeicons/core-free-icons";
import { format } from "date-fns";

interface WalletScreenProps {
  onBack: () => void;
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

  const monthlyRemaining = Math.max(0, monthlyAllowance - (wallet?.monthly_used ?? 0));

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">
        {/* Plan Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <HugeiconsIcon icon={CreditCardIcon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Current Plan</p>
          </div>
          <p className="text-2xl font-bold text-[#345C5A]">{planName}</p>
          <p className="text-xs text-[#6B7B7B] mt-1">{monthlyAllowance} credits / month</p>
        </div>

        {/* Credits */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <HugeiconsIcon icon={Coins01Icon} size={14} color="#345C5A" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#2E4A4A]">Credits</p>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7B7B]">Monthly remaining</span>
            <span className="font-bold text-[#345C5A]">{monthlyRemaining}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7B7B]">Monthly used</span>
            <span className="font-semibold text-[#2E4A4A]">{wallet?.monthly_used ?? 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7B7B]">Purchased balance</span>
            <span className="font-semibold text-[#2E4A4A]">{wallet?.purchased_balance ?? 0}</span>
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
