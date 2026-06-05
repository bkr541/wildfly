import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirportIcon,
  Location01Icon,
  Location04Icon,
  Cancel01Icon,
  AddCircleIcon,
} from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";

export interface Airport {
  id: number;
  name: string;
  iata_code: string;
  location_id?: number | null;
  locations?: {
    city: string;
    state_code: string;
    region: string;
  } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  airports: Airport[];
  onSelect: (airport: Airport) => void;
}

export function AirportSearchSheet({ open, onClose, airports, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const shouldShow = query.trim().length >= 2;

  const groupedAirports = useMemo(() => {
    if (!shouldShow) return {} as Record<string, Airport[]>;
    const q = query.toLowerCase();
    const filtered = airports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q) ||
          (a.locations?.city && a.locations.city.toLowerCase().includes(q))
      )
      .slice(0, 40);

    const grouped = filtered.reduce((acc, airport) => {
      const city = airport.locations?.city;
      const state = airport.locations?.state_code;
      const key = city && state ? `${city}, ${state}` : "Other Locations";
      if (!acc[key]) acc[key] = [];
      acc[key].push(airport);
      return acc;
    }, {} as Record<string, Airport[]>);

    return Object.fromEntries(
      Object.entries(grouped).map(([key, aps]) => [
        aps.length > 1 ? key : `__single__${key}`,
        aps,
      ])
    );
  }, [query, airports, shouldShow]);

  return (
    <BottomSheet open={open} onClose={onClose} style={{ top: "5%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <HugeiconsIcon icon={Location01Icon} size={15} color="white" strokeWidth={2} />
          </div>
          <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">
            Select Airport
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
        >
          <HugeiconsIcon
            icon={AddCircleIcon}
            size={18}
            color="currentColor"
            strokeWidth={2}
            className="rotate-45"
          />
        </button>
      </div>

      {/* Search input */}
      <div className="px-5 pb-4 pt-3">
        <div className="app-input-container">
          <button type="button" tabIndex={-1} className="app-input-icon-btn">
            <HugeiconsIcon icon={Location01Icon} size={20} color="currentColor" strokeWidth={2} />
          </button>
          <input
            ref={inputRef}
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
              <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {!shouldShow ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-5">
            <div className="h-16 w-16 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-5">
              <HugeiconsIcon icon={AirportIcon} size={28} color="#059669" strokeWidth={2} />
            </div>
            <p className="text-[#2E4A4A] font-bold text-base mb-1">Search for an airport</p>
            <p className="text-[#9CA3AF] text-sm">Type 2 or more letters to see results</p>
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
              const displayGroup = isSingle
                ? cityGroup.replace("__single__", "")
                : cityGroup;
              return (
                <div key={cityGroup} className="mb-2 last:mb-0">
                  {!isSingle && (
                    <div className="w-full px-5 py-3 text-sm font-bold text-[#6B7B7B] uppercase tracking-wider flex items-center gap-2">
                      <HugeiconsIcon
                        icon={Location04Icon}
                        size={20}
                        color="currentColor"
                        strokeWidth={2}
                        className="opacity-60"
                      />
                      {displayGroup !== "Other Locations"
                        ? `${displayGroup} Area`
                        : displayGroup}
                    </div>
                  )}
                  {cityAirports.map((a, idx) => (
                    <div key={a.id}>
                      {idx > 0 && <div className="border-t border-[#F0F1F1] mx-1" />}
                      <button
                        type="button"
                        onClick={() => { onSelect(a); onClose(); }}
                        className={cn(
                          "w-full text-left pr-4 py-1.5 text-base hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors flex items-center gap-3 overflow-hidden",
                          isSingle ? "pl-4" : "pl-14"
                        )}
                      >
                        <HugeiconsIcon
                          icon={AirportIcon}
                          size={22}
                          color="#6B7B7B"
                          strokeWidth={2}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#345C5A] text-sm shrink-0">
                              {a.iata_code}
                            </span>
                            <span className="text-[#9CA3AF] text-xs shrink-0">•</span>
                            <span className="text-[#2E4A4A] truncate text-sm font-medium">
                              {a.name}
                            </span>
                          </div>
                          {a.locations?.city && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F2F3F3] text-[#6B7B7B] text-xs font-medium mt-0.5">
                              <HugeiconsIcon
                                icon={Location01Icon}
                                size={10}
                                color="currentColor"
                                strokeWidth={2}
                              />
                              <span className="truncate">
                                {a.locations.city}
                                {a.locations.state_code ? `, ${a.locations.state_code}` : ""}
                              </span>
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
