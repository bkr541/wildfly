import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown, ArrowRight } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Search01Icon,
  EarthIcon,
  ArrowRight04Icon,
  CircleArrowReload01Icon,
  SunCloud01Icon,
  MapPinpoint01Icon,
  Calendar03Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
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
  gowild_found: boolean | null;
}

const TRIP_LABELS: Record<string, string> = {
  "one-way": "One Way",
  one_way: "One Way",
  "round-trip": "Round Trip",
  round_trip: "Round Trip",
  "day-trip": "Day Trip",
  day_trip: "Day Trip",
  "multi-day": "Multi Day",
  multi_day: "Multi Day",
};

const TRIP_ICONS: Record<string, IconSvgElement> = {
  "one-way": ArrowRight04Icon,
  one_way: ArrowRight04Icon,
  "round-trip": CircleArrowReload01Icon,
  round_trip: CircleArrowReload01Icon,
  "day-trip": SunCloud01Icon,
  day_trip: SunCloud01Icon,
  "multi-day": MapPinpoint01Icon,
  multi_day: MapPinpoint01Icon,
};

/** Extract display code from airport or city string */
function displayCode(code: string | null): string | null {
  if (!code) return null;
  const cityMatch = code.match(/^CITY:(.+)$/i);
  if (cityMatch) {
    const city = cityMatch[1].trim();
    const words = city.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    return city.slice(0, 3).toUpperCase();
  }
  return code;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

const HEADER_GREEN = "#2D6A4F";
const CARD_SHADOW =
  "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)";

interface Props {
  searches: FlightSearch[];
  loading: boolean;
  onNavigate?: (page: string) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function RecentSearches({ searches, loading, onNavigate, isCollapsed = false, onToggle }: Props) {

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Header */}
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between mb-3 px-1 group">
        <h2 className="text-[15px] font-black text-[#6B7280] uppercase tracking-widest flex items-center gap-2">
          <HugeiconsIcon icon={Search01Icon} className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
          Recent Searches
        </h2>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.("flights");
              }}
              className="flex items-center gap-0.5 text-[11px] font-semibold text-[#059669] hover:opacity-75 transition-opacity"
            >
              See More
              <ChevronRight size={13} strokeWidth={2.5} />
            </span>
          )}
          <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
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
            style={{ overflow: "visible" }}
          >
            <div style={{ padding: "8px 6px 10px" }}>
              {!loading && searches.length === 0 ? (
                <div
                  className="rounded-2xl px-4 py-5 flex items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    boxShadow: CARD_SHADOW,
                  }}
                >
                  <HugeiconsIcon icon={Search01Icon} size={20} color="#9AADAD" strokeWidth={1.5} />
                  <p className="text-sm text-[#9AADAD] font-medium">No recent searches yet</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
                  {loading
                    ? [1, 2].map((i) => (
                        <div
                          key={i}
                          className="rounded-2xl overflow-hidden flex-shrink-0 w-[220px]"
                          style={{
                            background: "rgba(255,255,255,0.95)",
                            border: "1px solid rgba(255,255,255,0.65)",
                            boxShadow: CARD_SHADOW,
                          }}
                        >
                          {/* Header skeleton */}
                          <div className="h-9 animate-pulse" style={{ background: HEADER_GREEN, opacity: 0.35 }} />
                          {/* Body skeleton */}
                          <div className="px-4 pt-5 pb-4">
                            <div className="h-8 w-32 rounded-lg bg-[#e5e7eb] mb-3 mx-auto" />
                            <div className="flex gap-2">
                              <div className="h-7 w-20 rounded-full bg-[#e5e7eb]" />
                              <div className="h-7 w-16 rounded-full bg-[#e5e7eb]" />
                            </div>
                          </div>
                        </div>
                      ))
                    : searches.map((s, i) => {
                        const isAllDest = s.all_destinations === "Yes";
                        const depCode = displayCode(s.departure_airport) ?? s.departure_airport;
                        const arrCode = isAllDest ? null : displayCode(s.arrival_airport);
                        const tripLabel = TRIP_LABELS[s.trip_type] ?? s.trip_type;
                        const tripIcon: IconSvgElement = TRIP_ICONS[s.trip_type] ?? ArrowRight04Icon;

                        let formattedDate = s.departure_date;
                        try {
                          formattedDate = format(parseISO(s.departure_date), "MMMM d, yyyy");
                        } catch {
                          // keep raw string
                        }

                        return (
                          <motion.button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              const payload = JSON.stringify({
                                recentSearch: true,
                                origin: s.departure_airport,
                                destination: s.arrival_airport,
                                tripType: s.trip_type,
                                departureDate: s.departure_date,
                                returnDate: s.return_date,
                                allDestinations: s.all_destinations === "Yes",
                              });
                              onNavigate?.("flights", payload);
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: { duration: 0.28, delay: i * 0.07, ease: EASE },
                            }}
                            className="text-left rounded-2xl overflow-hidden active:scale-[0.97] transition-transform flex-shrink-0 w-[185px]"
                            style={{
                              scrollSnapAlign: "start",
                              background: "rgba(255,255,255,0.95)",
                              border: "1px solid rgba(255,255,255,0.65)",
                              boxShadow: CARD_SHADOW,
                            }}
                          >
                            {/* Green date header */}
                            <div
                              className="relative flex items-center justify-center gap-1.5 px-4 py-2"
                              style={{ background: HEADER_GREEN }}
                            >
                              <HugeiconsIcon icon={Calendar03Icon} size={14} color="white" strokeWidth={2} />
                              <span className="text-white font-bold text-[13px] leading-none">{formattedDate}</span>
                              {/* Triangle notch */}
                              <div
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(100%-1px)]"
                                style={{
                                  width: 0,
                                  height: 0,
                                  borderLeft: "9px solid transparent",
                                  borderRight: "9px solid transparent",
                                  borderTop: `9px solid ${HEADER_GREEN}`,
                                }}
                              />
                            </div>

                            {/* Card body */}
                            <div className="px-4 pt-3 pb-3">
                              {/* Route row */}
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="text-[30px] font-bold text-[#1A2E2E] leading-none tracking-tight">
                                  {depCode}
                                </span>
                                <ArrowRight size={18} strokeWidth={2.5} className="text-[#059669] flex-shrink-0" />
                                {isAllDest ? (
                                  <HugeiconsIcon icon={EarthIcon} size={30} color="#1A2E2E" strokeWidth={2} />
                                ) : (
                                  <span className="text-[30px] font-bold text-[#1A2E2E] leading-none tracking-tight">
                                    {arrCode ?? "—"}
                                  </span>
                                )}
                              </div>

                              {/* Badges row */}
                              <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                                {s.gowild_found && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
                                    style={{ background: "#059669", color: "#FFFFFF" }}
                                  >
                                    <HugeiconsIcon icon={Rocket01Icon} size={11} color="white" strokeWidth={2} />
                                    GoWild
                                  </span>
                                )}
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 text-[11px] font-bold whitespace-nowrap"
                                  style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8", paddingTop: "2.5px", paddingBottom: "2.5px" }}
                                >
                                  <HugeiconsIcon icon={tripIcon} size={11} color="#1D4ED8" strokeWidth={2} />
                                  {tripLabel}
                                </span>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
