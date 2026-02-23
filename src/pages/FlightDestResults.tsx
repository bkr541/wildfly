import { useMemo, useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronDown, faPlane, faClock, faCalendarDays, faLayerGroup, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
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

  const { firecrawlRequestBody, flights, departureDate, arrivalDate } = useMemo(() => {
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

  // Check blackout
  const isBlackout = useMemo(() => {
    return isBlackoutDate(departureDate ?? "") || isBlackoutDate(arrivalDate ?? "");
  }, [departureDate, arrivalDate]);

  // Collect unique IATA codes for destinations
  const destinationCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const f of flights) {
      const dest = f.legs.length ? f.legs[f.legs.length - 1].destination : "";
      if (dest) codes.add(dest);
    }
    return Array.from(codes);
  }, [flights]);

  // Fetch airport city/state info
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

  // Group flights by destination
  const groups: DestinationGroup[] = useMemo(() => {
    const grouped: Record<string, ParsedFlight[]> = {};
    for (const f of flights) {
      const dest = f.legs.length ? f.legs[f.legs.length - 1].destination : "???";
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push(f);
    }
    return Object.entries(grouped).map(([dest, flts]) => ({
      destination: dest,
      city: airportMap[dest]?.city ?? "",
      stateCode: airportMap[dest]?.stateCode ?? "",
      flights: flts,
      hasGoWild: flts.some((f) => f.fares.basic != null),
      hasNonstop: flts.some((f) => f.legs.length === 1),
    }));
  }, [flights, airportMap]);

  // Derive origin from first flight
  const origin = useMemo(() => {
    if (flights.length === 0) return "";
    return flights[0].legs[0]?.origin ?? "";
  }, [flights]);

  // Selected destination group
  const selectedGroup = useMemo(() => {
    if (!selectedDest) return null;
    return groups.find((g) => g.destination === selectedDest) ?? null;
  }, [selectedDest, groups]);

  // Earliest departure for selected group
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

  // Nonstop count for selected group
  const nonstopCount = useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.flights.filter((f) => f.legs.length === 1).length;
  }, [selectedGroup]);

  const requestBodyText = firecrawlRequestBody ? JSON.stringify(firecrawlRequestBody, null, 2) : "(not available)";
  const responseText = JSON.stringify({ flights }, null, 2);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header */}
      <header className="relative z-10 grid grid-cols-[40px_1fr_40px] items-center px-6 pt-10 pb-4">
        <button type="button" onClick={onBack} className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity">
          <FontAwesomeIcon icon={faChevronLeft} className="block w-6 h-6" />
        </button>
        <h1 className="h-12 flex items-center justify-center text-xl font-bold text-[#2E4A4A] tracking-tight leading-none whitespace-nowrap">
          Flight Results
        </h1>
        <div className="h-12 w-10" />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 pt-2 pb-6 gap-4 relative z-10">
        {/* Route summary */}
        {groups.length > 0 && origin && (
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-lg text-[#6B7B7B]">{origin}</span>
            <span className="text-lg text-[#6B7B7B]">→</span>
            <span className="text-lg font-bold text-[#345C5A]">{groups.length} Available Route{groups.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Horizontal scrolling destination circles */}
        {groups.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {groups.map((group) => {
              const isSelected = selectedDest === group.destination;
              return (
                <button
                  key={group.destination}
                  type="button"
                  onClick={() => setSelectedDest(isSelected ? null : group.destination)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <div
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md transition-all duration-200 bg-gradient-to-br from-[#5A9E8F] to-[#345C5A]",
                      isSelected ? "ring-3 ring-[#345C5A] ring-offset-2 scale-105" : "opacity-80 hover:opacity-100 hover:scale-105"
                    )}
                  >
                    {group.destination}
                  </div>
                  <span className={cn("text-xs font-medium transition-colors", isSelected ? "text-[#345C5A]" : "text-[#6B7B7B]")}>
                    {group.city || group.destination}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected destination location card */}
        {selectedGroup && (
          <div className="rounded-2xl bg-white shadow-sm border border-[#E3E6E6] p-5 flex flex-col gap-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#2E4A4A]">
                {origin} <span className="text-[#6B7B7B] font-normal">→</span> {selectedGroup.destination}
              </span>
              {selectedGroup.hasGoWild && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-[#6B7B7B] uppercase tracking-wide">From</span>
                  <span className="text-sm font-semibold text-[#4A8C5C]">GoWild Pass</span>
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[#E3E6E6] bg-[#F7F8F8] px-4 py-3 flex items-center gap-3">
                <FontAwesomeIcon icon={faLayerGroup} className="w-5 h-5 text-[#5A9E8F]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#6B7B7B] uppercase tracking-wide">Options</span>
                  <span className="text-lg font-bold text-[#2E4A4A]">{selectedGroup.flights.length}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E3E6E6] bg-[#F7F8F8] px-4 py-3 flex items-center gap-3">
                <FontAwesomeIcon icon={faPlane} className="w-5 h-5 text-[#5A9E8F]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#6B7B7B] uppercase tracking-wide">Nonstop</span>
                  <span className="text-lg font-bold text-[#2E4A4A]">{nonstopCount}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E3E6E6] bg-[#F7F8F8] px-4 py-3 flex items-center gap-3">
                <FontAwesomeIcon icon={faClock} className="w-5 h-5 text-[#5A9E8F]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#6B7B7B] uppercase tracking-wide">Earliest</span>
                  <span className="text-lg font-bold text-[#2E4A4A]">{earliestDeparture ?? "-"}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E3E6E6] bg-[#F7F8F8] px-4 py-3 flex items-center gap-3">
                <FontAwesomeIcon icon={faCalendarDays} className="w-5 h-5 text-[#5A9E8F]" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#6B7B7B] uppercase tracking-wide">Events</span>
                  <span className="text-lg font-bold text-[#2E4A4A]">-</span>
                </div>
              </div>
            </div>

            {/* Route map placeholder */}
            <div className="rounded-xl border border-[#E3E6E6] bg-[#F7F8F8] px-4 py-3 flex items-center gap-3">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="w-5 h-5 text-[#5A9E8F]" />
              <span className="text-sm font-semibold text-[#5A9E8F] uppercase tracking-wide">Route Map</span>
              <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3 text-[#6B7B7B] ml-auto" />
            </div>

            {/* Show All Flights button */}
            <button
              type="button"
              onClick={() => {
                setExpandedDest(expandedDest === selectedGroup.destination ? null : selectedGroup.destination);
              }}
              className="mx-auto flex items-center gap-2 text-sm font-semibold text-[#5A9E8F] hover:opacity-80 transition-opacity"
            >
              <FontAwesomeIcon icon={faPlane} className="w-4 h-4" />
              <span>{expandedDest === selectedGroup.destination ? "Hide Flights" : "Show All Flights"}</span>
              <FontAwesomeIcon icon={faChevronDown} className={cn("w-3 h-3 transition-transform", expandedDest === selectedGroup.destination && "rotate-180")} />
            </button>
          </div>
        )}

        {/* Destination cards */}
        {groups.length > 0 && (
          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const isOpen = expandedDest === group.destination;
              const locationLabel = group.city && group.stateCode
                ? `${group.stateCode}`
                : group.city || group.destination;
              const cityName = group.city || group.destination;
              const dateLabel = departureDate
                ? new Date(departureDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                : "";

              return (
                <div key={group.destination} className="rounded-2xl bg-white shadow-lg border border-[#E8EBEB] overflow-hidden">
                  {/* Card header */}
                  <button
                    type="button"
                    onClick={() => setExpandedDest(isOpen ? null : group.destination)}
                    className="w-full flex items-start justify-between px-6 py-5 text-left"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-2xl font-bold text-[#2E4A4A]">{cityName}</span>
                      <span className="text-sm text-[#6B7B7B]">
                        {group.destination} · {locationLabel}
                      </span>
                      <span className="text-sm text-[#6B7B7B]">
                        {group.flights.length} flight{group.flights.length !== 1 ? "s" : ""}
                        {dateLabel && ` · ${dateLabel}`}
                      </span>
                    </div>

                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={cn("w-5 h-5 text-[#6B7B7B] mt-2 transition-transform duration-200", isOpen && "rotate-180")}
                    />
                  </button>

                  {/* Expanded flight list */}
                  {isOpen && (
                    <div className="px-5 pb-5 flex flex-col gap-2.5 animate-fade-in">
                      {group.flights.map((flight, idx) => {
                        const firstLeg = flight.legs[0];
                        const lastLeg = flight.legs[flight.legs.length - 1];
                        const depTime = formatTime(firstLeg?.departure_time ?? "");
                        const arrTime = formatTime(lastLeg?.arrival_time ?? "");
                        const isNonstop = flight.legs.length === 1;
                        const stops = flight.legs.length - 1;
                        const connectCity = !isNonstop && flight.legs.length >= 2 ? flight.legs[0].destination : null;

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-xl bg-[#F5F6F6] border border-[#E8EBEB] px-4 py-3.5"
                          >
                            <div className="flex items-center gap-3.5">
                              <FontAwesomeIcon icon={faPlane} className="w-5 h-5 text-[#345C5A] -rotate-45" />
                              <div className="flex flex-col">
                                <span className="text-base font-semibold text-[#2E4A4A]">
                                  {depTime} → {arrTime}
                                  {flight.is_plus_one_day && <span className="ml-1 text-[#E89830] text-xs font-medium">(+1)</span>}
                                </span>
                                <span className="text-sm text-[#6B7B7B]">
                                  {flight.total_duration || ""}
                                </span>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8EBEB] px-3 py-1 text-xs font-medium text-[#2E4A4A]">
                              <span className={cn("w-1.5 h-1.5 rounded-full", isNonstop ? "bg-[#5A9E8F]" : "bg-[#6B7B7B]")} />
                              {isNonstop ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}${connectCity ? ` · ${connectCity}` : ""}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Toggle raw results */}
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-sm font-semibold text-[#345C5A] underline underline-offset-2 hover:opacity-80 transition-opacity self-center py-2"
        >
          {showRaw ? "Hide Raw Results" : "Show Raw Results"}
        </button>

        {showRaw && (
          <>
            {/* Request body */}
            <div>
              <h2 className="text-sm font-semibold text-[#2E4A4A] mb-1">Request Body</h2>
              <textarea
                readOnly
                value={requestBodyText}
                className="w-full min-h-[120px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
              />
            </div>

            {/* Response payload */}
            <div className="flex-1 flex flex-col">
              <h2 className="text-sm font-semibold text-[#2E4A4A] mb-1">Response Payload</h2>
              <textarea
                readOnly
                value={responseText}
                className="w-full flex-1 min-h-[300px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FlightDestResults;
