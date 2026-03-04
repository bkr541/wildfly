import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faBars, faPlane } from "@fortawesome/free-solid-svg-icons";

const CACHE_ID = "29a414b6-1a64-48c2-906e-1353b7553322";

interface ParsedFlight {
  total_duration: string;
  is_plus_one_day: boolean;
  fares: { basic: number | null; economy: number | null; premium: number | null; business: number | null };
  legs: { origin: string; destination: string; departure_time: string; arrival_time: string }[];
}

interface Props { onBack: () => void }

function formatTime(raw: string): { time: string; ampm: string } {
  try {
    const d = new Date(raw);
    const str = isNaN(d.getTime())
      ? raw
      : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const m = str.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
    if (m) return { time: m[1], ampm: m[2].toUpperCase() };
    return { time: str, ampm: "" };
  } catch {
    return { time: raw, ampm: "" };
  }
}

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      .replace(",", "");
  } catch { return raw; }
}

function getDateFromResponse(responseData: string, isArrival = false): string {
  try {
    const p = JSON.parse(responseData);
    return isArrival ? (p.arrivalDate ?? p.departureDate ?? "") : (p.departureDate ?? "");
  } catch { return ""; }
}

const FlightResultsV2Screen = ({ onBack }: Props) => {
  const [responseData, setResponseData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [airportMap, setAirportMap] = useState<Record<string, { city: string; stateCode: string }>>({});
  const [activeFilter, setActiveFilter] = useState("Recommended");

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
        const synthesized = {
          response: payload,
          departureDate: canonical?.departureDate ?? null,
          arrivalDate: canonical?.arrivalDate ?? null,
          tripType: canonical?.tripType ?? "One Way",
          departureAirport: canonical?.origin ?? canonical?.dep_iata ?? "",
          arrivalAirport: canonical?.destination ?? canonical?.arr_iata ?? "",
          fromCache: true,
        };
        setResponseData(JSON.stringify(synthesized));
      }
      setLoading(false);
    };
    load();
  }, []);

  const { flights, departureAirport, arrivalAirport, departureDate, tripType } = useMemo(() => {
    if (!responseData) return { flights: [] as ParsedFlight[], departureAirport: "", arrivalAirport: "", departureDate: null, tripType: "One Way" };
    try {
      const p = JSON.parse(responseData);
      return {
        flights: (p.response?.flights ?? []) as ParsedFlight[],
        departureAirport: p.departureAirport ?? "",
        arrivalAirport: p.arrivalAirport ?? "",
        departureDate: p.departureDate ?? null,
        tripType: p.tripType ?? "One Way",
      };
    } catch {
      return { flights: [] as ParsedFlight[], departureAirport: "", arrivalAirport: "", departureDate: null, tripType: "One Way" };
    }
  }, [responseData]);

  // Fetch airport city/state info
  useEffect(() => {
    const codes = Array.from(new Set(
      flights.flatMap(f => f.legs.flatMap(l => [l.origin, l.destination]))
    )).filter(Boolean);
    if (!codes.length) return;
    supabase
      .from("airports")
      .select("iata_code, locations(city, state_code)")
      .in("iata_code", codes)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { city: string; stateCode: string }> = {};
        for (const a of data as any[]) {
          map[a.iata_code] = { city: a.locations?.city ?? "", stateCode: a.locations?.state_code ?? "" };
        }
        setAirportMap(map);
      });
  }, [flights]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center h-full bg-[#2E5C58]">
      <p className="text-sm text-white/60">Loading…</p>
    </div>
  );

  if (error || !responseData) return (
    <div className="flex-1 flex items-center justify-center h-full bg-[#2E5C58] px-6">
      <p className="text-sm text-red-300 text-center">{error ?? "No data"}</p>
    </div>
  );

  const originCity = airportMap[departureAirport];
  const destCity = arrivalAirport ? airportMap[arrivalAirport] : null;
  const depDate = departureDate ? getDateFromResponse(responseData) : null;

  const filters = ["$100–$800", "Recommended", "Best Seller", tripType];

  return (
    <div className="flex flex-col min-h-screen bg-[#2E5C58] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-5 pb-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
        </button>
        <span className="text-white font-semibold text-base tracking-wide">Flight Results</span>
        <button className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
          <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
        </button>
      </header>

      {/* Route display */}
      <div className="flex items-end justify-between px-6 pb-4">
        <div className="flex flex-col">
          <span className="text-[48px] font-black text-white leading-none">{departureAirport || "—"}</span>
          <span className="text-white/70 text-sm font-normal mt-0.5">
            {originCity ? `${originCity.city}, ${originCity.stateCode}` : ""}
          </span>
        </div>
        {/* Arrow */}
        <div className="flex flex-col items-center pb-3">
          <div className="flex items-center gap-1 text-white/60">
            <div className="w-3 h-px bg-white/40" />
            <FontAwesomeIcon icon={faPlane} className="w-5 h-5 text-white/80" />
            <div className="w-8 border-t border-dashed border-white/40" />
            <span className="text-white/80 text-lg">→</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[48px] font-black text-white leading-none">{arrivalAirport || "ALL"}</span>
          <span className="text-white/70 text-sm font-normal mt-0.5 text-right">
            {destCity ? `${destCity.city}, ${destCity.stateCode}` : ""}
          </span>
        </div>
      </div>

      {/* Result count */}
      <div className="text-center text-white/60 text-xs mb-3">
        {flights.length} Results Found
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeFilter === f
                ? "bg-[#4A8C7A] border-[#4A8C7A] text-white"
                : "bg-transparent border-white/30 text-white/70"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Flight cards list */}
      <div
        className="flex-1 rounded-t-3xl bg-[#E8EDE8] px-4 pt-5 pb-8 flex flex-col gap-3 overflow-y-auto"
      >
        {flights.map((flight, idx) => {
          const depLeg = flight.legs[0];
          const arrLeg = flight.legs[flight.legs.length - 1];
          const dep = formatTime(depLeg?.departure_time ?? "");
          const arr = formatTime(arrLeg?.arrival_time ?? "");
          const depCityInfo = airportMap[depLeg?.origin ?? ""];
          const arrCityInfo = airportMap[arrLeg?.destination ?? ""];
          const depDateStr = depDate ? formatDate(depDate + "T12:00:00") : "";
          const cheapest = [flight.fares.basic, flight.fares.economy, flight.fares.premium, flight.fares.business]
            .filter((v): v is number => v != null)
            .sort((a, b) => a - b)[0];
          const isGoWild = flight.fares.basic != null;

          return (
            <div
              key={idx}
              className="bg-[#F5F0E8] rounded-2xl overflow-hidden shadow-sm"
              style={{
                animation: `cascade-down 0.4s cubic-bezier(0.22,1,0.36,1) ${idx * 60}ms both`,
                // ticket cut-outs on sides
                position: "relative",
              }}
            >
              {/* Ticket notch left */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-[#E8EDE8] rounded-r-full z-10" />
              {/* Ticket notch right */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-[#E8EDE8] rounded-l-full z-10" />

              <div className="px-5 pt-4 pb-4">
                {/* Airline */}
                <div className="flex items-center gap-2 mb-3">
                  <img
                    src="/assets/logo/frontier/frontier_logo.png"
                    alt="Frontier"
                    className="w-6 h-6 rounded object-contain"
                  />
                  <span className="text-[#2E4A4A] font-black text-sm tracking-wide">
                    <span className="italic">FRONTIER</span>
                    <span className="font-normal ml-1">Airlines</span>
                  </span>
                </div>

                {/* Cities */}
                <div className="flex justify-between mb-1">
                  <span className="text-[#2E4A4A]/80 text-sm">
                    {depCityInfo?.city || depLeg?.origin}
                  </span>
                  <span className="text-[#2E4A4A]/80 text-sm text-right">
                    {arrCityInfo?.city || arrLeg?.destination}
                  </span>
                </div>

                {/* Times row */}
                <div className="flex items-center justify-between">
                  {/* Departure time */}
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[28px] font-black leading-none" style={{ color: "#D4A017" }}>
                      {dep.time}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "#D4A017" }}>{dep.ampm}</span>
                  </div>

                  {/* Flight path */}
                  <div className="flex-1 flex flex-col items-center mx-3">
                    <div className="flex items-center w-full gap-1">
                      <div className="w-2 h-2 rounded-full border-2 flex-shrink-0" style={{ borderColor: "#D4A017" }} />
                      <div className="flex-1 border-t-2 border-dashed border-[#2E4A4A]/30" />
                      <FontAwesomeIcon icon={faPlane} className="text-[#2E4A4A] w-3.5 h-3.5 flex-shrink-0" />
                      <div className="flex-1 border-t-2 border-dashed border-[#2E4A4A]/30" />
                      <div className="w-2 h-2 rounded-full border-2 flex-shrink-0" style={{ borderColor: "#2E5C58" }} />
                    </div>
                    <span className="text-[#2E5C58] text-xs font-semibold mt-1">{flight.total_duration}</span>
                  </div>

                  {/* Arrival time */}
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[28px] font-black leading-none text-[#2E5C58]">{arr.time}</span>
                    <span className="text-sm font-bold text-[#2E5C58]">{arr.ampm}</span>
                  </div>
                </div>

                {/* Dates row */}
                <div className="flex justify-between mt-1">
                  <span className="text-[#2E4A4A]/50 text-[11px]">{depDateStr}</span>
                  <span className="text-[#2E4A4A]/50 text-[11px] text-right">{depDateStr}</span>
                </div>

                {/* GoWild / price badge */}
                {cheapest != null && (
                  <div className="flex justify-end mt-3">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        isGoWild
                          ? "bg-[#2E5C58] text-white"
                          : "bg-[#2E4A4A]/10 text-[#2E4A4A]"
                      }`}
                    >
                      {isGoWild ? "GoWild · " : ""}${cheapest}
                    </span>
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

export default FlightResultsV2Screen;
