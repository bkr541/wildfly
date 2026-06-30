import { useEffect, useState } from "react";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Search01Icon,
  Calendar03Icon,
  Infinity01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { useBilling } from "@/hooks/useBilling";
import { Progress } from "@/components/ui/progress";

interface WalletScreenProps {
  onBack: () => void;
}

interface SearchUsageEvent {
  id: string;
  search_source: string;
  status: "authorized" | "denied" | "refunded";
  counted_against_limit: boolean;
  created_at: string;
}

const sourceLabel = (source: string) => {
  if (source === "cache_hit") return "Cached flight search";
  if (source === "flight_proxy") return "Live flight search";
  if (source === "legacy_client") return "Flight search";
  return "Flight search";
};

const WalletScreen = ({ onBack }: WalletScreenProps) => {
  const { entitlement, isPaid, loading, refetch } = useBilling();
  const [events, setEvents] = useState<SearchUsageEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setEventsLoading(true);
      const { data } = await (supabase.from("search_usage_events") as any)
        .select("id, search_source, status, counted_against_limit, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) {
        setEvents((data ?? []) as SearchUsageEvent[]);
        setEventsLoading(false);
      }
    };
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const limit = entitlement.monthlyLimit ?? 5;
  const used = entitlement.usedThisMonth;
  const percent = isPaid ? 100 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const resetDate = entitlement.periodEnd
    ? format(new Date(`${entitlement.periodEnd}T00:00:00Z`), "MMMM d, yyyy")
    : null;

  return (
    <div className="flex-1 w-full px-5 pt-4 pb-8 animate-fade-in">
      <button
        type="button"
        onClick={() => {
          refetch();
          onBack();
        }}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#345C5A]"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={15} color="#345C5A" strokeWidth={2} />
        Back to Subscription
      </button>

      <div className="rounded-2xl bg-white border border-[#E3E6E6] shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#059669]">Current plan</p>
            <h2 className="text-xl font-bold text-[#2E4A4A] mt-1">{isPaid ? "Paid" : "Free"}</h2>
          </div>
          <div className="h-11 w-11 rounded-full bg-[#E6F7F2] flex items-center justify-center">
            <HugeiconsIcon
              icon={isPaid ? Infinity01Icon : Search01Icon}
              size={21}
              color="#059669"
              strokeWidth={1.8}
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <p className="text-sm font-semibold text-[#2E4A4A]">Monthly searches</p>
              <p className="text-xs text-[#7A8E8E] mt-0.5">
                {isPaid
                  ? "Unlimited searches are active"
                  : `${entitlement.remainingThisMonth ?? 0} searches remaining`}
              </p>
            </div>
            <p className="text-lg font-bold text-[#2E4A4A] tabular-nums">
              {isPaid ? "∞" : `${used} / ${limit}`}
            </p>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        {resetDate && !isPaid && (
          <div className="mt-4 pt-4 border-t border-[#EEF1F1] flex items-center gap-2 text-xs text-[#6B7B7B]">
            <HugeiconsIcon icon={Calendar03Icon} size={14} color="#6B7B7B" strokeWidth={1.7} />
            Resets at the start of {resetDate} UTC
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-[#F0F8F6] border border-[#D7EBE6] px-4 py-3 mb-4">
        <div className="flex items-start gap-2.5">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={17} color="#059669" strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed text-[#456866]">
            Every deliberate route, All Destinations, round-trip, or day-trip search counts as one search. Scheduled jobs and Today's GoWild do not count against this allowance.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#E3E6E6] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#EEF1F1]">
          <h3 className="text-sm font-bold text-[#2E4A4A]">Recent search activity</h3>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Authorization history for your account</p>
        </div>

        {loading || eventsLoading ? (
          <div className="px-4 py-8 text-center text-xs text-[#9CA3AF]">Loading activity…</div>
        ) : events.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-semibold text-[#2E4A4A]">No searches yet</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Your next flight search will appear here.</p>
          </div>
        ) : (
          <div>
            {events.map((event, index) => {
              const counted = event.status === "authorized" && event.counted_against_limit;
              const statusLabel = event.status === "denied"
                ? "Limit reached"
                : event.status === "refunded"
                  ? "Returned"
                  : counted
                    ? "1 search used"
                    : "Unlimited";
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 px-4 py-3 ${index < events.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
                >
                  <div className="h-8 w-8 rounded-full bg-[#F1F7F6] flex items-center justify-center shrink-0">
                    <HugeiconsIcon icon={Search01Icon} size={14} color="#345C5A" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#2E4A4A] truncate">{sourceLabel(event.search_source)}</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                      {format(new Date(event.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                    event.status === "denied"
                      ? "bg-red-50 text-red-600"
                      : event.status === "refunded"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700"
                  }`}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletScreen;
