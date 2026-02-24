import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlane,
  faLocationDot,
  faTreeCity,
  faPlaneDeparture,
  faPlaneArrival,
  faCalendarDays,
  faArrowRight,
  faRepeat,
  faSun,
  faRoute,
  faXmark,
  faCirclePlus,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { normalizeSingleRouteResponse, normalizeAllDestinationsResponse } from "@/utils/normalizeFlights";

/** SHA-256 hex hash (Web Crypto) */
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 12:01 AM on the departure date in UTC – the GoWild reset boundary */
function resetBucket(departureDateStr: string): string {
  const [y, m, d] = departureDateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 1, 0)).toISOString();
}

const ACTIVE_TRIP_FLEX = 1.7;

type TripType = "one-way" | "round-trip" | "day-trip" | "multi-day";

const tripOptions: { value: TripType; label: string; icon: any }[] = [
  { value: "one-way", label: "One Way", icon: faArrowRight },
  { value: "round-trip", label: "Round Trip", icon: faRepeat },
  { value: "day-trip", label: "Day Trip", icon: faSun },
  { value: "multi-day", label: "Multi Day", icon: faRoute },
];

interface Airport {
  id: number;
  name: string;
  iata_code: string;
  locations?: {
    city: string;
    state_code: string;
    region: string;
  };
}

/* ── Multi-select Airport Searchbox ───────────────────────── */
const MultiAirportSearchbox = ({
  label,
  icon,
  selected,
  onChange,
  airports,
  containerClassName,
  disabled = false,
  placeholder = "Search airport or city...",
}: {
  label: string;
  icon: any;
  selected: Airport[];
  onChange: (a: Airport[]) => void;
  airports: Airport[];
  containerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shouldShow = query.trim().length > 2;
  const selectedIds = new Set(selected.map((a) => a.id));

  const groupedAirports = useMemo(() => {
    if (!shouldShow || disabled) return {};
    const q = query.toLowerCase();

    const filteredList = airports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q) ||
          (a.locations?.city && a.locations.city.toLowerCase().includes(q)),
      )
      .slice(0, 30);

    return filteredList.reduce(
      (acc, airport) => {
        const city = airport.locations?.city;
        const state = airport.locations?.state_code;
        const groupKey = city && state ? `${city}, ${state}` : "Other Locations";
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(airport);
        return acc;
      },
      {} as Record<string, Airport[]>,
    );
  }, [query, airports, shouldShow, disabled]);

  const addAirport = (a: Airport) => {
    if (!selectedIds.has(a.id)) {
      onChange([...selected, a]);
    }
    setQuery("");
    inputRef.current?.focus();
  };

  const addAreaAirports = (areaAirports: Airport[]) => {
    const newOnes = areaAirports.filter((a) => !selectedIds.has(a.id));
    if (newOnes.length > 0) {
      onChange([...selected, ...newOnes]);
    }
    setQuery("");
    inputRef.current?.focus();
  };

  const removeAirport = (id: number) => {
    onChange(selected.filter((a) => a.id !== id));
  };

  const showClear = selected.length > 0 && !disabled;

  return (
    <div className={cn("relative", containerClassName, disabled && "opacity-70")}>
      <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">{label}</label>

      <div
        className={cn(
          "flex items-center gap-1.5 h-10 bg-transparent transition-colors overflow-hidden",
          disabled ? "cursor-not-allowed" : "cursor-text",
        )}
      >
        <FontAwesomeIcon icon={icon} className="w-4 h-4 text-[#345C5A] shrink-0 mr-2" />

        <div
          className="flex-1 flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar py-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onClick={() => {
            if (disabled) return;
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          {selected.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 bg-[#E8F1F1] border border-[#D6DEDF] text-[#2E4A4A] text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full shadow-sm whitespace-nowrap shrink-0"
            >
              {a.iata_code} – {a.locations?.city}, {a.locations?.state_code}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAirport(a.id);
                }}
                className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors leading-none ml-0.5"
              >
                <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {selected.length > 0 && !query && !disabled && (
            <FontAwesomeIcon icon={faCirclePlus} className="w-3 h-3 text-[#9CA3AF] ml-0.5 shrink-0" />
          )}

          <input
            ref={inputRef}
            type="text"
            placeholder={selected.length > 0 || disabled ? "" : placeholder}
            disabled={disabled}
            value={query}
            onChange={(e) => {
              if (disabled) return;
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              if (disabled) return;
              setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className={cn(
              "flex-1 min-w-[100px] h-full bg-transparent outline-none text-[#2E4A4A] text-sm placeholder:text-[#9CA3AF] truncate",
              disabled && "cursor-not-allowed",
            )}
          />
        </div>

        {showClear && !open && (
          <button
            type="button"
            aria-label={`Clear all ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
              setQuery("");
              setOpen(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors"
          >
            <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && !disabled && shouldShow && Object.keys(groupedAirports).length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-[#E3E6E6] max-h-64 overflow-y-auto z-50 py-2">
          {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => (
            <div key={cityGroup} className="mb-2 last:mb-0">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addAreaAirports(cityAirports)}
                className="w-full px-4 py-1.5 text-xs font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2 hover:bg-[#F2F3F3] transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faTreeCity} className="w-3 h-3 opacity-60" />
                {cityGroup !== "Other Locations" ? `${cityGroup} Area` : cityGroup}
              </button>

              {cityAirports.map((a) => {
                const isSelected = selectedIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (isSelected) removeAirport(a.id);
                      else addAirport(a);
                    }}
                    className={cn(
                      "w-full text-left pr-4 pl-11 py-2 text-sm hover:bg-[#F2F3F3] transition-colors flex flex-col gap-0.5 overflow-hidden",
                      isSelected && "bg-[#345C5A]/5",
                    )}
                  >
                    <div className="flex items-center text-[#2E4A4A] w-full min-w-0">
                      <FontAwesomeIcon icon={faLocationDot} className="w-3 h-3 mr-2 text-[#9CA3AF] shrink-0" />
                      <span className="font-semibold text-[#345C5A] shrink-0">{a.iata_code}</span>
                      <span className="ml-2 truncate">{a.name}</span>
                      {isSelected && <span className="ml-auto text-[#345C5A] text-xs font-semibold shrink-0">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Flights Page ──────────────────────────────────────────── */
const FlightsPage = ({ onNavigate }: { onNavigate: (page: string, data?: string) => void }) => {
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [airports, setAirports] = useState<Airport[]>([]);

  // Both Departure and Arrivals now use an array state
  const [departures, setDepartures] = useState<Airport[]>([]);
  const [arrivals, setArrivals] = useState<Airport[]>([]);

  const [departureDate, setDepartureDate] = useState<Date>();
  const [arrivalDate, setArrivalDate] = useState<Date>();
  const [depDateOpen, setDepDateOpen] = useState(false);
  const [retDateOpen, setRetDateOpen] = useState(false);

  const [searchAll, setSearchAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const showReturnDate = tripType === "round-trip" || tripType === "multi-day";

  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    const loadAirports = async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code, locations(city, state_code, region)")
        .order("name");
      if (data) setAirports(data as unknown as Airport[]);
    };

    loadAirports();
  }, []);

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F2F3F3]">
          <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-[#345C5A]/20 animate-ping" />
            <div
              className="absolute inset-2 rounded-full border-4 border-[#345C5A]/30 animate-ping"
              style={{ animationDelay: "0.3s" }}
            />
            <div
              className="absolute inset-4 rounded-full border-4 border-[#345C5A]/40 animate-ping"
              style={{ animationDelay: "0.6s" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <FontAwesomeIcon icon={faPlane} className="w-10 h-10 text-[#345C5A] animate-bounce" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#2E4A4A] tracking-tight mb-2">Searching Flights</p>
          <p className="text-sm text-[#6B7B7B]">This may take a moment…</p>
        </div>
      )}

      <div className="px-6 pt-0 pb-3 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-0 tracking-tight">Flights</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Find and track your upcoming flights.</p>
      </div>

      <div className="px-6 pb-8 relative z-10 flex flex-col gap-5 animate-fade-in">
        {/* Trip Type Switch */}
        <div className="bg-white rounded-2xl p-1.5 flex shadow-sm border border-[#E3E6E6] relative">
          <div
            className="absolute top-1.5 bottom-1.5 rounded-xl bg-[#345C5A] shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-all duration-300 ease-in-out"
            style={{
              width: `calc(((100% - 12px) * ${ACTIVE_TRIP_FLEX} / ${tripOptions.length - 1 + ACTIVE_TRIP_FLEX}) - 8px)`,
              left: `calc(10px + (100% - 12px) * ${tripOptions.findIndex((o) => o.value === tripType)} / ${
                tripOptions.length - 1 + ACTIVE_TRIP_FLEX
              })`,
            }}
          />
          {tripOptions.map((opt) => {
            const isActive = tripType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTripType(opt.value)}
                style={{ flex: isActive ? ACTIVE_TRIP_FLEX : 1 }}
                className={cn(
                  "py-2.5 px-3 text-xs font-semibold rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                  isActive ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
                )}
              >
                <FontAwesomeIcon icon={opt.icon} className="w-4 h-4 shrink-0 transition-transform duration-300" />
                {isActive && <span className="animate-fade-in whitespace-nowrap">{opt.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Airport + Dates Group */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-visible">
          <div className="relative">
            {/* Departure now uses MultiAirportSearchbox */}
            <MultiAirportSearchbox
              label="Departure"
              icon={faPlaneDeparture}
              selected={departures}
              onChange={setDepartures}
              airports={airports}
              containerClassName="px-3 pt-3 pb-2"
            />

            <div className="h-px bg-[#E3E6E6] mx-3" />

            <MultiAirportSearchbox
              label="Arrival"
              icon={faPlaneArrival}
              selected={arrivals}
              onChange={setArrivals}
              airports={airports}
              disabled={searchAll}
              placeholder={searchAll ? "Searching all destinations" : "Search airport or city..."}
              containerClassName="px-3 pt-2 pb-2"
            />

            <div className="h-px bg-[#E3E6E6] mx-3" />
          </div>

          {/* Dates */}
          <div className="px-3 pt-2 pb-3">
            <div className={cn("grid gap-2", showReturnDate ? "grid-cols-2" : "grid-cols-1")}>
              <div>
                <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block cursor-pointer">Departure Date</label>

                <Popover open={depDateOpen} onOpenChange={setDepDateOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" className="w-full flex items-center gap-2.5 text-left outline-none h-10">
                      <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-[#345C5A] shrink-0" />
                      <span className={cn("text-sm", departureDate ? "text-[#2E4A4A]" : "text-[#9CA3AF]")}>
                        {departureDate ? format(departureDate, "MMM d, yyyy") : "Select date"}
                      </span>
                    </button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={departureDate}
                      onSelect={(date) => {
                        setDepartureDate(date);
                        setDepDateOpen(false);
                        if (arrivalDate && date && startOfDay(arrivalDate) < startOfDay(date))
                          setArrivalDate(undefined);
                      }}
                      disabled={(date) => date < today}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {showReturnDate && (
                <div>
                  <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block cursor-pointer">Return Date</label>

                  <Popover open={retDateOpen} onOpenChange={setRetDateOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="w-full flex items-center gap-2.5 text-left outline-none h-10">
                        <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-[#345C5A] shrink-0" />
                        <span className={cn("text-sm", arrivalDate ? "text-[#2E4A4A]" : "text-[#9CA3AF]")}>
                          {arrivalDate ? format(arrivalDate, "MMM d, yyyy") : "Select date"}
                        </span>
                      </button>
                    </PopoverTrigger>

                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={arrivalDate}
                        onSelect={(date) => {
                          setArrivalDate(date);
                          setRetDateOpen(false);
                        }}
                        disabled={(date) => date < startOfDay(departureDate ?? today)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search All Destinations */}
        <div className="flex items-center justify-end gap-2 -mt-1">
          <label htmlFor="search-all" className="text-xs font-semibold text-[#6B7B7B] cursor-pointer select-none">
            Search All Destinations
          </label>

          <button
            id="search-all"
            type="button"
            role="switch"
            aria-checked={searchAll}
            onClick={() =>
              setSearchAll((prev) => {
                const next = !prev;
                if (next) setArrivals([]);
                return next;
              })
            }
            className={cn(
              "relative inline-flex items-center h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
              searchAll ? "bg-[#345C5A]" : "bg-[#E3E6E6]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                searchAll ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {/* Search Button */}
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (departures.length === 0 || !departureDate) return;

            const originCode = departures[0].iata_code;
            const depFormatted = format(departureDate, "yyyy-MM-dd");
            const destinationCode = arrivals.length > 0 ? arrivals[0].iata_code : "__ALL__";

            const canonicalRequest = {
              origin: originCode,
              destination: searchAll ? "__ALL__" : destinationCode,
              departureDate: depFormatted,
              returnDate: arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null,
              tripType,
              searchAll,
            };
            const cacheKey = await sha256(JSON.stringify(canonicalRequest));
            const bucket = resetBucket(depFormatted);

            setLoading(true);
            try {
              // ── Check cache first ──
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);

              const arrIata = searchAll ? "__ALL__" : destinationCode;
              const { data: cached } = await (supabase.from("flight_search_cache") as any)
                .select("payload")
                .eq("dep_iata", originCode)
                .eq("arr_iata", arrIata)
                .eq("status", "ready")
                .gte("created_at", todayStart.toISOString())
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (cached?.payload) {
                const payload = JSON.stringify(
                  {
                    response: cached.payload,
                    departureDate: depFormatted,
                    arrivalDate: arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null,
                    tripType: tripType === "round-trip" ? "Round Trip" : "One Way",
                    departureAirport: originCode,
                    arrivalAirport: searchAll ? "All" : destinationCode,
                    fromCache: true,
                  },
                  null,
                  2,
                );
                onNavigate("flight-results", payload);
                return;
              }

              // ── No cache hit – call API ──
              let data, error;

              if (searchAll) {
                const requestBody = { departureAirport: originCode, departureDate: depFormatted };
                ({ data, error } = await supabase.functions.invoke("getAllDestinations", {
                  body: requestBody,
                }));
              } else {
                let targetUrl: string;
                let functionName: string;

                if (tripType === "round-trip" && arrivalDate) {
                  const retFormatted = format(arrivalDate, "yyyy-MM-dd");
                  targetUrl = `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${originCode}&d1=${destinationCode}&dd1=${encodeURIComponent(
                    depFormatted + " 00:00:00",
                  )}&dd2=${encodeURIComponent(retFormatted + " 00:00:00")}&r=true&adt=1&umnr=false&loy=false&mon=true&ftype=GW`;
                  functionName = "getRoundTripRoute";
                } else {
                  targetUrl = `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${originCode}&d1=${destinationCode}&dd1=${encodeURIComponent(
                    depFormatted + " 00:00:00",
                  )}&adt=1&umnr=false&loy=false&mon=true&ftype=GW`;
                  functionName = "getSingleRoute";
                }

                const requestBody = { targetUrl, origin: originCode, destination: destinationCode };
                ({ data, error } = await supabase.functions.invoke(functionName, {
                  body: requestBody,
                }));
              }

              if (error) {
                console.error("Edge function error:", error);
              } else {
                const normalized = searchAll
                  ? normalizeAllDestinationsResponse(data)
                  : normalizeSingleRouteResponse(data);

                // ── Write to cache ──
                try {
                  await (supabase.from("flight_search_cache") as any).upsert(
                    {
                      cache_key: cacheKey,
                      reset_bucket: bucket,
                      canonical_request: canonicalRequest,
                      provider: "frontier",
                      status: "ready",
                      payload: normalized,
                      dep_iata: originCode,
                      arr_iata: searchAll ? "__ALL__" : destinationCode,
                    },
                    { onConflict: "cache_key,reset_bucket" },
                  );
                } catch (cacheErr) {
                  console.warn("Cache write failed (non-blocking):", cacheErr);
                }

                const payload = JSON.stringify(
                  {
                    firecrawlRequestBody: data?._firecrawlRequestBody ?? null,
                    response: normalized,
                    departureDate: depFormatted,
                    arrivalDate: arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null,
                    tripType: tripType === "round-trip" ? "Round Trip" : "One Way",
                    departureAirport: originCode,
                    arrivalAirport: searchAll ? "All" : destinationCode,
                    fromCache: false,
                  },
                  null,
                  2,
                );
                onNavigate("flight-results", payload);
              }
            } catch (err) {
              console.error("Failed to invoke edge function:", err);
            } finally {
              setLoading(false);
            }
          }}
          className="w-full py-4 bg-[#345C5A] text-white font-semibold text-base rounded-2xl shadow-sm hover:bg-[#2E4A4A] active:scale-[0.98] transition-all mt-2 disabled:opacity-60"
        >
          {loading ? "Searching..." : "Search Flights"}
        </button>
      </div>
    </>
  );
};

export default FlightsPage;
