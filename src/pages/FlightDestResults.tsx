import { useMemo, useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronDown,
  faPlane,
  faClock,
  faCalendarDays,
  faLayerGroup,
  faMapMarkerAlt,
  faBullhorn,
  faBug,
} from "@fortawesome/free-solid-svg-icons";
import { faBell as faBellRegular, faCalendar as faCalendarRegular } from "@fortawesome/free-regular-svg-icons";
import { supabase } from "@/integrations/supabase/client";
import { isBlackoutDate } from "@/utils/blackoutDates";
import { cn } from "@/lib/utils";
import FlightLegTimeline from "@/components/FlightLegTimeline";

interface ParsedFlight {
  total_duration: string;
  is_plus_one_day: boolean;
  fares: { basic: number | null; economy: number | null; premium: number | null; business: number | null };
  legs: { origin: string; destination: string; departure_time: string; arrival_time: string }[];
}

interface DestinationGroup {
  destination: string;
  city: string;
  stateCode: string;
  flights: ParsedFlight[];
  hasGoWild: boolean;
  hasNonstop: boolean;
}

function formatTime(raw: string): string {
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    // Already a formatted time string like "3:01 PM"
    return raw;
  } catch {
    return raw;
  }
}

/** Parse a time string (ISO or "3:01 PM") into an hour number (0-23), or null */
function parseHour(raw: string): number | null {
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getHours();
  // Try parsing "H:MM AM/PM"
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h;
  }
  return null;
}

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  const [expandedDest, setExpandedDest] = useState<string | null>(null);
  const [expandedFlightKey, setExpandedFlightKey] = useState<string | null>(null);
  const [airportMap, setAirportMap] = useState<Record<string, { city: string; stateCode: string }>>({});
  const [showRaw, setShowRaw] = useState(false);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);

  // user_flights tracking
  const [userFlights, setUserFlights] = useState<Record<string, { id: string; type: string }>>({});
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1800);
  }, []);

  // Build a unique key for a flight to match against user_flights
  const flightKey = useCallback((flight: ParsedFlight, type: string) => {
    const dep = flight.legs[0];
    const arr = flight.legs[flight.legs.length - 1];
    return `${type}:${dep?.origin}:${arr?.destination}:${dep?.departure_time}:${arr?.arrival_time}`;
  }, []);

  // Load existing user_flights on mount
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_flights" as any)
        .select("id, type, departure_airport, arrival_airport, departure_time, arrival_time")
        .eq("user_id", user.id) as any;
      if (data) {
        const map: Record<string, { id: string; type: string }> = {};
        for (const row of data) {
          const key = `${row.type}:${row.departure_airport}:${row.arrival_airport}:${row.departure_time}:${row.arrival_time}`;
          map[key] = { id: row.id, type: row.type };
        }
        setUserFlights(map);
      }
    };
    load();
  }, []);

  const toggleUserFlight = useCallback(async (flight: ParsedFlight, type: "alert" | "going") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = flightKey(flight, type);
    const existing = userFlights[key];
    if (existing) {
      await supabase.from("user_flights" as any).delete().eq("id", existing.id);
      setUserFlights((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showToast(type === "alert" ? "Alerts turned off" : "Not going");
    } else {
      const dep = flight.legs[0];
      const arr = flight.legs[flight.legs.length - 1];
      const { data: inserted } = await supabase.from("user_flights" as any).insert({
        user_id: user.id,
        type,
        flight_json: flight,
        departure_airport: dep?.origin ?? "",
        arrival_airport: arr?.destination ?? "",
        departure_time: dep?.departure_time ?? "",
        arrival_time: arr?.arrival_time ?? "",
      } as any).select("id").single() as any;
      if (inserted) {
        setUserFlights((prev) => ({ ...prev, [key]: { id: inserted.id, type } }));
        showToast(type === "alert" ? "Alert set!" : "You're going! 🎉");
      }
    }
  }, [userFlights, flightKey, showToast]);

  const { flights, departureDate, arrivalDate, tripType, departureAirport, arrivalAirport, fromCache } = useMemo(() => {
    try {
      const parsed = JSON.parse(responseData);
      return {
        flights: (parsed.response?.flights ?? []) as ParsedFlight[],
        departureDate: parsed.departureDate ?? null,
        arrivalDate: parsed.arrivalDate ?? null,
        tripType: parsed.tripType ?? parsed.firecrawlRequestBody?.tripType ?? "One Way",
        departureAirport: parsed.departureAirport ?? parsed.firecrawlRequestBody?.departureAirport ?? "",
        arrivalAirport: parsed.arrivalAirport ?? parsed.firecrawlRequestBody?.arrivalAirport ?? "",
        fromCache: parsed.fromCache === true,
      };
    } catch {
      return { flights: [], departureDate: null, arrivalDate: null, tripType: "One Way", departureAirport: "", arrivalAirport: "All", fromCache: false };
    }
  }, [responseData]);

  const destinationCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const f of flights) {
      const dest = f.legs.length ? f.legs[f.legs.length - 1].destination : "";
      if (dest) codes.add(dest);
    }
    return Array.from(codes);
  }, [flights]);

  useEffect(() => {
    if (destinationCodes.length === 0) return;
    const fetchAirports = async () => {
      const { data } = await supabase
        .from("airports")
        .select("iata_code, locations(city, state_code)")
        .in("iata_code", destinationCodes);
      if (data) {
        const map: Record<string, { city: string; stateCode: string }> = {};
        for (const a of data as any[]) {
          map[a.iata_code] = {
            city: a.locations?.city ?? "",
            stateCode: a.locations?.state_code ?? "",
          };
        }
        setAirportMap(map);
      }
    };
    fetchAirports();
  }, [destinationCodes]);

  const groups: DestinationGroup[] = useMemo(() => {
    const grouped: Record<string, ParsedFlight[]> = {};
    for (const f of flights) {
      const dest = f.legs.length ? f.legs[f.legs.length - 1].destination : "???";
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push(f);
    }
    return Object.entries(grouped)
      .map(([dest, flts]) => ({
        destination: dest,
        city: airportMap[dest]?.city ?? "",
        stateCode: airportMap[dest]?.stateCode ?? "",
        flights: flts,
        hasGoWild: flts.some((f) => f.fares.basic != null),
        hasNonstop: flts.some((f) => f.legs.length === 1),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [flights, airportMap]);

  const origin = useMemo(() => {
    if (flights.length === 0) return "";
    return flights[0].legs[0]?.origin ?? "";
  }, [flights]);

  const selectedGroup = useMemo(() => {
    if (!selectedDest) return null;
    return groups.find((g) => g.destination === selectedDest) ?? null;
  }, [selectedDest, groups]);

  const earliestDeparture = useMemo(() => {
    if (!selectedGroup) return null;
    let earliestH: number | null = null;
    for (const f of selectedGroup.flights) {
      const dep = f.legs[0]?.departure_time;
      if (dep) {
        const h = parseHour(dep);
        if (h !== null && (earliestH === null || h < earliestH)) earliestH = h;
      }
    }
    if (earliestH === null) return null;
    const d = new Date();
    d.setHours(earliestH, 0, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }, [selectedGroup]);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-70 transition-opacity"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold text-[#345C5A] tracking-tight">
            {origin || departureAirport} → {arrivalAirport || "All"}
          </h1>
          <span className="text-[11px] text-[#6B7B7B] font-medium">
            {tripType} | {flights.length} Flight{flights.length !== 1 ? "s" : ""} | {destinationCodes.length} Airport{destinationCodes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col px-5 pt-1 pb-6 gap-3.5 relative z-10">


        <div className="flex flex-col gap-2.5">
          {groups.map((group) => {
            const isDestOpen = expandedDest === group.destination;
            const nonstopCount = group.flights.filter((f) => f.legs.length === 1).length;
            const goWildCount = group.flights.filter((f) => f.fares.basic != null).length;
            let earliestTime: Date | null = null;
             for (const f of group.flights) {
               const dep = f.legs[0]?.departure_time;
               if (dep) {
                 const h = parseHour(dep);
                 if (h !== null) {
                   const d = new Date();
                   d.setHours(h, 0, 0, 0);
                   if (!earliestTime || d < earliestTime) earliestTime = d;
                 }
               }
             }
            const earliestLabel = earliestTime
              ? earliestTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
              : null;
            return (
              <div
                key={group.destination}
                className="rounded-xl bg-white shadow-sm border border-[#E8EBEB] overflow-hidden"
              >
                <button
                   onClick={() => {
                     setExpandedDest(isDestOpen ? null : group.destination);
                     setExpandedFlightKey(null);
                   }}
                   className="w-full flex items-center gap-3 px-4 py-3 text-left"
                 >
                   <img
                     src="/assets/locations/chicago_icon.png"
                     alt={group.city || group.destination}
                     className="w-12 h-12 rounded-lg object-cover shrink-0"
                   />
                   <div className="flex flex-col flex-1 min-w-0">
                   <span className="text-base font-bold text-[#2E4A4A] leading-tight uppercase">
                      {group.city || group.destination}{group.stateCode ? <span className="font-normal">, {group.stateCode}</span> : ""}
                    </span>
                    <span className="text-[11px] text-[#6B7B7B] font-medium uppercase tracking-wide">
                      {group.flights.length} flight
                      {group.flights.length !== 1 ? "s" : ""} | {group.destination}
                     </span>
                     <div className="flex items-center gap-3 mt-1 text-[10px] text-[#6B7B7B] font-medium">
                       {earliestLabel && (
                         <span className="flex items-center gap-1">
                           <FontAwesomeIcon icon={faClock} className="w-3 h-3 text-[#345C5A]" />
                           Earliest: {earliestLabel}
                         </span>
                       )}
                       <span className="flex items-center gap-1">
                         <FontAwesomeIcon icon={faLayerGroup} className="w-3 h-3 text-[#345C5A]" />
                         Nonstop: {nonstopCount}
                       </span>
                       <span className="flex items-center gap-1">
                         <FontAwesomeIcon icon={faMapMarkerAlt} className="w-3 h-3 text-[#345C5A]" />
                         GoWild: {goWildCount} available
                       </span>
                     </div>
                    </div>
                   <FontAwesomeIcon
                     icon={faChevronDown}
                     className={cn(
                      "w-4 h-4 text-[#9CA3AF] transition-transform duration-200",
                      isDestOpen && "rotate-180",
                    )}
                  />
                </button>

                {isDestOpen && (() => {
                  // Group flights by hour, only keep hours with flights
                  const flightsByHour: { hour: number; items: { flight: ParsedFlight; idx: number }[] }[] = [];
                  const hourMap: Record<number, { flight: ParsedFlight; idx: number }[]> = {};
                   group.flights.forEach((flight, idx) => {
                     const dep = flight.legs[0]?.departure_time;
                     if (!dep) return;
                     const h = parseHour(dep);
                     if (h === null) return;
                     if (!hourMap[h]) hourMap[h] = [];
                     hourMap[h].push({ flight, idx });
                   });
                  Object.keys(hourMap)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .forEach((h) => flightsByHour.push({ hour: h, items: hourMap[h] }));

                  return (
                    <div className="animate-fade-in border-t border-[#F2F3F3] pt-3 pb-3 px-3">
                      <div className="relative flex">
                        {/* Timeline line */}
                        <div className="absolute left-[28px] top-3 bottom-3 w-px bg-[#D1D5DB]" />

                        <div className="flex flex-col gap-2 w-full">
                          {flightsByHour.map(({ hour: h, items }) => {
                            const hourLabel = h === 0 ? "12:00" : h > 12 ? `${h - 12}:00` : `${h}:00`;
                            const ampm = h < 12 ? "AM" : "PM";

                            return (
                              <div key={h} className="flex gap-2">
                                {/* Time label */}
                                <div className="w-14 shrink-0 flex flex-col items-center pt-1">
                                  <div className="relative z-10 flex flex-col items-center bg-[#F2F3F3] rounded px-1.5 py-0.5">
                                    <span className="text-[11px] font-bold text-[#2E4A4A] leading-tight">{hourLabel}</span>
                                    <span className="text-[9px] text-[#6B7B7B] font-medium leading-tight">{ampm}</span>
                                  </div>
                                </div>

                                {/* Flight cards for this hour */}
                                <div className="flex-1 flex flex-col gap-1.5">
                                  {items.map(({ flight, idx }) => {
                                    const fKey = `${group.destination}-${idx}`;
                                    const isFlightOpen = expandedFlightKey === fKey;
                                    const isNonstop = flight.legs.length === 1;
                                    const alertKey = flightKey(flight, "alert");
                                    const goingKey = flightKey(flight, "going");
                                    const hasAlert = !!userFlights[alertKey];
                                    const hasGoing = !!userFlights[goingKey];

                                    return (
                                      <div key={idx} className="flex flex-col gap-1.5">
                                         <div className={cn(
                                          "flex items-center border rounded-lg px-2.5 py-2 transition-colors",
                                          isFlightOpen ? "border-[#345C5A]/30 bg-white rounded-b-none" : "bg-[#F9FAFA] border-[#F2F3F3]",
                                         )}>
                                          <button
                                            onClick={() => setExpandedFlightKey(isFlightOpen ? null : fKey)}
                                            className="flex items-center justify-between text-left flex-1 min-w-0"
                                          >
                                            <div className="flex items-center gap-2">
                                              <img src="/assets/logo/frontier/frontier_logo.png" alt="Frontier" className="w-5 h-5 rounded object-contain shrink-0" />
                                              <div className="flex flex-col">
                                                <span className="text-xs font-bold text-[#2E4A4A]">
                                                  {formatTime(flight.legs[0]?.departure_time)} → {formatTime(flight.legs[flight.legs.length - 1]?.arrival_time)}
                                                </span>
                                                <span className="text-[9px] text-[#6B7B7B] font-medium">
                                                  {flight.total_duration}
                                                  {flight.is_plus_one_day && <span className="ml-1 text-[#E89830] font-semibold">+1 Day</span>}
                                                </span>
                                              </div>
                                            </div>
                                            <span className="inline-flex items-center rounded-full bg-[#E8EBEB] px-2 py-0.5 text-[9px] font-bold text-[#345C5A] uppercase">
                                              {isNonstop ? "Nonstop" : `${flight.legs.length - 1} stop`}
                                            </span>
                                          </button>
                                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); toggleUserFlight(flight, "alert"); }}
                                              className={cn(
                                                "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200",
                                                hasAlert ? "bg-[#E89830] text-white scale-110" : "bg-[#E8EBEB] text-[#6B7B7B] hover:bg-[#E89830]/20 hover:text-[#E89830]",
                                              )}
                                            >
                                              <FontAwesomeIcon icon={faBullhorn} className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); toggleUserFlight(flight, "going"); }}
                                              className={cn(
                                                "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200",
                                                hasGoing ? "bg-[#345C5A] text-white scale-110" : "bg-[#E8EBEB] text-[#6B7B7B] hover:bg-[#345C5A]/20 hover:text-[#345C5A]",
                                              )}
                                            >
                                              <FontAwesomeIcon icon={faCalendarDays} className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>

                                        {isFlightOpen && (
                                          <div className="bg-white animate-fade-in px-3 py-2 rounded-b-lg border border-t-0 border-[#345C5A]/30">
                                            <FlightLegTimeline legs={flight.legs} airportMap={airportMap} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs font-bold text-[#345C5A] opacity-50 hover:opacity-100 transition-opacity self-center py-4"
        >
          {showRaw ? "HIDE DEBUG DATA" : "VIEW RAW RESPONSE"}
        </button>

        {fromCache && (
          <div className="flex items-center justify-center gap-1.5 -mt-2 pb-1">
            <FontAwesomeIcon icon={faBug} className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[10px] font-semibold text-green-600">Loaded from cache</span>
          </div>
        )}

        {showRaw && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <textarea
              readOnly
              value={JSON.stringify({ flights }, null, 2)}
              className="w-full h-40 rounded-xl border border-[#E3E6E6] bg-white p-3 text-[10px] font-mono text-[#2E4A4A] resize-none"
            />
          </div>
        )}
      </div>

      {/* Toast popup */}
      <div
        className={cn(
          "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[#2E4A4A] text-white text-sm font-bold shadow-lg transition-all duration-300 pointer-events-none",
          toast.visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-95",
        )}
      >
        {toast.message}
      </div>
    </div>
  );
};

export default FlightDestResults;
