import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";

export interface ParsedFlight {
  total_duration: string;
  is_plus_one_day: boolean;
  fares: {
    basic: number | null;
    economy: number | null;
    premium: number | null;
    business: number | null;
    go_wild?: number | null;
    discount_den?: number | null;
    standard?: number | null;
  };
  legs: { origin: string; destination: string; departure_time: string; arrival_time: string }[];
  rawPayload?: any;
  destination?: string;
  duration?: string;
  price?: number;
  stops?: number;
  departureTime?: string;
  depart_time?: string;
}

export interface DestCard {
  destination: string;
  city: string;
  stateCode: string;
  country: string;
  airportName: string;
  locationId: number | null;
  flights: ParsedFlight[];
  flightCount: number;
  minFare: number | null;
  maxFare: number | null;
  isMinFareGoWild: boolean;
  hasGoWild: boolean;
  hasNonstop: boolean;
  nonstopCount: number;
  avgDurationMin: number;
  minDurationMin: number;
  departureWindow: string | null;
  earliestDeparture: string | null;
  availableFareTypes: string[];
}

export function parseDurationToMinutes(duration: string): number {
  const raw = String(duration).trim();
  if (!raw) return 0;
  if (raw.includes(":")) {
    const parts = raw.split(":").map((p) => p.trim());
    if (parts.length >= 3) {
      const hoursPart = parts[0];
      let days = 0, hours = 0;
      if (hoursPart.includes(".")) {
        const [d, h] = hoursPart.split(".");
        days = parseInt(d, 10) || 0;
        hours = parseInt(h, 10) || 0;
      } else {
        hours = parseInt(hoursPart, 10) || 0;
      }
      const minutes = parseInt(parts[1], 10) || 0;
      return days * 24 * 60 + hours * 60 + minutes;
    }
    if (parts.length === 2) {
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    }
  }
  const hoursMatch = raw.match(/(\d+)\s*(hr|hrs|h)\b/i);
  const minsMatch = raw.match(/(\d+)\s*(min|m)\b/i);
  return (parseInt(hoursMatch?.[1] ?? "0", 10) || 0) * 60 + (parseInt(minsMatch?.[1] ?? "0", 10) || 0);
}

export function formatDurationMinutes(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function buildDestCards(
  rawFlights: any[],
  airportMap: Record<string, { city: string; stateCode: string; country: string; name: string; locationId: number | null }>,
): DestCard[] {
  const grouped: Record<string, any[]> = {};
  for (const f of rawFlights) {
    const dest =
      Array.isArray(f.legs) && f.legs.length > 0
        ? (f.legs[f.legs.length - 1]?.destination ?? f.destination ?? "???")
        : (f.destination ?? "???");
    if (!grouped[dest]) grouped[dest] = [];
    grouped[dest].push(f);
  }

  return Object.entries(grouped).map(([dest, flts]) => {
    const cleanFare = (v: any): number | null => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    let minFare: number | null = null;
    let maxFare: number | null = null;
    let isMinFareGoWild = false;

    for (const f of flts) {
      const nFares = f.fares ?? {};
      const goWildFare = cleanFare(nFares.go_wild) ?? cleanFare(f.rawPayload?.fares?.go_wild?.total);
      const rpFares = (f.rawPayload as any)?.fares ?? {};
      const nonGoWildFares: (number | null)[] = [
        cleanFare(nFares.discount_den) ?? cleanFare(rpFares.discount_den?.total),
        cleanFare(nFares.standard) ?? cleanFare(rpFares.standard?.total),
        cleanFare(nFares.economy),
        cleanFare(nFares.premium),
        cleanFare(f.price),
      ];
      const allFares: number[] = [
        ...(goWildFare != null ? [goWildFare] : []),
        ...nonGoWildFares.filter((v): v is number => v != null),
      ];
      if (allFares.length === 0) {
        const basic = cleanFare(nFares.basic);
        if (basic != null) allFares.push(basic);
      }
      if (allFares.length === 0) continue;
      const flightMin = Math.min(...allFares);
      const flightMax = Math.max(...allFares);
      if (maxFare == null || flightMax > maxFare) maxFare = flightMax;
      if (minFare == null || flightMin < minFare) {
        minFare = flightMin;
        isMinFareGoWild = goWildFare != null && flightMin === goWildFare;
      }
    }

    let minDurationMin = Infinity;
    const totalDurMins = flts.reduce((sum, f) => {
      const durStr = f.total_duration ?? f.duration ?? "";
      const mins = parseDurationToMinutes(durStr);
      if (mins > 0 && mins < minDurationMin) minDurationMin = mins;
      return sum + mins;
    }, 0);
    const avgDurationMin = flts.length > 0 ? Math.round(totalDurMins / flts.length) : 0;
    if (minDurationMin === Infinity) minDurationMin = 0;

    const depTimeMins: number[] = [];
    for (const f of flts) {
      const depStr: string =
        (Array.isArray(f.legs) && f.legs.length > 0 && f.legs[0]?.departure_time ? f.legs[0].departure_time : null) ??
        (Array.isArray((f.rawPayload as any)?.segments) && (f.rawPayload as any).segments.length > 0
          ? (f.rawPayload as any).segments[0]?.departure_time
          : null) ??
        (f.rawPayload as any)?.departure_time ??
        f.departureTime ??
        f.depart_time ??
        "";
      if (!depStr) continue;
      const d = new Date(depStr);
      if (!isNaN(d.getTime())) {
        depTimeMins.push(d.getHours() * 60 + d.getMinutes());
      } else {
        const m = depStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (m) {
          let h = parseInt(m[1], 10);
          const min = parseInt(m[2], 10);
          if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
          if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
          depTimeMins.push(h * 60 + min);
        }
      }
    }
    const fmtWindowTime = (totalMins: number) => {
      const h24 = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const ampm = h24 >= 12 ? "PM" : "AM";
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    };
    let departureWindow: string | null = null;
    if (depTimeMins.length > 0) {
      departureWindow = `${fmtWindowTime(Math.min(...depTimeMins))} – ${fmtWindowTime(Math.max(...depTimeMins))}`;
    }

    const hasGoWild = flts.some((f) => {
      const gw = f.fares?.go_wild ?? f.rawPayload?.fares?.go_wild?.total;
      return gw != null && Number(gw) > 0;
    });

    const hasNonstop = flts.some((f) => {
      if (Array.isArray(f.legs)) return f.legs.length === 1;
      return (f.stops ?? 1) === 0;
    });
    const nonstopCount = flts.filter((f) => {
      if (Array.isArray(f.legs)) return f.legs.length === 1;
      return (f.stops ?? 1) === 0;
    }).length;

    const earliestDeparture = depTimeMins.length > 0 ? fmtWindowTime(Math.min(...depTimeMins)) : null;

    return {
      destination: dest,
      city: airportMap[dest]?.city ?? dest,
      stateCode: airportMap[dest]?.stateCode ?? "",
      country: airportMap[dest]?.country ?? "",
      airportName: airportMap[dest]?.name ?? "",
      locationId: airportMap[dest]?.locationId ?? null,
      flights: flts,
      flightCount: flts.length,
      minFare,
      maxFare,
      isMinFareGoWild,
      hasGoWild,
      hasNonstop,
      nonstopCount,
      avgDurationMin,
      minDurationMin,
      departureWindow,
      earliestDeparture,
      availableFareTypes: [],
    };
  });
}

export function DestCardItem({
  card,
  index,
  onViewDest,
}: {
  card: DestCard;
  index: number;
  onViewDest: (card: DestCard) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: cardRef, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  const bgImage = card.locationId ? `/assets/locations/${card.locationId}_background.png` : null;
  const isGoWild = card.hasGoWild;

  return (
    <motion.div
      ref={cardRef}
      className="rounded-2xl overflow-hidden bg-white"
      style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)", border: isGoWild ? "2px solid #FFD700" : "1px solid #E8EBEB" }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
    >
      {/* City photo */}
      <div className="relative h-[158px] overflow-hidden bg-[#C8D5D5]">
        {bgImage ? (
          <motion.img
            src={bgImage}
            alt={card.city}
            className="w-full object-cover absolute inset-0"
            style={{ y: imgY, height: "124%", top: "-12%" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
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
            background: "linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.22) 40%, rgba(255,255,255,0.62) 72%, rgba(255,255,255,0.92) 100%)",
          }}
        />
        {/* IATA | City, State */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 pointer-events-none flex items-center gap-0">
          <span className="text-[42px] font-black leading-none" style={{ color: isGoWild ? "#047857" : "#0F2040", textShadow: "0 1px 3px rgba(255,255,255,0.6)" }}>{card.destination}</span>
          <span className="font-bold text-[24px] leading-none" style={{ color: "#0F2040", textShadow: "0 1px 2px rgba(255,255,255,0.5)", margin: "0 6px" }}> | </span>
          <span className="uppercase tracking-wide font-semibold text-[19px] leading-none" style={{ color: "#0F2040", textShadow: "0 1px 2px rgba(255,255,255,0.5)" }}>
            {card.city || card.destination}
            {card.stateCode && card.stateCode !== "None" && (
              <span>{", "}{card.stateCode}</span>
            )}
          </span>
        </div>
        {/* GoWild badge — top left */}
        {card.hasGoWild && (
          <div
            className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 bg-[#059669]"
            style={{ border: "2px solid #FFFFFF", boxShadow: "0 2px 8px rgba(5,150,105,0.30)" }}
          >
            <HugeiconsIcon icon={Rocket01Icon} size={12} color="white" strokeWidth={2} />
            <span className="text-[10px] font-bold leading-none text-white">GoWild</span>
          </div>
        )}
        {/* Min price badge — top right */}
        {card.minFare != null && (
          <div
            className="absolute top-3 right-3 inline-flex items-baseline gap-1 rounded-full px-3 py-1.5"
            style={
              isGoWild
                ? { background: "#059669", border: "2px solid #FFD700", boxShadow: "0 2px 8px rgba(5,150,105,0.30)" }
                : { background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)", boxShadow: "0 2px 8px rgba(0,0,0,0.14)" }
            }
          >
            <span className="text-[14px] font-semibold leading-none" style={{ color: isGoWild ? "rgba(255,255,255,0.80)" : "#6B7B7B" }}>From</span>
            <span className="text-[20px] font-black leading-none tracking-tight" style={{ color: isGoWild ? "#FFFFFF" : "#1A2E2E" }}>${Math.round(card.minFare)}</span>
          </div>
        )}
        {card.hasGoWild && card.minFare == null && (
          <div
            className="absolute top-3 right-3 inline-flex items-baseline gap-1 rounded-full px-3 py-1.5"
            style={{ background: "#059669", border: "2px solid #FFD700", boxShadow: "0 2px 8px rgba(5,150,105,0.30)" }}
          >
            <span className="text-[14px] font-semibold leading-none text-white/80">From</span>
            <span className="text-[20px] font-black leading-none tracking-tight text-white">GoWild</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 pt-1.5 pb-4">
        <div className="grid grid-cols-4 gap-x-2 mb-4">
          {[
            { label: "RANGE",    value: card.minFare != null && card.maxFare != null ? `$${Math.round(card.minFare)} – $${Math.round(card.maxFare)}` : "—" },
            { label: "EARLIEST", value: card.earliestDeparture ?? "—" },
            { label: "QUICKEST", value: card.minDurationMin > 0 ? formatDurationMinutes(card.minDurationMin) : "—" },
            { label: "NONSTOP",  value: card.nonstopCount },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <span className="text-[12px] font-semibold text-[#1A2E2E] uppercase tracking-wide leading-tight text-center whitespace-nowrap">{label}</span>
              <span className="text-[12px] font-medium text-[#6B7B7B] leading-tight text-center whitespace-nowrap">{value}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onViewDest(card)}
          className="w-full py-3 rounded-full text-[14px] font-bold transition-opacity hover:opacity-90 active:scale-95"
          style={
            isGoWild
              ? { background: "#059669", color: "#FFFFFF" }
              : { background: "rgba(0,0,0,0.07)", color: "#1A2E2E" }
          }
        >
          View {card.flightCount} Flight{card.flightCount !== 1 ? "s" : ""}
        </button>
      </div>
    </motion.div>
  );
}
