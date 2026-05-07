import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, nextSaturday, isSaturday, isSunday, addDays } from "date-fns";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon, Location01Icon, Calendar03Icon, Luggage01Icon } from "@hugeicons/core-free-icons";

interface QuickSearchLocation {
  locationId: number;
  city: string;
  iataCode: string;
  airportCount: number;
  todayDate: string;
  tomorrowDate: string;
  weekendDate: string;
  isWeekend: boolean;
}

function buildLocations(
  rawLocations: { locationId: number; city: string; iataCode: string; airportCount: number }[]
): QuickSearchLocation[] {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const saturday = isSaturday(today) ? today : nextSaturday(today);
  const saturdayStr = format(saturday, "yyyy-MM-dd");
  const isWeekend = isSaturday(today) || isSunday(today);

  return rawLocations.map((loc) => ({
    ...loc,
    todayDate: todayStr,
    tomorrowDate: tomorrowStr,
    weekendDate: saturdayStr,
    isWeekend,
  }));
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

  if (!loading && locations.length === 0) return null;

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
              <div className="overflow-x-auto scrollbar-hide" style={{ margin: "0 -20px" }}>
                <div className="flex gap-3" style={{ padding: "2px 20px 2px", scrollSnapType: "x mandatory" }}>
                  {loading
                    ? [1, 2].map((i) => (
                        <div
                          key={i}
                          className="rounded-2xl flex-shrink-0 px-4 pt-4 pb-4"
                          style={{ ...CARD_STYLE, width: 340 }}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-6 h-6 rounded-full bg-[#e5e7eb]" />
                            <div className="h-5 w-28 rounded bg-[#e5e7eb]" />
                          </div>
                          <div className="h-px bg-[#e5e7eb] mb-3" />
                          <div className="h-3 w-36 rounded bg-[#e5e7eb] mb-3" />
                          <div className="flex gap-2">
                            {[1, 2, 3].map((j) => (
                              <div key={j} className="flex-1 h-20 rounded-xl bg-[#e5e7eb]" />
                            ))}
                          </div>
                        </div>
                      ))
                    : locations.map((loc, i) => {
                        const showWeekend = loc.todayDate !== loc.weekendDate;

                        return (
                          <motion.div
                            key={loc.locationId}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: { duration: 0.3, delay: i * 0.07, ease: EASE },
                            }}
                            className="flex-shrink-0 rounded-2xl"
                            style={{ scrollSnapAlign: "start", width: 340, ...CARD_STYLE }}
                          >
                            {/* City header */}
                            <div className="px-4 pt-4 pb-3 flex items-center gap-1.5">
                              <HugeiconsIcon icon={Location01Icon} size={14} color="#6B7280" strokeWidth={2} />
                              <span className="text-sm font-medium text-[#6B7280]">
                                {loc.city}
                              </span>
                              {loc.airportCount > 1 && (
                                <span
                                  className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 ml-0.5"
                                  style={{ background: "rgba(5,150,105,0.12)", color: "#059669" }}
                                >
                                  {loc.airportCount} airports
                                </span>
                              )}
                            </div>

                            {/* Divider */}
                            <div className="mx-4 mb-3" style={{ height: 1, background: "rgba(0,0,0,0.07)" }} />

                            {/* Choose a departure */}
                            <p className="px-4 pb-2.5 text-sm text-[#6B7280]">Choose a departure</p>

                            {/* Option cards */}
                            <div className="px-4 pb-4 flex gap-2">
                              {/* Today */}
                              <button
                                type="button"
                                onClick={() => handleClick(loc, "Today", loc.todayDate)}
                                className="flex-1 flex flex-col items-center rounded-xl py-3 gap-2 active:scale-[0.96] transition-transform"
                              >
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center"
                                  style={{ background: "rgba(5,150,105,0.10)" }}
                                >
                                  <HugeiconsIcon icon={Calendar03Icon} size={18} color="#059669" strokeWidth={2} />
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-sm font-bold text-[#1A2E2E]">Today</span>
                                  <span className="text-[11px] text-[#6B7280]">
                                    {format(new Date(loc.todayDate + "T12:00:00"), "EEE, MMM d")}
                                  </span>
                                </div>
                              </button>

                              {/* Tomorrow */}
                              <button
                                type="button"
                                onClick={() => handleClick(loc, "Tomorrow", loc.tomorrowDate)}
                                className="flex-1 flex flex-col items-center rounded-xl py-3 gap-2 active:scale-[0.96] transition-transform"
                              >
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center"
                                  style={{ background: "rgba(5,150,105,0.10)" }}
                                >
                                  <HugeiconsIcon icon={Calendar03Icon} size={18} color="#059669" strokeWidth={2} />
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-sm font-bold text-[#1A2E2E]">Tomorrow</span>
                                  <span className="text-[11px] text-[#6B7280]">
                                    {format(new Date(loc.tomorrowDate + "T12:00:00"), "EEE, MMM d")}
                                  </span>
                                </div>
                              </button>

                              {/* Weekend */}
                              {showWeekend && (
                                <button
                                  type="button"
                                  onClick={() => handleClick(loc, "Weekend", loc.weekendDate)}
                                  className="flex-1 flex flex-col items-center rounded-xl py-3 gap-2 active:scale-[0.96] transition-transform"
                                >
                                  <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center"
                                    style={{ background: "rgba(5,150,105,0.10)" }}
                                  >
                                    <HugeiconsIcon icon={Luggage01Icon} size={18} color="#059669" strokeWidth={2} />
                                  </div>
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-sm font-bold text-[#1A2E2E]">Weekend</span>
                                    <span className="text-[11px] text-[#6B7280]">
                                      {format(new Date(loc.weekendDate + "T12:00:00"), "EEE, MMM d")}
                                    </span>
                                  </div>
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
