import { motion } from "framer-motion";
import { ChevronRight, ArrowRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { format, parseISO } from "date-fns";

interface FlightSearch {
  id: string;
  departure_airport: string;
  arrival_airport: string | null;
  departure_date: string;
  return_date: string | null;
  trip_type: string;
  all_destinations: string;
  search_timestamp: string;
}

function formatTripLabel(search: FlightSearch): string {
  const date = (() => {
    try {
      return format(parseISO(search.departure_date), "MMM d");
    } catch {
      return search.departure_date;
    }
  })();

  const tripLabel: Record<string, string> = {
    "one-way": "One Way",
    "one_way": "One Way",
    "round-trip": "Round Trip",
    "round_trip": "Round Trip",
    "day-trip": "Day Trip",
    "day_trip": "Day Trip",
    "multi-day": "Multi Day",
    "multi_day": "Multi Day",
  };

  const type = tripLabel[search.trip_type] ?? search.trip_type;
  return `${date} • ${type}`;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface Props {
  searches: FlightSearch[];
  loading: boolean;
  onNavigate?: (page: string) => void;
}

export function RecentSearches({ searches, loading, onNavigate }: Props) {
  if (!loading && searches.length === 0) return null;

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-[13px] font-black text-[#07444a] uppercase tracking-widest flex items-center gap-2">
          <HugeiconsIcon icon={Search01Icon} className="w-4 h-4 text-[#07444a]" strokeWidth={2} />
          Recent Searches
        </h2>
        <button
          type="button"
          onClick={() => onNavigate?.("flights")}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-[#059669] hover:opacity-75 transition-opacity"
        >
          See More
          <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3">
        {loading
          ? [1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#e3e6e6] bg-white px-4 py-4 animate-pulse"
              >
                <div className="h-6 w-28 rounded bg-[#e5e7eb] mb-2" />
                <div className="h-3 w-20 rounded bg-[#e5e7eb]" />
              </div>
            ))
          : searches.map((s, i) => (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => onNavigate?.("flights")}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, delay: i * 0.07, ease: EASE } }}
                className="text-left rounded-2xl px-4 py-4 active:scale-[0.97] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(5,150,105,0.15)",
                  boxShadow: "0 4px 20px 0 rgba(5,150,105,0.10), 0 1.5px 5px 0 rgba(5,150,105,0.07)",
                }}
              >
                {/* Route */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xl font-extrabold text-[#1a2e2e] leading-none tracking-tight">
                    {s.departure_airport}
                  </span>
                  <ArrowRight size={14} strokeWidth={2.5} className="text-[#059669] flex-shrink-0" />
                  <span className="text-xl font-extrabold text-[#1a2e2e] leading-none tracking-tight">
                    {s.all_destinations === "Yes" ? "ALL" : (s.arrival_airport ?? "—")}
                  </span>
                </div>

                {/* Meta */}
                <p className="text-[11px] font-medium text-[#6B7B7B] leading-tight">
                  {formatTripLabel(s)}
                </p>
              </motion.button>
            ))}
      </div>
    </section>
  );
}
