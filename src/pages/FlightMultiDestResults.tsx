import { useMemo, useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  AirplaneTakeOff01Icon,
  FilterIcon,
  SortByDown02Icon,
  TicketStarIcon,
  Clock01Icon,
  Route02Icon,
  CheckmarkCircle02Icon,
  DollarCircleIcon,
  ArrowDown01Icon,
  AirplaneTakeOff02Icon,
} from "@hugeicons/core-free-icons";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface ParsedFlight {
  total_duration: string;
  is_plus_one_day: boolean;
  fares: {
    basic: number | null;
    economy: number | null;
    premium: number | null;
    business: number | null;
  };
  legs: { origin: string; destination: string; departure_time: string; arrival_time: string }[];
}

interface DestCard {
  destination: string;
  city: string;
  stateCode: string;
  country: string;
  airportName: string;
  locationId: number | null;
  flights: ParsedFlight[];
  flightCount: number;
  minFare: number | null;
  hasGoWild: boolean;
  hasNonstop: boolean;
  avgDurationMin: number;
  availableFareTypes: string[];
}

// ── Helpers ──────────────────────────────────────────────────

function parseDurationToMinutes(duration: string): number {
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
  return ((parseInt(hoursMatch?.[1] ?? "0", 10) || 0) * 60) + (parseInt(minsMatch?.[1] ?? "0", 10) || 0);
}

function formatDurationMinutes(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Component ────────────────────────────────────────────────

const FlightMultiDestResults = ({
  onBack,
  responseData,
  onViewDest,
}: {
  onBack: () => void;
  responseData: string;
  /** Navigate into a single destination's results */
  onViewDest: (destResponseData: string) => void;
}) => {
  const [airportMap, setAirportMap] = useState<
    Record<string, { city: string; stateCode: string; country: string; name: string; locationId: number | null }>
  >({});
  const [sortBy, setSortBy] = useState<"city" | "fare" | "flights" | "duration">("city");
  const [sortSheet, setSortSheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [filterNonstopOnly, setFilterNonstopOnly] = useState(false);
  const [filterGoWildOnly, setFilterGoWildOnly] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // ── Parse payload ────────────────────────────────────────
  const { rawFlights, departureDate, arrivalDate, tripType, departureAirport, arrivalAirport } = useMemo(() => {
    try {
      const parsed = JSON.parse(responseData);
      return {
        rawFlights: (parsed.response?.flights ?? []) as any[],
        departureDate: parsed.departureDate ?? null,
        arrivalDate: parsed.arrivalDate ?? null,
        tripType: parsed.tripType ?? "One Way",
        departureAirport: parsed.departureAirport ?? "",
        arrivalAirport: parsed.arrivalAirport ?? "",
      };
    } catch {
      return { rawFlights: [] as any[], departureDate: null, arrivalDate: null, tripType: "One Way", departureAirport: "", arrivalAirport: "" };
    }
  }, [responseData]);

  // ── Fetch airport metadata ───────────────────────────────
  const destinationCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const f of rawFlights) {
      // Normalized: use legs array for airport codes
      if (Array.isArray(f.legs)) {
        for (const leg of f.legs) {
          if (leg.origin) codes.add(leg.origin);
          if (leg.destination) codes.add(leg.destination);
        }
      } else {
        // Fallback: top-level fields preserved by spread in normalizer
        if (f.destination) codes.add(f.destination);
        if (f.origin) codes.add(f.origin);
      }
    }
    return Array.from(codes);
  }, [rawFlights]);

  // Collapse hero into compact bar once 60% of it scrolls past
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const heroH = heroRef.current?.offsetHeight ?? 200;
      setCompactHeader(el.scrollTop > heroH * 0.6);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (destinationCodes.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("iata_code, name, location_id, locations(city, state_code, country)")
        .in("iata_code", destinationCodes);
      if (data) {
        const map: typeof airportMap = {};
        for (const a of data as any[]) {
          map[a.iata_code] = {
            city: a.locations?.city ?? "",
            stateCode: a.locations?.state_code ?? "",
            country: a.locations?.country ?? "",
            name: a.name ?? "",
            locationId: a.location_id ?? null,
          };
        }
        setAirportMap(map);
      }
    })();
  }, [destinationCodes]);

  // ── Build destination cards ──────────────────────────────
  // Normalized format: each flight has `legs`, `fares.{basic,economy,premium,business}`,
  // `total_duration`, `is_plus_one_day`, plus original fields spread in.
  const cards: DestCard[] = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const f of rawFlights) {
      // Prefer last leg destination; fall back to top-level destination field
      const dest = (Array.isArray(f.legs) && f.legs.length > 0)
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

      // Use normalized fares first; fall back to rawPayload for cache-miss data
      const minFare = flts.reduce<number | null>((min, f) => {
        const nFares = f.fares ?? {};
        // normalized fares: basic is already the cheapest available
        const candidates: number[] = [
          cleanFare(nFares.basic),
          cleanFare(nFares.economy),
          cleanFare(nFares.premium),
          // fallback to rawPayload in case this is an un-normalized entry
          cleanFare(f.rawPayload?.fares?.go_wild?.total),
          cleanFare(f.rawPayload?.fares?.discount_den?.total),
          cleanFare(f.rawPayload?.fares?.standard?.total),
          cleanFare(f.price),
        ].filter((v): v is number => v != null);
        const cheapest = candidates.sort((a, b) => a - b)[0] ?? null;
        if (cheapest == null) return min;
        return min == null || cheapest < min ? cheapest : min;
      }, null);

      // Duration: use normalized total_duration string, fall back to raw duration
      const totalDurMins = flts.reduce((sum, f) => {
        const durStr = f.total_duration ?? f.duration ?? "";
        return sum + parseDurationToMinutes(durStr);
      }, 0);
      const avgDurationMin = flts.length > 0 ? Math.round(totalDurMins / flts.length) : 0;

      // GoWild: normalized fares.basic is the GoWild/cheapest fare
      const hasGoWild = flts.some((f) => {
        const basic = f.fares?.basic;
        if (basic != null && Number(basic) > 0) return true;
        // fallback
        const gw = f.rawPayload?.fares?.go_wild?.total;
        return gw != null && Number(gw) > 0;
      });

      // Nonstop: use legs array length; fall back to stops field
      const hasNonstop = flts.some((f) => {
        if (Array.isArray(f.legs)) return f.legs.length === 1;
        return (f.stops ?? 1) === 0;
      });

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
        hasGoWild,
        hasNonstop,
        avgDurationMin,
        availableFareTypes: [],
      };
    });
  }, [rawFlights, airportMap]);

  const sortedCards = useMemo(() => {
    let filtered = [...cards];
    if (filterNonstopOnly) filtered = filtered.filter((c) => c.hasNonstop);
    if (filterGoWildOnly) filtered = filtered.filter((c) => c.hasGoWild);
    return filtered.sort((a, b) => {
      if (sortBy === "fare") {
        if (a.minFare == null && b.minFare == null) return 0;
        if (a.minFare == null) return 1;
        if (b.minFare == null) return -1;
        return a.minFare - b.minFare;
      }
      if (sortBy === "flights") return b.flightCount - a.flightCount;
      if (sortBy === "duration") return a.avgDurationMin - b.avgDurationMin;
      return a.city.localeCompare(b.city);
    });
  }, [cards, sortBy, filterNonstopOnly, filterGoWildOnly]);

  // ── Build single-dest payload for drilling in ────────────
  const handleViewDest = (card: DestCard) => {
    const singleDestFlights = card.flights;
    const singlePayload = JSON.stringify({
      response: { flights: singleDestFlights },
      departureDate,
      arrivalDate,
      tripType,
      departureAirport,
      arrivalAirport: card.destination,
      fromCache: false,
    });
    onViewDest(singlePayload);
  };

  const formattedDate = useMemo(() => {
    if (!departureDate) return null;
    return new Date(departureDate).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [departureDate]);

  const originCity = airportMap[departureAirport]?.city || departureAirport;

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F1F5F5]">
      {/* ── Sticky Header + Sort Bar ────────────────────────── */}
      <div className="sticky top-0 z-20">
      {/* ── Hero Header ─────────────────────────────────────── */}
      <header
        className="flex flex-col px-5 pt-6 pb-[124px] overflow-hidden relative"
        style={{
          backgroundImage: `url('/assets/locations/init_background.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Green gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(6, 78, 59, 0.65) 0%, rgba(6, 78, 59, 0.40) 25%, rgba(6, 78, 59, 0.55) 50%, rgba(6, 78, 59, 0.65) 75%, rgba(6, 78, 59, 0.70) 100%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(6, 78, 59, 0) 0%, rgba(6, 78, 59, 0.85) 100%)" }}
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

        {/* Title */}
        <div className="relative mt-3">
          <p
            className="text-white/70 text-[22px] font-light leading-tight"
            style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
          >
            {originCity} to
          </p>
          <p
            className="text-white leading-tight"
            style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
          >
            {(() => {
              // Check if this was a city area search
              if (arrivalAirport?.startsWith("CITY:")) {
                const cityName = arrivalAirport.replace("CITY:", "").replace(/\+/g, " ").toLowerCase()
                  .split(" ")
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ");
                return <span className="text-[36px] font-black">{cityName}</span>;
              }
              return <span className="text-[36px] font-black">All Destinations</span>;
            })()}
          </p>

          {formattedDate && (
            <div
              className="mt-2 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg"
              style={{
                boxShadow: "0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)",
                transform: "translateY(-1px)",
              }}
            >
              <HugeiconsIcon icon={Calendar03Icon} size={13} color="#065F46" strokeWidth={1.5} />
              <span className="text-[#065F46] text-xs font-semibold leading-none">{formattedDate}</span>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end justify-between w-full gap-2">
          {[
            { label: "DESTINATIONS", value: cards.length },
            { label: "TOTAL FLIGHTS", value: rawFlights.length },
            { label: "NONSTOP", value: cards.filter((c) => c.hasNonstop).length },
            { label: "GO WILD", value: cards.filter((c) => c.hasGoWild).length },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 flex flex-col items-center">
              <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight text-center">
                {label}
              </span>
              <span className="text-[34px] font-bold text-white leading-tight mt-0.5 text-center">{value}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Sort / filter bar ───────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-end gap-2">
        {/* Active filter indicator */}
        {(filterNonstopOnly || filterGoWildOnly) && (
          <span className="text-[11px] font-semibold text-[#10B981] bg-[#E6FAF4] px-2.5 py-1 rounded-full">
            {[filterNonstopOnly && "Nonstop", filterGoWildOnly && "GoWild"].filter(Boolean).join(" · ")}
          </span>
        )}
        {/* Sort icon button */}
        <button
          type="button"
          onClick={() => setSortSheet(true)}
          className={cn(
            "h-9 w-9 flex items-center justify-center rounded-full border transition-all",
            sortBy !== "city"
              ? "bg-[#10B981] border-[#10B981] text-white"
              : "bg-white border-[#E8EBEB] text-[#6B7B7B]",
          )}
        >
          <HugeiconsIcon icon={SortByDown02Icon} size={18} color={sortBy !== "city" ? "white" : "#6B7B7B"} strokeWidth={2} />
        </button>
        {/* Filter icon button */}
        <button
          type="button"
          onClick={() => setFilterSheet(true)}
          className={cn(
            "h-9 w-9 flex items-center justify-center rounded-full border transition-all",
            (filterNonstopOnly || filterGoWildOnly)
              ? "bg-[#10B981] border-[#10B981] text-white"
              : "bg-white border-[#E8EBEB] text-[#6B7B7B]",
          )}
        >
          <HugeiconsIcon icon={FilterIcon} size={18} color={(filterNonstopOnly || filterGoWildOnly) ? "white" : "#6B7B7B"} strokeWidth={2} />
        </button>
      </div>
      </div>{/* end sticky wrapper */}

      {/* ── Destination cards list ───────────────────────────── */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-4 relative z-10">
        {sortedCards.map((card) => {
          const bgImage = card.locationId
            ? `/assets/locations/${card.locationId}_background.png`
            : null;

          return (
            <div
              key={card.destination}
              className="rounded-2xl overflow-hidden bg-white border border-[#E8EBEB]"
              style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
            >
              {/* City photo */}
              <div className="relative h-[130px] overflow-hidden bg-[#C8D5D5]">
                {bgImage ? (
                  <img
                    src={bgImage}
                    alt={card.city}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{
                      background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)",
                      opacity: 0.6,
                    }}
                  />
                )}
                {/* Gradient scrim */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)",
                  }}
                />
                {/* GoWild badge — only shown if GoWild fares exist */}
                {card.hasGoWild && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#10B981] rounded-full px-2.5 py-1">
                    <HugeiconsIcon icon={TicketStarIcon} size={11} color="white" strokeWidth={2} />
                    <span className="text-[10px] font-bold text-white leading-none">GO WILD</span>
                  </div>
                )}
                {/* Nonstop badge */}
                {card.hasNonstop && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={11} color="#065F46" strokeWidth={2} />
                    <span className="text-[10px] font-bold text-[#065F46] leading-none">NONSTOP</span>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="px-4 pt-3 pb-3">
                {/* City, State  |  IATA code */}
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-[18px] font-black text-[#1A2E2E] leading-tight">
                    {card.city || card.destination}
                    {(card.stateCode || card.country) && (
                      <span className="text-[#6B7B7B] font-normal text-[16px]">
                        {", "}{card.stateCode || card.country}
                      </span>
                    )}
                  </h3>
                  <span className="text-[15px] font-bold text-[#6B7B7B] leading-tight flex-shrink-0 ml-2">
                    {card.destination}
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-[#F0F3F3] my-2.5" />

                {/* Stats row */}
                <div className="flex flex-col gap-1.5 mb-3">
                  {card.minFare != null && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgba(16,185,129,0.12)" }}
                      >
                        <HugeiconsIcon icon={TicketStarIcon} size={13} color="#10B981" strokeWidth={2} />
                      </div>
                      <span className="text-[13px] text-[#2E4A4A]">
                        From{" "}
                        <span className="font-bold text-[#1A2E2E]">
                          ${card.minFare.toFixed(2)} USD
                        </span>
                      </span>
                    </div>
                  )}
                  {card.avgDurationMin > 0 && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgba(107,123,123,0.10)" }}
                      >
                        <HugeiconsIcon icon={Clock01Icon} size={13} color="#6B7B7B" strokeWidth={2} />
                      </div>
                      <span className="text-[13px] text-[#2E4A4A]">
                        Avg. Duration:{" "}
                        <span className="font-semibold">~{formatDurationMinutes(card.avgDurationMin)}</span>
                      </span>
                    </div>
                  )}
                  {/* Nonstop pill — replaces the old "Non-Stop & Connecting" text row */}
                  {card.hasNonstop && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-white border border-[#E8EBEB] rounded-full px-2.5 py-1" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                        <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={11} color="#065F46" strokeWidth={2} />
                        <span className="text-[10px] font-bold text-[#065F46] leading-none">NONSTOP</span>
                      </div>
                    </div>
                  )}
                  {card.availableFareTypes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgba(107,123,123,0.10)" }}
                      >
                        <HugeiconsIcon icon={Route02Icon} size={13} color="#6B7B7B" strokeWidth={2} />
                      </div>
                      <span className="text-[13px] text-[#2E4A4A] truncate">
                        {card.availableFareTypes.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* View Flights button row — flight count left, button right */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#6B7B7B] font-medium">
                    {card.flightCount} Flight{card.flightCount !== 1 ? "s" : ""} Available
                  </span>
                  <button
                    type="button"
                    onClick={() => handleViewDest(card)}
                    className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                  >
                    View Flights
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {sortedCards.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-sm text-[#6B7B7B] text-center">No destinations found.</p>
          </div>
        )}
      </div>

      {/* ── Sort Sheet ──────────────────────────────────────── */}
      <AnimatePresence>
        {sortSheet && (
          <>
            <motion.div
              key="sort-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setSortSheet(false)}
            />
            <motion.div
              key="sort-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl"
              style={{ maxWidth: "768px", margin: "0 auto" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
              </div>
              {/* Header */}
              <div className="flex items-center gap-2.5 px-5 pt-2 pb-4 border-b border-[#F0F1F1]">
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                  <HugeiconsIcon icon={SortByDown02Icon} size={15} color="white" strokeWidth={2} />
                </div>
                <h2 className="text-base font-bold text-[#2E4A4A]">Sort By</h2>
              </div>
              {/* Options */}
              <div className="flex flex-col py-2 pb-8">
                {([
                  { key: "city", label: "A–Z (City Name)", desc: "Alphabetical order", icon: CheckmarkCircle02Icon },
                  { key: "fare", label: "Lowest Price", desc: "Cheapest fares first", icon: DollarCircleIcon },
                  { key: "flights", label: "Most Flights", desc: "Most available flights first", icon: AirplaneTakeOff02Icon },
                  { key: "duration", label: "Shortest Duration", desc: "Quickest flights first", icon: Clock01Icon },
                ] as const).map(({ key, label, desc, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setSortBy(key); setSortSheet(false); }}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5"
                  >
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: sortBy === key ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "rgba(107,123,123,0.10)" }}
                    >
                      <HugeiconsIcon icon={icon} size={17} color={sortBy === key ? "white" : "#6B7B7B"} strokeWidth={2} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={cn("text-sm font-semibold", sortBy === key ? "text-[#059669]" : "text-[#2E4A4A]")}>{label}</p>
                      <p className="text-xs text-[#9CA3AF]">{desc}</p>
                    </div>
                    {sortBy === key && (
                      <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} color="white" strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Filter Sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {filterSheet && (
          <>
            <motion.div
              key="filter-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setFilterSheet(false)}
            />
            <motion.div
              key="filter-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl"
              style={{ maxWidth: "768px", margin: "0 auto" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-[#F0F1F1]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                    <HugeiconsIcon icon={FilterIcon} size={15} color="white" strokeWidth={2} />
                  </div>
                  <h2 className="text-base font-bold text-[#2E4A4A]">Filter</h2>
                </div>
                {(filterNonstopOnly || filterGoWildOnly) && (
                  <button
                    type="button"
                    onClick={() => { setFilterNonstopOnly(false); setFilterGoWildOnly(false); }}
                    className="text-xs font-semibold text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {/* Filter options */}
              <div className="flex flex-col py-2 pb-8">
                {([
                  {
                    key: "nonstop",
                    label: "Nonstop Only",
                    desc: "Show only destinations with nonstop flights",
                    icon: AirplaneTakeOff01Icon,
                    active: filterNonstopOnly,
                    toggle: () => setFilterNonstopOnly((v) => !v),
                  },
                  {
                    key: "gowild",
                    label: "GoWild Fares",
                    desc: "Show only destinations with GoWild pricing",
                    icon: TicketStarIcon,
                    active: filterGoWildOnly,
                    toggle: () => setFilterGoWildOnly((v) => !v),
                  },
                ]).map(({ key, label, desc, icon, active, toggle }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={toggle}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5"
                  >
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: active ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "rgba(107,123,123,0.10)" }}
                    >
                      <HugeiconsIcon icon={icon} size={17} color={active ? "white" : "#6B7B7B"} strokeWidth={2} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={cn("text-sm font-semibold", active ? "text-[#059669]" : "text-[#2E4A4A]")}>{label}</p>
                      <p className="text-xs text-[#9CA3AF]">{desc}</p>
                    </div>
                    {/* Toggle pill */}
                    <div
                      className="w-11 h-6 rounded-full flex items-center transition-all flex-shrink-0 px-0.5"
                      style={{ background: active ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "#E5E7EB" }}
                    >
                      <motion.div
                        animate={{ x: active ? 20 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        className="h-5 w-5 rounded-full bg-white shadow-sm"
                      />
                    </div>
                  </button>
                ))}
              </div>
              {/* Apply button */}
              <div className="px-5 pb-8">
                <button
                  type="button"
                  onClick={() => setFilterSheet(false)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlightMultiDestResults;
