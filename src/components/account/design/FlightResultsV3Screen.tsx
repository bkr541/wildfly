import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronDown, faPlane } from "@fortawesome/free-solid-svg-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import FlightLegTimeline from "@/components/FlightLegTimeline";

const CACHE_ID = "29a414b6-1a64-48c2-906e-1353b7553322";

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
  airportName: string;
  flights: ParsedFlight[];
  nonstopCount: number;
  goWildCount: number;
  earliestLabel: string | null;
  latestLabel: string | null;
}

interface Props { onBack: () => void }

function formatTime(raw: string): string {
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return raw;
  } catch { return raw; }
}

function parseHour(raw: string): number | null {
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getHours();
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h;
  }
  return null;
}

// Teal gradient destination hero — abstract city silhouette via SVG
function CityHeroBackground({ destination }: { destination: string }) {
  // Deterministic but varied silhouette based on IATA code
  const seed = destination.charCodeAt(0) + (destination.charCodeAt(1) ?? 0) + (destination.charCodeAt(2) ?? 0);
  const variant = seed % 3;

  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" preserveAspectRatio="xMidYMax meet">
      {/* Sky gradient */}
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a6b6a" />
          <stop offset="60%" stopColor="#2d9e7a" />
          <stop offset="100%" stopColor="#3dbd8a" />
        </linearGradient>
        <linearGradient id="hillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d5c5a" />
          <stop offset="100%" stopColor="#134543" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="55%" cy="35%" r="20%">
          <stop offset="0%" stopColor="#f0e070" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#f0d040" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f0d040" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect width="400" height="220" fill="url(#skyGrad)" />
      {/* Sun glow */}
      <ellipse cx="220" cy="80" rx="70" ry="70" fill="url(#sunGlow)" />
      {/* Sun disc */}
      <circle cx="220" cy="80" r="28" fill="#f5e040" opacity="0.85" />

      {/* Background hills */}
      <ellipse cx="80" cy="200" rx="120" ry="50" fill="#1d5c5a" opacity="0.6" />
      <ellipse cx="320" cy="210" rx="140" ry="55" fill="#1d5c5a" opacity="0.5" />

      {/* City buildings — variant 0: skyline with tower */}
      {variant === 0 && (
        <g fill="#134543">
          <rect x="30" y="140" width="18" height="70" />
          <rect x="55" y="120" width="24" height="90" />
          <rect x="85" y="130" width="20" height="80" />
          {/* Needle tower */}
          <rect x="150" y="80" width="8" height="130" />
          <ellipse cx="154" cy="80" rx="14" ry="20" />
          <rect x="140" y="145" width="28" height="12" />
          <rect x="110" y="135" width="22" height="75" />
          <rect x="240" y="115" width="30" height="95" />
          <rect x="275" y="128" width="22" height="82" />
          <rect x="305" y="120" width="28" height="90" />
          <rect x="340" y="135" width="20" height="75" />
          <rect x="365" y="145" width="25" height="65" />
        </g>
      )}

      {/* Variant 1: pyramid + ferris wheel */}
      {variant === 1 && (
        <g fill="#134543">
          {/* Ferris wheel */}
          <circle cx="70" cy="148" r="35" fill="none" stroke="#134543" strokeWidth="3" />
          <circle cx="70" cy="148" r="6" fill="#134543" />
          {[0,60,120,180,240,300].map(a => (
            <line key={a} x1="70" y1="148"
              x2={70 + 35 * Math.cos(a * Math.PI/180)}
              y2={148 + 35 * Math.sin(a * Math.PI/180)}
              stroke="#134543" strokeWidth="2" />
          ))}
          <rect x="67" y="183" width="6" height="27" />
          {/* Pyramid */}
          <polygon points="200,90 170,200 230,200" />
          <polygon points="230,100 210,200 260,200" />
          {/* Buildings */}
          <rect x="270" y="120" width="25" height="90" />
          <rect x="300" y="130" width="20" height="80" />
          <rect x="330" y="115" width="30" height="95" />
          <rect x="365" y="140" width="22" height="70" />
        </g>
      )}

      {/* Variant 2: downtown skyline */}
      {variant === 2 && (
        <g fill="#134543">
          <rect x="20" y="130" width="22" height="80" />
          <rect x="48" y="110" width="28" height="100" />
          <rect x="82" y="120" width="24" height="90" />
          <rect x="112" y="100" width="32" height="110" />
          <rect x="150" y="115" width="26" height="95" />
          <rect x="182" y="90" width="36" height="120" />
          <rect x="224" y="110" width="28" height="100" />
          <rect x="258" y="125" width="24" height="85" />
          <rect x="288" y="105" width="30" height="105" />
          <rect x="325" y="120" width="26" height="90" />
          <rect x="358" y="135" width="22" height="75" />
        </g>
      )}

      {/* Foreground palm trees */}
      <g fill="#0d3533">
        <rect x="18" y="170" width="5" height="40" />
        <ellipse cx="20" cy="170" rx="14" ry="8" />
        <rect x="370" y="175" width="5" height="35" />
        <ellipse cx="372" cy="175" rx="12" ry="7" />
      </g>

      {/* Airplane */}
      <g transform="translate(305, 45) rotate(-10)" fill="white" opacity="0.7">
        <path d="M0,0 L16,5 L0,10 L3,5 Z" />
        <path d="M5,2 L8,-4 L10,5 L5,8 Z" />
        <path d="M2,5 L5,9 L7,5 Z" />
      </g>
    </svg>
  );
}

const FlightResultsV3Screen = ({ onBack }: Props) => {
  const [responseData, setResponseData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [airportMap, setAirportMap] = useState<Record<string, { city: string; stateCode: string; name: string }>>({});
  const [expandedDest, setExpandedDest] = useState<string | null>(null);
  const [expandedFlightKey, setExpandedFlightKey] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error: err } = await supabase
        .from("flight_search_cache")
        .select("payload, canonical_request")
        .eq("id", CACHE_ID)
        .single();
      if (err || !data) {
        setError(err?.message ?? "Not found");
      } else {
        const payload = data.payload as any;
        const canonical = data.canonical_request as any;
        setResponseData(JSON.stringify({
          response: payload,
          departureDate: canonical?.departureDate ?? null,
          arrivalDate: canonical?.arrivalDate ?? null,
          tripType: canonical?.tripType ?? "One Way",
          departureAirport: canonical?.origin ?? canonical?.dep_iata ?? "",
          arrivalAirport: canonical?.destination ?? canonical?.arr_iata ?? "",
          fromCache: true,
        }));
      }
      setLoading(false);
    };
    load();
  }, []);

  const { flights, departureAirport, departureDate } = useMemo(() => {
    if (!responseData) return { flights: [] as ParsedFlight[], departureAirport: "", departureDate: null };
    try {
      const p = JSON.parse(responseData);
      return {
        flights: (p.response?.flights ?? []) as ParsedFlight[],
        departureAirport: p.departureAirport ?? "",
        departureDate: p.departureDate ?? null,
      };
    } catch {
      return { flights: [] as ParsedFlight[], departureAirport: "", departureDate: null };
    }
  }, [responseData]);

  // Fetch airport info
  useEffect(() => {
    const codes = Array.from(new Set(flights.flatMap(f => f.legs.flatMap(l => [l.origin, l.destination])))).filter(Boolean);
    if (!codes.length) return;
    supabase.from("airports").select("iata_code, name, locations(city, state_code)").in("iata_code", codes)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { city: string; stateCode: string; name: string }> = {};
        for (const a of data as any[]) {
          map[a.iata_code] = { city: a.locations?.city ?? "", stateCode: a.locations?.state_code ?? "", name: a.name ?? "" };
        }
        setAirportMap(map);
      });
  }, [flights]);

  const groups: DestinationGroup[] = useMemo(() => {
    const grouped: Record<string, ParsedFlight[]> = {};
    for (const f of flights) {
      const dest = f.legs[f.legs.length - 1]?.destination ?? "???";
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push(f);
    }
    return Object.entries(grouped).map(([dest, flts]) => {
      let earliestTime: Date | null = null;
      let latestTime: Date | null = null;
      for (const f of flts) {
        const h = parseHour(f.legs[0]?.departure_time ?? "");
        if (h !== null) {
          const d = new Date(); d.setHours(h, 0, 0, 0);
          if (!earliestTime || d < earliestTime) earliestTime = d;
          if (!latestTime || d > latestTime) latestTime = d;
        }
      }
      return {
        destination: dest,
        city: airportMap[dest]?.city ?? "",
        stateCode: airportMap[dest]?.stateCode ?? "",
        airportName: airportMap[dest]?.name ?? "",
        flights: flts,
        nonstopCount: flts.filter(f => f.legs.length === 1).length,
        goWildCount: flts.filter(f => f.fares.basic != null).length,
        earliestLabel: earliestTime ? earliestTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : null,
        latestLabel: latestTime ? latestTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : null,
      };
    }).sort((a, b) => a.city.localeCompare(b.city));
  }, [flights, airportMap]);

  const originCity = airportMap[departureAirport];

  if (loading) return (
    <div className="flex-1 flex items-center justify-center h-full">
      <p className="text-sm text-[#6B7B7B]">Loading…</p>
    </div>
  );

  if (error || !responseData) return (
    <div className="flex-1 flex items-center justify-center h-full px-6">
      <p className="text-sm text-red-500 text-center">{error ?? "No data"}</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Fixed back button */}
      <button
        onClick={onBack}
        className="absolute top-5 left-4 z-20 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white"
      >
        <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {groups.map((group, gIdx) => {
          const isOpen = expandedDest === group.destination;

          // Build timeline for expanded view
          const hourMap: Record<number, { flight: ParsedFlight; idx: number }[]> = {};
          group.flights.forEach((flight, idx) => {
            const h = parseHour(flight.legs[0]?.departure_time ?? "");
            if (h === null) return;
            if (!hourMap[h]) hourMap[h] = [];
            hourMap[h].push({ flight, idx });
          });
          const flightsByHour = Object.keys(hourMap).map(Number).sort((a, b) => a - b)
            .map(h => ({ hour: h, items: hourMap[h] }));

          const fmtHourLabel = (h: number) => {
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${h12}:00${h < 12 ? "AM" : "PM"}`;
          };

          return (
            <div
              key={group.destination}
              className="mb-4"
              style={{ animation: `cascade-down 0.4s cubic-bezier(0.22,1,0.36,1) ${gIdx * 80}ms both` }}
            >
              {/* Hero card */}
              <div className="relative overflow-hidden" style={{ minHeight: 260 }}>
                {/* City illustration background */}
                <div className="absolute inset-0">
                  <CityHeroBackground destination={group.destination} />
                </div>

                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

                {/* Hero text */}
                <div className="relative z-10 px-5 pt-16 pb-20">
                  <p className="text-white/80 text-sm font-medium mb-0.5">
                    {originCity ? `${originCity.city} to` : departureAirport ? `${departureAirport} to` : "Flights to"}
                  </p>
                  <h2 className="text-white leading-tight">
                    <span className="text-[28px] font-black">{group.destination}</span>
                    {(group.city || group.stateCode) && (
                      <>
                        <span className="text-[28px] font-black"> | </span>
                        <span className="text-[26px] font-light">
                          {group.city}{group.stateCode ? `, ${group.stateCode}` : ""}
                        </span>
                      </>
                    )}
                  </h2>
                  {group.airportName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
                      <HugeiconsIcon icon={Location01Icon} size={12} color="#2E4A4A" strokeWidth={1.5} />
                      <span className="text-[12px] text-[#2E4A4A] font-medium">{group.airportName}</span>
                    </div>
                  )}
                </div>

                {/* Stats pill floating at bottom of hero */}
                <div className="absolute bottom-0 left-4 right-4 translate-y-1/2 z-10">
                  <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between">
                    {[
                      { label: "Earliest", value: group.earliestLabel ?? "—" },
                      { label: "Latest", value: group.latestLabel ?? "—" },
                      { label: "Nonstop", value: group.nonstopCount },
                      { label: "GoWild", value: group.goWildCount },
                    ].map(({ label, value }, i) => (
                      <div key={label} className={cn("flex flex-col items-center flex-1", i > 0 && "border-l border-[#E8EBEB]")}>
                        <span className="text-[11px] text-[#6B7B7B] font-normal">{label}</span>
                        <span className="text-[15px] font-bold text-[#10B981] leading-tight mt-0.5">
                          {typeof value === "string" ? (() => {
                            const m = value.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
                            if (!m) return value;
                            return <><span>{m[1]}</span><span className="text-[10px] font-semibold ml-0.5">{m[2].toUpperCase()}</span></>;
                          })() : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Flight list */}
              <div className="mt-8 mx-4 bg-white rounded-2xl shadow-sm border border-[#E8EBEB] overflow-hidden">
                {/* Section header — tap to expand */}
                <button
                  onClick={() => { setExpandedDest(isOpen ? null : group.destination); setExpandedFlightKey(null); }}
                  className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#F2F3F3]"
                >
                  <span className="text-sm font-semibold text-[#2E4A4A]">
                    {group.flights.length} Flight{group.flights.length !== 1 ? "s" : ""}{departureDate ? ` · ${new Date(departureDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className={cn("w-4 h-4 text-[#9CA3AF] transition-transform duration-200", isOpen && "rotate-180")} />
                </button>

                {/* Collapsed: show first 3 flights preview */}
                {!isOpen && group.flights.slice(0, 3).map((flight, idx) => {
                  const cheapest = [flight.fares.basic, flight.fares.economy, flight.fares.premium, flight.fares.business]
                    .filter((v): v is number => v != null).sort((a, b) => a - b)[0];
                  const isGoWild = flight.fares.basic != null;
                  return (
                    <div key={idx} className={cn("flex items-center px-4 py-3 gap-3", idx > 0 && "border-t border-[#F2F3F3]")}>
                      <img src="/assets/logo/frontier/frontier_logo.png" alt="Frontier" className="w-7 h-7 rounded object-contain shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-[#2E4A4A]">
                          {formatTime(flight.legs[0]?.departure_time)} → {formatTime(flight.legs[flight.legs.length - 1]?.arrival_time)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[12px] text-[#6B7B7B]">{flight.total_duration}</span>
                          {flight.legs.length === 1 && <span className="text-[10px] font-semibold text-[#10B981] bg-[#10B981]/10 px-1.5 rounded-full">Nonstop</span>}
                        </div>
                      </div>
                      {cheapest != null && (
                        <span className={cn("text-sm font-bold px-3 py-1 rounded-full", isGoWild ? "bg-[#10B981] text-white" : "bg-[#F4F8F8] text-[#2E4A4A]")}>
                          ${cheapest}
                        </span>
                      )}
                    </div>
                  );
                })}
                {!isOpen && group.flights.length > 3 && (
                  <button onClick={() => setExpandedDest(group.destination)} className="w-full py-2.5 text-xs font-semibold text-[#10B981] border-t border-[#F2F3F3]">
                    +{group.flights.length - 3} more flights
                  </button>
                )}

                {/* Expanded: full timeline */}
                {isOpen && (
                  <div className="relative pt-3 pb-4">
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#C8D5D5]" />
                    <div className="flex flex-col items-center gap-0">
                      {flightsByHour.map(({ hour, items }) => (
                        <div key={hour} className="w-full">
                          {/* Hour marker */}
                          <div className="relative flex items-center justify-center w-full py-2">
                            <div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#A8BEBE] z-10" />
                            <div className="z-10 bg-white px-2 rounded">
                              <span className="text-[11px] font-semibold text-[#6B7B7B]">{fmtHourLabel(hour)}</span>
                            </div>
                          </div>
                          {/* Flights in this hour */}
                          {items.map(({ flight, idx }) => {
                            const fKey = `${group.destination}-${idx}`;
                            const isFlightOpen = expandedFlightKey === fKey;
                            const cheapest = [flight.fares.basic, flight.fares.economy, flight.fares.premium, flight.fares.business]
                              .filter((v): v is number => v != null).sort((a, b) => a - b)[0];
                            const isGoWild = flight.fares.basic != null;
                            return (
                              <div key={idx} className="relative flex justify-center w-full py-1.5 px-4"
                                style={{ animation: `cascade-down 0.4s cubic-bezier(0.22,1,0.36,1) ${idx * 60}ms both` }}>
                                <div className={cn(
                                  "w-full flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm",
                                  isGoWild ? "border-[#10B981]" : "border-[#E8EBEB]"
                                )}>
                                  <button
                                    onClick={() => setExpandedFlightKey(isFlightOpen ? null : fKey)}
                                    className="flex items-center px-3 py-3 gap-2.5 w-full text-left"
                                  >
                                    <img src="/assets/logo/frontier/frontier_logo.png" alt="Frontier" className="w-8 h-8 rounded object-contain shrink-0" />
                                    <div className="flex-1">
                                      <span className="text-sm font-bold text-[#2E4A4A]">
                                        {formatTime(flight.legs[0]?.departure_time)} → {formatTime(flight.legs[flight.legs.length - 1]?.arrival_time)}
                                      </span>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[12px] text-[#6B7B7B]">{flight.total_duration}</span>
                                        {flight.is_plus_one_day && <span className="text-[11px] font-semibold text-[#E89830]">+1 Day</span>}
                                        {flight.legs.length === 1 && <span className="text-[10px] font-semibold text-[#10B981] bg-[#10B981]/10 px-1.5 rounded-full">Nonstop</span>}
                                      </div>
                                    </div>
                                    {cheapest != null && (
                                      <span className={cn("text-sm font-bold px-2.5 py-1 rounded-full shrink-0", isGoWild ? "bg-[#10B981] text-white" : "bg-[#F4F8F8] text-[#2E4A4A]")}>
                                        ${cheapest}
                                      </span>
                                    )}
                                  </button>
                                  {isFlightOpen && (
                                    <div className="border-t border-[#E8EBEB]/60 px-3 py-3">
                                      <FlightLegTimeline legs={flight.legs} airportMap={airportMap} />
                                      <div className="flex items-center justify-end gap-2 pt-2">
                                        <span className="text-xs text-[#6B7B7B] border border-[#D1D5DB] px-3 py-1.5 rounded-full">Alert Me</span>
                                        {cheapest != null && (
                                          <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full", isGoWild ? "bg-[#10B981] text-white" : "bg-[#F4F8F8] text-[#2E4A4A] border border-[#D1D5DB]")}>
                                            ${cheapest} ›
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      {/* Trailing hour */}
                      {flightsByHour.length > 0 && (() => {
                        const lastH = flightsByHour[flightsByHour.length - 1].hour;
                        return (
                          <div className="relative flex items-center justify-center w-full py-2">
                            <div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#A8BEBE] z-10" />
                            <div className="z-10 bg-white px-2 rounded">
                              <span className="text-[11px] font-semibold text-[#6B7B7B]">{fmtHourLabel((lastH + 3) % 24)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlightResultsV3Screen;
