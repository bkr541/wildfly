import { useState, useEffect, useMemo, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  AirplaneLanding01Icon,
  Location01Icon,
  Location04Icon,
  AddCircleIcon,
  Cancel01Icon,
  AirportIcon,
  CalendarCheckOut02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  activeFrontierStationCodes,
  filterAirportsToCodes,
  isFrontierRouteOffered,
  marketDetailsByCode,
} from "@/lib/frontierMarketOfferings";
import { format, startOfDay } from "date-fns";
import { DatePickerSheet } from "@/components/DatePickerSheet";
import { DestCardItem, DestCard, buildDestCards } from "@/components/DestCardItem";

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

type AirportSheetOption = Airport & {
  disabled?: boolean;
  disabledReason?: string;
  /** When set, the input renders this label (e.g. "Chicago, IL")
   *  instead of `IATA | City` — used when a city-area parent is picked. */
  cityAreaLabel?: string;
};

/* ── Recent IATA codes from flight_searches ─────────── */
function useRecentAirports() {
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("flight_searches")
        .select("departure_airport")
        .eq("user_id", user.id)
        .order("search_timestamp", { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (!data) return;
          const codes: string[] = [];
          const seen = new Set<string>();
          for (const row of data) {
            const code = row.departure_airport;
            if (code && !seen.has(code)) {
              seen.add(code);
              codes.push(code);
              if (codes.length >= 8) break;
            }
          }
          setRecentCodes(codes);
        });
    });
  }, []);
  return recentCodes;
}

/* ── Airport Search Sheet ──────────────────────────── */
function AirportSearchSheet({
  open,
  onClose,
  label,
  airports,
  selected,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  airports: AirportSheetOption[];
  selected: Airport | null;
  onChange: (a: Airport | null) => void;
}) {
  const [query, setQuery] = useState("");
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const recentCodes = useRecentAirports();

  const recentAirports = useMemo(
    () => recentCodes.map((code) => airports.find((a) => a.iata_code === code)).filter(Boolean) as AirportSheetOption[],
    [recentCodes, airports],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => {
        setTimeout(() => sheetInputRef.current?.focus(), 50);
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const shouldShow = query.trim().length >= 2;

  const groupedAirports = useMemo(() => {
    if (!shouldShow) return {};
    const q = query.toLowerCase();
    const filteredList = airports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q) ||
          (a.locations?.city && a.locations.city.toLowerCase().includes(q)),
      )
      .slice(0, 40);

    const grouped = filteredList.reduce(
      (acc, airport) => {
        const city = airport.locations?.city;
        const state = airport.locations?.state_code;
        const groupKey = city && state ? `${city}, ${state}` : "Other Locations";
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(airport);
        return acc;
      },
      {} as Record<string, AirportSheetOption[]>,
    );
    return Object.fromEntries(
      Object.entries(grouped).map(([key, aps]) => [aps.length > 1 ? key : `__single__${key}`, aps]),
    );
  }, [query, airports, shouldShow]);

  const addAirport = (a: AirportSheetOption) => {
    if (a.disabled) return;
    onChange(a);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} style={{ top: "5%" }}>
      {/* Title row */}
      <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <HugeiconsIcon icon={Location01Icon} size={15} color="white" strokeWidth={2} />
          </div>
          <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">
            Select {label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
        >
          <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
        </button>
      </div>

      {/* Search input */}
      <div className="px-5 pb-4">
        <div className="app-input-container">
          <button type="button" tabIndex={-1} className="app-input-icon-btn">
            <HugeiconsIcon icon={Location01Icon} size={20} color="currentColor" strokeWidth={2} />
          </button>
          <input
            ref={sheetInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search airport or city…"
            className="app-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="app-input-reset app-input-reset--visible"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {!shouldShow ? (
          <div className="px-5 pt-2">
            {/* Close To Me */}
            <div className="mb-5">
              <p className="block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-2">Close To Me</p>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-[#059669] hover:opacity-75 transition-opacity"
              >
                <HugeiconsIcon icon={Location01Icon} size={14} color="#059669" strokeWidth={2.5} />
                Use current location to search
              </button>
            </div>

            {recentAirports.length > 0 && (
              <div className="mb-6">
                <p className="block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-2">Recent Airports</p>
                <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
                  {recentAirports.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => addAirport(a)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-semibold transition-colors shrink-0 whitespace-nowrap",
                        a.disabled ? "cursor-not-allowed opacity-50" : "",
                      )}
                      style={a.disabled ? {
                        background: "#F3F4F6",
                        color: "#9CA3AF",
                        border: "1px solid #E5E7EB",
                      } : {
                        background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
                        color: "#065F46",
                        border: "1px solid #6EE7B7",
                      }}
                    >
                      <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={14} color={a.disabled ? "#9CA3AF" : "#059669"} strokeWidth={2.5} />
                      <span className="font-bold">{a.iata_code}</span>
                      {a.locations?.city && (
                        <span className="opacity-60 font-medium">{a.locations.city}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-5">
                <HugeiconsIcon icon={AirportIcon} size={28} color="#059669" strokeWidth={2} />
              </div>
              <p className="text-[#2E4A4A] font-bold text-base mb-1">Search for an airport</p>
              <p className="text-[#9CA3AF] text-sm">Type 2 or more letters to see results</p>
            </div>
          </div>
        ) : Object.keys(groupedAirports).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <p className="text-[#2E4A4A] font-bold text-base mb-1">No airports found</p>
            <p className="text-[#9CA3AF] text-sm">Try a different city or airport code</p>
          </div>
        ) : (
          <div className="py-3 px-4">
            {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => {
              const isSingle = cityGroup.startsWith("__single__");
              const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
              const areaAllDisabled = cityAirports.every((a) => a.disabled);
              const firstEnabled = cityAirports.find((a) => !a.disabled);
              return (
                <div key={cityGroup} className="mb-2 last:mb-0">
                  {!isSingle && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!firstEnabled) return;
                        // Mark this selection as a city-area pick so the input
                        // displays "City, ST" instead of a single IATA code.
                        addAirport({ ...firstEnabled, cityAreaLabel: displayGroup } as AirportSheetOption);
                      }}
                      className={cn(
                        "w-full px-5 py-3 text-sm font-bold text-[#6B7B7B] uppercase tracking-wider flex items-center gap-2 transition-colors",
                        areaAllDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-[#F2F3F3]",
                      )}
                    >
                      <HugeiconsIcon icon={Location04Icon} size={20} color="currentColor" strokeWidth={2} className="opacity-60" />
                      {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                    </button>
                  )}
                  {cityAirports.map((a, aIdx) => (
                    <div key={a.id}>
                      {aIdx > 0 && <div className="border-t border-[#F0F1F1] mx-1" />}
                      <button
                        type="button"
                        onClick={() => addAirport(a)}
                        aria-disabled={a.disabled || undefined}
                        className={cn(
                          "w-full text-left pr-4 py-1.5 text-base transition-colors flex items-center gap-3 overflow-hidden",
                          isSingle ? "pl-4" : "pl-14",
                          a.disabled
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-[#F2F3F3] active:bg-[#E8F5F0]",
                        )}
                      >
                        <HugeiconsIcon icon={AirportIcon} size={22} color={a.disabled ? "#C4C4C4" : "#6B7B7B"} strokeWidth={2} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("font-bold text-sm shrink-0", a.disabled ? "text-[#9CA3AF]" : "text-[#345C5A]")}>{a.iata_code}</span>
                            <span className="text-[#9CA3AF] text-xs shrink-0">•</span>
                            <span className={cn("truncate text-sm font-medium", a.disabled ? "text-[#9CA3AF]" : "text-[#2E4A4A]")}>{a.name}</span>
                          </div>
                          {a.locations?.city && (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-0.5",
                              a.disabled ? "bg-[#F3F4F6] text-[#D1D5DB]" : "bg-[#F2F3F3] text-[#6B7B7B]",
                            )}>
                              <HugeiconsIcon icon={Location01Icon} size={10} color="currentColor" strokeWidth={2} />
                              <span className="truncate">{a.locations.city}{a.locations.state_code ? `, ${a.locations.state_code}` : ""}</span>
                            </span>
                          )}
                          {a.disabledReason && (
                            <span className="block text-[10px] text-[#9CA3AF] mt-0.5 leading-tight">
                              {a.disabledReason}
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <div className="h-10" />
      </div>
    </BottomSheet>
  );
}

/* ── Flight Explorer Page ──────────────────────────── */
const FlightExplorer = ({ onNavigate }: { onNavigate?: (page: string, data?: string) => void }) => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [departure, setDeparture] = useState<Airport | null>(null);
  const [arrival, setArrival] = useState<Airport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [airportSheetMode, setAirportSheetMode] = useState<"departure" | "arrival">("departure");
  const [departureDate, setDepartureDate] = useState<Date | undefined>(undefined);
  const [depDateOpen, setDepDateOpen] = useState(false);
  const today = startOfDay(new Date());

  // ── Cached flight results for selected date + airport ──
  const [explorerCards, setExplorerCards] = useState<DestCard[]>([]);
  const [explorerAirportMap, setExplorerAirportMap] = useState<
    Record<string, { city: string; stateCode: string; country: string; name: string; locationId: number | null }>
  >({});
  const [explorerLoading, setExplorerLoading] = useState(false);

  const departureAirportOptions = useMemo<AirportSheetOption[]>(() => {
    const dbMap = new Map(airports.map((a) => [a.iata_code.toUpperCase(), a]));

    const options = [...marketDetailsByCode.entries()].map(([code, station], index) => {
      const dbAirport = dbMap.get(code);
      const cityName = station.cityAndCode.replace(` (${station.stationCode})`, "").trim();

      const airport: Airport = dbAirport ?? {
        id: -(index + 1),
        name: station.stationName,
        iata_code: code,
        locations: {
          city: cityName,
          state_code: station.stateCode ?? "",
          region: station.countryCode ?? "",
        },
      };

      return { ...airport } as AirportSheetOption;
    });

    return options.sort((a, b) =>
      (a.locations?.city ?? a.name).localeCompare(b.locations?.city ?? b.name),
    );
  }, [airports]);

  const arrivalAirportOptions = useMemo<AirportSheetOption[]>(() => {
    // Use a DB-airport map for rich name/location data when available.
    // Falls back to market_offerings.json station data so every active Frontier
    // station appears regardless of its is_active state in the DB.
    const dbMap = new Map(airports.map((a) => [a.iata_code.toUpperCase(), a]));

    const options = [...marketDetailsByCode.entries()].map(([code, station], index) => {
      const dbAirport = dbMap.get(code);
      const cityName = station.cityAndCode.replace(` (${station.stationCode})`, "").trim();

      const airport: Airport = dbAirport ?? {
        id: -(index + 1),
        name: station.stationName,
        iata_code: code,
        locations: {
          city: cityName,
          state_code: station.stateCode ?? "",
          region: station.countryCode ?? "",
        },
      };

      const offered = departure?.iata_code
        ? isFrontierRouteOffered(departure.iata_code, code)
        : false;

      return {
        ...airport,
        disabled: !offered,
        disabledReason: !departure?.iata_code
          ? "Select a departure airport first"
          : !offered
            ? `This route is not offered with ${departure.iata_code}`
            : undefined,
      };
    });

    return options.sort((a, b) =>
      (a.locations?.city ?? a.name).localeCompare(b.locations?.city ?? b.name),
    );
  }, [airports, departure?.iata_code]);

  // Clear arrival when departure changes and the selected arrival is no longer valid.
  const departureCode = departure?.iata_code;
  const arrivalCode = arrival?.iata_code;
  useEffect(() => {
    if (!departureCode) { setArrival(null); return; }
    if (!arrivalCode) return;
    if (!isFrontierRouteOffered(departureCode, arrivalCode)) setArrival(null);
  }, [departureCode, arrivalCode]);

  useEffect(() => {
    const loadAirports = async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code, locations(city, state_code, region)")
        .eq("is_active", true)
        .order("name");
      if (data) {
        const filtered = filterAirportsToCodes(
          data as unknown as Airport[],
          activeFrontierStationCodes,
        );
        setAirports(filtered);
      }
    };
    loadAirports();
  }, []);

  // ── Query flight_searches when both inputs are set ──
  useEffect(() => {
    if (!departure || !departureDate) {
      setExplorerCards([]);
      setExplorerAirportMap({});
      return;
    }
    const dateStr = format(departureDate, "yyyy-MM-dd");
    const iata = departure.iata_code;

    setExplorerLoading(true);
    (async () => {
      const { data: searches } = await supabase
        .from("flight_searches")
        .select("json_body, departure_airport, departure_date")
        .eq("departure_airport", iata)
        .eq("departure_date", dateStr)
        .not("json_body", "is", null)
        .order("search_timestamp", { ascending: false })
        .limit(20);

      if (!searches || searches.length === 0) {
        setExplorerCards([]);
        setExplorerLoading(false);
        return;
      }

      // Merge flights from all matching searches
      const rawFlights: any[] = [];
      for (const row of searches) {
        const body = row.json_body as any;
        const flights: any[] = body?.response?.flights ?? body?.flights ?? [];
        rawFlights.push(...flights);
      }

      // Collect all destination IATA codes
      const destCodes = new Set<string>();
      destCodes.add(iata);
      for (const f of rawFlights) {
        if (Array.isArray(f.legs)) {
          for (const leg of f.legs) {
            if (leg.origin) destCodes.add(leg.origin);
            if (leg.destination) destCodes.add(leg.destination);
          }
        } else if (f.destination) {
          destCodes.add(f.destination);
        }
      }

      const { data: airportData } = await supabase
        .from("airports")
        .select("iata_code, name, location_id, locations(city, state_code, country)")
        .in("iata_code", Array.from(destCodes));

      const aMap: Record<string, { city: string; stateCode: string; country: string; name: string; locationId: number | null }> = {};
      for (const a of (airportData ?? []) as any[]) {
        aMap[a.iata_code] = {
          city: a.locations?.city ?? "",
          stateCode: a.locations?.state_code ?? "",
          country: a.locations?.country ?? "",
          name: a.name ?? "",
          locationId: a.location_id ?? null,
        };
      }

      setExplorerAirportMap(aMap);
      setExplorerCards(buildDestCards(rawFlights, aMap));
      setExplorerLoading(false);
    })();
  }, [departure, departureDate]);

  const handleViewDest = (card: DestCard) => {
    if (!onNavigate || !departure || !departureDate) return;
    const payload = JSON.stringify({
      departureAirport: departure.iata_code,
      arrivalAirport: card.destination,
      departureDate: format(departureDate, "yyyy-MM-dd"),
      tripType: "One Way",
      response: { flights: card.flights },
    });
    onNavigate("flight-results", payload);
  };

  const displayValue = departure
    ? ((departure as AirportSheetOption).cityAreaLabel
        ?? `${departure.iata_code} | ${departure.locations?.city ?? departure.name}`)
    : "";
  const arrivalDisplayValue = arrival
    ? ((arrival as AirportSheetOption).cityAreaLabel
        ?? `${arrival.iata_code} | ${arrival.locations?.city ?? arrival.name}`)
    : "";

  return (
    <div className="flex-1 flex flex-col relative z-10 animate-fade-in">
      {/* Airport Search Sheet — shared for departure and arrival */}
      <AirportSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        label={airportSheetMode === "departure" ? "Departure" : "Arrival"}
        airports={airportSheetMode === "departure" ? departureAirportOptions : arrivalAirportOptions}
        selected={airportSheetMode === "departure" ? departure : arrival}
        onChange={(a) => {
          if (airportSheetMode === "departure") setDeparture(a);
          else setArrival(a);
        }}
      />

      {/* Departure Date Sheet */}
      <DatePickerSheet
        open={depDateOpen}
        onClose={() => setDepDateOpen(false)}
        label="Departure Date"
        selected={departureDate}
        onSelect={setDepartureDate}
        minDate={today}
      />

      {/* Inputs card */}
      <div className="px-4 pt-2 pb-2">
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
          <div className="relative px-5 pt-4 pb-3">
            {/* Departure */}
            <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure</label>
            <div
              className="app-input-container cursor-pointer"
              style={{ minHeight: 48 }}
              onClick={() => { setAirportSheetMode("departure"); setSheetOpen(true); }}
            >
              <button type="button" tabIndex={-1} className="app-input-icon-btn">
                <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              <span
                className="app-input truncate flex-1 flex items-center"
                style={{ color: displayValue ? "#1F2937" : "#6B7280" }}
              >
                {displayValue || "Search airport or city..."}
              </span>
              {departure && (
                <button
                  type="button"
                  aria-label="Clear departure"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeparture(null);
                  }}
                  className="app-input-reset app-input-reset--visible"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Arrival */}
            <label className={cn("text-sm font-bold ml-1 mb-0 block mt-3", departure ? "text-[#059669]" : "text-[#9CA3AF]")}>
              Arrival
            </label>
            <div
              className={cn("app-input-container", departure ? "cursor-pointer" : "cursor-not-allowed opacity-70")}
              style={{ minHeight: 48 }}
              onClick={() => {
                if (!departure) return;
                setAirportSheetMode("arrival");
                setSheetOpen(true);
              }}
            >
              <button type="button" tabIndex={-1} className="app-input-icon-btn">
                <HugeiconsIcon icon={AirplaneLanding01Icon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              <span
                className={cn("app-input truncate flex-1 flex items-center", !departure && "cursor-not-allowed")}
                style={{ color: arrival ? "#1F2937" : "#6B7280" }}
              >
                {arrival
                  ? arrivalDisplayValue
                  : departure ? "Search airport or city..." : "Select departure first"}
              </span>
              {arrival && departure && (
                <button
                  type="button"
                  aria-label="Clear arrival"
                  onClick={(e) => {
                    e.stopPropagation();
                    setArrival(null);
                  }}
                  className="app-input-reset app-input-reset--visible"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Departure Date */}
            <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block mt-3 cursor-pointer">
              Departure Date
            </label>
            <button
              type="button"
              className="app-input-container w-full text-left outline-none"
              style={{ minHeight: 48 }}
              onClick={() => setDepDateOpen(true)}
            >
              <span className="app-input-icon-btn">
                <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
              </span>
              <span
                className="flex-1 truncate px-[0.8em] py-[0.7em] text-base"
                style={{ color: departureDate ? "#1F2937" : "#6B7280" }}
              >
                {departureDate ? format(departureDate, "MMM d, yyyy") : "Select date"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Cached flight results */}
      {(departure && departureDate) && (
        <div className="px-4 pt-2 pb-6">
          {explorerLoading ? (
            <div className="flex flex-col gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden bg-white animate-pulse"
                  style={{ border: "1px solid #E8EBEB", boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
                >
                  <div className="h-[158px] bg-[#E5E7EB]" />
                  <div className="px-4 pt-3 pb-4">
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[1, 2, 3, 4].map((j) => <div key={j} className="h-8 rounded bg-[#E5E7EB]" />)}
                    </div>
                    <div className="h-11 rounded-full bg-[#E5E7EB]" />
                  </div>
                </div>
              ))}
            </div>
          ) : explorerCards.length === 0 ? (
            <div
              className="rounded-2xl px-5 py-8 flex flex-col items-center gap-3 text-center"
              style={{
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.55)",
                boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13)",
              }}
            >
              <div className="h-12 w-12 rounded-full bg-[#F0FDF4] flex items-center justify-center">
                <HugeiconsIcon icon={Search01Icon} size={22} color="#9CA3AF" strokeWidth={1.5} />
              </div>
              <p className="text-[#2E4A4A] font-bold text-base">No Recently Searched Flights</p>
              <p className="text-[#9CA3AF] text-sm">No cached results for this date and airport</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {explorerCards.map((card, i) => (
                <DestCardItem
                  key={card.destination}
                  card={card}
                  index={i}
                  onViewDest={handleViewDest}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FlightExplorer;
