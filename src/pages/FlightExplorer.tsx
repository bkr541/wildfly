import { useState, useEffect, useMemo, useRef } from "react";
import { DayPicker } from "react-day-picker";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  Location01Icon,
  AddCircleIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  airports,
  selected,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  airports: Airport[];
  selected: Airport | null;
  onChange: (a: Airport | null) => void;
}) {
  const [query, setQuery] = useState("");
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const recentCodes = useRecentAirports();

  const recentAirports = useMemo(
    () => recentCodes.map((code) => airports.find((a) => a.iata_code === code)).filter(Boolean) as Airport[],
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
      {} as Record<string, Airport[]>,
    );
    return Object.fromEntries(
      Object.entries(grouped).map(([key, aps]) => [aps.length > 1 ? key : `__single__${key}`, aps]),
    );
  }, [query, airports, shouldShow]);

  const addAirport = (a: Airport) => {
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
            Select Departure
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

      {/* Recent chips */}
      {!shouldShow && recentAirports.length > 0 && (
        <div className="px-5 pb-3">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recentAirports.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => addAirport(a)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-card text-card-foreground hover:bg-muted transition-colors"
              >
                {a.iata_code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5">
        {shouldShow && Object.keys(groupedAirports).length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No airports found</p>
        )}
        {Object.entries(groupedAirports).map(([groupKey, groupAirports]) => {
          const isSingle = groupKey.startsWith("__single__");
          const displayKey = isSingle ? groupKey.replace("__single__", "") : groupKey;
          return (
            <div key={groupKey} className="mb-3">
              {!isSingle && groupAirports.length > 1 && (
                <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">{displayKey}</p>
              )}
              {groupAirports.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => addAirport(a)}
                  className="w-full text-left py-2.5 px-1 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors"
                >
                  <span className="text-sm font-bold text-foreground">{a.iata_code}</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {a.locations?.city ?? a.name}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
        <div className="h-10" />
      </div>
    </BottomSheet>
  );
}

/* ── Flight Explorer Page ──────────────────────────── */
const FlightExplorer = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [departure, setDeparture] = useState<Airport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const displayValue = departure
    ? `${departure.iata_code} | ${departure.locations?.city ?? departure.name}`
    : "";

  return (
    <div className="flex-1 flex flex-col relative z-10 animate-fade-in">
      {/* Airport Search Sheet */}
      <AirportSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        airports={airports}
        selected={departure}
        onChange={setDeparture}
      />

      {/* Departure Airport Input */}
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
            <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure</label>
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
          </div>
        </div>
      </div>

      {/* Calendar — top ~1/3 */}
      <div className="px-4 pt-1 pb-3">
        <div className="rounded-2xl overflow-hidden shadow-lg border border-border/30 bg-card">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            showOutsideDays
            weekStartsOn={1}
            className="!p-0 w-full explorer-calendar"
            classNames={{
              months: "w-full",
              month: "w-full",
              caption:
                "flex items-center justify-between px-4 py-2.5 bg-primary text-primary-foreground rounded-t-2xl",
              caption_label: "text-base font-bold tracking-wide",
              nav: "flex items-center gap-2",
              nav_button:
                "h-7 w-7 flex items-center justify-center rounded-full text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15 transition-colors",
              nav_button_previous: "",
              nav_button_next: "",
              head_row: "flex w-full bg-secondary text-secondary-foreground/70",
              head_cell:
                "flex-1 text-center text-xs font-semibold py-1.5 uppercase tracking-wider",
              table: "w-full border-collapse",
              row: "flex w-full",
              cell: "flex-1 aspect-[1/0.82] flex items-center justify-center p-px",
              day: "h-full w-full flex items-center justify-center rounded-full text-sm font-medium text-card-foreground hover:bg-muted transition-colors cursor-pointer",
              day_selected:
                "!bg-primary !text-primary-foreground font-bold",
              day_today:
                "ring-2 ring-ring ring-inset font-bold",
              day_outside: "text-muted-foreground/40",
              day_disabled: "text-muted-foreground/30 cursor-not-allowed",
              day_range_middle: "",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => (
                <FontAwesomeIcon icon={faChevronLeft} className="h-3.5 w-3.5" />
              ),
              IconRight: () => (
                <FontAwesomeIcon icon={faChevronRight} className="h-3.5 w-3.5" />
              ),
            }}
          />
        </div>
      </div>

      {/* Bottom section placeholder */}
      <div className="flex-1 px-5 pb-4">
        <p className="text-muted-foreground text-sm">
          Select a date to explore available flights.
        </p>
      </div>
    </div>
  );
};

export default FlightExplorer;
