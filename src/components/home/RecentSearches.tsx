import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import allDestIcon from "@/assets/all-destinations-icon.svg";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Search01Icon,
  ArrowRight04Icon,
  CircleArrowReload01Icon,
  SunCloud01Icon,
  MapPinpoint01Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { TicketDivider } from "./TicketDivider";

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

function displayCode(code: string | null): string | null {
  if (!code) return null;
  const cityMatch = code.match(/^CITY:(.+)$/i);
  if (cityMatch) {
    const city = cityMatch[1].trim();
    const words = city.split(/\s+/).filter(Boolean);
    if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    return city.slice(0, 3).toUpperCase();
  }
  return code;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const CARD_STYLE = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: CARD_SHADOW,
};

const PlaneSVG = ({ size = 22 }: { size?: number }) => (
  <svg
    fill="#2D6A4F"
    style={{ width: size, height: size, flexShrink: 0 }}
    viewBox="-3.2 -3.2 38.40 38.40"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z" />
    <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z" />
  </svg>
);

interface Props {
  searches: FlightSearch[];
  loading: boolean;
  onNavigate?: (page: string, data?: string) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onSearchRemoved?: (id: string) => void;
}

export function RecentSearches({ searches, loading, onNavigate, isCollapsed = false, onToggle, onSearchRemoved }: Props) {

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("flight_searches").delete().eq("id", id);
    onSearchRemoved?.(id);
  };

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Header */}
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between mb-1 px-1 group">
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Search01Icon} size={13} color="#059669" strokeWidth={2} />
          <h2 className="text-xs font-semibold text-[#059669] uppercase tracking-wider">
            Recent Searches
          </h2>
        </div>
        <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
          <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
        </motion.div>
      </button>

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
            <div style={{ padding: "2px 0 10px" }}>
              {!loading && searches.length === 0 ? (
                <div className="rounded-2xl px-4 py-5 flex items-center gap-3" style={CARD_STYLE}>
                  <HugeiconsIcon icon={Search01Icon} size={20} color="#9AADAD" strokeWidth={1.5} />
                  <p className="text-sm text-[#9AADAD] font-medium">No recent searches yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-hide" style={{ margin: "0 -20px" }}>
                  <div className="flex gap-3" style={{ padding: "2px 20px 2px", scrollSnapType: "x mandatory" }}>
                    {loading
                      ? [1, 2].map((i) => (
                          <div
                            key={i}
                            className="rounded-2xl overflow-hidden flex-shrink-0 w-[232px] px-3 pt-2 pb-4"
                            style={CARD_STYLE}
                          >
                            <div className="h-[14px] w-28 rounded bg-[#e5e7eb] mb-3" />
                            <div className="h-7 w-full rounded-lg bg-[#e5e7eb] mb-2" />
                            <div className="h-3 w-32 rounded bg-[#e5e7eb] mb-3" />
                            <div className="h-px w-full bg-[#e5e7eb] mb-3" />
                            <div className="flex gap-2 justify-center">
                              <div className="h-6 w-20 rounded-full bg-[#e5e7eb]" />
                              <div className="h-6 w-16 rounded-full bg-[#e5e7eb]" />
                            </div>
                          </div>
                        ))
                      : searches.map((s, i) => {
                          const arrRaw = s.arrival_airport ?? "";
                          const isAllDest =
                            s.all_destinations === "Yes" ||
                            arrRaw === "__ALL__" ||
                            arrRaw === "-" ||
                            arrRaw.trim() === "";
                          const depCode = displayCode(s.departure_airport) ?? s.departure_airport;
                          const arrCode = isAllDest ? null : displayCode(s.arrival_airport);
                          const tripLabel = TRIP_LABELS[s.trip_type] ?? s.trip_type;
                          const tripIcon: IconSvgElement = TRIP_ICONS[s.trip_type] ?? ArrowRight04Icon;

                          const fmtTime = (raw: string | null) => {
                            if (!raw) return "";
                            try {
                              const d = new Date(raw);
                              if (isNaN(d.getTime())) return "";
                              return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                            } catch {
                              return "";
                            }
                          };
                          const fmtDate = (raw: string | null) => {
                            if (!raw) return "";
                            try {
                              return format(parseISO(raw), "EEE, MMM d, yyyy");
                            } catch {
                              return raw;
                            }
                          };
                          const searchedTime = fmtTime(s.search_timestamp);
                          const searchedDate = fmtDate(s.search_timestamp);
                          const depDateLabel = fmtDate(s.departure_date);

                          return (
                            <motion.div
                              key={s.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                transition: { duration: 0.28, delay: i * 0.07, ease: EASE },
                              }}
                              className="relative flex-shrink-0 w-[232px] cursor-pointer active:scale-[0.98] transition-transform"
                              style={{ scrollSnapAlign: "start" }}
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
                            >
                              <div className="relative rounded-2xl px-3 pt-2 pb-[18px] overflow-hidden" style={CARD_STYLE}>
                                {/* Colored bottom border */}
                                <div
                                  className="absolute inset-x-0 bottom-0 h-2 pointer-events-none"
                                  style={{ background: "#1D4ED8" }}
                                />

                                {/* Header: Frontier logo + dismiss */}
                                <div className="flex items-center justify-between mb-2">
                                  <img
                                    src="/assets/logo/frontier/frontier_full_logo.png"
                                    alt="Frontier"
                                    className="h-[14px] w-auto object-contain"
                                    loading="eager"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemove(e, s.id)}
                                    className="flex items-center justify-center transition-opacity hover:opacity-70"
                                  >
                                    <X size={11} strokeWidth={2.5} className="text-[#6B7280]" />
                                  </button>
                                </div>

                                {/* Route row */}
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <span className="text-2xl font-bold text-[#1A2E2E] leading-none tracking-tight">
                                    {depCode}
                                  </span>
                                  <div className="flex-1 flex items-center px-1.5">
                                    <div className="flex-1 h-0 border-t border-dashed" style={{ borderColor: "#B8CECE" }} />
                                    <div className="mx-1.5">
                                      <PlaneSVG size={22} />
                                    </div>
                                    <div className="flex-1 h-0 border-t border-dashed" style={{ borderColor: "#B8CECE" }} />
                                  </div>
                                  {isAllDest ? (
                                    <img src={allDestIcon} alt="All destinations" className="w-[26px] h-[26px] object-contain" />
                                  ) : (
                                    <span className="text-2xl font-bold text-[#1A2E2E] leading-none tracking-tight">
                                      {arrCode ?? "—"}
                                    </span>
                                  )}
                                </div>

                                {/* Searched / Depart dates */}
                                <div className="flex items-start justify-between">
                                  <span className="leading-tight">
                                    <span className="block text-xs font-medium text-[#059669]">{searchedTime || "Searched"}</span>
                                    <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">{searchedDate}</span>
                                  </span>
                                  <span className="leading-tight text-right">
                                    <span className="block text-xs font-medium text-[#059669]">Depart</span>
                                    <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">{depDateLabel}</span>
                                  </span>
                                </div>

                                <TicketDivider />

                                {/* Badges row */}
                                <div className="flex items-center justify-center gap-1.5 flex-wrap" style={{ paddingTop: "10px" }}>
                                  {s.gowild_found && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                                      style={{ background: "#059669", color: "#FFFFFF", height: "24px", padding: "0 10px" }}
                                    >
                                      <HugeiconsIcon icon={Rocket01Icon} size={11} color="white" strokeWidth={2.5} />
                                      GoWild
                                    </span>
                                  )}
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                                    style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8", height: "24px", padding: "0 10px" }}
                                  >
                                    <HugeiconsIcon icon={tripIcon} size={11} color="#1D4ED8" strokeWidth={2.5} />
                                    {tripLabel}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
