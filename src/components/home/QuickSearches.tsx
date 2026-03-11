import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, addDays, nextSaturday, nextSunday, isSaturday, isSunday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneTakeOff01Icon, FlashIcon } from "@hugeicons/core-free-icons";
import { ArrowRight } from "lucide-react";

interface QuickSearchLocation {
  locationId: number;
  city: string;
  iataCode: string; // single IATA or city name (e.g. 'CHICAGO') for multi-airport cities
  airportCount: number;
}

interface QuickSearchCard {
  location: QuickSearchLocation;
  label: string; // 'Today', 'Tomorrow', 'This Weekend'
  date: string; // yyyy-MM-dd
}

/** Returns the cards to show: up to 2 time slots × n locations */
function buildCards(locations: QuickSearchLocation[]): QuickSearchCard[] {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const saturday = isSaturday(today) ? today : nextSaturday(today);
  const saturdayStr = format(saturday, "yyyy-MM-dd");
  const sundayStr = format(isSunday(today) ? today : nextSunday(today), "yyyy-MM-dd");

  const cards: QuickSearchCard[] = [];

  for (const loc of locations) {
    // Today
    cards.push({ location: loc, label: "Today", date: todayStr });
    // This Weekend (Saturday) — only add if it's not today
    if (saturdayStr !== todayStr) {
      cards.push({ location: loc, label: "This Weekend", date: saturdayStr });
    }
  }

  return cards;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface Props {
  onNavigate?: (page: string, data?: string) => void;
}

export function QuickSearches({ onNavigate }: Props) {
  const [cards, setCards] = useState<QuickSearchCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      // Get user's integer id from user_info
      const { data: userInfo } = await supabase
        .from("user_info")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!userInfo?.id || cancelled) {
        setLoading(false);
        return;
      }

      // Get all user_locations with location details
      const { data: userLocations } = await supabase
        .from("user_locations")
        .select("location_id, locations(id, city, state_code)")
        .eq("user_id", userInfo.id);

      if (!userLocations || userLocations.length === 0 || cancelled) {
        setLoading(false);
        return;
      }

      // For each location, find airports
      const locationIds = userLocations.map((ul) => ul.location_id);
      const { data: airportData } = await supabase
        .from("airports")
        .select("iata_code, location_id")
        .in("location_id", locationIds);

      if (!airportData || cancelled) {
        setLoading(false);
        return;
      }

      // Group airports by location_id
      const airportsByLocation: Record<number, string[]> = {};
      for (const ap of airportData) {
        if (!ap.location_id) continue;
        if (!airportsByLocation[ap.location_id]) airportsByLocation[ap.location_id] = [];
        airportsByLocation[ap.location_id].push(ap.iata_code);
      }

      const quickLocations: QuickSearchLocation[] = [];
      for (const ul of userLocations) {
        const loc = Array.isArray(ul.locations) ? ul.locations[0] : ul.locations;
        const airports = airportsByLocation[ul.location_id] ?? [];
        if (airports.length === 0) continue;

        const city = loc?.city ?? "Unknown";
        // If more than one airport in the city, use the CITY NAME in ALL CAPS as the IATA value
        const iataCode = airports.length > 1 ? city.toUpperCase() : airports[0];

        quickLocations.push({
          locationId: ul.location_id,
          city,
          iataCode,
          airportCount: airports.length,
        });
      }

      if (!cancelled) {
        setCards(buildCards(quickLocations));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && cards.length === 0) return null;

  const handleCardClick = (card: QuickSearchCard) => {
    const payload = JSON.stringify({
      quickSearch: true,
      origin: card.location.iataCode,
      date: card.date,
      label: card.label,
      city: card.location.city,
      airportCount: card.location.airportCount,
    });
    onNavigate?.("flights", payload);
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
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-36 rounded-2xl border border-[#e3e6e6] bg-white px-4 py-4 animate-pulse"
              >
                <div className="h-4 w-16 rounded bg-[#e5e7eb] mb-3" />
                <div className="h-6 w-20 rounded bg-[#e5e7eb] mb-1" />
                <div className="h-3 w-12 rounded bg-[#e5e7eb]" />
              </div>
            ))
          : cards.map((card, i) => (
              <motion.button
                key={`${card.location.locationId}-${card.date}`}
                type="button"
                onClick={() => handleCardClick(card)}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.28, delay: i * 0.06, ease: EASE },
                }}
                className="flex-shrink-0 w-36 text-left rounded-2xl px-4 py-4 active:scale-[0.97] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(5,150,105,0.15)",
                  boxShadow:
                    "0 4px 20px 0 rgba(5,150,105,0.10), 0 1.5px 5px 0 rgba(5,150,105,0.07)",
                }}
              >
                {/* Time label */}
                <p className="text-[10px] font-bold text-[#059669] uppercase tracking-widest mb-2 flex items-center gap-1">
                  <HugeiconsIcon icon={AirplaneTakeOff01Icon} className="w-3 h-3" />
                  {card.label}
                </p>

                {/* City */}
                <p className="text-base font-extrabold text-[#1a2e2e] leading-tight tracking-tight mb-0.5">
                  {card.location.city}
                </p>

                {/* IATA indicator */}
                <div className="flex items-center gap-1 mt-1">
                  {card.location.airportCount > 1 ? (
                    <span className="text-[10px] font-semibold text-[#6B7B7B]">
                      {card.location.airportCount} airports
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-[#345C5A]">
                      {card.location.iataCode}
                    </span>
                  )}
                </div>

                {/* Date */}
                <p className="text-[10px] text-[#9CA3AF] mt-1 font-medium">
                  {format(new Date(card.date + "T12:00:00"), "MMM d")}
                </p>
              </motion.button>
            ))}
      </div>
    </section>
  );
}
