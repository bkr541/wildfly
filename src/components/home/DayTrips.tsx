import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SunCloud01Icon,
  Calendar03Icon,
  Clock01Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayTripPair {
  id: string;
  date: string; // YYYY-MM-DD
  outbound: {
    origin: string;
    destination: string;
    departureTime: string; // ISO or "HH:MM AM/PM"
    arrivalTime: string;
    duration: string;
    stops: number;
    goWild: boolean;
  };
  inbound: {
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
    goWild: boolean;
  };
  groundMinutes: number; // minutes on the ground at destination
}

interface Props {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: (page: string, data?: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const HEADER_GREEN = "#2D6A4F";
const CARD_SHADOW =
  "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hex string (same as Home.tsx) */
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert "HH:MM AM/PM" + date "YYYY-MM-DD" → Date */
function parseTimeString(timeStr: string, dateStr: string): Date | null {
  try {
    const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) {
      // might already be ISO
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? null : d;
    }
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`);
  } catch {
    return null;
  }
}

/** Format a time string for display: "9:12 AM" */
function formatDisplayTime(timeStr: string, dateStr: string): string {
  const d = parseTimeString(timeStr, dateStr);
  if (!d) return timeStr;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Format duration: "02:44:00" or "2 hrs 44 min" → "2h 44m" */
function formatDuration(duration: string): string {
  // HH:MM:SS
  const hms = duration.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
  // "X hrs Y min"
  const wordy = duration.match(/(\d+)\s*h(?:rs?)?(?:\s+(\d+)\s*m(?:in)?)?/i);
  if (wordy) {
    const h = parseInt(wordy[1], 10);
    const m = wordy[2] ? parseInt(wordy[2], 10) : 0;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
  return duration;
}

/** Format ground minutes: "13h 02m" */
function formatGround(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Parse day-trip API payload and apply the 4 filters:
 * 1. Outbound dep + return arr within same day (00:01–23:59)
 * 2. Ground time at destination ≥ 6 hours
 * 3. Both flights non-stop (stops === 0)
 * 4. Both flights have a GoWild fare
 */
function parseDayTripPairs(payload: any, dateStr: string): DayTripPair[] {
  const rawFlights: any[] = payload?.dayTrips ?? payload?.flights ?? [];
  const pairs: DayTripPair[] = [];
  const seenDests = new Set<string>();

  for (const f of rawFlights) {
    const dest = (f.destination ?? f.arrive ?? "").toUpperCase();
    if (!dest || seenDests.has(dest)) continue;

    // The dayTrips API returns flights with an embedded `inbound` object
    const inbound = f.inbound ?? f.return_flight ?? null;
    if (!inbound) continue;

    // ── Condition 3: both non-stop ────────────────────────────────────────────
    const outStops =
      f.stops != null ? Number(f.stops) : (Array.isArray(f.segments) ? f.segments.length - 1 : -1);
    const inStops =
      inbound.stops != null ? Number(inbound.stops) : (Array.isArray(inbound.segments) ? inbound.segments.length - 1 : -1);
    if (outStops !== 0 || inStops !== 0) continue;

    // ── Condition 4: both GoWild ──────────────────────────────────────────────
    const outGoWild =
      (f.fares?.go_wild != null && f.fares.go_wild !== -1) ||
      (f.rawPayload?.fares?.go_wild?.total != null);
    const inGoWild =
      (inbound.fares?.go_wild != null && inbound.fares.go_wild !== -1) ||
      (inbound.rawPayload?.fares?.go_wild?.total != null);
    if (!outGoWild || !inGoWild) continue;

    // ── Parse times ───────────────────────────────────────────────────────────
    const outDepTime = f.departureTime ?? f.depart_time ?? f.departure_time ?? "";
    const outArrTime = f.arrivalTime ?? f.arrive_time ?? f.arrival_time ?? "";
    const inDepTime = inbound.departureTime ?? inbound.depart_time ?? inbound.departure_time ?? "";
    const inArrTime = inbound.arrivalTime ?? inbound.arrive_time ?? inbound.arrival_time ?? "";

    const outDep = parseTimeString(outDepTime, dateStr);
    const outArr = parseTimeString(outArrTime, dateStr);
    const inDep = parseTimeString(inDepTime, dateStr);
    const inArr = parseTimeString(inArrTime, dateStr);

    if (!outDep || !outArr || !inDep || !inArr) continue;

    // ── Condition 1: outbound dep AND return arr within same calendar day ─────
    const dayStart = new Date(`${dateStr}T00:01:00`);
    const dayEnd = new Date(`${dateStr}T23:59:00`);
    if (outDep < dayStart || outDep > dayEnd) continue;
    if (inArr < dayStart || inArr > dayEnd) continue;

    // ── Condition 2: ground time ≥ 6 hours ────────────────────────────────────
    const groundMs = inDep.getTime() - outArr.getTime();
    const groundMinutes = Math.floor(groundMs / 60000);
    if (groundMinutes < 360) continue; // < 6 hours

    seenDests.add(dest);
    pairs.push({
      id: `${dest}-${dateStr}`,
      date: dateStr,
      outbound: {
        origin: (f.origin ?? "").toUpperCase(),
        destination: dest,
        departureTime: outDepTime,
        arrivalTime: outArrTime,
        duration: f.duration ?? f.total_duration ?? "",
        stops: outStops,
        goWild: outGoWild,
      },
      inbound: {
        origin: dest,
        destination: (inbound.origin ?? f.origin ?? "").toUpperCase(),
        departureTime: inDepTime,
        arrivalTime: inArrTime,
        duration: inbound.duration ?? inbound.total_duration ?? "",
        stops: inStops,
        goWild: inGoWild,
      },
      groundMinutes,
    });

    if (pairs.length >= 3) break;
  }

  return pairs;
}

// ─── Sub-component: Flight Column ────────────────────────────────────────────

function FlightColumn({
  label,
  origin,
  destination,
  depTime,
  arrTime,
  duration,
  date,
  align,
}: {
  label: string;
  origin: string;
  destination: string;
  depTime: string;
  arrTime: string;
  duration: string;
  date: string;
  align: "left" | "right";
}) {
  const labelBg = align === "left" ? "bg-[#F0F4F0] text-[#2D6A4F]" : "bg-[#2D2D2D] text-white";
  const ta = align === "left" ? "text-left" : "text-right";
  const labelAlign = align === "left" ? "justify-start" : "justify-end";

  return (
    <div className={`flex flex-col gap-0.5 flex-1 ${ta}`}>
      {/* Label chip */}
      <div className={`flex ${labelAlign} mb-1`}>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${labelBg}`}>
          {label}
        </span>
      </div>

      {/* Origin */}
      <span className="text-[26px] font-black text-[#1A2E2E] leading-none tracking-tight">{origin}</span>
      <span className="text-[12px] font-bold text-[#374151] leading-none">
        {formatDisplayTime(depTime, date)}
      </span>
      <span className="text-[10px] font-medium text-[#6B7280] leading-none mb-1.5">Departure</span>

      {/* Duration pill */}
      <div className={`flex ${labelAlign}`}>
        <span className="text-[10px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Destination */}
      <span className="text-[26px] font-black text-[#1A2E2E] leading-none tracking-tight mt-1.5">{destination}</span>
      <span className="text-[12px] font-bold text-[#374151] leading-none">
        {formatDisplayTime(arrTime, date)}
      </span>
      <span className="text-[10px] font-medium text-[#6B7280] leading-none">Arrival</span>
    </div>
  );
}

// ─── Sub-component: Trip Card ─────────────────────────────────────────────────

function DayTripCard({ pair, index }: { pair: DayTripPair; index: number }) {
  let formattedDate = pair.date;
  try {
    formattedDate = format(new Date(pair.date + "T12:00:00"), "MMMM d, yyyy");
  } catch { /* keep raw */ }

  return (
    <motion.div
      key={pair.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.28, delay: index * 0.07, ease: EASE },
      }}
      className="flex-shrink-0 w-[272px] rounded-2xl overflow-hidden text-left"
      style={{
        scrollSnapAlign: "start",
        background: "rgba(255,255,255,0.95)",
        border: "1px solid rgba(255,255,255,0.65)",
        boxShadow: CARD_SHADOW,
      }}
    >
      {/* Green date header */}
      <div
        className="relative flex items-center justify-center gap-1.5 px-4 py-2.5"
        style={{ background: HEADER_GREEN }}
      >
        <HugeiconsIcon icon={Calendar03Icon} size={14} color="white" strokeWidth={2} />
        <span className="text-white font-bold text-[13px] leading-none">{formattedDate}</span>
        {/* Triangle notch */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(100%-1px)]"
          style={{
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: `9px solid ${HEADER_GREEN}`,
          }}
        />
      </div>

      {/* Card body */}
      <div className="px-4 pt-4 pb-4">
        {/* Flight columns */}
        <div className="flex gap-2 items-start">
          <FlightColumn
            label="Outbound"
            origin={pair.outbound.origin}
            destination={pair.outbound.destination}
            depTime={pair.outbound.departureTime}
            arrTime={pair.outbound.arrivalTime}
            duration={pair.outbound.duration}
            date={pair.date}
            align="left"
          />

          {/* Center divider: ground time */}
          <div className="flex flex-col items-center justify-center gap-1.5 pt-6 shrink-0 w-[72px]">
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5"
              style={{ background: "#059669" }}
            >
              <HugeiconsIcon icon={Clock01Icon} size={10} color="white" strokeWidth={2.5} />
              <span className="text-white text-[11px] font-black leading-none">
                {formatGround(pair.groundMinutes)}
              </span>
            </div>
            <span className="text-[9px] font-medium text-[#6B7280] text-center leading-tight">
              Ground Time in
            </span>
            <span className="text-[10px] font-bold text-[#1A2E2E] text-center leading-tight">
              {pair.outbound.destination}
            </span>
            {/* Vertical separator */}
            <div className="w-px h-4 bg-[#E5E7EB] mt-0.5" />
            {/* GoWild badge */}
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[9px] font-black whitespace-nowrap"
              style={{ background: "#059669", color: "#FFFFFF" }}
            >
              <HugeiconsIcon icon={Rocket01Icon} size={9} color="white" strokeWidth={2} />
              GoWild
            </span>
          </div>

          <FlightColumn
            label="Return"
            origin={pair.inbound.origin}
            destination={pair.inbound.destination}
            depTime={pair.inbound.departureTime}
            arrTime={pair.inbound.arrivalTime}
            duration={pair.inbound.duration}
            date={pair.date}
            align="right"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DayTrips({ isCollapsed = false, onToggle, onNavigate }: Props) {
  const { user } = useAuth();
  const [pairs, setPairs] = useState<DayTripPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        // ── Resolve home airport from profile ─────────────────────────────────
        const { data: info } = await supabase
          .from("user_info")
          .select("home_airport")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const homeIata = info?.home_airport ?? null;
        if (!homeIata) { setLoading(false); return; }

        const today = format(new Date(), "yyyy-MM-dd");
        const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

        // ── Load cache entries for today and tomorrow in parallel ─────────────
        const [todayCacheKey, tomorrowCacheKey] = await Promise.all([
          sha256(`${homeIata}|__DAYTRIPS__|${today}`),
          sha256(`${homeIata}|__DAYTRIPS__|${tomorrow}`),
        ]);

        const [todayCached, tomorrowCached] = await Promise.all([
          (supabase.from("flight_search_cache") as any)
            .select("payload, status")
            .eq("cache_key", todayCacheKey)
            .eq("status", "ready")
            .maybeSingle(),
          (supabase.from("flight_search_cache") as any)
            .select("payload, status")
            .eq("cache_key", tomorrowCacheKey)
            .eq("status", "ready")
            .maybeSingle(),
        ]);

        const allPairs: DayTripPair[] = [
          ...(todayCached.data?.payload ? parseDayTripPairs(todayCached.data.payload, today) : []),
          ...(tomorrowCached.data?.payload ? parseDayTripPairs(tomorrowCached.data.payload, tomorrow) : []),
        ];

        setPairs(allPairs);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check cache every 30 seconds while component is visible (handles async fetch completing)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      if (pairs.length > 0) return; // already have data

      const { data: info } = await supabase
        .from("user_info")
        .select("home_airport")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const homeIata = info?.home_airport ?? null;
      if (!homeIata) return;

      const today = format(new Date(), "yyyy-MM-dd");
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

      const [todayCacheKey, tomorrowCacheKey] = await Promise.all([
        sha256(`${homeIata}|__DAYTRIPS__|${today}`),
        sha256(`${homeIata}|__DAYTRIPS__|${tomorrow}`),
      ]);

      const [todayCached, tomorrowCached] = await Promise.all([
        (supabase.from("flight_search_cache") as any)
          .select("payload, status")
          .eq("cache_key", todayCacheKey)
          .eq("status", "ready")
          .maybeSingle(),
        (supabase.from("flight_search_cache") as any)
          .select("payload, status")
          .eq("cache_key", tomorrowCacheKey)
          .eq("status", "ready")
          .maybeSingle(),
      ]);

      const allPairs: DayTripPair[] = [
        ...(todayCached.data?.payload ? parseDayTripPairs(todayCached.data.payload, today) : []),
        ...(tomorrowCached.data?.payload ? parseDayTripPairs(tomorrowCached.data.payload, tomorrow) : []),
      ];

      if (allPairs.length > 0) setPairs(allPairs);
    }, 30_000);

    return () => clearInterval(interval);
  }, [user?.id, pairs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Header */}
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between mb-1 px-1 group">
        <h2 className="text-[15px] font-black text-[#6B7280] uppercase tracking-widest flex items-center gap-2">
          <HugeiconsIcon icon={SunCloud01Icon} className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
          Day Trips
        </h2>
        <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
          <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
        </motion.div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="daytrips-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "visible" }}
          >
            <div style={{ padding: "2px 6px 10px" }}>
              {loading ? (
                // Skeleton
                <div className="flex gap-3 overflow-x-hidden pb-1 -mx-1 px-1">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-2xl overflow-hidden flex-shrink-0 w-[272px]"
                      style={{
                        background: "rgba(255,255,255,0.95)",
                        border: "1px solid rgba(255,255,255,0.65)",
                        boxShadow: CARD_SHADOW,
                      }}
                    >
                      <div className="h-9 animate-pulse" style={{ background: HEADER_GREEN, opacity: 0.35 }} />
                      <div className="px-4 pt-4 pb-4">
                        <div className="flex gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-14 rounded bg-[#e5e7eb]" />
                            <div className="h-7 w-10 rounded bg-[#e5e7eb]" />
                            <div className="h-3 w-16 rounded bg-[#e5e7eb]" />
                            <div className="h-3 w-12 rounded bg-[#e5e7eb]" />
                            <div className="h-7 w-10 rounded bg-[#e5e7eb]" />
                          </div>
                          <div className="w-16 flex flex-col items-center gap-2 pt-4">
                            <div className="h-6 w-14 rounded-full bg-[#e5e7eb]" />
                            <div className="h-3 w-12 rounded bg-[#e5e7eb]" />
                          </div>
                          <div className="flex-1 space-y-2 items-end flex flex-col">
                            <div className="h-3 w-14 rounded bg-[#e5e7eb]" />
                            <div className="h-7 w-10 rounded bg-[#e5e7eb]" />
                            <div className="h-3 w-16 rounded bg-[#e5e7eb]" />
                            <div className="h-3 w-12 rounded bg-[#e5e7eb]" />
                            <div className="h-7 w-10 rounded bg-[#e5e7eb]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : pairs.length === 0 ? (
                <div
                  className="rounded-2xl px-4 py-5 flex items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    boxShadow: CARD_SHADOW,
                  }}
                >
                  <HugeiconsIcon icon={SunCloud01Icon} size={20} color="#9AADAD" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm text-[#1A2E2E] font-semibold leading-tight">No day trips available today</p>
                    <p className="text-[11px] text-[#9AADAD] font-medium mt-0.5">
                      Check back later for GoWild nonstop same-day options
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
                  style={{ scrollSnapType: "x mandatory" }}
                >
                  {pairs.map((pair, i) => (
                    <DayTripCard key={pair.id} pair={pair} index={i} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
