import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AddCircleIcon,
  AirplaneTakeOff01Icon,
  AirportIcon,
  ArrowDown01Icon,
  Cancel01Icon,
  Location01Icon,
  Location04Icon,
} from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { AirportInfo } from "@/hooks/useAirportDictionary";

type HistoricalOrigin = {
  iata: string;
  count: number;
};

type GuideAirportOption = {
  id: number;
  iata_code: string;
  name: string;
  count: number;
  locations?: {
    city: string;
    state_code: string;
    region: string;
  };
};

function useRecentAirports() {
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from("flight_searches")
        .select("departure_airport, arrival_airport")
        .eq("user_id", user.id)
        .order("search_timestamp", { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (!data) return;

          const seen = new Set<string>();
          const codes: string[] = [];

          for (const row of data) {
            for (const code of [row.departure_airport, row.arrival_airport]) {
              if (
                code &&
                code !== "null" &&
                !code.toLowerCase().includes("all") &&
                /^[A-Z]{3}$/.test(code) &&
                !seen.has(code)
              ) {
                seen.add(code);
                codes.push(code);
                if (codes.length >= 8) break;
              }
            }
            if (codes.length >= 8) break;
          }

          setRecentCodes(codes);
        });
    });
  }, []);

  return recentCodes;
}

function toAirportOption(origin: HistoricalOrigin, info: AirportInfo | undefined, index: number): GuideAirportOption {
  return {
    id: info?.locationId ?? index + 1,
    iata_code: origin.iata,
    name: info?.name ?? `${origin.iata} Airport`,
    count: origin.count,
    locations: info?.city
      ? {
          city: info.city,
          state_code: info.state ?? "",
          region: info.region ?? "",
        }
      : undefined,
  };
}

export function GuideAirportPicker({
  value,
  onChange,
  hubsSorted,
  airportDict,
  label = "Departure Airport",
}: {
  value: string;
  onChange: (value: string) => void;
  hubsSorted: HistoricalOrigin[];
  airportDict: Record<string, AirportInfo>;
  label?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const recentCodes = useRecentAirports();

  const airports = useMemo(
    () => hubsSorted.map((origin, index) => toAirportOption(origin, airportDict[origin.iata], index)),
    [airportDict, hubsSorted],
  );

  const selectedAirport = useMemo(
    () => airports.find((airport) => airport.iata_code === value) ?? null,
    [airports, value],
  );

  const recentAirports = useMemo(
    () =>
      recentCodes
        .map((code) => airports.find((airport) => airport.iata_code === code))
        .filter(Boolean) as GuideAirportOption[],
    [airports, recentCodes],
  );

  useEffect(() => {
    if (!sheetOpen) return;

    setQuery("");
    requestAnimationFrame(() => {
      setTimeout(() => {
        sheetInputRef.current?.focus();
      }, 50);
    });
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sheetOpen]);

  const shouldShow = query.trim().length >= 2;

  const groupedAirports = useMemo(() => {
    if (!shouldShow) return {} as Record<string, GuideAirportOption[]>;

    const q = query.toLowerCase();
    const filteredList = airports
      .filter((airport) => {
        const city = airport.locations?.city ?? "";
        const state = airport.locations?.state_code ?? "";
        const cityState = [city, state].filter(Boolean).join(" ");

        return (
          airport.name.toLowerCase().includes(q) ||
          airport.iata_code.toLowerCase().includes(q) ||
          city.toLowerCase().includes(q) ||
          cityState.toLowerCase().includes(q)
        );
      })
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
      {} as Record<string, GuideAirportOption[]>,
    );

    return Object.fromEntries(
      Object.entries(grouped).map(([key, groupAirports]) => [
        groupAirports.length > 1 ? key : `__single__${key}`,
        groupAirports,
      ]),
    ) as Record<string, GuideAirportOption[]>;
  }, [airports, query, shouldShow]);

  const displayValue = selectedAirport
    ? `${selectedAirport.iata_code} | ${selectedAirport.locations?.city ?? selectedAirport.name}`
    : "";

  const selectAirport = (airport: GuideAirportOption) => {
    onChange(airport.iata_code);
    setQuery("");
    setSheetOpen(false);
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div className="relative z-10 w-full">
      <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">{label}</label>

      <div
        className="app-input-container cursor-pointer"
        style={{ minHeight: 48 }}
        onClick={() => setSheetOpen(true)}
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

        {value ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={handleClear}
            className="app-input-reset app-input-reset--visible"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
          </button>
        ) : (
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} color="#9CA3AF" strokeWidth={1.5} className="shrink-0 ml-1" />
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} style={{ top: "5%" }}>
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
            onClick={() => setSheetOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
          >
            <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="app-input-container">
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={Location01Icon} size={20} color="currentColor" strokeWidth={2} />
            </button>
            <input
              ref={sheetInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!shouldShow ? (
            <div className="px-5 pt-2">
              <div className="mb-5">
                <p className="block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-2">
                  Close To Me
                </p>
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
                  <p className="block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-2">
                    Recent Airports
                  </p>
                  <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
                    {recentAirports.map((airport) => (
                      <button
                        key={airport.iata_code}
                        type="button"
                        onClick={() => selectAirport(airport)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-semibold transition-colors shrink-0 whitespace-nowrap"
                        style={{
                          background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
                          color: "#065F46",
                          border: "1px solid #6EE7B7",
                        }}
                      >
                        <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={14} color="#059669" strokeWidth={2.5} />
                        <span className="font-bold">{airport.iata_code}</span>
                        {airport.locations?.city && (
                          <span className="opacity-60 font-medium">{airport.locations.city}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

                return (
                  <div key={cityGroup} className="mb-2 last:mb-0">
                    {!isSingle && (
                      <div className="w-full px-5 py-3 text-sm font-bold text-[#6B7B7B] uppercase tracking-wider flex items-center gap-2">
                        <HugeiconsIcon icon={Location04Icon} size={20} color="currentColor" strokeWidth={2} className="opacity-60" />
                        {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                      </div>
                    )}

                    {cityAirports.map((airport, airportIndex) => {
                      const isSelected = selectedAirport?.iata_code === airport.iata_code;

                      return (
                        <div key={airport.iata_code}>
                          {airportIndex > 0 && <div className="border-t border-[#F0F1F1] mx-1" />}
                          <button
                            type="button"
                            onClick={() => selectAirport(airport)}
                            className={cn(
                              "w-full text-left pr-4 py-1.5 text-base hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors flex items-center gap-3 overflow-hidden",
                              isSingle ? "pl-4" : "pl-14",
                              isSelected && "bg-[#345C5A]/5",
                            )}
                          >
                            <HugeiconsIcon icon={AirportIcon} size={22} color="#6B7B7B" strokeWidth={2} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#345C5A] text-sm shrink-0">{airport.iata_code}</span>
                                <span className="text-[#9CA3AF] text-xs shrink-0">•</span>
                                <span className="text-[#2E4A4A] truncate text-sm font-medium">{airport.name}</span>
                              </div>
                              {airport.locations?.city && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F2F3F3] text-[#6B7B7B] text-xs font-medium mt-0.5">
                                  <HugeiconsIcon icon={Location01Icon} size={10} color="currentColor" strokeWidth={2} />
                                  <span className="truncate">
                                    {airport.locations.city}
                                    {airport.locations.state_code ? `, ${airport.locations.state_code}` : ""}
                                  </span>
                                </span>
                              )}
                            </div>
                            {isSelected && <span className="text-[#059669] text-sm font-bold shrink-0">✓</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          <div className="h-10" />
        </div>
      </BottomSheet>
    </div>
  );
}
