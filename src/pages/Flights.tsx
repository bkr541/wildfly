import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getLogger } from "@/lib/logger";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  AirplaneLanding01Icon,
  Location01Icon,
  Building04Icon,
  CalendarCheckOut02Icon,
  CalendarCheckIn02Icon,
  ArrowRight04Icon,
  CircleArrowReload01Icon,
  SunCloud01Icon,
  MapPinpoint01Icon,
  GlobalSearchIcon,
  Cancel01Icon,
  AddCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { normalizeGetMyDataResponse, normalizeAllDestinationsResponse } from "@/utils/normalizeFlights";

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

const flightLog = getLogger("FlightsPage");
const cacheLog = getLogger("Cache");
const edgeLog = getLogger("EdgeFunctions");

const ACTIVE_TRIP_FLEX = 1.7;

type TripType = "one-way" | "round-trip" | "day-trip" | "multi-day";

const tripOptions: { value: TripType; label: string; icon: any }[] = [
  { value: "one-way", label: "One Way", icon: ArrowRight04Icon },
  { value: "round-trip", label: "Round Trip", icon: CircleArrowReload01Icon },
  { value: "day-trip", label: "Day Trip", icon: SunCloud01Icon },
  { value: "multi-day", label: "Multi Day", icon: MapPinpoint01Icon },
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
  const [isFocused, setIsFocused] = useState(false);
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

    const grouped = filteredList.reduce(
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
    // Only keep group headers for cities with multiple airports
    return Object.fromEntries(
      Object.entries(grouped).map(([key, airports]) => [airports.length > 1 ? key : `__single__${key}`, airports]),
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

  // Display text: "IATA | City" for the first selected airport (single-select display)
  const displayValue =
    selected.length > 0 && !query
      ? `${selected[0].iata_code} | ${selected[0].locations?.city ?? selected[0].name}`
      : query;

  return (
    <div className={cn("relative", containerClassName)}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#059669] ml-1 mb-1 block">{label}</label>

      <div
        className={cn("app-input-container", disabled ? "cursor-not-allowed opacity-70" : "cursor-text")}
        style={{ minHeight: 44 }}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        <button type="button" tabIndex={-1} className="app-input-icon-btn">
          <HugeiconsIcon icon={icon} size={20} color="currentColor" strokeWidth={2} />
        </button>

        <input
          ref={inputRef}
          type="text"
          placeholder={disabled ? "" : placeholder}
          disabled={disabled}
          value={displayValue}
          onChange={(e) => {
            if (disabled) return;
            if (selected.length > 0) onChange([]);
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            if (selected.length > 0) {
              setQuery(`${selected[0].iata_code} | ${selected[0].locations?.city ?? ""}`);
            }
            setOpen(true);
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setOpen(false), 200);
            if (selected.length === 0) setQuery("");
          }}
          className={cn("app-input font-semibold truncate", disabled && "cursor-not-allowed")}
          style={{ fontSize: 16 }}
        />

        {showClear && (
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
            className="app-input-reset app-input-reset--visible"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
          </button>
        )}
      </div>

      {open && !disabled && shouldShow && Object.keys(groupedAirports).length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-[#E3E6E6] max-h-64 overflow-y-auto z-50 py-2">
          {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => {
            const isSingle = cityGroup.startsWith("__single__");
            const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
            return (
              <div key={cityGroup} className="mb-2 last:mb-0">
                {!isSingle && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addAreaAirports(cityAirports)}
                    className="w-full px-4 py-1.5 text-xs font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2 hover:bg-[#F2F3F3] transition-colors cursor-pointer"
                  >
                    <HugeiconsIcon
                      icon={Building04Icon}
                      size={12}
                      color="currentColor"
                      strokeWidth={2}
                      className="opacity-60"
                    />
                    {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                  </button>
                )}

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
                        "w-full text-left pr-4 py-2 text-sm hover:bg-[#F2F3F3] transition-colors flex flex-col gap-0.5 overflow-hidden",
                        isSingle ? "pl-4" : "pl-11",
                        isSelected && "bg-[#345C5A]/5",
                      )}
                    >
                      <div className="flex items-center text-[#2E4A4A] w-full min-w-0">
                        <HugeiconsIcon
                          icon={Location01Icon}
                          size={12}
                          color="#9CA3AF"
                          strokeWidth={2}
                          className="mr-2 shrink-0"
                        />
                        <span className="font-semibold text-[#345C5A] shrink-0">{a.iata_code}</span>
                        <span className="ml-2 truncate">{a.name}</span>
                        {isSelected && <span className="ml-auto text-[#345C5A] text-xs font-semibold shrink-0">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Flights Page ──────────────────────────────────────────── */
/* ── Departure-board searching overlay ───────────────────── */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "; // Used for the header
const WORD_GAP = 14; // px gap between words

function SplitFlapWord({ word, green, delay = 0 }: { word: string; green?: boolean; delay?: number }) {
  const [display, setDisplay] = useState<string[]>(Array(word.length).fill(" "));
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const allTimeouts: ReturnType<typeof setTimeout>[] = [];
    const allIntervals: ReturnType<typeof setInterval>[] = [];

    const runCycle = (cycleDelay: number) => {
      word.split("").forEach((finalChar, idx) => {
        const to = setTimeout(
          () => {
            if (!activeRef.current) return;
            let step = 0;
            const steps = 6;
            const iv = setInterval(() => {
              if (!activeRef.current) {
                clearInterval(iv);
                return;
              }
              step++;
              if (step >= steps) {
                clearInterval(iv);
                setDisplay((prev) => {
                  const n = [...prev];
                  n[idx] = finalChar;
                  return n;
                });
              } else {
                const r = CHARS[Math.floor(Math.random() * CHARS.length)];
                setDisplay((prev) => {
                  const n = [...prev];
                  n[idx] = r;
                  return n;
                });
              }
            }, 40);
            allIntervals.push(iv);
          },
          cycleDelay + delay + idx * 55,
        );
        allTimeouts.push(to);
      });
    };

    // Loop: each cycle takes ~word.length*55 + 400ms pause before repeating
    const cycleLength = word.length * 55 + 600;
    let cycle = 0;
    const schedule = () => {
      if (!activeRef.current) return;
      runCycle(cycle * cycleLength);
      const loopTo = setTimeout(schedule, cycleLength);
      allTimeouts.push(loopTo);
      cycle++;
    };
    schedule();

    return () => {
      activeRef.current = false;
      allTimeouts.forEach(clearTimeout);
      allIntervals.forEach(clearInterval);
    };
  }, []);

  return (
    <div className="flex gap-1">
      {display.map((char, i) => (
        <div
          key={i}
          className="relative flex flex-col items-center justify-center rounded-lg shadow-md border overflow-hidden"
          style={{
            width: 28,
            height: 36,
            background: green ? "linear-gradient(160deg,#6ee7b7 0%,#10B981 100%)" : "#e8eaed",
            borderColor: green ? "#059669" : "#d1d5db",
          }}
        >
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
            style={{ background: green ? "#059669aa" : "#b0b5bdaa" }}
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
            style={{ background: green ? "#d1fae5" : "#e8eaed", borderColor: green ? "#059669" : "#d1d5db" }}
          />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
            style={{ background: green ? "#d1fae5" : "#e8eaed", borderColor: green ? "#059669" : "#d1d5db" }}
          />
          <span
            className="font-black text-base leading-none select-none"
            style={{ color: green ? "#fff" : "#1f2937", letterSpacing: "0.04em" }}
          >
            {char === " " ? "" : char}
          </span>
        </div>
      ))}
    </div>
  );
}

function SearchingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F2F3F3] gap-5">
      <SplitFlapWord word="SEARCHING" delay={0} />
      <SplitFlapWord word="FLIGHTS" green delay={100} />
      <p className="text-sm text-[#6B7B7B] mt-2">This may take a moment…</p>
    </div>
  );
}

const FlightsPage = ({
  onNavigate,
  quickSearchData,
}: {
  onNavigate: (page: string, data?: string) => void;
  quickSearchData?: string | null;
}) => {
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [airports, setAirports] = useState<Airport[]>([]);

  // Both Departure and Arrivals now use an array state
  const [departures, setDepartures] = useState<Airport[]>([]);
  const [arrivals, setArrivals] = useState<Airport[]>([]);
  const [defaultHomeApplied, setDefaultHomeApplied] = useState(false);

  const [departureDate, setDepartureDate] = useState<Date>();
  const [arrivalDate, setArrivalDate] = useState<Date>();
  const [depDateOpen, setDepDateOpen] = useState(false);
  const [retDateOpen, setRetDateOpen] = useState(false);

  const [searchAll, setSearchAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creditError, setCreditError] = useState<{
    cost: number;
    remaining_monthly: number;
    purchased_balance: number;
  } | null>(null);
  const showReturnDate = tripType === "round-trip" || tripType === "multi-day";

  const today = useMemo(() => startOfDay(new Date()), []);
  const { settings: userSettings } = useUserSettings();

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

  // Auto-fill home airport when default_departure_to_home is on
  useEffect(() => {
    if (defaultHomeApplied || departures.length > 0) return;
    if (!userSettings.default_departure_to_home) return;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: info } = await supabase
        .from("user_info")
        .select("home_location_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!info?.home_location_id) return;
      const { data: ap } = await supabase
        .from("airports")
        .select("id, name, iata_code, locations(city, state_code, region)")
        .eq("location_id", info.home_location_id)
        .limit(1)
        .maybeSingle();
      if (ap) {
        setDepartures([ap as unknown as Airport]);
        setDefaultHomeApplied(true);
      }
    })();
  }, [userSettings.default_departure_to_home, defaultHomeApplied, departures.length]);

  // Auto-fill and trigger search from quickSearchData (passed from Home's Quick Search cards)
  const quickSearchApplied = useRef(false);
  const searchBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (quickSearchApplied.current) return;
    if (!quickSearchData) return;
    if (airports.length === 0) return; // wait for airports to load

    try {
      const parsed = JSON.parse(quickSearchData);
      if (!parsed?.quickSearch || !parsed.origin || !parsed.date) return;

      const originCode: string = parsed.origin; // could be 'CITY:Chicago' or 'ORD'
      const depDate = new Date(parsed.date + "T12:00:00");

      // Find matching airport(s)
      let matchedAirports: Airport[] = [];
      if (originCode.startsWith("CITY:")) {
        // Multi-airport city: match by city name
        const cityName = originCode.slice(5).toLowerCase();
        matchedAirports = airports.filter(
          (a) => a.locations?.city?.toLowerCase() === cityName,
        );
      } else if (originCode.length === 3) {
        const found = airports.find((a) => a.iata_code === originCode);
        if (found) matchedAirports = [found];
      } else {
        // Fallback: match by city name
        const cityLower = originCode.toLowerCase();
        matchedAirports = airports.filter(
          (a) => a.locations?.city?.toLowerCase() === cityLower,
        );
      }

      if (matchedAirports.length === 0) return;

      quickSearchApplied.current = true;
      setTripType("one-way");
      // For multi-airport cities, set ALL matched airports as departures
      setDepartures(matchedAirports);
      setDepartureDate(depDate);
      setSearchAll(false);
      setArrivals([]);

      // Defer search trigger until state settles
      setTimeout(() => {
        searchBtnRef.current?.click();
      }, 120);
    } catch {
      // ignore
    }
  }, [quickSearchData, airports]);

  return (
    <>
      {loading && <SearchingOverlay />}


      <div className="px-6 pt-6 pb-8 relative z-10 flex flex-col gap-2 animate-fade-in">
        {/* Trip Type Switch — frosted glass pill */}
        <div
          className="rounded-full p-[2px] flex relative"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
          }}
        >
          <div
            className="absolute top-[2px] bottom-[2px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out"
            style={{
              background: "#10B981",
              width: `calc((100% - 4px) * ${ACTIVE_TRIP_FLEX} / ${tripOptions.length - 1 + ACTIVE_TRIP_FLEX})`,
              left: `calc(2px + (100% - 4px) * ${tripOptions.findIndex((o) => o.value === tripType)} / ${
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
                  "py-2.5 px-3 text-xs font-semibold rounded-full transition-all duration-300 relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                  isActive ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
                )}
              >
                <HugeiconsIcon
                  icon={opt.icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={2}
                  className="shrink-0 transition-transform duration-300"
                />
                {isActive && <span className="animate-fade-in whitespace-nowrap">{opt.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Airport + Dates Group — frosted glass card */}
        <div
          className="rounded-2xl overflow-visible"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
          }}
        >
          <div className="relative">
            {/* Departure now uses MultiAirportSearchbox */}
            <MultiAirportSearchbox
              label="Departure"
              icon={AirplaneTakeOff01Icon}
              selected={departures}
              onChange={setDepartures}
              airports={airports}
              containerClassName="px-3 pt-3 pb-1"
            />

            <MultiAirportSearchbox
              label="Arrival"
              icon={AirplaneLanding01Icon}
              selected={arrivals}
              onChange={setArrivals}
              airports={airports}
              disabled={searchAll}
              placeholder={searchAll ? "Searching all destinations" : "Search airport or city..."}
              containerClassName="px-3 pt-1 pb-1"
            />
          </div>

          {/* Dates */}
          <div className="px-3 pt-1 pb-3">
            <div className={cn("grid gap-3", showReturnDate ? "grid-cols-2" : "grid-cols-1")}>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#059669] ml-1 mb-1 block cursor-pointer">
                  Departure Date
                </label>
                <Popover open={depDateOpen} onOpenChange={setDepDateOpen}>
                  <PopoverTrigger asChild>
                     <button
                      type="button"
                      className="app-input-container w-full text-left outline-none"
                      style={{ minHeight: 44 }}
                    >
                      <span className="app-input-icon-btn">
                        <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
                      </span>
                      <span
                        className="flex-1 truncate font-semibold px-[0.8em] py-[0.7em] text-base"
                        style={{ color: departureDate ? "#1F2937" : "#9CA3AF" }}
                      >
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#059669] ml-1 mb-1 block cursor-pointer">Return Date</label>
                  <Popover open={retDateOpen} onOpenChange={setRetDateOpen}>
                    <PopoverTrigger asChild>
                       <button
                        type="button"
                        className="app-input-container w-full text-left outline-none"
                        style={{ minHeight: 44 }}
                      >
                        <span className="app-input-icon-btn">
                          <HugeiconsIcon icon={CalendarCheckIn02Icon} size={20} color="currentColor" strokeWidth={2} />
                        </span>
                        <span
                          className="flex-1 truncate font-semibold px-[0.8em] py-[0.7em] text-base"
                          style={{ color: arrivalDate ? "#1F2937" : "#9CA3AF" }}
                        >
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

            {/* Search All Destinations */}
            <div className="flex items-center justify-end gap-2 py-2 px-1">
              <label htmlFor="search-all" className="text-[10px] font-bold uppercase tracking-widest text-[#059669] cursor-pointer select-none">
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
          </div>
        </div>

        {/* Insufficient credits upsell */}
        {creditError && (
          <div className="rounded-2xl border border-[#E89830]/30 bg-[#FFF7ED] p-4 flex flex-col gap-2 animate-fade-in">
            <p className="text-sm font-bold text-[#2E4A4A]">Not enough credits</p>
            <p className="text-xs text-[#6B7B7B]">
              This search costs{" "}
              <span className="font-semibold text-[#E89830]">
                {creditError.cost} credit{creditError.cost !== 1 ? "s" : ""}
              </span>
              . You have {creditError.remaining_monthly} monthly + {creditError.purchased_balance} purchased remaining.
            </p>
            <button
              type="button"
              onClick={() => setCreditError(null)}
              className="self-end text-xs font-semibold text-[#345C5A] hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search Button */}
        <button
          ref={searchBtnRef}
          type="button"
          disabled={loading}
          onClick={async () => {
            if (departures.length === 0 || !departureDate) return;

            const depFormatted = format(departureDate, "yyyy-MM-dd");

            // Build origin: if multiple airports share a city, send CITY:<CityName>
            const depCity = departures[0].locations?.city;
            const allSameDepCity = departures.length > 1 && depCity && departures.every(a => a.locations?.city === depCity);
            const originCode = allSameDepCity ? `CITY:${depCity}` : departures[0].iata_code;

            // Build destination: same logic for arrivals
            const arrCity = arrivals[0]?.locations?.city;
            const allSameArrCity = arrivals.length > 1 && arrCity && arrivals.every(a => a.locations?.city === arrCity);
            const destinationCode = arrivals.length === 0 ? "__ALL__" : (allSameArrCity ? `CITY:${arrCity}` : arrivals[0].iata_code);

            const cacheOrigin = originCode;
            const cacheDest = searchAll ? "__ALL__" : destinationCode;
            const cacheDate = depFormatted;
            const cacheKey = await sha256(`${cacheOrigin}|${cacheDest}|${cacheDate}`);

            const canonicalRequest = {
              origin: cacheOrigin,
              destination: cacheDest,
              departureDate: cacheDate,
            };
            const bucket = resetBucket(depFormatted);

            const tripTypeMapping =
              tripType === "round-trip"
                ? "round_trip"
                : tripType === "day-trip"
                  ? "day_trip"
                  : tripType === "multi-day"
                    ? "trip_planner"
                    : "one_way";
            const arrivalAirportsCount = searchAll ? 0 : arrivals.length;

            setLoading(true);
            setCreditError(null);
            const searchStart = performance.now();
            flightLog.info("Search started", {
              origin: originCode,
              dest: searchAll ? "ALL" : destinationCode,
              tripType,
              date: depFormatted,
            });
            try {
              // ── Credit check ──
              const { data: creditResult, error: creditErr } = await supabase.rpc(
                "consume_search_credits" as any,
                {
                  p_trip_type: tripTypeMapping,
                  p_arrival_airports_count: arrivalAirportsCount,
                  p_all_destinations: searchAll,
                } as any,
              );

              if (creditErr) {
                flightLog.error("Credit check failed", creditErr);
                setLoading(false);
                return;
              }

              const cr = creditResult as any;
              if (!cr?.allowed) {
                setCreditError({
                  cost: cr?.cost ?? 0,
                  remaining_monthly: cr?.remaining_monthly ?? 0,
                  purchased_balance: cr?.purchased_balance ?? 0,
                });
                setLoading(false);
                return;
              }

              const creditsCost = cr?.cost ?? 0;
              // ── Check cache first ──
              // Cache is valid if: same dep/arr/date (cache_key) AND written within last 6 hours
              const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
              const { data: cached } = await (supabase.from("flight_search_cache") as any)
                .select("payload, updated_at")
                .eq("cache_key", cacheKey)
                .eq("status", "ready")
                .gte("updated_at", sixHoursAgo)
                .maybeSingle();

              if (cached?.payload) {
                cacheLog.info("Cache HIT", { dep: originCode, arr: cacheDest });
                await new Promise((r) => setTimeout(r, 2000));

                // Log to flight_searches
                try {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (user) {
                    await supabase.from("flight_searches").insert({
                      user_id: user.id,
                      departure_airport: originCode,
                      arrival_airport: searchAll ? null : destinationCode,
                      departure_date: depFormatted,
                      return_date: arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null,
                      trip_type: tripTypeMapping,
                      all_destinations: searchAll ? "Yes" : "No",
                      json_body: cached.payload as any,
                      credits_cost: creditsCost,
                      arrival_airports_count: arrivalAirportsCount,
                    });
                  }
                } catch (logErr) {
                  flightLog.warn("Flight search log failed (non-blocking)", logErr);
                }

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
              cacheLog.info("Cache MISS", { dep: originCode, arr: cacheDest });
              const edgeStart = performance.now();
              let data, error;

              if (searchAll) {
                const requestBody = { departureAirport: originCode, departureDate: depFormatted };
                ({ data, error } = await supabase.functions.invoke("getAllDestinations", {
                  body: requestBody,
                }));
              } else {
                // Call the shared external endpoint
                const body: Record<string, string> = {
                  origin: originCode,
                  departureDate: depFormatted,
                };
                if (destinationCode && destinationCode !== "__ALL__") {
                  body.destination = destinationCode; // may be "CITY:Chicago" or a plain IATA
                }
                if (tripType === "round-trip" && arrivalDate) {
                  body.returnDate = format(arrivalDate, "yyyy-MM-dd");
                }

                try {
                  const res = await fetch("https://getmydata.fly.dev/api/flights/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  const json = await res.json();
                  data = json;
                  error = res.ok ? null : new Error(`HTTP ${res.status}`);
                } catch (fetchErr) {
                  data = null;
                  error = fetchErr;
                }
              }

              edgeLog.info("Edge function complete", {
                duration: `${(performance.now() - edgeStart).toFixed(0)}ms`,
                success: !error,
              });
              if (error) {
                edgeLog.error("Edge function error", error);
              } else {
                const normalizeStart = performance.now();
                const normalized = searchAll
                  ? normalizeAllDestinationsResponse(data)
                  : normalizeGetMyDataResponse(data, depFormatted);
                flightLog.debug("Normalized in", `${(performance.now() - normalizeStart).toFixed(0)}ms`, {
                  flights: normalized.flights.length,
                });
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
                  cacheLog.info("Cache WRITE", {
                    cacheKey,
                    bucket,
                    dep: originCode,
                    arr: searchAll ? "__ALL__" : destinationCode,
                  });
                } catch (cacheErr) {
                  cacheLog.warn("Cache write failed (non-blocking)", cacheErr);
                }

                // Log to flight_searches
                try {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (user) {
                    const arrivalAirportValue = searchAll || destinationCode === "__ALL__" ? null : destinationCode;
                    await supabase.from("flight_searches").insert({
                      user_id: user.id,
                      departure_airport: originCode,
                      arrival_airport: arrivalAirportValue,
                      departure_date: depFormatted,
                      return_date: arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null,
                      trip_type: tripTypeMapping,
                      all_destinations: searchAll ? "Yes" : "No",
                      json_body: normalized as any,
                      credits_cost: creditsCost,
                      arrival_airports_count: arrivalAirportsCount,
                    });
                  }
                } catch (logErr) {
                  flightLog.warn("Flight search log failed (non-blocking)", logErr);
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
              edgeLog.error("Failed to invoke edge function", err);
            } finally {
              flightLog.info("Search complete", { duration: `${(performance.now() - searchStart).toFixed(0)}ms` });
              setLoading(false);
            }
          }}
          className="w-full h-14 px-6 bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold rounded-full shadow-lg hover:shadow-xl active:scale-[0.98] transition-all mt-2 disabled:opacity-60 flex items-center justify-center gap-3"
        >
          <span className="uppercase tracking-[0.45em] text-[11px] font-black">{loading ? "Searching..." : "Search Flights"}</span>
          {!loading && <HugeiconsIcon icon={GlobalSearchIcon} size={16} color="white" strokeWidth={2} className="shrink-0" />}
        </button>
      </div>
    </>
  );
};

export default FlightsPage;
