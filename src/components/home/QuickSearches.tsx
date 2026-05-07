import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, nextSaturday, isSaturday, isSunday, parseISO } from "date-fns";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import allDestIcon from "@/assets/all-destinations-icon.svg";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon, Calendar03Icon, Sun03Icon, Calendar02Icon } from "@hugeicons/core-free-icons";

interface QuickSearchLocation {
  locationId: number;
  city: string;
  iataCode: string;
  airportCount: number;
  todayDate: string;
  weekendDate: string;
  isWeekend: boolean;
}

interface QuickSearchCard {
  key: string;
  loc: QuickSearchLocation;
  date: string;
  label: "Today" | "This Weekend";
}

function buildLocations(
  rawLocations: { locationId: number; city: string; iataCode: string; airportCount: number }[]
): QuickSearchLocation[] {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const saturday = isSaturday(today) ? today : nextSaturday(today);
  const saturdayStr = format(saturday, "yyyy-MM-dd");
  const isWeekend = isSaturday(today) || isSunday(today);

  return rawLocations.map((loc) => ({
    ...loc,
    todayDate: todayStr,
    weekendDate: saturdayStr,
    isWeekend,
  }));
}

function displayCode(code: string): string {
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
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: CARD_SHADOW,
};

interface Props {
  onNavigate?: (page: string, data?: string) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function QuickSearches({ onNavigate, isCollapsed = false, onToggle }: Props) {
  const [locations, setLocations] = useState<QuickSearchLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data: userInfo } = await supabase
        .from("user_info")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!userInfo?.id || cancelled) { setLoading(false); return; }

      const { data: userLocations } = await supabase
        .from("user_locations")
        .select("location_id, locations(id, city, state_code)")
        .eq("user_id", userInfo.id);

      if (!userLocations || userLocations.length === 0 || cancelled) { setLoading(false); return; }

      const locationIds = userLocations.map((ul) => ul.location_id);
      const { data: airportData } = await supabase
        .from("airports")
        .select("iata_code, location_id")
        .in("location_id", locationIds);

      if (!airportData || cancelled) { setLoading(false); return; }

      const airportsByLocation: Record<number, string[]> = {};
      for (const ap of airportData) {
        if (!ap.location_id) continue;
        if (!airportsByLocation[ap.location_id]) airportsByLocation[ap.location_id] = [];
        airportsByLocation[ap.location_id].push(ap.iata_code);
      }

      const rawLocs = [];
      for (const ul of userLocations) {
        const loc = Array.isArray(ul.locations) ? ul.locations[0] : ul.locations;
        const airports = airportsByLocation[ul.location_id] ?? [];
        if (airports.length === 0) continue;
        const city = loc?.city ?? "Unknown";
        const normalizeCityForApi = (c: string) => {
          const upper = c.toUpperCase().replace(/,.*$/, "").trim();
          if (upper === "NEW YORK") return "NEW YORK CITY";
          return upper;
        };
        const iataCode = airports.length > 1 ? `CITY:${normalizeCityForApi(city)}` : airports[0];
        rawLocs.push({ locationId: ul.location_id, city, iataCode, airportCount: airports.length });
      }

      if (!cancelled) {
        setLocations(buildLocations(rawLocs));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClick = (loc: QuickSearchLocation, label: string, date: string) => {
    onNavigate?.(
      "flights",
      JSON.stringify({
        quickSearch: true,
        origin: loc.iataCode,
        date,
        label,
        city: loc.city,
        airportCount: loc.airportCount,
      })
    );
  };

  // Flatten locations into one card per (location, date)
  const cards: QuickSearchCard[] = [];
  for (const loc of locations) {
    cards.push({ key: `${loc.locationId}-today`, loc, date: loc.todayDate, label: "Today" });
    if (loc.todayDate !== loc.weekendDate) {
      cards.push({ key: `${loc.locationId}-weekend`, loc, date: loc.weekendDate, label: "This Weekend" });
    }
  }

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Header — clickable to toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-1 px-1 group"
      >
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={FlashIcon} size={13} color="#059669" strokeWidth={2} />
          <h2 className="text-xs font-semibold text-[#059669] uppercase tracking-wider">
            Quick Searches
          </h2>
        </div>
        <motion.div
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="quick-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "visible" }}
          >
            <div style={{ padding: "2px 0 10px" }}>
              {!loading && cards.length === 0 ? (
                <div className="rounded-2xl px-4 py-5 flex items-center gap-3" style={CARD_STYLE}>
                  <HugeiconsIcon icon={FlashIcon} size={20} color="#9AADAD" strokeWidth={1.5} />
                  <p className="text-sm text-[#9AADAD] font-medium">No quick searches available</p>
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-hide" style={{ margin: "0 -20px" }}>
                  <div className="flex gap-3" style={{ padding: "2px 20px 2px", scrollSnapType: "x mandatory" }}>
                    {loading
                      ? [1, 2].map((i) => (
                          <div
                            key={i}
                            className="rounded-2xl overflow-hidden flex-shrink-0 w-[232px] px-4 pt-3 pb-4"
                            style={CARD_STYLE}
                          >
                            <div className="h-4 w-28 rounded bg-[#e5e7eb] mb-4" />
                            <div className="h-8 w-36 rounded-lg bg-[#e5e7eb] mb-4 mx-auto" />
                            <div className="flex gap-2">
                              <div className="h-7 w-20 rounded-full bg-[#e5e7eb]" />
                              <div className="h-7 w-16 rounded-full bg-[#e5e7eb]" />
                            </div>
                          </div>
                        ))
                      : cards.map((c, i) => {
                          const depCode = displayCode(c.loc.iataCode);
                          let formattedDate = c.date;
                          try {
                            formattedDate = format(parseISO(c.date), "MMM d, yyyy");
                          } catch {
                            // keep raw
                          }
                          const isWeekendCard = c.label === "This Weekend";
                          const labelIcon = isWeekendCard ? Weekend02Icon : Sun03Icon;

                          return (
                            <motion.div
                              key={c.key}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                transition: { duration: 0.28, delay: i * 0.07, ease: EASE },
                              }}
                              className="relative flex-shrink-0 w-[232px] rounded-2xl px-3 pt-2 pb-3 cursor-pointer active:scale-[0.98] transition-transform"
                              style={{ scrollSnapAlign: "start", ...CARD_STYLE }}
                              onClick={() => handleClick(c.loc, c.label, c.date)}
                            >
                              {/* Date row */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-1.5">
                                  <HugeiconsIcon icon={Calendar03Icon} size={14} color="#6B7280" strokeWidth={2} />
                                  <span className="text-sm font-medium text-[#6B7280]">{formattedDate}</span>
                                </div>
                                <HugeiconsIcon icon={FlashIcon} size={13} color="#059669" strokeWidth={2.5} />
                              </div>

                              {/* Route row: origin → all destinations */}
                              <div className="flex items-center justify-between gap-1 mb-3">
                                <span className="text-2xl font-bold text-[#1A2E2E] leading-none tracking-tight">
                                  {depCode}
                                </span>
                                <div className="flex-1 flex items-center px-1">
                                  <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-20" />
                                  <svg fill="#2D6A4F" className="mx-1.5 w-6 h-6 shrink-0" viewBox="-3.2 -3.2 38.40 38.40" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z"/>
                                    <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z"/>
                                  </svg>
                                  <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-20" />
                                </div>
                                <img src={allDestIcon} alt="All destinations" className="w-[28px] h-[28px] object-contain" />
                              </div>

                              {/* Badges row */}
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap"
                                  style={{ background: "#059669", color: "#FFFFFF" }}
                                >
                                  <HugeiconsIcon icon={labelIcon} size={11} color="white" strokeWidth={2.5} />
                                  {c.label}
                                </span>
                                {c.loc.airportCount > 1 && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                                    style={{ background: "#EFF6FF", border: "1.5px solid #93C5FD", color: "#1D4ED8", padding: "3px 10px" }}
                                  >
                                    {c.loc.airportCount} airports
                                  </span>
                                )}
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
