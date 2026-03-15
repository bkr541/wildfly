import { useMemo, useState, useEffect, useRef, lazy, Suspense } from "react";
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
  CircleArrowRight02Icon,
  DollarCircleIcon,
  AirplaneTakeOff02Icon,
  SunriseIcon,
  MapsLocation02Icon,
} from "@hugeicons/core-free-icons";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const MultiDestMap = lazy(() => import("@/components/MultiDestMap"));

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

// ── Helpers ──────────────────────────────────────────────────

function parseDurationToMinutes(duration: string): number {
  const raw = String(duration).trim();
  if (!raw) return 0;
  if (raw.includes(":")) {
    const parts = raw.split(":").map((p) => p.trim());
    if (parts.length >= 3) {
      const hoursPart = parts[0];
      let days = 0,
        hours = 0;
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
    Record<
      string,
      {
        city: string;
        stateCode: string;
        country: string;
        name: string;
        locationId: number | null;
        latitude: number | null;
        longitude: number | null;
      }
    >
  >({});
  const [sortBy, setSortBy] = useState<"city" | "fare" | "flights" | "duration">("city");
  const [sortSheet, setSortSheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [mapSheet, setMapSheet] = useState(false);
  const [filterNonstopOnly, setFilterNonstopOnly] = useState(false);
  const [filterGoWildOnly, setFilterGoWildOnly] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);
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
      return {
        rawFlights: [] as any[],
        departureDate: null,
        arrivalDate: null,
        tripType: "One Way",
        departureAirport: "",
        arrivalAirport: "",
      };
    }
  }, [responseData]);

  // ── Fetch airport metadata ───────────────────────────────
  const destinationCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const f of rawFlights) {
      if (Array.isArray(f.legs)) {
        for (const leg of f.legs) {
          if (leg.origin) codes.add(leg.origin);
          if (leg.destination) codes.add(leg.destination);
        }
      } else {
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
      setParallaxY(el.scrollTop * 0.4);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (destinationCodes.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("iata_code, name, location_id, latitude, longitude, locations(city, state_code, country)")
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
            latitude: a.latitude ?? null,
            longitude: a.longitude ?? null,
          };
        }
        setAirportMap(map);
      }
    })();
  }, [destinationCodes]);

  // ── Build destination cards ──────────────────────────────
  const cards: DestCard[] = useMemo(() => {
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

      // Compute min/max fare and whether the minimum is a GoWild fare.
      // After normalizeAllDestinationsResponse (with ...f spread), each flight has:
      //   f.fares.go_wild      = raw GoWild fare (number | null)
      //   f.fares.discount_den = DiscountDen fare
      //   f.fares.standard     = Standard fare
      //   f.fares.basic        = pre-computed lowest of all three
      // getMyData shape also preserved via f.rawPayload.fares.go_wild.total
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

        // Fall back to pre-computed basic if no individual fares found
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

      // Duration: shortest (min) and avg
      let minDurationMin = Infinity;
      const totalDurMins = flts.reduce((sum, f) => {
        const durStr = f.total_duration ?? f.duration ?? "";
        const mins = parseDurationToMinutes(durStr);
        if (mins > 0 && mins < minDurationMin) minDurationMin = mins;
        return sum + mins;
      }, 0);
      const avgDurationMin = flts.length > 0 ? Math.round(totalDurMins / flts.length) : 0;
      if (minDurationMin === Infinity) minDurationMin = 0;

      // Departure window: earliest and latest departure times across all flights
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

      // GoWild: check fares.go_wild (preserved from normalizer) or rawPayload
      const hasGoWild = flts.some((f) => {
        const gw = f.fares?.go_wild ?? f.rawPayload?.fares?.go_wild?.total;
        return gw != null && Number(gw) > 0;
      });

      // Nonstop: use legs array length; fall back to stops field
      const hasNonstop = flts.some((f) => {
        if (Array.isArray(f.legs)) return f.legs.length === 1;
        return (f.stops ?? 1) === 0;
      });
      const nonstopCount = flts.filter((f) => {
        if (Array.isArray(f.legs)) return f.legs.length === 1;
        return (f.stops ?? 1) === 0;
      }).length;

      // Earliest departure (smallest minute value → formatted time)
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
    const enriched = card.flights.map((f: any) => {
      const rp = f.rawPayload ?? {};
      const segments: any[] = Array.isArray(rp.segments) ? rp.segments : [];

      // Rebuild legs with real ISO times from rawPayload.segments
      const enrichedLegs =
        segments.length > 0
          ? segments.map((seg: any) => ({
              origin: seg.departure_airport ?? "",
              destination: seg.arrival_airport ?? "",
              departure_time: seg.departure_time ?? "",
              arrival_time: seg.arrival_time ?? "",
            }))
          : (f.legs ?? []).map((leg: any) => ({
              ...leg,
              departure_time: leg.departure_time || rp.departure_time || "",
              arrival_time: leg.arrival_time || rp.arrival_time || "",
            }));

      // Enrich fares from rawPayload.fares
      const rpFares = rp.fares ?? {};
      const discountDen: number | null = rpFares.discount_den?.total ?? null;
      const standard: number | null = rpFares.standard?.total ?? null;
      const goWild: number | null = rpFares.go_wild?.total ?? null;
      const nonNullFares = [discountDen, standard, goWild].filter((v): v is number => v != null);
      const basic: number | null = nonNullFares.length > 0 ? Math.min(...nonNullFares) : (f.price ?? null);

      // Enrich duration — use rawPayload.total_trip_time if available
      const durRaw: string = rp.total_trip_time ?? f.total_duration ?? f.duration ?? "";

      // is_plus_one_day: compare first leg dep date vs last leg arr date
      const firstDep = enrichedLegs[0]?.departure_time ?? "";
      const lastArr = enrichedLegs[enrichedLegs.length - 1]?.arrival_time ?? "";
      const plusOne =
        firstDep && lastArr
          ? new Date(firstDep).toDateString() !== new Date(lastArr).toDateString() &&
            new Date(lastArr) > new Date(firstDep)
          : false;

      return {
        ...f,
        legs: enrichedLegs,
        fares: {
          basic,
          economy: discountDen,
          premium: standard,
          business: null,
          go_wild: goWild,
          discount_den: discountDen,
          standard,
        },
        total_duration: durRaw,
        is_plus_one_day: plusOne,
      };
    });

    const singlePayload = JSON.stringify({
      response: { flights: enriched },
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

  const destinationLabel = useMemo(() => {
    if (arrivalAirport?.startsWith("CITY:")) {
      return arrivalAirport
        .replace("CITY:", "")
        .replace(/\+/g, " ")
        .toLowerCase()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return "All Destinations";
  }, [arrivalAirport]);

  // ── Map data ──────────────────────────────────────────────
  const depLatLng = useMemo<[number, number] | null>(() => {
    const a = airportMap[departureAirport];
    if (a?.latitude != null && a?.longitude != null) return [a.latitude, a.longitude];
    return null;
  }, [airportMap, departureAirport]);

  const mapDestinations = useMemo(() => {
    return cards
      .map((c) => {
        const a = airportMap[c.destination];
        if (a?.latitude != null && a?.longitude != null) {
          return { iata: c.destination, latLng: [a.latitude, a.longitude] as [number, number] };
        }
        return null;
      })
      .filter((d): d is { iata: string; latLng: [number, number] } => d !== null);
  }, [cards, airportMap]);

  return (
    <div className="relative flex flex-col h-full bg-[#F1F5F5]">
      {/* ── Compact sticky header (appears when hero scrolls away) ── */}
      <motion.div
        className="sticky top-0 z-30 px-4 bg-gradient-to-r from-[#10B981] to-[#059669] overflow-hidden"
        initial={false}
        animate={{
          height: compactHeader ? 80 : 0,
          opacity: compactHeader ? 1 : 0,
          pointerEvents: compactHeader ? "auto" : "none",
        }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
      >
        {/* Top row: Back + Route + Controls */}
        <div className="flex items-center justify-between h-10 mt-1">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity flex-shrink-0"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <span className="text-[17px] font-black text-white tracking-tight">{departureAirport}</span>
            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={16} color="white" strokeWidth={2} />
            <span className="text-[17px] font-black text-white tracking-tight truncate">{destinationLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSortSheet(true)}
              className={cn(
                "h-8 w-8 flex items-center justify-center rounded-full border transition-all",
                sortBy !== "city" ? "bg-white/20 border-white/40" : "bg-white/10 border-white/30",
              )}
            >
              <HugeiconsIcon icon={SortByDown02Icon} size={16} color="white" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setFilterSheet(true)}
              className={cn(
                "h-8 w-8 flex items-center justify-center rounded-full border transition-all",
                filterNonstopOnly || filterGoWildOnly ? "bg-white/20 border-white/40" : "bg-white/10 border-white/30",
              )}
            >
              <HugeiconsIcon icon={FilterIcon} size={16} color="white" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-4 mt-2 pb-1">
          {[
            { label: "DEST", value: cards.length },
            { label: "FLIGHTS", value: rawFlights.length },
            { label: "NONSTOP", value: cards.filter((c) => c.hasNonstop).length },
            { label: "GO WILD", value: cards.filter((c) => c.hasGoWild).length },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-white/80">{label}</span>
              <span className="text-[12px] font-black text-white">{value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Scrollable content ────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {/* ── Hero Header ─────────────────────────────────────── */}
        <header
          ref={heroRef}
          className="flex flex-col px-5 pt-6 pb-[100px] overflow-hidden relative"
          style={{
            backgroundImage: `url('/assets/locations/init_background.png')`,
            backgroundSize: "cover",
            backgroundPosition: `center ${parallaxY}px`,
            willChange: "background-position",
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

          {/* Title - Whitespace reduced here */}
          <div className="relative mt-0">
            <div className="flex flex-col gap-0 leading-tight" style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}>
              <span className="text-white/70 text-[22px] font-light">{originCity} to</span>
              <span className="text-white text-[36px] font-black">{destinationLabel}</span>
              {formattedDate && (
                <div
                  className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg self-start mt-2"
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
          </div>

          {/* Stats strip */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end justify-between w-full gap-2">
            {[
              { label: "DESTINATIONS", value: cards.length },
              { label: "TOTAL FLIGHTS", value: rawFlights.length },
              { label: "NONSTOP", value: cards.filter((c) => c.hasNonstop).length },
              { label: "GO WILD", value: cards.filter((c) => c.hasGoWild).length },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-0">
                <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight text-center">
                  {label}
                </span>
                <span className="text-[32px] font-bold text-white leading-tight text-center">{value}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── Sort / filter bar ───────────────────────────────── */}
        <div className="bg-white border-b border-[#E8EBEB] px-4 py-2 flex items-center justify-between gap-2">
          {/* Left: active filter indicator */}
          <div className="flex-1">
            {(filterNonstopOnly || filterGoWildOnly) && (
              <span className="text-[11px] font-semibold text-[#10B981] bg-[#E6FAF4] px-2.5 py-1 rounded-full whitespace-nowrap">
                {[filterNonstopOnly && "Nonstop", filterGoWildOnly && "GoWild"].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          {/* Right-aligned controls */}
          <div className="flex items-center gap-2 justify-end flex-shrink-0">
            {/* Map button */}
            <button
              type="button"
              onClick={() => setMapSheet(true)}
              className="h-9 w-9 flex items-center justify-center rounded-full border border-[#E8EBEB] bg-white transition-all flex-shrink-0"
            >
              <HugeiconsIcon icon={MapsLocation02Icon} size={16} color="#10B981" strokeWidth={2} />
            </button>
            {/* Sort button */}
            <button
              type="button"
              onClick={() => setSortSheet(true)}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-full border transition-all flex-shrink-0",
                sortBy !== "city" ? "bg-[#10B981] border-[#10B981]" : "bg-white border-[#E8EBEB]",
              )}
            >
              <HugeiconsIcon icon={SortByDown02Icon} size={16} color="#10B981" strokeWidth={2} />
            </button>
            {/* Filter button */}
            <button
              type="button"
              onClick={() => setFilterSheet(true)}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-full border transition-all flex-shrink-0",
                filterNonstopOnly || filterGoWildOnly ? "bg-[#10B981] border-[#10B981]" : "bg-white border-[#E8EBEB]",
              )}
            >
              <HugeiconsIcon icon={FilterIcon} size={16} color="#10B981" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── Destination cards list ───────────────────────────── */}
        <div className="flex-1 flex flex-col px-4 py-4 gap-4 relative z-10">
          {sortedCards.map((card) => {
            const bgImage = card.locationId ? `/assets/locations/${card.locationId}_background.png` : null;

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
                      background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)",
                    }}
                  />
                  {/* Min price badge — top RIGHT of hero image */}
                  {card.minFare != null && (
                    <div
                      className="absolute top-3 right-3 flex-shrink-0 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
                      style={{
                        background: card.isMinFareGoWild ? "#10B981" : "rgba(255,255,255,0.95)",
                        border: card.isMinFareGoWild ? "none" : "1px solid rgba(232,235,235,0.8)",
                        boxShadow: card.isMinFareGoWild
                          ? "0 2px 8px rgba(16,185,129,0.4)"
                          : "0 2px 8px rgba(0,0,0,0.18)",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <span
                        className="text-[14px] font-black leading-none"
                        style={{ color: card.isMinFareGoWild ? "#FFFFFF" : "#1A2E2E" }}
                      >
                        ${Math.round(card.minFare)}
                      </span>
                    </div>
                  )}
                  {/* GoWild badge — top LEFT of hero image (only when no min fare or GoWild is separate) */}
                  {card.hasGoWild && !card.isMinFareGoWild && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#10B981] rounded-full px-2.5 py-1">
                      <HugeiconsIcon icon={TicketStarIcon} size={11} color="white" strokeWidth={2} />
                      <span className="text-[10px] font-bold text-white leading-none">GO WILD</span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="px-4 pt-3 pb-3">
                  {/* Row 1: IATA | City, State  +  flight count right-justified */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[18px] font-black text-[#1A2E2E] leading-tight flex-1 mr-2">
                      <span className="text-[#10B981]">{card.destination}</span>
                      <span className="text-[#6B7B7B] font-normal text-[15px]"> | </span>
                      {card.city || card.destination}
                      {(card.stateCode || card.country) && (
                        <span className="text-[#6B7B7B] font-normal text-[16px]">
                          {", "}
                          {card.stateCode || card.country}
                        </span>
                      )}
                    </h3>
                    <span className="text-[12px] text-[#6B7B7B] font-medium flex-shrink-0">
                      {card.flightCount} Flight{card.flightCount !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[#F0F3F3] my-2.5" />

                  {/* Stats grid: 2-column layout */}
                  <div className="flex flex-col gap-2 mb-3">
                    {/* Row A: Fare Range | Earliest Departure */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(107,123,123,0.10)" }}
                        >
                          <HugeiconsIcon icon={DollarCircleIcon} size={13} color="#6B7B7B" strokeWidth={2} />
                        </div>
                        <span className="text-[12px] text-[#2E4A4A] truncate">
                          Range:{" "}
                          <span className="font-semibold">
                            {card.minFare != null && card.maxFare != null
                              ? `$${Math.round(card.minFare)} – $${Math.round(card.maxFare)}`
                              : "—"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(107,123,123,0.10)" }}
                        >
                          <HugeiconsIcon icon={SunriseIcon} size={13} color="#6B7B7B" strokeWidth={2} />
                        </div>
                        <span className="text-[12px] text-[#2E4A4A] truncate">
                          Earliest: <span className="font-semibold">{card.earliestDeparture ?? "—"}</span>
                        </span>
                      </div>
                    </div>

                    {/* Row B: Quickest | Nonstop Count */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(107,123,123,0.10)" }}
                        >
                          <HugeiconsIcon icon={Clock01Icon} size={13} color="#6B7B7B" strokeWidth={2} />
                        </div>
                        <span className="text-[12px] text-[#2E4A4A] truncate">
                          Quickest:{" "}
                          <span className="font-semibold">
                            {card.minDurationMin > 0 ? formatDurationMinutes(card.minDurationMin) : "—"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(107,123,123,0.10)" }}
                        >
                          <HugeiconsIcon icon={CircleArrowRight02Icon} size={13} color="#6B7B7B" strokeWidth={2} />
                        </div>
                        <span className="text-[12px] text-[#2E4A4A] truncate">
                          Nonstop: <span className="font-semibold">{card.nonstopCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* View Flights button — right aligned */}
                  <div className="flex items-center justify-end">
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
      </div>
      {/* end scrollRef */}

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
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  <HugeiconsIcon icon={SortByDown02Icon} size={15} color="white" strokeWidth={2} />
                </div>
                <h2 className="text-base font-bold text-[#2E4A4A]">Sort By</h2>
              </div>
              {/* Options */}
              <div className="flex flex-col py-2 pb-8">
                {(
                  [
                    { key: "city", label: "A–Z (City Name)", desc: "Alphabetical order", icon: CheckmarkCircle02Icon },
                    { key: "fare", label: "Lowest Price", desc: "Cheapest fares first", icon: DollarCircleIcon },
                    {
                      key: "flights",
                      label: "Most Flights",
                      desc: "Most available flights first",
                      icon: AirplaneTakeOff02Icon,
                    },
                    { key: "duration", label: "Shortest Duration", desc: "Quickest flights first", icon: Clock01Icon },
                  ] as const
                ).map(({ key, label, desc, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSortBy(key);
                      setSortSheet(false);
                    }}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5"
                  >
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background:
                          sortBy === key
                            ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                            : "rgba(107,123,123,0.10)",
                      }}
                    >
                      <HugeiconsIcon
                        icon={icon}
                        size={17}
                        color={sortBy === key ? "white" : "#6B7B7B"}
                        strokeWidth={2}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={cn("text-sm font-semibold", sortBy === key ? "text-[#059669]" : "text-[#2E4A4A]")}>
                        {label}
                      </p>
                      <p className="text-xs text-[#9CA3AF]">{desc}</p>
                    </div>
                    {sortBy === key && (
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                      >
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
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                  >
                    <HugeiconsIcon icon={FilterIcon} size={15} color="white" strokeWidth={2} />
                  </div>
                  <h2 className="text-base font-bold text-[#2E4A4A]">Filter Results</h2>
                </div>
                {(filterNonstopOnly || filterGoWildOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterNonstopOnly(false);
                      setFilterGoWildOnly(false);
                    }}
                    className="text-xs font-semibold text-[#10B981]"
                  >
                    Clear All
                  </button>
                )}
              </div>
              {/* Filter options */}
              <div className="flex flex-col py-2 pb-8">
                {[
                  {
                    label: "Nonstop Only",
                    desc: "Show only destinations with nonstop flights",
                    active: filterNonstopOnly,
                    toggle: () => setFilterNonstopOnly((v) => !v),
                    icon: AirplaneTakeOff01Icon,
                  },
                  {
                    label: "Go Wild! Fares",
                    desc: "Show only destinations with Go Wild fares",
                    active: filterGoWildOnly,
                    toggle: () => setFilterGoWildOnly((v) => !v),
                    icon: TicketStarIcon,
                  },
                ].map(({ label, desc, active, toggle, icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={toggle}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5"
                  >
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                          : "rgba(107,123,123,0.10)",
                      }}
                    >
                      <HugeiconsIcon icon={icon} size={17} color={active ? "white" : "#6B7B7B"} strokeWidth={2} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={cn("text-sm font-semibold", active ? "text-[#059669]" : "text-[#2E4A4A]")}>
                        {label}
                      </p>
                      <p className="text-xs text-[#9CA3AF]">{desc}</p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                        active ? "border-[#10B981] bg-[#10B981]" : "border-[#D1D5DB] bg-transparent",
                      )}
                    >
                      {active && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={11} color="white" strokeWidth={3} />}
                    </div>
                  </button>
                ))}
              </div>
              {/* Apply button */}
              <div className="px-5 pb-8">
                <button
                  type="button"
                  onClick={() => setFilterSheet(false)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Map Sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {mapSheet && (
          <>
            <motion.div
              key="map-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setMapSheet(false)}
            />
            <motion.div
              key="map-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl overflow-hidden"
              style={{ maxWidth: "768px", margin: "0 auto", height: "72vh" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1] flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                  >
                    <HugeiconsIcon icon={MapsLocation02Icon} size={15} color="white" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#2E4A4A] leading-tight">Route Map</h2>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {departureAirport} → {mapDestinations.length} destination{mapDestinations.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMapSheet(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280]"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
              {/* Map */}
              <div className="flex-1 relative min-h-0">
                {depLatLng && mapDestinations.length > 0 ? (
                  <Suspense
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-[#F1F5F5]">
                        <span className="text-sm text-[#6B7B7B]">Loading map…</span>
                      </div>
                    }
                  >
                    <MultiDestMap depIata={departureAirport} depLatLng={depLatLng} destinations={mapDestinations} />
                  </Suspense>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F1F5F5]">
                    <p className="text-sm text-[#6B7B7B] text-center px-8">
                      {depLatLng == null
                        ? "Departure airport coordinates not available."
                        : "No destination coordinates available yet."}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlightMultiDestResults;
