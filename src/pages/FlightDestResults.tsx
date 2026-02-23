import { useMemo, useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronDown, faPlane } from "@fortawesome/free-solid-svg-icons";
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
        {/* Destination cards */}
        {groups.length > 0 && (
          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const isOpen = expandedDest === group.destination;
              const locationLabel = group.city && group.stateCode
                ? `${group.city}, ${group.stateCode}`
                : group.city || group.destination;

              return (
                <div key={group.destination} className="rounded-2xl bg-white shadow-sm border border-[#E3E6E6] overflow-hidden">
                  {/* Card header */}
                  <button
                    type="button"
                    onClick={() => setExpandedDest(isOpen ? null : group.destination)}
                    className="w-full flex items-start justify-between px-5 py-4 text-left"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#345C5A]">{group.destination}</span>
                        <span className="text-[#9CA3AF] text-lg font-medium">|</span>
                        <span className="text-lg text-[#4B5563] font-medium">{locationLabel}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {group.hasGoWild && (
                          <span className="inline-flex items-center rounded-full bg-[#4A8C5C] px-3 py-0.5 text-xs font-semibold text-white">
                            GoWild
                          </span>
                        )}
                        {group.hasNonstop && (
                          <span className="inline-flex items-center rounded-full bg-[#E89830] px-3 py-0.5 text-xs font-semibold text-white">
                            Non Stop
                          </span>
                        )}
                        {isBlackout && (
                          <span className="inline-flex items-center rounded-full bg-[#3B3B3B] px-3 py-0.5 text-xs font-semibold text-white">
                            Blackout
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className={cn("w-4 h-4 text-[#6B7B7B] transition-transform duration-200", isOpen && "rotate-180")}
                      />
                      <span className="text-sm text-[#2E4A4A]">
                        <span className="font-bold text-base">{group.flights.length}</span>{" "}
                        Available Flight{group.flights.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>

                  {/* Expanded flight list */}
                  {isOpen && (
                    <div className="border-t border-[#E3E6E6] px-4 py-3 flex flex-col gap-2 animate-fade-in">
                      {group.flights.map((flight, idx) => {
                        const firstLeg = flight.legs[0];
                        const lastLeg = flight.legs[flight.legs.length - 1];
                        const origin = firstLeg?.origin ?? "?";
                        const dest = lastLeg?.destination ?? "?";
                        const depTime = formatTime(firstLeg?.departure_time ?? "");
                        const arrTime = formatTime(lastLeg?.arrival_time ?? "");
                        const isNonstop = flight.legs.length === 1;
                        const stops = flight.legs.length - 1;

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-xl bg-[#F7F8F8] border border-[#E3E6E6] px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <FontAwesomeIcon icon={faPlane} className="w-4 h-4 text-[#345C5A]" />
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-[#2E4A4A]">
                                  {origin} → {dest}
                                </span>
                                <span className="text-xs text-[#6B7B7B]">
                                  {depTime} – {arrTime}
                                  {flight.is_plus_one_day && <span className="ml-1 text-[#E89830] font-medium">(+1 day)</span>}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {flight.total_duration && (
                                <span className="text-xs text-[#6B7B7B]">{flight.total_duration}</span>
                              )}
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
                                  isNonstop ? "bg-[#E89830]" : "bg-[#6B7B7B]",
                                )}
                              >
                                {isNonstop ? "Nonstop" : `+${stops} Stop${stops > 1 ? "s" : ""}`}
                              </span>
                            </div>
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
      </div>
    </div>
  );
};

export default FlightDestResults;
