import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, nextSaturday, isSaturday, isSunday, nextSunday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneTakeOff01Icon, FlashIcon, Location01Icon } from "@hugeicons/core-free-icons";

interface QuickSearchLocation {
  locationId: number;
  city: string;
  iataCode: string;
  airportCount: number;
  todayDate: string;
  weekendDate: string;
  isWeekend: boolean; // true if today is already Sat/Sun
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

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

// Distinct gradient pairs per card index
const CARD_STYLES = [
  {
    gradient: "linear-gradient(135deg, #0f766e 0%, #059669 100%)",
    accent: "rgba(255,255,255,0.18)",
    pill: "rgba(255,255,255,0.22)",
    pillHover: "rgba(255,255,255,0.32)",
  },
  {
    gradient: "linear-gradient(135deg, #0e7490 0%, #0284c7 100%)",
    accent: "rgba(255,255,255,0.18)",
    pill: "rgba(255,255,255,0.22)",
    pillHover: "rgba(255,255,255,0.32)",
  },
  {
    gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
    accent: "rgba(255,255,255,0.18)",
    pill: "rgba(255,255,255,0.22)",
    pillHover: "rgba(255,255,255,0.32)",
  },
  {
    gradient: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
    accent: "rgba(255,255,255,0.18)",
    pill: "rgba(255,255,255,0.22)",
    pillHover: "rgba(255,255,255,0.32)",
  },
];

interface Props {
  onNavigate?: (page: string, data?: string) => void;
}

export function QuickSearches({ onNavigate }: Props) {
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
        const iataCode = airports.length > 1 ? `CITY:${city}` : airports[0];
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
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-[10px] font-bold text-[#059669] uppercase tracking-widest flex items-center gap-2">
          <HugeiconsIcon icon={FlashIcon} className="w-4 h-4 text-[#059669]" />
          Quick Searches
        </h2>
      </div>

      {/* Cards */}
      <div className="flex flex-row gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {loading
          ? [1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ height: 110, background: "rgba(5,150,105,0.10)" }}
              />
            ))
          : locations.map((loc, i) => {
              const style = CARD_STYLES[i % CARD_STYLES.length];
              const weekendLabel = loc.isWeekend ? "This Weekend" : "This Weekend";

              return (
                <motion.div
                  key={loc.locationId}
                  style={{ minWidth: "58vw", maxWidth: "58vw" }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.3, delay: i * 0.07, ease: EASE },
                  }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: style.gradient,
                    boxShadow: "0 6px 24px 0 rgba(0,0,0,0.13), 0 1.5px 5px 0 rgba(0,0,0,0.07)",
                  }}
                >
                  {/* City header */}
                  <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                    <HugeiconsIcon icon={Location01Icon} className="w-3.5 h-3.5 text-white opacity-80" />
                    <span className="text-white font-extrabold text-[13px] tracking-wide uppercase">
                      {loc.city}
                    </span>
                    {loc.airportCount > 1 && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5"
                        style={{ background: style.accent, color: "rgba(255,255,255,0.85)" }}
                      >
                        {loc.airportCount} airports
                      </span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="mx-4 mb-2.5" style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />

                  {/* Time slot pills */}
                  <div className="flex gap-2.5 px-4 pb-3.5">
                    {/* Today */}
                    <button
                      type="button"
                      onClick={() => handleClick(loc, "Today", loc.todayDate)}
                      className="flex-1 flex flex-col items-start rounded-xl px-3 py-2.5 active:scale-[0.96] transition-transform"
                      style={{ background: style.pill }}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white opacity-75 mb-0.5">
                        Depart
                      </span>
                      <span className="text-white font-extrabold text-[13px] leading-tight">Today</span>
                      <span className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.72)" }}>
                        {format(new Date(loc.todayDate + "T12:00:00"), "EEE, MMM d")}
                      </span>
                    </button>

                    {/* This Weekend */}
                    {loc.todayDate !== loc.weekendDate && (
                      <button
                        type="button"
                        onClick={() => handleClick(loc, weekendLabel, loc.weekendDate)}
                        className="flex-1 flex flex-col items-start rounded-xl px-3 py-2.5 active:scale-[0.96] transition-transform"
                        style={{ background: style.pill }}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white opacity-75 mb-0.5">
                          Depart
                        </span>
                        <span className="text-white font-extrabold text-[13px] leading-tight">This Weekend</span>
                        <span className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.72)" }}>
                          {format(new Date(loc.weekendDate + "T12:00:00"), "EEE, MMM d")}
                        </span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
      </div>
    </section>
  );
}
