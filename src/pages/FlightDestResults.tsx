import { useMemo, useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronDown,
  faPlane,
  faClock,
  faCalendarDays,
  faLayerGroup,
  faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/integrations/supabase/client";
import { isBlackoutDate } from "@/utils/blackoutDates";
import { cn } from "@/lib/utils";

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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  const [expandedDest, setExpandedDest] = useState<string | null>(null);
  const [airportMap, setAirportMap] = useState<Record<string, { city: string; stateCode: string }>>({});
  const [showRaw, setShowRaw] = useState(false);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);

  const { flights, departureDate, arrivalDate, firecrawlRequestBody } = useMemo(() => {
    try {
      const parsed = JSON.parse(responseData);
      return {
        firecrawlRequestBody: parsed.firecrawlRequestBody ?? null,
        flights: (parsed.response?.flights ?? []) as ParsedFlight[],
        departureDate: parsed.departureDate ?? null,
        arrivalDate: parsed.arrivalDate ?? null,
      };
    } catch {
      return { firecrawlRequestBody: null, flights: [], departureDate: null, arrivalDate: null };
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
    let earliest: Date | null = null;
    for (const f of selectedGroup.flights) {
      const dep = f.legs[0]?.departure_time;
      if (dep) {
        const d = new Date(dep);
        if (!isNaN(d.getTime()) && (!earliest || d < earliest)) earliest = d;
      }
    }
    if (!earliest) return null;
    return earliest.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }, [selectedGroup]);

  const nonstopCount = useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.flights.filter((f) => f.legs.length === 1).length;
  }, [selectedGroup]);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Background Decor */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Synchronized Header - pt-6 for smaller top gap */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-70 transition-opacity"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-[#2E4A4A] tracking-tight">Flight Results</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col px-5 pt-1 pb-6 gap-3.5 relative z-10">
        {/* Route Summary Text - text-sm instead of text-lg */}
        {groups.length > 0 && origin && (
          <div className="flex items-center gap-1.5 px-1 opacity-80">
            <span className="text-sm font-semibold text-[#6B7B7B] uppercase tracking-wider">{origin}</span>
            <span className="text-[#6B7B7B]">→</span>
            <span className="text-sm font-bold text-[#345C5A] uppercase tracking-wider">
              {groups.length} Destination{groups.length !== 1 ? "s" : ""} Found
            </span>
          </div>
        )}

        {/* Scaled-down Destination Circles (w-16 instead of w-20) */}
        {groups.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {groups.map((group) => {
              const isSelected = selectedDest === group.destination;
              return (
                <button
                  key={group.destination}
                  onClick={() => setSelectedDest(isSelected ? null : group.destination)}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <div
                    className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm transition-all duration-200",
                      isSelected
                        ? "bg-[#345C5A] scale-105 ring-2 ring-offset-2 ring-[#345C5A]"
                        : "bg-[#345C5A]/80 opacity-70 hover:opacity-100",
                    )}
                  >
                    {group.destination}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase transition-colors truncate w-16 text-center",
                      isSelected ? "text-[#345C5A]" : "text-[#6B7B7B]",
                    )}
                  >
                    {group.city || group.destination}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Highlight Card - Tightened padding and font */}
        {selectedGroup && (
          <div className="rounded-xl bg-white shadow-sm border border-[#E3E6E6] p-4 flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#F2F3F3] pb-2">
              <span className="text-lg font-bold text-[#2E4A4A]">
                {origin} <span className="text-[#6B7B7B] font-normal mx-0.5">→</span> {selectedGroup.destination}
              </span>
              {selectedGroup.hasGoWild && (
                <span className="text-[10px] font-bold bg-[#E8F1F1] text-[#345C5A] px-2 py-0.5 rounded-md uppercase tracking-tight">
                  GoWild
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#F7F8F8] px-3 py-2 rounded-lg flex items-center gap-2.5">
                <FontAwesomeIcon icon={faLayerGroup} className="w-3.5 h-3.5 text-[#5A9E8F]" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#6B7B7B] uppercase font-bold tracking-tighter leading-none">
                    Options
                  </span>
                  <span className="text-sm font-bold text-[#2E4A4A]">{selectedGroup.flights.length}</span>
                </div>
              </div>
              <div className="bg-[#F7F8F8] px-3 py-2 rounded-lg flex items-center gap-2.5">
                <FontAwesomeIcon icon={faPlane} className="w-3.5 h-3.5 text-[#5A9E8F]" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#6B7B7B] uppercase font-bold tracking-tighter leading-none">
                    Nonstop
                  </span>
                  <span className="text-sm font-bold text-[#2E4A4A]">{nonstopCount}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                setExpandedDest(expandedDest === selectedGroup.destination ? null : selectedGroup.destination)
              }
              className="flex items-center justify-center gap-2 text-xs font-bold text-[#5A9E8F] py-1 hover:bg-[#F7F8F8] rounded-md transition-colors"
            >
              <FontAwesomeIcon icon={faPlane} className="w-3 h-3" />
              <span>{expandedDest === selectedGroup.destination ? "HIDE DETAILS" : "SHOW ALL FLIGHTS"}</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={cn(
                  "w-2.5 h-2.5 transition-transform",
                  expandedDest === selectedGroup.destination && "rotate-180",
                )}
              />
            </button>
          </div>
        )}

        {/* Compact List Cards */}
        <div className="flex flex-col gap-2.5">
          {groups.map((group) => {
            const isOpen = expandedDest === group.destination;
            return (
              <div
                key={group.destination}
                className="rounded-xl bg-white shadow-sm border border-[#E8EBEB] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedDest(isOpen ? null : group.destination)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-[#2E4A4A] leading-tight">
                      {group.city || group.destination}
                    </span>
                    <span className="text-[11px] text-[#6B7B7B] font-medium uppercase tracking-wide">
                      {group.destination} · {group.stateCode || "Domestic"} · {group.flights.length} flight
                      {group.flights.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={cn("w-4 h-4 text-[#9CA3AF] transition-transform duration-200", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 flex flex-col gap-2 animate-fade-in border-t border-[#F2F3F3] pt-3">
                    {group.flights.map((flight, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-[#F9FAFA] border border-[#F2F3F3] rounded-lg px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <FontAwesomeIcon icon={faPlane} className="w-3.5 h-3.5 text-[#345C5A] -rotate-45" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#2E4A4A]">
                              {formatTime(flight.legs[0]?.departure_time)} →{" "}
                              {formatTime(flight.legs[flight.legs.length - 1]?.arrival_time)}
                              {flight.is_plus_one_day && <span className="ml-1 text-[#E89830] text-[10px]">(+1)</span>}
                            </span>
                            <span className="text-[10px] text-[#6B7B7B] font-medium">{flight.total_duration}</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8EBEB] px-2.5 py-0.5 text-[10px] font-bold text-[#345C5A] uppercase">
                          {flight.legs.length === 1 ? "Nonstop" : `${flight.legs.length - 1} stop`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
    </div>
  );
};

export default FlightDestResults;
