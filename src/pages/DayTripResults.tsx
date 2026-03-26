import { useMemo, useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faPlane } from "@fortawesome/free-solid-svg-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SunCloud01Icon,
  Calendar03Icon,
  Clock01Icon,
  Rocket01Icon,
  Location01Icon,
  ArrowDown01Icon,
  MapPinpoint01Icon,
} from "@hugeicons/core-free-icons";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DayTripPair {
  id: string;
  date: string;
  origin: string;
  destination: string;
  outbound: {
    departureTime: string;
    arrivalTime: string;
    duration: string;
  };
  inbound: {
    departureTime: string;
    arrivalTime: string;
    duration: string;
  };
  groundMinutes: number;
  isNonstop: boolean;
  isSameDay: boolean;
  goWild: boolean;
}

interface AirportInfo {
  city: string;
  stateCode: string;
  name: string;
  locationId?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseTimeString(timeStr: string, dateStr: string): Date | null {
  try {
    const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? null : d;
    }
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return new Date(
      `${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`
    );
  } catch {
    return null;
  }
}

function formatDisplayTime(timeStr: string, dateStr: string): string {
  const d = parseTimeString(timeStr, dateStr);
  if (!d) return timeStr;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(duration: string): string {
  const hms = duration.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
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

function formatGround(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Parse day-trip API payload into DayTripPair[]
 *
 * Handles two shapes:
 *  1. payload.dayTrips[] — from /api/flights/dayTrips, each item has { outbound, return }
 *  2. payload.flights[]  — legacy fallback where each flight has { inbound } or { return_flight }
 */
function parseDayTripPairs(payload: any, dateStr: string): DayTripPair[] {
  const rawDayTrips: any[] = payload?.dayTrips ?? [];

  // ── Shape 1: server-provided pairs ──────────────────────────────────────────
  if (rawDayTrips.length > 0) {
    const pairs: DayTripPair[] = [];
    const seenDests = new Set<string>();

    for (const f of rawDayTrips) {
      const dest = (f.destination ?? "").toUpperCase();
      if (!dest || seenDests.has(dest)) continue;

      const outbound = f.outbound;
      const ret = f.return; // API field is named "return"
      if (!outbound || !ret) continue;

      const isNonstop = Number(outbound.stops ?? 0) === 0 && Number(ret.stops ?? 0) === 0;

      const goWild =
        !!outbound.cabin?.toLowerCase().includes("wild") &&
        !!ret.cabin?.toLowerCase().includes("wild");

      const outDepTime = outbound.departureTime ?? "";
      const outArrTime = outbound.arrivalTime ?? "";
      const inDepTime = ret.departureTime ?? "";
      const inArrTime = ret.arrivalTime ?? "";

      const outDep = parseTimeString(outDepTime, dateStr);
      const outArr = parseTimeString(outArrTime, dateStr);
      const inDep = parseTimeString(inDepTime, dateStr);
      const inArr = parseTimeString(inArrTime, dateStr);

      if (!outDep || !outArr || !inDep || !inArr) continue;

      const dayStart = new Date(`${dateStr}T00:01:00`);
      const dayEnd = new Date(`${dateStr}T23:59:00`);
      const isSameDay =
        outDep >= dayStart && outDep <= dayEnd && inArr >= dayStart && inArr <= dayEnd;

      const groundMinutes = Math.floor((inDep.getTime() - outArr.getTime()) / 60000);

      seenDests.add(dest);
      pairs.push({
        id: f.id ?? `${dest}-${dateStr}-${pairs.length}`,
        date: dateStr,
        origin: (outbound.origin ?? "").toUpperCase(),
        destination: dest,
        outbound: {
          departureTime: outDepTime,
          arrivalTime: outArrTime,
          duration: outbound.duration ?? "",
        },
        inbound: {
          departureTime: inDepTime,
          arrivalTime: inArrTime,
          duration: ret.duration ?? "",
        },
        groundMinutes,
        isNonstop,
        isSameDay,
        goWild,
      });
    }

    return pairs;
  }

  // ── Shape 2: legacy — individual flights with inbound attached ───────────────
  const rawFlights: any[] = payload?.flights ?? [];
  const pairs: DayTripPair[] = [];
  const seenDests = new Set<string>();

  for (const f of rawFlights) {
    const dest = (f.destination ?? f.arrive ?? "").toUpperCase();
    if (!dest || seenDests.has(dest)) continue;

    const inbound = f.inbound ?? f.return_flight ?? null;
    if (!inbound) continue;

    const outStops =
      f.stops != null ? Number(f.stops) : Array.isArray(f.segments) ? f.segments.length - 1 : -1;
    const inStops =
      inbound.stops != null
        ? Number(inbound.stops)
        : Array.isArray(inbound.segments)
        ? inbound.segments.length - 1
        : -1;
    const isNonstop = outStops === 0 && inStops === 0;

    const outGoWild =
      (f.fares?.go_wild != null && f.fares.go_wild !== -1) ||
      f.rawPayload?.fares?.go_wild?.total != null;
    const inGoWild =
      (inbound.fares?.go_wild != null && inbound.fares.go_wild !== -1) ||
      inbound.rawPayload?.fares?.go_wild?.total != null;
    const goWild = outGoWild && inGoWild;

    const outDepTime = f.departureTime ?? f.depart_time ?? f.departure_time ?? "";
    const outArrTime = f.arrivalTime ?? f.arrive_time ?? f.arrival_time ?? "";
    const inDepTime = inbound.departureTime ?? inbound.depart_time ?? inbound.departure_time ?? "";
    const inArrTime = inbound.arrivalTime ?? inbound.arrive_time ?? inbound.arrival_time ?? "";

    const outDep = parseTimeString(outDepTime, dateStr);
    const outArr = parseTimeString(outArrTime, dateStr);
    const inDep = parseTimeString(inDepTime, dateStr);
    const inArr = parseTimeString(inArrTime, dateStr);

    if (!outDep || !outArr || !inDep || !inArr) continue;

    const dayStart = new Date(`${dateStr}T00:01:00`);
    const dayEnd = new Date(`${dateStr}T23:59:00`);
    const isSameDay =
      outDep >= dayStart && outDep <= dayEnd && inArr >= dayStart && inArr <= dayEnd;

    const groundMinutes = Math.floor((inDep.getTime() - outArr.getTime()) / 60000);

    seenDests.add(dest);
    pairs.push({
      id: `${dest}-${dateStr}-${pairs.length}`,
      date: dateStr,
      origin: (f.origin ?? "").toUpperCase(),
      destination: dest,
      outbound: {
        departureTime: outDepTime,
        arrivalTime: outArrTime,
        duration: f.duration ?? f.total_duration ?? "",
      },
      inbound: {
        departureTime: inDepTime,
        arrivalTime: inArrTime,
        duration: inbound.duration ?? inbound.total_duration ?? "",
      },
      groundMinutes,
      isNonstop,
      isSameDay,
      goWild,
    });
  }

  return pairs;
}

// Badge definitions
interface Badge {
  key: string;
  label: string;
  color: string; // bg color
  textColor: string;
  icon: any;
}

function getBadges(pair: DayTripPair, allPairs: DayTripPair[]): Badge[] {
  const badges: Badge[] = [];

  if (pair.isNonstop) {
    badges.push({
      key: "nonstop",
      label: "Nonstop",
      color: "#059669",
      textColor: "#fff",
      icon: Rocket01Icon,
    });
  }

  if (pair.isSameDay) {
    badges.push({
      key: "sameday",
      label: "Same Day",
      color: "#2563EB",
      textColor: "#fff",
      icon: Calendar03Icon,
    });
  }

  // Best Balance = most ground time among same-day nonstop pairs
  const eligible = allPairs.filter((p) => p.isNonstop && p.isSameDay);
  if (eligible.length > 0) {
    const sorted = [...eligible].sort((a, b) => b.groundMinutes - a.groundMinutes);
    const medIdx = Math.floor(sorted.length / 2);
    const median = sorted[medIdx].groundMinutes;
    if (
      pair.isNonstop &&
      pair.isSameDay &&
      Math.abs(pair.groundMinutes - median) <=
        (sorted[0].groundMinutes - sorted[sorted.length - 1].groundMinutes) * 0.25
    ) {
      badges.push({
        key: "bestbalance",
        label: "Best Balance",
        color: "#7C3AED",
        textColor: "#fff",
        icon: ArrowDown01Icon,
      });
    }
  }

  // Longest Time There = max ground time
  const maxGround = Math.max(...allPairs.map((p) => p.groundMinutes));
  if (pair.groundMinutes === maxGround && allPairs.length > 1) {
    badges.push({
      key: "longest",
      label: "Longest Time There",
      color: "#D97706",
      textColor: "#fff",
      icon: MapPinpoint01Icon,
    });
  }

  return badges;
}

// ─── Sub-component: Flight Row ───────────────────────────────────────────────

function splitAmPm(t: string): { time: string; ampm: string } {
  const m = t.match(/^(\d+:\d+)\s*(AM|PM)$/i);
  if (m) return { time: m[1], ampm: m[2].toUpperCase() };
  return { time: t, ampm: "" };
}

function FlightRow({
  label,
  labelColor,
  labelBg,
  depIata,
  depTime,
  depAirportName,
  arrIata,
  arrTime,
  arrAirportName,
  duration,
  date,
}: {
  label: string;
  labelColor: string;
  labelBg: string;
  depIata: string;
  depTime: string;
  depAirportName: string;
  arrIata: string;
  arrTime: string;
  arrAirportName: string;
  duration: string;
  date: string;
}) {
  const dep = splitAmPm(formatDisplayTime(depTime, date));
  const arr = splitAmPm(formatDisplayTime(arrTime, date));

  return (
    <div>
      {/* Times row */}
      <div className="flex items-start gap-2">
        {/* Departure */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[26px] font-black leading-none text-[#111827]">{dep.time}</span>
            <span className="text-[13px] font-bold text-[#111827] leading-none">{dep.ampm}</span>
          </div>
          <span className="text-[13px] font-bold text-[#374151] mt-0.5 leading-none">{depIata}</span>
          <span className="text-[10px] text-[#9CA3AF] mt-0.5 leading-tight">{depAirportName}</span>
        </div>

        {/* Center: dashed line + duration */}
        <div className="flex-1 flex flex-col items-center pt-2.5 min-w-0">
          <div className="flex items-center w-full">
            <div className="flex-1 border-t-[1.5px] border-dashed border-[#D1D5DB]" />
            <FontAwesomeIcon icon={faPlane} className="mx-1.5 text-[#9CA3AF] w-3 h-3 flex-shrink-0" />
            <div className="flex-1 border-t-[1.5px] border-dashed border-[#D1D5DB]" />
          </div>
          <div
            className="mt-2 flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{ background: labelBg }}
          >
            <HugeiconsIcon icon={Clock01Icon} size={10} color={labelColor} strokeWidth={2} />
            <span className="text-[10px] font-semibold leading-none" style={{ color: labelColor }}>
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Arrival */}
        <div className="flex flex-col items-end min-w-0">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[26px] font-black leading-none text-[#111827]">{arr.time}</span>
            <span className="text-[13px] font-bold text-[#111827] leading-none">{arr.ampm}</span>
          </div>
          <span className="text-[13px] font-bold text-[#374151] mt-0.5 leading-none">{arrIata}</span>
          <span className="text-[10px] text-[#9CA3AF] mt-0.5 leading-tight text-right">{arrAirportName}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: Trip Card ────────────────────────────────────────────────

const CARD_SHADOW =
  "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)";
const HEADER_GREEN = "#2D6A4F";
const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

function DayTripCard({
  pair,
  index,
  allPairs,
  originInfo,
  destInfo,
}: {
  pair: DayTripPair;
  index: number;
  allPairs: DayTripPair[];
  originInfo?: AirportInfo;
  destInfo?: AirportInfo;
}) {
  let formattedDate = pair.date;
  try {
    formattedDate = format(new Date(pair.date + "T12:00:00"), "MMMM d, yyyy");
  } catch {
    /* keep raw */
  }

  const badges = getBadges(pair, allPairs);
  const destLabel = destInfo
    ? destInfo.city
      ? `${destInfo.city}${destInfo.stateCode ? `, ${destInfo.stateCode}` : ""}`
      : pair.destination
    : pair.destination;

  const cardImageSrc = destInfo?.locationId
    ? `/assets/locations/${destInfo.locationId}_background.png`
    : `/assets/locations/init_background.png`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: index * 0.06, ease: EASE } }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(255,255,255,0.65)",
        boxShadow: CARD_SHADOW,
      }}
    >
      {/* Outbound flight row */}
      <div className="px-4 pt-3 pb-2">
        <FlightRow
          label="Outbound Flight"
          labelColor="#059669"
          labelBg="#ECFDF5"
          depIata={pair.origin}
          depTime={pair.outbound.departureTime}
          depAirportName={originInfo?.name ?? ""}
          arrIata={pair.destination}
          arrTime={pair.outbound.arrivalTime}
          arrAirportName={destInfo?.name ?? ""}
          duration={pair.outbound.duration}
          date={pair.date}
        />
      </div>

      {/* City image banner with ground time pill overlay */}
      <div className="mx-4 mb-0 rounded-xl overflow-hidden relative" style={{ height: 100 }}>
        <img
          src={cardImageSrc}
          alt={destLabel}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/assets/locations/init_background.png";
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: "#059669", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
          >
            <HugeiconsIcon icon={Clock01Icon} size={11} color="white" strokeWidth={2.5} />
            <span className="text-white text-[11px] font-black leading-none">
              {formatGround(pair.groundMinutes)}
            </span>
          </div>
        </div>
      </div>

      {/* Return flight row */}
      <div className="px-4 pt-0 pb-3">
        <div className="pt-2">
          <FlightRow
            label="Return Flight"
            labelColor="#B45309"
            labelBg="#FEF3C7"
            depIata={pair.destination}
            depTime={pair.inbound.departureTime}
            depAirportName={destInfo?.name ?? ""}
            arrIata={pair.origin}
            arrTime={pair.inbound.arrivalTime}
            arrAirportName={originInfo?.name ?? ""}
            duration={pair.inbound.duration}
            date={pair.date}
          />
        </div>
      </div>

      {/* Badges row */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-0 border-t border-[#F3F4F6]">
          <div className="pt-3 flex flex-wrap gap-1.5 w-full">
            {badges.map((badge) => (
              <span
                key={badge.key}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap"
                style={{ background: badge.color, color: badge.textColor }}
              >
                <HugeiconsIcon icon={badge.icon} size={10} color={badge.textColor} strokeWidth={2} />
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  responseData: string;
}

const DayTripResults = ({ onBack, responseData }: Props) => {
  const [airportMap, setAirportMap] = useState<Record<string, AirportInfo>>({});
  const [compactHeader, setCompactHeader] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const heroH = heroRef.current?.offsetHeight ?? 200;
      setCompactHeader(el.scrollTop > heroH * 0.6);
      setParallaxY(el.scrollTop * 0.4);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const { pairs, departureDate, departureAirport } = useMemo(() => {
    try {
      const parsed = JSON.parse(responseData);
      const dateStr: string =
        parsed.departureDate ?? format(new Date(), "yyyy-MM-dd");
      const depAirport: string =
        parsed.departureAirport ?? parsed.firecrawlRequestBody?.departureAirport ?? "";
      // The day-trip API returns { flights: [...] } at the top level
      const rawPayload = parsed.response ?? parsed;
      const tripPairs = parseDayTripPairs(rawPayload, dateStr);
      return {
        pairs: tripPairs,
        departureDate: dateStr,
        departureAirport: depAirport,
      };
    } catch {
      return { pairs: [], departureDate: "", departureAirport: "" };
    }
  }, [responseData]);

  // Fetch airport info for all destination codes
  const allCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const p of pairs) {
      if (p.origin) codes.add(p.origin);
      if (p.destination) codes.add(p.destination);
    }
    return Array.from(codes);
  }, [pairs]);

  useEffect(() => {
    if (allCodes.length === 0) return;
    supabase
      .from("airports")
      .select("iata_code, name, location_id, locations(city, state_code)")
      .in("iata_code", allCodes)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, AirportInfo> = {};
        for (const a of data as any[]) {
          map[a.iata_code] = {
            city: a.locations?.city ?? "",
            stateCode: a.locations?.state_code ?? "",
            name: a.name ?? "",
            locationId: a.location_id ?? null,
          };
        }
        setAirportMap(map);
      });
  }, [allCodes]);

  // Get the primary destination for the hero (first pair's destination)
  const primaryDest = pairs[0]?.destination ?? null;
  const primaryDestInfo = primaryDest ? airportMap[primaryDest] : null;
  const heroLocationId = primaryDestInfo?.locationId ?? null;
  const heroBg = heroLocationId
    ? `/assets/locations/${heroLocationId}_background.png`
    : `/assets/locations/init_background.png`;

  const heroTitle = primaryDestInfo
    ? `Day Trip to ${primaryDestInfo.city || primaryDest}${primaryDestInfo.stateCode ? `, ${primaryDestInfo.stateCode}` : ""}`
    : primaryDest
    ? `Day Trip to ${primaryDest}`
    : "Day Trip Results";

  const formattedDate = departureDate
    ? new Date(departureDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="relative flex flex-col h-full bg-[#F1F5F5] overflow-hidden">
      {/* ── Compact sticky header ── */}
      <motion.div
        className="sticky top-0 z-30 px-4 bg-gradient-to-r from-[#10B981] to-[#059669] overflow-hidden"
        initial={false}
        animate={{
          height: compactHeader ? 64 : 0,
          opacity: compactHeader ? 1 : 0,
          pointerEvents: compactHeader ? "auto" : "none",
        }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
      >
        <div className="flex items-center justify-between h-full">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity flex-shrink-0"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <HugeiconsIcon icon={SunCloud01Icon} size={16} color="white" strokeWidth={2} />
            <span className="text-[15px] font-black text-white truncate">Day Trips</span>
          </div>
          <div className="w-10" />
        </div>
      </motion.div>

      {/* ── Scrollable content ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {/* Hero */}
        <header
          ref={heroRef}
          className="relative z-10 flex flex-col px-5 pt-6 pb-5 overflow-hidden shrink-0"
          style={{
            backgroundImage: `url('${heroBg}')`,
            backgroundSize: "cover",
            backgroundPosition: `center ${parallaxY}px`,
            willChange: "background-position",
          }}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(6,78,59,0.65) 0%, rgba(6,78,59,0.40) 25%, rgba(6,78,59,0.55) 50%, rgba(6,78,59,0.65) 75%, rgba(6,78,59,0.72) 100%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(6,78,59,0) 0%, rgba(6,78,59,0.85) 100%)",
            }}
          />

          {/* Back button */}
          <div className="relative flex items-center w-full">
            <button
              type="button"
              onClick={onBack}
              className="h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
            </button>
          </div>

          {/* Hero text */}
          <div className="relative mt-3">
            <p
              className="text-white/70 text-[13px] font-semibold uppercase tracking-[0.18em] leading-tight"
              style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
            >
              Day Trips From
            </p>
            <p
              className="text-white text-[32px] font-black leading-tight uppercase tracking-wide"
              style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
            >
              {(() => {
                const info = airportMap[departureAirport];
                if (info?.city) {
                  return info.stateCode ? `${info.city}, ${info.stateCode}` : info.city;
                }
                return departureAirport || "—";
              })()}
            </p>

            {/* Meta pills */}
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {formattedDate && (
                <div
                  className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5"
                  style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}
                >
                  <HugeiconsIcon icon={Calendar03Icon} size={13} color="#065F46" strokeWidth={1.5} />
                  <span className="text-[#065F46] text-xs font-semibold leading-none">
                    {formattedDate}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats strip */}
          {pairs.length > 0 && (
            <div className="relative mt-4 flex items-center justify-between w-full gap-2 pt-3 border-t border-white/20">
              {[
                { label: "TOTAL", value: pairs.length },
                {
                  label: "MIN GROUND",
                  value:
                    pairs.length > 0
                      ? formatGround(Math.min(...pairs.map((p) => p.groundMinutes)))
                      : "—",
                },
                {
                  label: "MAX GROUND",
                  value:
                    pairs.length > 0
                      ? formatGround(Math.max(...pairs.map((p) => p.groundMinutes)))
                      : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight text-center">
                    {label}
                  </span>
                  <span className="text-[14px] font-bold text-white leading-tight mt-0.5 text-center">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </header>

        {/* ── Results ── */}
        <div className="px-4 pt-4 pb-8 flex flex-col gap-4">
          <AnimatePresence>
            {pairs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl px-5 py-8 flex flex-col items-center gap-3 text-center"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(255,255,255,0.65)",
                  boxShadow: CARD_SHADOW,
                }}
              >
                <HugeiconsIcon
                  icon={SunCloud01Icon}
                  size={36}
                  color="#9AADAD"
                  strokeWidth={1.5}
                />
                <p className="text-base font-bold text-[#1A2E2E]">No day trips found</p>
                <p className="text-sm text-[#9AADAD]">
                  No nonstop same-day GoWild pairs were found for this date. Try a different
                  departure date.
                </p>
              </motion.div>
            ) : (
              pairs.map((pair, i) => (
                <DayTripCard
                  key={pair.id}
                  pair={pair}
                  index={i}
                  allPairs={pairs}
                  originInfo={airportMap[pair.origin]}
                  destInfo={airportMap[pair.destination]}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default DayTripResults;
