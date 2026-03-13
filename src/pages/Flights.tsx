import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getLogger } from "@/lib/logger";
import { Calendar } from "@/components/ui/calendar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  AirplaneLanding01Icon,
  Location01Icon,
  Location04Icon,
  AirportIcon,
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
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { format, startOfDay, getYear, getMonth, getDate, setYear, setMonth, setDate as setDayOfMonth, getDaysInMonth } from "date-fns";
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

/* ── Hook: recent IATA codes from flight_searches ─────────── */
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

/* ── Airport Search Sheet (full-screen bottom sheet) ──────── */
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
  airports: Airport[];
  selected: Airport[];
  onChange: (a: Airport[]) => void;
}) {
  const [query, setQuery] = useState("");
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const selectedIds = new Set(selected.map((a) => a.id));
  const recentCodes = useRecentAirports();

  // Map recent codes → Airport objects (for quick-select)
  const recentAirports = useMemo(
    () => recentCodes.map((code) => airports.find((a) => a.iata_code === code)).filter(Boolean) as Airport[],
    [recentCodes, airports],
  );

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setQuery("");
      // Use requestAnimationFrame + small timeout to ensure the element is
      // mounted and visible before focusing — triggers iOS keyboard reliably
      requestAnimationFrame(() => {
        setTimeout(() => {
          sheetInputRef.current?.focus();
        }, 50);
      });
    }
  }, [open]);

  // Close on Escape
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
    if (!selectedIds.has(a.id)) onChange([...selected, a]);
    onClose();
  };

  const addAreaAirports = (areaAirports: Airport[]) => {
    const newOnes = areaAirports.filter((a) => !selectedIds.has(a.id));
    if (newOnes.length > 0) onChange([...selected, ...newOnes]);
    onClose();
  };

  const content = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/40"
            onClick={onClose}
          />
          <motion.div
            key="airport-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            className="fixed inset-x-0 bottom-0 top-[5%] z-[9999] flex flex-col bg-white rounded-t-3xl shadow-2xl"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
            </div>

            {/* Title row — matches Notifications sheet */}
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

            {/* Search input row */}
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
                  placeholder={`Search airport or city…`}
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
                <div className="px-5 pt-6">
                  {recentAirports.length > 0 && (
                    <div className="mb-6">
                      <p className="text-base font-bold uppercase tracking-widest text-[#6B7B7B] mb-3">Recent Airports</p>
                      <div className="flex flex-nowrap gap-2.5 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
                        {recentAirports.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => addAirport(a)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-colors shrink-0 whitespace-nowrap"
                            style={{
                              background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
                              color: "#065F46",
                              border: "1px solid #6EE7B7",
                            }}
                          >
                            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={12} color="#059669" strokeWidth={2.5} />
                            <span className="font-bold">{a.iata_code}</span>
                            {a.locations?.city && (
                              <span className="opacity-60 font-medium">{a.locations.city}</span>
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
                <div className="py-3">
                  {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => {
                    const isSingle = cityGroup.startsWith("__single__");
                    const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
                    return (
                      <div key={cityGroup} className="mb-2 last:mb-0">
                        {!isSingle && (
                          <button
                            type="button"
                            onClick={() => addAreaAirports(cityAirports)}
                            className="w-full px-5 py-3 text-sm font-bold text-[#6B7B7B] uppercase tracking-wider flex items-center gap-2 hover:bg-[#F2F3F3] transition-colors"
                          >
                            <HugeiconsIcon icon={Location04Icon} size={20} color="currentColor" strokeWidth={2} className="opacity-60" />
                            {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                            <span className="ml-auto text-xs font-semibold text-[#059669]">Add all</span>
                          </button>
                        )}
                        {cityAirports.map((a) => {
                          const isSelected = selectedIds.has(a.id);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => addAirport(a)}
                              className={cn(
                                "w-full text-left pr-5 py-1.5 text-base hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors flex items-center gap-4 overflow-hidden",
                                isSingle ? "pl-5" : "pl-12",
                                isSelected && "bg-[#345C5A]/5",
                              )}
                            >
                              <HugeiconsIcon icon={AirportIcon} size={20} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1">
                                  <span className="font-bold text-[#345C5A] text-lg shrink-0">{a.iata_code}</span>
                                  <span className="text-[#6B7B7B] truncate text-base">{a.locations?.city ?? a.name}</span>
                                </div>
                                <p className="text-sm text-[#9CA3AF] truncate">{a.name}</p>
                              </div>
                              {isSelected && (
                                <span className="text-[#059669] text-sm font-bold shrink-0">✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="h-10" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const displayValue =
    selected.length > 0
      ? `${selected[0].iata_code} | ${selected[0].locations?.city ?? selected[0].name}`
      : "";

  const handleSelect = (newSelected: Airport[]) => {
    onChange(newSelected);
  };

  return (
    <div className={cn("relative", containerClassName)}>
      <AirportSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        label={label}
        airports={airports}
        selected={selected}
        onChange={handleSelect}
      />

      <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">{label}</label>

      <div
        className={cn("app-input-container", disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer")}
        style={{ minHeight: 48 }}
        onClick={() => {
          if (disabled) return;
          setSheetOpen(true);
        }}
      >
        <button type="button" tabIndex={-1} className="app-input-icon-btn">
          <HugeiconsIcon icon={icon} size={20} color="currentColor" strokeWidth={2} />
        </button>

        <span
          className={cn("app-input truncate flex-1 flex items-center", disabled && "cursor-not-allowed")}
          style={{ color: displayValue ? "#1F2937" : "#6B7280" }}
        >
          {displayValue || (disabled ? "" : placeholder)}
        </span>

        {selected.length > 0 && !disabled && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="app-input-reset app-input-reset--visible"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Date Picker Sheet ─────────────────────────────────────── */
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function DatePickerSheet({
  open,
  onClose,
  label,
  selected,
  onSelect,
  minDate,
  departureDate,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  selected?: Date;
  onSelect: (date: Date) => void;
  minDate?: Date;
  departureDate?: Date;
}) {
  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(minDate) : today;

  // Internal calendar state — sync from `selected` when sheet opens
  const [calDate, setCalDate] = useState<Date>(selected ?? today);

  // Dropdown state (controlled separately so dropdowns drive the calendar)
  const [selMonth, setSelMonth] = useState(getMonth(calDate));
  const [selDay, setSelDay] = useState(getDate(calDate));
  const [selYear, setSelYear] = useState(getYear(calDate));

  // When sheet opens, reset internal state to `selected` (or today)
  useEffect(() => {
    if (open) {
      const base = selected && selected >= min ? selected : today;
      setCalDate(base);
      setSelMonth(getMonth(base));
      setSelDay(getDate(base));
      setSelYear(getYear(base));
    }
  }, [open]);

  // Sync calendar when dropdowns change
  useEffect(() => {
    const daysInMonth = getDaysInMonth(new Date(selYear, selMonth, 1));
    const safeDay = Math.min(selDay, daysInMonth);
    const candidate = startOfDay(new Date(selYear, selMonth, safeDay));
    if (candidate >= min) {
      setCalDate(candidate);
      setSelDay(safeDay);
    }
  }, [selMonth, selDay, selYear]);

  // Sync dropdowns when calendar day is clicked
  const handleCalendarSelect = (date?: Date) => {
    if (!date) return;
    setCalDate(date);
    setSelMonth(getMonth(date));
    setSelDay(getDate(date));
    setSelYear(getYear(date));
  };

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleConfirm = () => {
    onSelect(calDate);
    onClose();
  };

  // Build year options: today's year → +2
  const currentYear = getYear(today);
  const years = [currentYear, currentYear + 1, currentYear + 2];

  // Build day options: 1..daysInMonth
  const daysInCurMonth = getDaysInMonth(new Date(selYear, selMonth, 1));
  const days = Array.from({ length: daysInCurMonth }, (_, i) => i + 1);

  // Navigate month with arrow buttons
  const goToPrevMonth = () => {
    const prev = new Date(selYear, selMonth - 1, 1);
    if (prev >= new Date(min.getFullYear(), min.getMonth(), 1)) {
      setSelMonth(getMonth(prev));
      setSelYear(getYear(prev));
    }
  };
  const goToNextMonth = () => {
    const next = new Date(selYear, selMonth + 1, 1);
    setSelMonth(getMonth(next));
    setSelYear(getYear(next));
  };

  const canGoPrev = new Date(selYear, selMonth - 1, 1) >= new Date(min.getFullYear(), min.getMonth(), 1);

  const content = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="date-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/40"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            key="date-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            className="fixed inset-x-0 bottom-0 top-[5%] z-[9999] flex flex-col bg-white rounded-t-3xl shadow-2xl"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  <HugeiconsIcon icon={label === "Return Date" ? CalendarCheckIn02Icon : CalendarCheckOut02Icon} size={15} color="white" strokeWidth={2} />
                </div>
                <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">{label}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
              >
                <HugeiconsIcon icon={CancelCircleIcon} size={22} color="currentColor" strokeWidth={1.8} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Month Year nav row */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-[19px] font-bold text-[#2E4A4A]">
                  {MONTHS[selMonth]}, {selYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={goToPrevMonth}
                    disabled={!canGoPrev}
                    className="h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#F2F3F3] disabled:opacity-30"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={goToNextMonth}
                    className="h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#F2F3F3]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>

              {/* Custom Calendar Grid */}
              <div className="px-4 pb-4">
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d) => (
                    <div key={d} className="flex items-center justify-center py-1">
                      <span className="text-xs font-semibold text-[#9CA3AF]">{d}</span>
                    </div>
                  ))}
                </div>
                {/* Calendar days */}
                {(() => {
                  const firstDay = new Date(selYear, selMonth, 1);
                  // Monday-based: Mon=0 … Sun=6
                  const startDow = (firstDay.getDay() + 6) % 7;
                  const daysCount = getDaysInMonth(firstDay);
                  const cells: (number | null)[] = [
                    ...Array(startDow).fill(null),
                    ...Array.from({ length: daysCount }, (_, i) => i + 1),
                  ];
                  // Pad to complete last row
                  while (cells.length % 7 !== 0) cells.push(null);

                  const weeks: (number | null)[][] = [];
                  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

                  // Range highlight: dep date → selected return date
                  const isReturnPicker = label === "Return Date" && !!departureDate;
                  const depDay = departureDate ? startOfDay(departureDate) : null;

                  return weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 mb-0.5">
                      {week.map((day, di) => {
                        if (!day) {
                          return <div key={di} />;
                        }
                        const thisDate = startOfDay(new Date(selYear, selMonth, day));
                        const isDisabled = thisDate < min;
                        const isSelected = calDate &&
                          thisDate.getFullYear() === calDate.getFullYear() &&
                          thisDate.getMonth() === calDate.getMonth() &&
                          thisDate.getDate() === calDate.getDate();
                        const isDeparture = depDay && thisDate.getTime() === depDay.getTime();
                        const isInRange = isReturnPicker && depDay && calDate &&
                          thisDate > depDay && thisDate < calDate;
                        const isRangeStart = isDeparture && isReturnPicker && calDate && depDay && calDate > depDay;
                        const isRangeEnd = isSelected && isReturnPicker && depDay && calDate && calDate > depDay;
                        const isToday = thisDate.getTime() === today.getTime();

                        // Determine which sides of the cell get the range background
                        const rangeLeft = (isInRange || isRangeEnd) && di !== 0;
                        const rangeRight = (isInRange || isRangeStart) && di !== 6;

                        return (
                          <div key={di} className="relative flex items-center justify-center py-1">
                            {/* Range band — left half */}
                            {rangeLeft && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-9" style={{ background: "#D1FAE5" }} />
                            )}
                            {/* Range band — right half */}
                            {rangeRight && (
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-9" style={{ background: "#D1FAE5" }} />
                            )}
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => !isDisabled && handleCalendarSelect(thisDate)}
                              className={cn(
                                "relative z-10 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                                isDisabled && "opacity-30 cursor-default",
                                (isSelected || isDeparture) && "text-[#065F46]",
                                !isSelected && !isDeparture && !isDisabled && "text-[#2E4A4A] hover:bg-[#F0FDF4]",
                                isInRange && !isSelected && !isDeparture && "text-[#059669]",
                                isToday && !isSelected && !isDeparture && "font-black",
                              )}
                              style={(isSelected || isDeparture) ? {
                                background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
                                border: "1px solid #6EE7B7",
                              } : undefined}
                            >
                              {day}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>

              {/* Bottom safe area */}
              <div className="h-4" />
            </div>

            {/* Select Date button — styled like Search Flights button */}
            <div className="px-5 py-4 border-t border-[#F0F1F1] bg-white">
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full h-12 rounded-full text-white text-sm font-black uppercase tracking-[0.45em] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
              >
                <HugeiconsIcon icon={GlobalSearchIcon} size={20} color="white" strokeWidth={2} />
                {calDate ? format(calDate, "MMM d, yyyy") : "Select Date"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

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


      <div className="px-6 pt-6 pb-8 relative z-10 flex flex-col gap-6 animate-fade-in">
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
              left: `calc(2px + (100% - 4px) * ${tripOptions.findIndex((o) => o.value === tripType)} / ${tripOptions.length - 1 + ACTIVE_TRIP_FLEX
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
                  "py-2.5 px-3 text-sm font-semibold rounded-full transition-all duration-300 relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                  isActive ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
                )}
              >
                <HugeiconsIcon
                  icon={opt.icon}
                  size={18}
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
              containerClassName="px-5 pt-5 pb-3"
            />

            <AnimatePresence initial={false}>
              {!searchAll && (
                <motion.div
                  key="arrival-input"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "visible" }}
                >
                  <MultiAirportSearchbox
                    label="Arrival"
                    icon={AirplaneLanding01Icon}
                    selected={arrivals}
                    onChange={setArrivals}
                    airports={airports}
                    disabled={false}
                    placeholder="Search airport or city..."
                    containerClassName="px-5 pt-3 pb-3"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dates */}
          <div className="px-5 pt-3 pb-0">
            {/* Date Picker Sheets (portaled) */}
            <DatePickerSheet
              open={depDateOpen}
              onClose={() => setDepDateOpen(false)}
              label="Departure Date"
              selected={departureDate}
              onSelect={(date) => {
                setDepartureDate(date);
                if (arrivalDate && startOfDay(arrivalDate) < startOfDay(date))
                  setArrivalDate(undefined);
              }}
              minDate={today}
            />
            {showReturnDate && (
              <DatePickerSheet
                open={retDateOpen}
                onClose={() => setRetDateOpen(false)}
                label="Return Date"
                selected={arrivalDate}
                onSelect={setArrivalDate}
                minDate={departureDate ?? today}
                departureDate={departureDate}
              />
            )}

            <div className={cn("grid gap-3", showReturnDate ? "grid-cols-2" : "grid-cols-1")}>
              <div>
                <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block cursor-pointer">
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

              {showReturnDate && (
                <div>
                  <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block cursor-pointer">Return Date</label>
                  <button
                    type="button"
                    className="app-input-container w-full text-left outline-none"
                    style={{ minHeight: 48 }}
                    onClick={() => setRetDateOpen(true)}
                  >
                    <span className="app-input-icon-btn">
                      <HugeiconsIcon icon={CalendarCheckIn02Icon} size={20} color="currentColor" strokeWidth={2} />
                    </span>
                    <span
                      className="flex-1 truncate px-[0.8em] py-[0.7em] text-base"
                      style={{ color: arrivalDate ? "#1F2937" : "#6B7280" }}
                    >
                      {arrivalDate ? format(arrivalDate, "MMM d, yyyy") : "Select date"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Search All Destinations */}
            <div className="flex items-center justify-end gap-2 pt-5 pb-5">
              <label htmlFor="search-all" className="text-sm font-bold text-[#059669] cursor-pointer select-none">
                Search all destinations
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
                    tripType: tripType === "round-trip" ? "Round Trip" : tripType === "day-trip" ? "Day Trip" : "One Way",
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

              try {
                if (tripType === "day-trip") {
                  // GET /api/flights/dayTrips — returns paired same-day turnarounds
                  const params = new URLSearchParams({
                    origin: originCode,
                    date: depFormatted,
                    nonstop: "true",
                    layovertime: "6",
                  });
                  edgeLog.info("Day Trip search", { origin: originCode, date: depFormatted });
                  const res = await fetch(`https://getmydata.fly.dev/api/flights/dayTrips?${params}`);
                  const json = await res.json();
                  data = json;
                  error = res.ok ? null : new Error(`HTTP ${res.status}`);
                } else if (tripType === "round-trip" && arrivalDate) {
                  // POST /api/flights/roundTrip — fetches outbound + return simultaneously
                  const body = {
                    origin: originCode,
                    destination: destinationCode,
                    departureDate: depFormatted,
                    returnDate: format(arrivalDate, "yyyy-MM-dd"),
                  };
                  edgeLog.info("Round Trip search", body);
                  const res = await fetch("https://getmydata.fly.dev/api/flights/roundTrip", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  const json = await res.json();
                  data = json;
                  error = res.ok ? null : new Error(`HTTP ${res.status}`);
                } else {
                  // POST /api/flights/search — one-way, search-all, multi-day
                  const body: Record<string, string> = {
                    origin: originCode,
                    departureDate: depFormatted,
                  };
                  if (!searchAll && destinationCode && destinationCode !== "__ALL__") {
                    body.destination = destinationCode; // may be "CITY:Chicago" or a plain IATA
                  }
                  edgeLog.info("One-way / Search-all search", { origin: originCode, dest: body.destination ?? "ALL", date: depFormatted });
                  const res = await fetch("https://getmydata.fly.dev/api/flights/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  const json = await res.json();
                  data = json;
                  error = res.ok ? null : new Error(`HTTP ${res.status}`);
                }
              } catch (fetchErr) {
                data = null;
                error = fetchErr;
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

                    // Build request_body capturing the outbound API call details
                    let requestBody: Record<string, unknown>;
                    if (tripType === "day-trip") {
                      requestBody = {
                        endpoint: "GET https://getmydata.fly.dev/api/flights/dayTrips",
                        params: { origin: originCode, date: depFormatted, nonstop: "true", layovertime: "6" },
                      };
                    } else if (tripType === "round-trip" && arrivalDate) {
                      requestBody = {
                        endpoint: "POST https://getmydata.fly.dev/api/flights/roundTrip",
                        headers: { "Content-Type": "application/json" },
                        body: {
                          origin: originCode,
                          destination: destinationCode,
                          departureDate: depFormatted,
                          returnDate: format(arrivalDate, "yyyy-MM-dd"),
                        },
                      };
                    } else {
                      const searchBody: Record<string, string> = { origin: originCode, departureDate: depFormatted };
                      if (!searchAll && destinationCode && destinationCode !== "__ALL__") {
                        searchBody.destination = destinationCode;
                      }
                      requestBody = {
                        endpoint: "POST https://getmydata.fly.dev/api/flights/search",
                        headers: { "Content-Type": "application/json" },
                        body: searchBody,
                      };
                    }

                    await supabase.from("flight_searches").insert({
                      user_id: user.id,
                      departure_airport: originCode,
                      arrival_airport: arrivalAirportValue,
                      departure_date: depFormatted,
                      return_date: arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null,
                      trip_type: tripTypeMapping,
                      all_destinations: searchAll ? "Yes" : "No",
                      json_body: normalized as any,
                      request_body: requestBody as any,
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
                    tripType: tripType === "round-trip" ? "Round Trip" : tripType === "day-trip" ? "Day Trip" : "One Way",
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
          <span className="uppercase tracking-[0.45em] text-sm font-black">{loading ? "Searching..." : "Search Flights"}</span>
          {!loading && <HugeiconsIcon icon={GlobalSearchIcon} size={20} color="white" strokeWidth={2} className="shrink-0" />}
        </button>
      </div>
    </>
  );
};

export default FlightsPage;
