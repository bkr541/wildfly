import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SearchingIcon,
  AirportIcon,
  AirplaneTakeOff01Icon,
  Location01Icon,
  Location04Icon,
  Cancel01Icon,
  AddCircleIcon,
  CalendarRemove02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  Rocket01Icon,
  AirplaneSeatIcon,
  AirplaneLanding01Icon,
} from "@hugeicons/core-free-icons";
import { isBlackoutDate } from "@/utils/blackoutDates";

import { supabase } from "@/integrations/supabase/client";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";

interface Airport {
  id: number;
  name: string;
  iata_code: string;
  location_id?: number | null;
  locations?: {
    city: string;
    state_code: string;
    region: string;
  };
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface FlightSearchExample {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_date: string;
  trip_type: string | null;
  gowild_found: boolean | null;
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function formatDateLabel(date: string): string {
  try {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  } catch {
    return date;
  }
}

/* ── Airport Search Sheet (single-select, public) ──────────── */
function AirportSearchSheet({
  open,
  onClose,
  airports,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  airports: Airport[];
  onSelect: (a: Airport) => void;
}) {
  const [query, setQuery] = useState("");
  const sheetInputRef = useRef<HTMLInputElement>(null);

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
    if (!shouldShow) return {} as Record<string, Airport[]>;
    const q = query.toLowerCase();
    const filtered = airports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q) ||
          (a.locations?.city && a.locations.city.toLowerCase().includes(q)),
      )
      .slice(0, 40);

    const grouped = filtered.reduce(
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

  return (
    <BottomSheet open={open} onClose={onClose} style={{ top: "5%" }}>
      <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <HugeiconsIcon icon={Location01Icon} size={15} color="white" strokeWidth={2} />
          </div>
          <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">Select Airport</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
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
              const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
              return (
                <div key={cityGroup} className="mb-2 last:mb-0">
                  {!isSingle && (
                    <div className="w-full px-5 py-3 text-sm font-bold text-[#6B7B7B] uppercase tracking-wider flex items-center gap-2">
                      <HugeiconsIcon icon={Location04Icon} size={20} color="currentColor" strokeWidth={2} className="opacity-60" />
                      {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                    </div>
                  )}
                  {cityAirports.map((a, aIdx) => (
                    <div key={a.id}>
                      {aIdx > 0 && <div className="border-t border-[#F0F1F1] mx-1" />}
                      <button
                        type="button"
                        onClick={() => { onSelect(a); onClose(); }}
                        className={cn(
                          "w-full text-left pr-4 py-1.5 text-base hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors flex items-center gap-3 overflow-hidden",
                          isSingle ? "pl-4" : "pl-14",
                        )}
                      >
                        <HugeiconsIcon icon={AirportIcon} size={22} color="#6B7B7B" strokeWidth={2} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#345C5A] text-sm shrink-0">{a.iata_code}</span>
                            <span className="text-[#9CA3AF] text-xs shrink-0">•</span>
                            <span className="text-[#2E4A4A] truncate text-sm font-medium">{a.name}</span>
                          </div>
                          {a.locations?.city && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F2F3F3] text-[#6B7B7B] text-xs font-medium mt-0.5">
                              <HugeiconsIcon icon={Location01Icon} size={10} color="currentColor" strokeWidth={2} />
                              <span className="truncate">{a.locations.city}{a.locations.state_code ? `, ${a.locations.state_code}` : ""}</span>
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

/* ── Blackout Dates Calendar ───────────────────────────────── */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function BlackoutCalendar() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="px-5 pt-4 pb-5">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prev}
          className="h-9 w-9 rounded-full flex items-center justify-center text-[#345C5A] hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors"
          aria-label="Previous month"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} color="currentColor" strokeWidth={2} />
        </button>
        <div className="text-base font-bold text-[#2E4A4A] text-center w-[170px] tabular-nums shrink-0">
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          type="button"
          onClick={next}
          className="h-9 w-9 rounded-full flex items-center justify-center text-[#345C5A] hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors"
          aria-label="Next month"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="currentColor" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-[#9CA3AF] uppercase py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-x-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="h-10" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const blackout = isBlackoutDate(dateStr);
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className="h-10 flex items-center justify-center">
              <div
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors",
                  blackout && "bg-black text-white",
                  !blackout && isToday && "ring-2 ring-[#10B981] text-[#059669] font-bold",
                  !blackout && !isToday && "text-[#2E4A4A]",
                )}
              >
                {d}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#F0F1F1]">
        <div className="h-3 w-3 rounded-full bg-black" />
        <span className="text-xs text-[#6B7B7B] font-medium">GoWild blackout date</span>
      </div>
    </div>
  );
}

/* ── GoWild Seat Availability Calendar ─────────────────────── */
function SeatAvailabilityCalendar({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [seatsByDate, setSeatsByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Query a wide window (past + future) so historical seat data shows up
      // and navigating months doesn't require refetching.
      const start = new Date();
      start.setFullYear(start.getFullYear() - 2);
      const end = new Date();
      end.setFullYear(end.getFullYear() + 2);
      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const { data, error } = await (supabase.rpc as any)(
        "get_route_gowild_seat_calendar",
        {
          p_origin_iata: origin,
          p_destination_iata: destination,
          p_start_date: toDateStr(start),
          p_end_date: toDateStr(end),
        },
      );
      if (cancelled) return;
      const map: Record<string, number> = {};
      if (!error && Array.isArray(data)) {
        for (const row of data as any[]) {
          const date: string = row.travel_date;
          if (!date) continue;
          const seats = row.available_seats;
          if (seats != null && seats > 0) map[date] = seats;
        }
      }
      setSeatsByDate(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [origin, destination]);


  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="px-5 pt-4 pb-5">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prev}
          className="h-9 w-9 rounded-full flex items-center justify-center text-[#345C5A] hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors"
          aria-label="Previous month"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} color="currentColor" strokeWidth={2} />
        </button>
        <div className="text-base font-bold text-[#2E4A4A] text-center w-[170px] tabular-nums shrink-0">
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          type="button"
          onClick={next}
          className="h-9 w-9 rounded-full flex items-center justify-center text-[#345C5A] hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors"
          aria-label="Next month"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="currentColor" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-[#9CA3AF] uppercase py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-x-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="h-12" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const seats = seatsByDate[dateStr];
          const hasSeats = seats != null && seats > 0;
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className="h-12 flex items-center justify-center">
              <div className="relative h-9 w-9 flex items-center justify-center">
                <div
                  className={cn(
                    "h-[30px] w-[30px] flex items-center justify-center rounded-full text-sm transition-colors tabular-nums",
                    hasSeats && "bg-[#4CAF50] text-white font-semibold",
                    !hasSeats && isToday && "ring-2 ring-[#10B981] text-[#059669] font-bold",
                    !hasSeats && !isToday && "text-[#2E4A4A] font-medium",
                  )}
                >
                  {d}
                </div>
                {hasSeats && (
                  <span
                    className="absolute -bottom-2.5 -right-2.5 h-[27px] min-w-[27px] px-1 flex items-center justify-center rounded-full bg-[#059669] text-white text-[13px] font-bold leading-none tabular-nums ring-[3px] ring-white"
                  >
                    {seats}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-[#F0F1F1]">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#059669]" />
          <span className="text-xs text-[#6B7B7B] font-medium">
            {loading ? "Loading seat data…" : "Most recent GoWild seats observed for this date"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#059669]" />
          <span className="text-xs text-[#6B7B7B] font-medium">
            Average GoWild Seat count availability
          </span>
        </div>
      </div>
    </div>
  );
}


const PreviewPage = () => {

  const [airports, setAirports] = useState<Airport[]>([]);
  const [selected, setSelected] = useState<Airport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<FlightSearchExample[] | null>(null);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<Record<string, { status: "loading" | "ready" | "empty"; flights?: any[] }>>({});

  // GoWild Seat Availability section state
  const [seatDep, setSeatDep] = useState<Airport | null>(null);
  const [seatArr, setSeatArr] = useState<Airport | null>(null);
  const [seatSheet, setSeatSheet] = useState<null | "dep" | "arr">(null);
  const [seatRoute, setSeatRoute] = useState<{ origin: string; destination: string } | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code, location_id, locations(city, state_code, region)")
        .eq("is_active", true)
        .order("name");
      if (data) setAirports(data as unknown as Airport[]);
    })();
  }, []);

  const airportMap = useMemo(() => {
    const m: Record<string, Airport> = {};
    for (const a of airports) m[a.iata_code] = a;
    return m;
  }, [airports]);

  const displayValue = selected
    ? `${selected.iata_code} | ${selected.locations?.city ?? selected.name}`
    : "";

  const handlePreview = async () => {
    if (!selected) {
      setError("Please select an airport to preview flights.");
      return;
    }
    setError(null);
    setExpandedId(null);
    setLoadingExamples(true);
    setExamples(null);
    const { data } = await supabase
      .from("flight_searches")
      .select("id, departure_airport, arrival_airport, departure_date, trip_type, gowild_found")
      .eq("departure_airport", selected.iata_code)
      .not("arrival_airport", "is", null)
      .order("search_timestamp", { ascending: false })
      .limit(50);
    const rows = (data ?? []).filter(
      (r: any) => r.arrival_airport && !r.arrival_airport.startsWith("CITY:"),
    ) as FlightSearchExample[];
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    setExamples(rows.slice(0, 5));
    setLoadingExamples(false);
  };

  const handleExpand = async (ex: FlightSearchExample) => {
    if (expandedId === ex.id) { setExpandedId(null); return; }
    setExpandedId(ex.id);
    if (payloads[ex.id]) return;
    setPayloads((p) => ({ ...p, [ex.id]: { status: "loading" } }));
    const cacheKey = await sha256(`${ex.departure_airport}|${ex.arrival_airport}|${ex.departure_date}`);
    const { data } = await (supabase.from("flight_search_cache") as any)
      .select("payload")
      .eq("cache_key", cacheKey)
      .eq("status", "ready")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const flights: any[] = data?.payload?.flights ?? [];
    setPayloads((p) => ({
      ...p,
      [ex.id]: { status: flights.length > 0 ? "ready" : "empty", flights },
    }));
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
    >
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-8 pb-10 gap-4">
        {/* Header */}
        <div className="px-1 mb-2">
          <div className="flex items-baseline gap-1.5 select-none flex-wrap">
            <span className="text-[22px] font-medium text-[#6B7280]">Wildfly</span>
            <span className="text-[22px] font-black tracking-widest uppercase text-[#10B981]">Preview</span>
          </div>
          <p className="text-sm text-[#6B7B7B] mt-0.5">
            See when you can fly. Discover what Wildfly can help you find.
          </p>
        </div>

        {/* Flight Preview group */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07)",
          }}
        >
          <div className="flex items-center gap-2 px-5 py-4">
            <HugeiconsIcon icon={SearchingIcon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
            <div className="flex-1">
              <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Flight Preview</p>
              <p className="text-xs text-[#6B7B7B]">
                See how Wildfly collects, analyzes, and presents flight data
              </p>
            </div>
          </div>

          <div className="px-5 pt-4 pb-5">
            <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure Airport</label>

            <AirportSearchSheet
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              airports={airports}
              onSelect={(a) => { setSelected(a); setError(null); }}
            />

            <div
              className={cn("app-input-container cursor-pointer", error && "app-input-error")}
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
              {selected && (
                <button
                  type="button"
                  aria-label="Clear airport"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(null);
                  }}
                  className="app-input-reset app-input-reset--visible"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>

            {error && (
              <p className="text-xs font-medium text-[#ef4444] mt-2 ml-1">{error}</p>
            )}

            <button
              type="button"
              onClick={handlePreview}
              disabled={loadingExamples}
              className="mt-5 w-full h-12 rounded-full font-bold text-sm tracking-widest uppercase text-white transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              {loadingExamples ? "Loading…" : "Preview Flights"}
            </button>

            {examples && examples.length === 0 && (
              <p className="text-sm text-[#6B7B7B] mt-5 text-center">
                No example searches found for {selected?.iata_code}.
              </p>
            )}

            {examples && examples.length > 0 && (
              <div className="mt-5 flex flex-col gap-3">
                <p className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider ml-1">
                  Example Searches
                </p>
                {examples.map((ex) => {
                  const destAirport = airportMap[ex.arrival_airport];
                  const destCity = destAirport?.locations?.city ?? ex.arrival_airport;
                  const destState = destAirport?.locations?.state_code ?? "";
                  const bgImage = destAirport?.location_id
                    ? `/assets/locations/${destAirport.location_id}_background.png`
                    : null;
                  const isOpen = expandedId === ex.id;
                  const isGoWild = ex.gowild_found === true;
                  const payload = payloads[ex.id];
                  return (
                    <div
                      key={ex.id}
                      className="rounded-2xl overflow-hidden bg-white transition-all"
                      style={{
                        boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)",
                        border: isGoWild ? "2px solid #FFD700" : "1px solid #E8EBEB",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleExpand(ex)}
                        className="block w-full text-left"
                      >
                        {/* City photo header */}
                        <div className="relative h-[120px] overflow-hidden bg-[#C8D5D5]">
                          {bgImage ? (
                            <img
                              src={bgImage}
                              alt={destCity}
                              className="w-full h-full object-cover absolute inset-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)", opacity: 0.6 }}
                            />
                          )}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background:
                                "linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.22) 40%, rgba(255,255,255,0.62) 72%, rgba(255,255,255,0.92) 100%)",
                            }}
                          />
                          {/* IATA | City, State */}
                          <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 pointer-events-none flex items-center gap-0">
                            <span
                              className="text-[34px] font-black leading-none"
                              style={{
                                color: isGoWild ? "#047857" : "#0F2040",
                                textShadow: "0 1px 3px rgba(255,255,255,0.6)",
                              }}
                            >
                              {ex.arrival_airport}
                            </span>
                            <span
                              className="font-bold text-[20px] leading-none"
                              style={{ color: "#0F2040", textShadow: "0 1px 2px rgba(255,255,255,0.5)", margin: "0 6px" }}
                            >
                              |
                            </span>
                            <span
                              className="uppercase tracking-wide font-semibold text-[15px] leading-none"
                              style={{ color: "#0F2040", textShadow: "0 1px 2px rgba(255,255,255,0.5)" }}
                            >
                              {destCity}
                              {destState && destState !== "None" && <span>{", "}{destState}</span>}
                            </span>
                          </div>
                          {/* GoWild badge */}
                          {isGoWild && (
                            <div
                              className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-xl px-2.5 py-1 bg-[#059669]"
                              style={{ border: "2px solid #FFFFFF", boxShadow: "0 2px 8px rgba(5,150,105,0.30)" }}
                            >
                              <HugeiconsIcon icon={Rocket01Icon} size={11} color="white" strokeWidth={2} />
                              <span className="text-[10px] font-bold leading-none text-white">GoWild</span>
                            </div>
                          )}
                          {/* Chevron */}
                          <div
                            className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center bg-white/85 transition-transform"
                            style={{
                              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                          >
                            <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#345C5A" strokeWidth={2.5} />
                          </div>
                        </div>

                        {/* Sub-row */}
                        <div className="px-4 py-2 flex items-center justify-between border-t border-[#F0F1F1]">
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#345C5A]">
                            <span>{ex.departure_airport}</span>
                            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={13} color="#6B7B7B" strokeWidth={2} />
                            <span>{ex.arrival_airport}</span>
                          </div>
                          <span className="text-[11px] font-medium text-[#6B7B7B]">
                            {formatDateLabel(ex.departure_date)}
                          </span>
                        </div>
                      </button>

                      {/* Expanded: flights from cache */}
                      {isOpen && (
                        <div className="border-t border-[#F0F1F1] bg-[#F8FAFA] px-3 py-3">
                          {!payload || payload.status === "loading" ? (
                            <p className="text-xs text-[#6B7B7B] text-center py-4">Loading cached flights…</p>
                          ) : payload.status === "empty" ? (
                            <p className="text-xs text-[#6B7B7B] text-center py-4">
                              No cached results for this search.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {payload.flights!.slice(0, 8).map((f: any, i: number) => {
                                const depLeg = f.legs?.[0];
                                const arrLeg = f.legs?.[f.legs.length - 1];
                                const isGW = (f.fares?.go_wild ?? f.rawPayload?.fares?.go_wild?.total) != null;
                                const cheapest = [f.fares?.basic, f.fares?.economy, f.fares?.premium]
                                  .filter((v): v is number => v != null)
                                  .sort((a, b) => a - b)[0];
                                return (
                                  <div
                                    key={i}
                                    className={cn(
                                      "rounded-xl bg-white px-3 py-2.5",
                                      isGW ? "border border-[#059669]" : "border border-[#E8EBEB]",
                                    )}
                                    style={{ boxShadow: "0 2px 8px 0 rgba(53,92,90,0.06)" }}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold text-[#6B7B7B]">
                                          {f.flightNumber ?? f.airline ?? "Frontier"}
                                        </span>
                                        {isGW && (
                                          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 h-4 text-[9px] font-bold text-white bg-[#059669]">
                                            <HugeiconsIcon icon={Rocket01Icon} size={9} color="#FFFFFF" strokeWidth={2.5} />
                                            GoWild
                                          </span>
                                        )}
                                      </div>
                                      {cheapest != null && (
                                        <span className="text-[14px] font-black text-[#1A2E2E] tabular-nums">
                                          ${cheapest.toFixed(0)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                      <div className="text-left">
                                        <div className="text-[16px] font-bold text-[#1A2E2E] tabular-nums leading-tight">
                                          {formatTime(depLeg?.departure_time ?? "")}
                                        </div>
                                        <div className="text-[10px] font-semibold text-[#6B7B7B]">
                                          {depLeg?.origin}
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-center text-[10px] text-[#9CA3AF] font-medium">
                                        <div className="w-12 h-px bg-[#C8D5D5] mb-1" />
                                        <span>{f.total_duration || "—"}</span>
                                        <span className="mt-0.5">
                                          {(f.legs?.length ?? 1) === 1 ? "Nonstop" : `${(f.legs?.length ?? 1) - 1} stop`}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-[16px] font-bold text-[#1A2E2E] tabular-nums leading-tight">
                                          {formatTime(arrLeg?.arrival_time ?? "")}
                                        </div>
                                        <div className="text-[10px] font-semibold text-[#6B7B7B]">
                                          {arrLeg?.destination}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>


        {/* GoWild Seat Availability group */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07)",
          }}
        >
          <div className="flex items-center gap-2 px-5 py-4">
            <HugeiconsIcon icon={AirplaneSeatIcon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
            <div className="flex-1">
              <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">GoWild Seat Aval.</p>
              <p className="text-xs text-[#6B7B7B]">
                Historical GoWild seat availability by date for a route
              </p>
            </div>
          </div>

          <div className="px-5 pt-4 pb-5">
            <AirportSearchSheet
              open={seatSheet !== null}
              onClose={() => setSeatSheet(null)}
              airports={airports}
              onSelect={(a) => {
                if (seatSheet === "dep") setSeatDep(a);
                else if (seatSheet === "arr") setSeatArr(a);
                setSeatError(null);
              }}
            />

            <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Departure Airport</label>
            <div
              className="app-input-container cursor-pointer"
              style={{ minHeight: 48 }}
              onClick={() => setSeatSheet("dep")}
            >
              <button type="button" tabIndex={-1} className="app-input-icon-btn">
                <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              <span
                className="app-input truncate flex-1 flex items-center"
                style={{ color: seatDep ? "#1F2937" : "#6B7280" }}
              >
                {seatDep ? `${seatDep.iata_code} | ${seatDep.locations?.city ?? seatDep.name}` : "Search airport or city..."}
              </span>
              {seatDep && (
                <button
                  type="button"
                  aria-label="Clear departure airport"
                  onClick={(e) => { e.stopPropagation(); setSeatDep(null); }}
                  className="app-input-reset app-input-reset--visible"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>

            <label className="text-sm font-bold text-[#059669] ml-1 mb-0 mt-3 block">Arrival Airport</label>
            <div
              className="app-input-container cursor-pointer"
              style={{ minHeight: 48 }}
              onClick={() => setSeatSheet("arr")}
            >
              <button type="button" tabIndex={-1} className="app-input-icon-btn">
                <HugeiconsIcon icon={AirplaneLanding01Icon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              <span
                className="app-input truncate flex-1 flex items-center"
                style={{ color: seatArr ? "#1F2937" : "#6B7280" }}
              >
                {seatArr ? `${seatArr.iata_code} | ${seatArr.locations?.city ?? seatArr.name}` : "Search airport or city..."}
              </span>
              {seatArr && (
                <button
                  type="button"
                  aria-label="Clear arrival airport"
                  onClick={(e) => { e.stopPropagation(); setSeatArr(null); }}
                  className="app-input-reset app-input-reset--visible"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>

            {seatError && (
              <p className="text-xs font-medium text-[#ef4444] mt-2 ml-1">{seatError}</p>
            )}

            <button
              type="button"
              onClick={() => {
                if (!seatDep || !seatArr) {
                  setSeatError("Please select both a departure and arrival airport.");
                  return;
                }
                if (seatDep.iata_code === seatArr.iata_code) {
                  setSeatError("Departure and arrival airports must differ.");
                  return;
                }
                setSeatError(null);
                setSeatRoute({ origin: seatDep.iata_code, destination: seatArr.iata_code });
              }}
              className="mt-5 w-full h-12 rounded-full font-bold text-sm tracking-widest uppercase text-white transition-opacity hover:opacity-90 active:opacity-75"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              View Seats
            </button>

            {seatRoute && (
              <div className="mt-4 -mx-5">
                <SeatAvailabilityCalendar
                  key={`${seatRoute.origin}-${seatRoute.destination}`}
                  origin={seatRoute.origin}
                  destination={seatRoute.destination}
                />
              </div>
            )}
          </div>
        </div>


        {/* Blackout Dates group */}

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07)",
          }}
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#F0F1F1]">
            <HugeiconsIcon icon={CalendarRemove02Icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
            <div className="flex-1">
              <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Blackout Dates</p>
              <p className="text-xs text-[#6B7B7B]">GoWild Blackout Dates Calendar</p>
            </div>
          </div>
          <BlackoutCalendar />
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;

