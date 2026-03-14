import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown, ArrowRight, CalendarDays } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, EarthIcon } from "@hugeicons/core-free-icons";
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

function formatDateRange(search: FlightSearch): string {
  try {
    const dep = format(parseISO(search.departure_date), "MMM d");
    if (search.return_date) {
      const ret = format(parseISO(search.return_date), "d");
      return `${dep} – ${ret}`;
    }
    return dep;
  } catch {
    return search.departure_date;
  }
}

const TRIP_LABELS: Record<string, string> = {
  "one-way": "One Way",
  "one_way": "One Way",
  "round-trip": "Round Trip",
  "round_trip": "Round Trip",
  "day-trip": "Day Trip",
  "day_trip": "Day Trip",
  "multi-day": "Multi Day",
  "multi_day": "Multi Day",
};

/** Extract display code from airport or city string */
function displayCode(code: string | null): string | null {
  if (!code) return null;
  // CITY:CHICAGO → CHI, CITY:LOS ANGELES → LOS
  const cityMatch = code.match(/^CITY:(.+)$/i);
  if (cityMatch) {
    return cityMatch[1].trim().slice(0, 3).toUpperCase();
  }
  return code;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface Props {
  searches: FlightSearch[];
  loading: boolean;
  onNavigate?: (page: string) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function RecentSearches({ searches, loading, onNavigate, isCollapsed = false, onToggle }: Props) {
  if (!loading && searches.length === 0) return null;

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-3 px-1 group"
      >
        <h2 className="text-[15px] font-black text-[#6B7280] uppercase tracking-widest flex items-center gap-2">
          <HugeiconsIcon icon={Search01Icon} className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
          Recent Searches
        </h2>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <span
              onClick={(e) => { e.stopPropagation(); onNavigate?.("flights"); }}
              className="flex items-center gap-0.5 text-[11px] font-semibold text-[#059669] hover:opacity-75 transition-opacity"
            >
              See More
              <ChevronRight size={13} strokeWidth={2.5} />
            </span>
          )}
          <motion.div
            animate={{ rotate: isCollapsed ? -90 : 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
          </motion.div>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="recent-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div className="grid grid-cols-2 gap-3">
              {loading
                ? [1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl px-4 py-4 animate-pulse"
                    style={{
                      background: "rgba(255,255,255,0.82)",
                      backdropFilter: "blur(18px)",
                      WebkitBackdropFilter: "blur(18px)",
                      border: "1px solid rgba(255,255,255,0.65)",
                      boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="h-8 w-32 rounded-lg bg-[#e5e7eb] mb-3" />
                    <div className="h-3 w-24 rounded bg-[#e5e7eb] mb-2" />
                    <div className="h-5 w-16 rounded-full bg-[#e5e7eb]" />
                  </div>
                ))
                : searches.map((s, i) => {
                  const isAllDest = s.all_destinations === "Yes";
                  const depCode = displayCode(s.departure_airport) ?? s.departure_airport;
                  const arrCode = isAllDest ? null : displayCode(s.arrival_airport);
                  const tripLabel = TRIP_LABELS[s.trip_type] ?? s.trip_type;
                  const dateRange = formatDateRange(s);

                  return (
                    <motion.button
                      key={s.id}
                      type="button"
                      onClick={() => onNavigate?.("flights")}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.28, delay: i * 0.07, ease: EASE },
                      }}
                      className="text-left rounded-2xl px-3 py-3 active:scale-[0.97] transition-transform"
                      style={{
                        background: "rgba(255,255,255,0.82)",
                        backdropFilter: "blur(18px)",
                        WebkitBackdropFilter: "blur(18px)",
                        border: "1px solid rgba(255,255,255,0.65)",
                        boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
                      }}
                    >
                      {/* Airport codes row */}
                      <div className="flex items-center gap-0.5 mb-2">
                        <span className="text-[20px] font-black text-[#1a2e2e] leading-none tracking-tight">
                          {depCode}
                        </span>
                        <ArrowRight size={13} strokeWidth={2.5} className="text-[#059669] flex-shrink-0 mx-0.5" />
                        {isAllDest ? (
                          <HugeiconsIcon
                            icon={EarthIcon}
                            className="w-5 h-5 text-[#1a2e2e]"
                            strokeWidth={2.5}
                          />
                        ) : (
                          <span className="text-[20px] font-black text-[#1a2e2e] leading-none tracking-tight">
                            {arrCode ?? "—"}
                          </span>
                        )}
                      </div>

                      {/* Date + trip type on same row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: "rgba(107,114,128,0.1)" }}>
                          <CalendarDays size={10} strokeWidth={2} className="text-[#6B7280] flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-[#6B7280] leading-none whitespace-nowrap">
                            {dateRange}
                          </span>
                        </div>
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: "rgba(16,185,129,0.13)",
                            color: "#059669",
                          }}
                        >
                          {tripLabel}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
