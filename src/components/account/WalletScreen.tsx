import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCoins, faCreditCard } from "@fortawesome/free-solid-svg-icons";
import { format } from "date-fns";

interface WalletScreenProps {
  onBack: () => void;
}

const WalletScreen = ({ onBack }: WalletScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<{
    monthly_used: number;
    purchased_balance: number;
    monthly_period_start: string;
    monthly_period_end: string;
  } | null>(null);
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

  const remaining = Math.max(0, monthlyAllowance - (wallet?.monthly_used ?? 0));

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;

  return (
    <div className="flex flex-col h-full animate-fade-in">

      <div className="flex-1 px-5 pb-4 space-y-4">
        {/* Plan badge */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4 flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-[#F2F3F3] flex items-center justify-center shrink-0">
            <FontAwesomeIcon icon={faCreditCard} className="w-4 h-4 text-[#345C5A]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#2E4A4A]">Current Plan</p>
            <p className="text-xs text-[#6B7B7B] capitalize">{planName}</p>
          </div>
        </div>

        {/* Credits card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-[#F2F3F3] flex items-center justify-center shrink-0">
              <FontAwesomeIcon icon={faCoins} className="w-4 h-4 text-[#345C5A]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#2E4A4A]">Credits</p>
              <p className="text-xs text-[#6B7B7B]">Monthly allowance resets each billing period</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[#F2F3F3] rounded-xl py-2.5">
              <p className="text-lg font-bold text-[#2E4A4A]">{remaining}</p>
              <p className="text-[10px] text-[#6B7B7B] uppercase font-semibold tracking-wider">Remaining</p>
            </div>
            <div className="bg-[#F2F3F3] rounded-xl py-2.5">
              <p className="text-lg font-bold text-[#2E4A4A]">{wallet?.monthly_used ?? 0}</p>
              <p className="text-[10px] text-[#6B7B7B] uppercase font-semibold tracking-wider">Used</p>
            </div>
            <div className="bg-[#F2F3F3] rounded-xl py-2.5">
              <p className="text-lg font-bold text-[#2E4A4A]">{wallet?.purchased_balance ?? 0}</p>
              <p className="text-[10px] text-[#6B7B7B] uppercase font-semibold tracking-wider">Purchased</p>
            </div>
          </div>

          {wallet && (
            <p className="text-[11px] text-[#849494] text-center">
              Period: {format(new Date(wallet.monthly_period_start), "MMM d")} – {format(new Date(wallet.monthly_period_end), "MMM d, yyyy")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletScreen;
