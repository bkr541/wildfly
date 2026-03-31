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
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { motion } from "framer-motion";
import { DestCardItem, DestCard, buildDestCards } from "@/components/DestCardItem";
import { BottomSheet } from "@/components/BottomSheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const MultiDestMap = lazy(() => import("@/components/MultiDestMap"));

// ── Types ────────────────────────────────────────────────────

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
  const [filterDestType, setFilterDestType] = useState<"all" | "domestic" | "international">("all");
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
  const cards: DestCard[] = useMemo(
    () => buildDestCards(rawFlights, airportMap),
    [rawFlights, airportMap],
  );

  const sortedCards = useMemo(() => {
    let filtered = [...cards];
    if (filterNonstopOnly) filtered = filtered.filter((c) => c.hasNonstop);
    if (filterGoWildOnly) filtered = filtered.filter((c) => c.hasGoWild);
    if (filterDestType === "domestic") filtered = filtered.filter((c) => !c.country || c.country === "United States of America");
    if (filterDestType === "international") filtered = filtered.filter((c) => c.country && c.country !== "United States of America");
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
  }, [cards, sortBy, filterNonstopOnly, filterGoWildOnly, filterDestType]);

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
      year: "numeric",
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
      className="sticky top-0 z-30 px-[22px] bg-gradient-to-r from-[#10B981] to-[#059669] overflow-hidden"
        initial={false}
        animate={{
          height: compactHeader ? 92 : 0,
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
                <HugeiconsIcon icon={SortByDown02Icon} size={16} color={sortBy !== "city" ? "#FFD700" : "white"} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setFilterSheet(true)}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-full border transition-all",
                  filterNonstopOnly || filterGoWildOnly || filterDestType !== "all" ? "bg-white/20 border-white/40" : "bg-white/10 border-white/30",
                )}
              >
                <HugeiconsIcon icon={FilterIcon} size={16} color={filterNonstopOnly || filterGoWildOnly || filterDestType !== "all" ? "#FFD700" : "white"} strokeWidth={2} />
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
          className="flex flex-col px-5 pt-6 pb-20 overflow-hidden relative"
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

          {/* Title */}
          <div className="relative mt-0">
            <div className="flex flex-col gap-0 leading-tight" style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}>
              <span className="text-white text-[22px] font-light" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}>{originCity} to</span>
              <span className="text-white text-[36px] font-black">{destinationLabel}</span>
            </div>
          </div>

          {/* Stats strip */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-center justify-between w-full gap-2 pt-3 border-t border-white/20">
            {[
              { label: "DESTINATIONS", value: cards.length },
              { label: "TOTAL FLIGHTS", value: rawFlights.length },
              { label: "NONSTOP", value: cards.filter((c) => c.hasNonstop).length },
              { label: "GO WILD", value: cards.filter((c) => c.hasGoWild).length },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 flex flex-col items-center">
                <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight text-center">{label}</span>
                <span className="text-[24px] font-medium text-white leading-tight mt-0.5 text-center">{value}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── Sort / filter bar ───────────────────────────────── */}
        <div className="bg-white border-b border-[#E8EBEB] px-4 py-2 flex items-center justify-between gap-2">
          {/* Left: date */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {formattedDate && (
              <div className="inline-flex items-center gap-1.5 flex-shrink-0">
                <HugeiconsIcon icon={Calendar03Icon} size={19} color="#10B981" strokeWidth={1.5} />
                <span className="text-[18px] font-semibold text-[#2E4A4A]">{formattedDate}</span>
              </div>
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
              <HugeiconsIcon icon={SortByDown02Icon} size={16} color={sortBy !== "city" ? "#FFD700" : "#10B981"} strokeWidth={2} />
            </button>
            {/* Filter button */}
            <button
              type="button"
              onClick={() => setFilterSheet(true)}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-full border transition-all flex-shrink-0",
                filterNonstopOnly || filterGoWildOnly || filterDestType !== "all" ? "bg-[#10B981] border-[#10B981]" : "bg-white border-[#E8EBEB]",
              )}
            >
              <HugeiconsIcon icon={FilterIcon} size={16} color={filterNonstopOnly || filterGoWildOnly || filterDestType !== "all" ? "#FFD700" : "#10B981"} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── Destination cards list ───────────────────────────── */}
        <div className="flex-1 flex flex-col px-10 py-4 gap-6 relative z-10">
          {sortedCards.map((card, index) => (
            <DestCardItem
              key={card.destination}
              card={card}
              index={index}
              onViewDest={handleViewDest}
            />
          ))}

          {sortedCards.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-sm text-[#6B7B7B] text-center">No destinations found.</p>
            </div>
          )}
        </div>
      </div>
      {/* end scrollRef */}

      {/* ── Sort Sheet ──────────────────────────────────────── */}
      <BottomSheet open={sortSheet} onClose={() => setSortSheet(false)}>
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
      </BottomSheet>

      {/* ── Filter Sheet ─────────────────────────────────────── */}
      <BottomSheet open={filterSheet} onClose={() => setFilterSheet(false)}>
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
                {(filterNonstopOnly || filterGoWildOnly || filterDestType !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterNonstopOnly(false);
                      setFilterGoWildOnly(false);
                      setFilterDestType("all");
                    }}
                    className="text-xs font-semibold text-[#10B981]"
                  >
                    Clear All
                  </button>
                )}
              </div>
              {/* Filter options */}
              <div className="flex flex-col py-2 pb-4">
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
                  <div
                    key={label}
                    className="flex items-center gap-3 px-5 py-3.5"
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
                    {/* Toggle switch */}
                    <button
                      type="button"
                      onClick={toggle}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                        active ? "bg-[#10B981]" : "bg-[#D1D5DB]",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                          active ? "translate-x-5" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                ))}

                {/* Destination Type — segmented control */}
                <div className="px-5 py-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: filterDestType !== "all"
                          ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                          : "rgba(107,123,123,0.10)",
                      }}
                    >
                      <HugeiconsIcon icon={Route02Icon} size={17} color={filterDestType !== "all" ? "white" : "#6B7B7B"} strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold", filterDestType !== "all" ? "text-[#059669]" : "text-[#2E4A4A]")}>
                        Destination Type
                      </p>
                      <p className="text-xs text-[#9CA3AF]">Filter by domestic or international</p>
                    </div>
                  </div>
                  {/* 3-option pill toggle */}
                  <div
                    className="relative flex items-center rounded-full p-0.5 ml-12"
                    style={{ background: "rgba(107,123,123,0.10)" }}
                  >
                    {/* Sliding pill indicator */}
                    <div
                      className="absolute top-[2px] bottom-[2px] rounded-full shadow-sm transition-all duration-300 ease-in-out"
                      style={{
                        background: "#10B981",
                        width: "calc((100% - 4px) / 3)",
                        left: `calc(2px + (100% - 4px) / 3 * ${["domestic", "all", "international"].indexOf(filterDestType)})`,
                      }}
                    />
                    {(["domestic", "all", "international"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFilterDestType(opt)}
                        className={cn(
                          "relative z-10 flex-1 py-2 text-[12px] font-semibold rounded-full transition-colors duration-200 capitalize",
                          filterDestType === opt ? "text-white" : "text-[#9CA3AF]",
                        )}
                      >
                        {opt === "all" ? "All" : opt === "domestic" ? "Domestic" : "Intl"}
                      </button>
                    ))}
                  </div>
                </div>
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
      </BottomSheet>

      {/* ── Map Sheet ─────────────────────────────────────── */}
      <BottomSheet open={mapSheet} onClose={() => setMapSheet(false)} className="overflow-hidden" style={{ height: "72vh" }}>
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
      </BottomSheet>
    </div>
  );
};

export default FlightMultiDestResults;
