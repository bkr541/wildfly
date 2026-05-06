import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SunCloud01Icon,
  Calendar03Icon,
  Clock01Icon,
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
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

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
  // dayTrips API returns an array of pair objects with outbound/return keys
  const rawTrips: any[] = payload?.dayTrips ?? [];
  const pairs: DayTripPair[] = [];
  const seenDests = new Set<string>();

  for (const trip of rawTrips) {
    const out = trip.outbound;
    const ret = trip.return;
    if (!out || !ret) continue;

    const dest = (trip.destination ?? out.destination ?? "").toUpperCase();
    if (!dest || seenDests.has(dest)) continue;

    // ── Both GoWild ───────────────────────────────────────────────────────────
    const outGoWild = (out.cabin ?? "").toLowerCase().includes("wild") || (out.fares?.go_wild != null && out.fares.go_wild !== -1);
    const retGoWild = (ret.cabin ?? "").toLowerCase().includes("wild") || (ret.fares?.go_wild != null && ret.fares.go_wild !== -1);
    if (!outGoWild || !retGoWild) continue;

    // ── Both non-stop ─────────────────────────────────────────────────────────
    if (Number(out.stops ?? 0) !== 0 || Number(ret.stops ?? 0) !== 0) continue;

    // ── Use pre-computed ground time if available, else compute ───────────────
    const groundMinutes: number =
      trip.timeInDestinationMinutes ??
      (() => {
        const outArr = new Date(out.arrivalIso ?? out.arrivalTime ?? "");
        const retDep = new Date(ret.departureIso ?? ret.departureTime ?? "");
        return isNaN(outArr.getTime()) || isNaN(retDep.getTime())
          ? 0
          : Math.floor((retDep.getTime() - outArr.getTime()) / 60000);
      })();

    if (groundMinutes < 360) continue;

    seenDests.add(dest);
    pairs.push({
      id: `${dest}-${dateStr}`,
      date: dateStr,
      outbound: {
        origin: (out.origin ?? "").toUpperCase(),
        destination: (out.destination ?? dest).toUpperCase(),
        departureTime: out.departureIso ?? out.departureTime ?? "",
        arrivalTime: out.arrivalIso ?? out.arrivalTime ?? "",
        duration: out.duration ?? "",
        stops: Number(out.stops ?? 0),
        goWild: outGoWild,
      },
      inbound: {
        origin: (ret.origin ?? dest).toUpperCase(),
        destination: (ret.destination ?? out.origin ?? "").toUpperCase(),
        departureTime: ret.departureIso ?? ret.departureTime ?? "",
        arrivalTime: ret.arrivalIso ?? ret.arrivalTime ?? "",
        duration: ret.duration ?? "",
        stops: Number(ret.stops ?? 0),
        goWild: retGoWild,
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
  const isLeft = align === "left";
  const labelBg = isLeft ? "bg-[#E8F4EE] text-[#2D6A4F]" : "bg-[#2D2D2D] text-white";
  const ta = isLeft ? "text-left" : "text-right";
  const labelAlign = isLeft ? "justify-start" : "justify-end";

  return (
    <div className={`flex flex-col gap-0.5 flex-1 ${ta}`}>
      {/* Origin IATA */}
      <span className="text-[28px] font-black text-[#1A2E2E] leading-none tracking-tight">{origin}</span>
      <span className="text-[13px] font-bold text-[#374151] leading-none mt-0.5">
        {formatDisplayTime(depTime, date)}
      </span>
      <div className="mb-3" />

      {/* Flight duration pill */}
      <div className={`flex ${labelAlign} mb-3`}>
        <span className="text-[10px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-2.5 py-1 rounded-full">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Destination IATA */}
      <span className="text-[28px] font-black text-[#1A2E2E] leading-none tracking-tight">{destination}</span>
      <span className="text-[13px] font-bold text-[#374151] leading-none mt-0.5">
        {formatDisplayTime(arrTime, date)}
      </span>
    </div>
  );
}

// ─── Sub-component: Trip Card ─────────────────────────────────────────────────

function DayTripCard({ pair, index, cityNames }: { pair: DayTripPair; index: number; cityNames: Record<string, string> }) {
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
      <div className="px-2 pt-2 pb-2">
        <div className="flex items-stretch gap-1.5">
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

          {/* Center: ground time */}
          <div className="flex flex-col gap-0.5 items-center shrink-0 w-[80px]">
            <span className="text-[28px] font-black leading-none opacity-0 select-none">X</span>
            <span className="text-[13px] font-bold leading-none mt-0.5 opacity-0 select-none">X</span>
            <div className="mb-3" />
            <span
              className="rounded-full px-2.5 py-1 whitespace-nowrap text-[10px] font-semibold leading-none"
              style={{ background: "#059669", color: "#fff" }}
            >
              {formatGround(pair.groundMinutes)}
            </span>
            <span className="text-[9px] font-medium text-[#6B7280] text-center leading-tight mt-1">
              Ground Time in
            </span>
            <span className="text-[10px] font-bold text-[#1A2E2E] text-center leading-tight">
              {cityNames[pair.outbound.destination] || pair.outbound.destination}
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
  const [cityNames, setCityNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

        // ── Resolve home airport ──────────────────────────────────────────────
        const { data: info } = await supabase
          .from("user_info")
          .select("home_airport")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const homeIata = info?.home_airport ?? null;

        let allPairs: DayTripPair[] = [];

        // ── 1. Try flight_search_cache if we have a home airport ──────────────
        if (homeIata) {
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

          allPairs = [
            ...(todayCached.data?.payload ? parseDayTripPairs(todayCached.data.payload, today) : []),
            ...(tomorrowCached.data?.payload ? parseDayTripPairs(tomorrowCached.data.payload, tomorrow) : []),
          ];
        }

        // ── 2. Always fall back to flight_searches (works even without home_airport) ──
        if (allPairs.length === 0) {
          const query = supabase
            .from("flight_searches")
            .select("json_body, departure_date, departure_airport")
            .eq("user_id", user.id)
            .eq("trip_type", "day_trip")
            .in("departure_date", [today, tomorrow])
            .order("search_timestamp", { ascending: false })
            .limit(10);

          const { data: searches } = await query;

          if (searches && searches.length > 0) {
            // Group by date, use latest per date
            const byDate: Record<string, any> = {};
            for (const s of searches) {
              const d = String(s.departure_date);
              if (!byDate[d]) byDate[d] = s.json_body;
            }
            allPairs = [
              ...(byDate[today] ? parseDayTripPairs(byDate[today], today) : []),
              ...(byDate[tomorrow] ? parseDayTripPairs(byDate[tomorrow], tomorrow) : []),
            ];
          }
        }

        setPairs(allPairs);

        // Resolve destination city names
        const destCodes = [...new Set(allPairs.map((p) => p.outbound.destination))];
        if (destCodes.length > 0) {
          const { data: airports } = await (supabase as any)
            .from("airports")
            .select("iata_code, locations(city)")
            .in("iata_code", destCodes);
          if (airports) {
            const map: Record<string, string> = {};
            for (const a of airports) {
              map[a.iata_code] = a.locations?.city ?? "";
            }
            setCityNames(map);
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Header */}
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between mb-1 px-1 group">
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={SunCloud01Icon} size={13} color="#059669" strokeWidth={2} />
          <h2 className="text-xs font-semibold text-[#059669] uppercase tracking-wider">
            Day Trips
          </h2>
        </div>
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
                  className="rounded-2xl px-3 py-3 flex items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    boxShadow: CARD_SHADOW,
                  }}
                >
                  <img
                    src="/assets/userhome/nodaytrips.png"
                    alt="No day trips"
                    className="flex-shrink-0 w-24 h-24 object-contain"
                  />
                  <div>
                    <p className="text-base text-[#1A2E2E] font-semibold leading-tight capitalize">No day trips available today</p>
                    <p className="text-xs text-[#9AADAD] font-medium mt-0.5">
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
                    <DayTripCard key={pair.id} pair={pair} index={i} cityNames={cityNames} />
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
