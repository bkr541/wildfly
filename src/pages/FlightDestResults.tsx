import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronDown,
  faPlane,
  faClock,
  faCalendarDays,
  faLayerGroup,
  faMapMarkerAlt,
  faBullhorn,
  faBug,
  faArrowsSpin,
  faArrowsTurnToDots,
} from "@fortawesome/free-solid-svg-icons";
import { faBell as faBellRegular, faCalendar as faCalendarRegular } from "@fortawesome/free-regular-svg-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SunriseIcon,
  SunsetIcon,
  Navigator02Icon,
  TicketStarIcon,
  Location01Icon,
  InformationCircleIcon,
  AirplaneTakeOff01Icon,
  Calendar03Icon,
  Location06Icon,
  FilterIcon,
  SortByDown02Icon,
  CheckmarkCircle02Icon,
  DollarCircleIcon,
  AirplaneTakeOff02Icon,
  Clock01Icon,
  Rocket01Icon,
  UnavailableIcon,
  Alert01Icon,
  TrafficLightIcon,
} from "@hugeicons/core-free-icons";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/BottomSheet";
import { supabase } from "@/integrations/supabase/client";
import { isBlackoutDate } from "@/utils/blackoutDates";
import { cn } from "@/lib/utils";
import FlightLegTimeline from "@/components/FlightLegTimeline";
import { fetchDeveloperSettings } from "@/lib/logSettings";

interface ParsedFlight {
  total_duration: string;
  is_plus_one_day: boolean;
  fares: { basic: number | null; economy: number | null; premium: number | null; business: number | null };
  legs: { origin: string; destination: string; departure_time: string; arrival_time: string }[];
  flightNumber?: string;
}

interface DestinationGroup {
  destination: string;
  city: string;
  stateCode: string;
  airportName: string;
  flights: ParsedFlight[];
  hasGoWild: boolean;
  hasNonstop: boolean;
}

function formatTime(raw: string): string {
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      // e.g. "7:00 PM" — ensure space before AM/PM
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    // Already a formatted time string like "3:01PM" — normalize to "3:01 PM"
    return raw.replace(/(\d)(AM|PM)/i, "$1 $2").replace(/\s{2,}/, " ");
  } catch {
    return raw;
  }
}

/** Parse a time string (ISO or "3:01 PM") into an hour number (0-23), or null */
function parseHour(raw: string): number | null {
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getHours();
  // Try parsing "H:MM AM/PM"
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h;
  }
  return null;
}

/** Format raw duration string into "1d 7h 03m" / "6h 34m"
 *  Handles: D.HH:MM:SS (e.g. "1.02:44:00"), D:H:MM:SS, H:MM:SS, H:MM
 */
function formatDuration(raw: string): string {
  const str = String(raw ?? "").trim();
  if (!str) return "";
  let days = 0, hours = 0, mins = 0;
  if (str.includes(":")) {
    const parts = str.split(":");
    // "D.HH:MM:SS" — first segment has a decimal separating days from hours
    if (parts[0].includes(".")) {
      const [dStr, hStr] = parts[0].split(".");
      days = parseInt(dStr) || 0;
      hours = parseInt(hStr) || 0;
      mins = parseInt(parts[1]) || 0;
    } else if (parts.length === 4) {
      // D:H:MM:SS
      [days, hours, mins] = parts.map(Number);
    } else {
      // H:MM:SS or H:MM — always first two are hours:mins
      [hours, mins] = parts.map(Number);
    }
  } else {
    const h = str.match(/(\d+)\s*(hr|hrs|h)\b/i);
    const m = str.match(/(\d+)\s*(min|m)\b/i);
    hours = parseInt(h?.[1] ?? "0") || 0;
    mins = parseInt(m?.[1] ?? "0") || 0;
  }
  const result: string[] = [];
  if (days > 0) result.push(`${days}d`);
  if (hours > 0) result.push(`${hours}h`);
  result.push(`${String(mins).padStart(2, "0")}m`);
  return result.join(" ");
}

/**
 * Combine a time-only string like "3:08 PM" with a date from responseData
 * to produce a full ISO datetime string (e.g. "2025-03-15T15:08:00").
 */
function buildFullDateTime(timeStr: string, responseData: string, isArrival = false): string {
  try {
    const parsed = JSON.parse(responseData);
    const dateStr: string | null = isArrival
      ? (parsed.arrivalDate ?? parsed.departureDate ?? null)
      : (parsed.departureDate ?? null);
    if (!dateStr || !timeStr) return timeStr;
    const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return timeStr;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const dt = new Date(`${dateStr}T00:00:00`);
    dt.setHours(h, min, 0, 0);
    return dt.toISOString();
  } catch {
    return timeStr;
  }
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function RouteFlapTile({ char, animating }: { char: string; animating: boolean }) {
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-lg shadow-md border overflow-hidden"
      style={{
        width: 24,
        height: 26,
        background: animating ? "#e8eaed" : "linear-gradient(160deg,#059669 0%,#065F46 100%)",
        borderColor: animating ? "#d1d5db" : "#064E3B",
      }}
    >
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
        style={{ background: animating ? "#b0b5bdaa" : "#064E3Baa" }}
      />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: animating ? "#e8eaed" : "#10B981", borderColor: animating ? "#d1d5db" : "#064E3B" }}
      />
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: animating ? "#e8eaed" : "#10B981", borderColor: animating ? "#d1d5db" : "#064E3B" }}
      />
      <span
        className="font-black text-sm leading-none select-none z-10"
        style={{ color: animating ? "#6b7280" : "#fff", letterSpacing: "0.04em" }}
      >
        {char}
      </span>
    </div>
  );
}

function RouteFlap({ word }: { word: string }) {
  const upper = word.toUpperCase().slice(0, 4);
  const [displayChars, setDisplayChars] = useState<string[]>(
    upper.split("").map(() => CHARS[Math.floor(Math.random() * CHARS.length)]),
  );
  const [settled, setSettled] = useState<boolean[]>(Array(upper.length).fill(false));
  const ran = useRef(false);

  useEffect(() => {
    ran.current = false;
    setDisplayChars(upper.split("").map(() => CHARS[Math.floor(Math.random() * CHARS.length)]));
    setSettled(Array(upper.length).fill(false));
  }, [word]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    upper.split("").forEach((finalChar, idx) => {
      const to = setTimeout(() => {
        const steps = 6;
        let step = 0;
        const iv = setInterval(() => {
          step++;
          if (step >= steps) {
            clearInterval(iv);
            setDisplayChars((prev) => {
              const n = [...prev];
              n[idx] = finalChar;
              return n;
            });
            setSettled((prev) => {
              const n = [...prev];
              n[idx] = true;
              return n;
            });
          } else {
            setDisplayChars((prev) => {
              const n = [...prev];
              n[idx] = CHARS[Math.floor(Math.random() * CHARS.length)];
              return n;
            });
          }
        }, 45);
        intervals.push(iv);
      }, idx * 70);
      timeouts.push(to);
    });
    return () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [upper]);

  return (
    <div className="flex gap-0.5">
      {upper.split("").map((_, i) => (
        <RouteFlapTile key={i} char={displayChars[i] ?? ""} animating={!settled[i]} />
      ))}
    </div>
  );
}

type TabType = "Info" | "Flights" | "Events";

const FlightDestResults = ({
  onBack,
  responseData,
  hideHeader,
  hideBackground,
  onBackOverride,
}: {
  onBack: () => void;
  responseData: string;
  hideHeader?: boolean;
  hideBackground?: boolean;
  /** If provided, the back button calls this instead of onBack */
  onBackOverride?: () => void;
}) => {
  const handleBack = onBackOverride ?? onBack;
  const [activeTab, setActiveTab] = useState<TabType>("Flights");
  const [expandedFlightKey, setExpandedFlightKey] = useState<string | null>(null);
  const [airportMap, setAirportMap] = useState<
    Record<string, { city: string; stateCode: string; name: string; locationId?: number | null }>
  >({});
  const [showRaw, setShowRaw] = useState(false);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  // Sort & filter state
  const [sortBy, setSortBy] = useState<"time" | "fare" | "duration" | "stops">("time");
  const [sortSheet, setSortSheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [bookingConfirm, setBookingConfirm] = useState<{ url: string; flight: typeof flights[0] } | null>(null);
  const [filterNonstopOnly, setFilterNonstopOnly] = useState(false);
  const [filterGoWildOnly, setFilterGoWildOnly] = useState(false);
  // Sticky compact header
  const [compactHeader, setCompactHeader] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDeveloperSettings().then((s) => setDebugEnabled(s?.debug_enabled ?? false));
  }, []);

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

  // user_flights tracking
  const [userFlights, setUserFlights] = useState<Record<string, { id: string; type: string }>>({});
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1800);
  }, []);

  // Build a unique key for a flight to match against user_flights
  const isGoWildFlight = (flight: ParsedFlight) => flight.fares.basic != null && flight.fares.basic < 60;

  const flightKey = useCallback((flight: ParsedFlight, type: string) => {
    const dep = flight.legs[0];
    const arr = flight.legs[flight.legs.length - 1];
    return `${type}:${dep?.origin}:${arr?.destination}:${dep?.departure_time}:${arr?.arrival_time}`;
  }, []);

  // Load existing user_flights on mount
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = (await supabase
        .from("user_flights" as any)
        .select("id, type, departure_airport, arrival_airport, departure_time, arrival_time")
        .eq("user_id", user.id)) as any;
      if (data) {
        const map: Record<string, { id: string; type: string }> = {};
        for (const row of data) {
          const key = `${row.type}:${row.departure_airport}:${row.arrival_airport}:${row.departure_time}:${row.arrival_time}`;
          map[key] = { id: row.id, type: row.type };
        }
        setUserFlights(map);
      }
    };
    load();
  }, []);

  const addUserFlight = useCallback(
    async (flight: ParsedFlight, type: "alert" | "going") => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const key = flightKey(flight, type);
      if (userFlights[key]) return; // already saved, nothing to do
      const dep = flight.legs[0];
      const arr = flight.legs[flight.legs.length - 1];
      const { data: inserted } = (await supabase
        .from("user_flights" as any)
        .insert({
          user_id: user.id,
          type,
          flight_json: flight,
          departure_airport: dep?.origin ?? "",
          arrival_airport: arr?.destination ?? "",
          departure_time: buildFullDateTime(dep?.departure_time ?? "", responseData),
          arrival_time: buildFullDateTime(arr?.arrival_time ?? "", responseData, true),
        } as any)
        .select("id")
        .single()) as any;
      if (inserted) {
        setUserFlights((prev) => ({ ...prev, [key]: { id: inserted.id, type } }));
      }
    },
    [userFlights, flightKey, responseData],
  );

  const toggleUserFlight = useCallback(
    async (flight: ParsedFlight, type: "alert" | "going") => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const key = flightKey(flight, type);
      const existing = userFlights[key];
      if (existing) {
        await supabase
          .from("user_flights" as any)
          .delete()
          .eq("id", existing.id);
        setUserFlights((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        showToast(type === "alert" ? "Alerts turned off" : "Not going");
      } else {
        const dep = flight.legs[0];
        const arr = flight.legs[flight.legs.length - 1];
        const { data: inserted } = (await supabase
          .from("user_flights" as any)
          .insert({
            user_id: user.id,
            type,
            flight_json: flight,
            departure_airport: dep?.origin ?? "",
            arrival_airport: arr?.destination ?? "",
            departure_time: buildFullDateTime(dep?.departure_time ?? "", responseData),
            arrival_time: buildFullDateTime(arr?.arrival_time ?? "", responseData, true),
          } as any)
          .select("id")
          .single()) as any;
        if (inserted) {
          setUserFlights((prev) => ({ ...prev, [key]: { id: inserted.id, type } }));
          showToast(type === "alert" ? "Alert set!" : "You're going! 🎉");
        }
      }
    },
    [userFlights, flightKey, showToast],
  );

  const { flights, departureDate, arrivalDate, tripType, departureAirport, arrivalAirport, fromCache } = useMemo(() => {
    try {
      const parsed = JSON.parse(responseData);
      return {
        flights: (parsed.response?.flights ?? []) as ParsedFlight[],
        departureDate: parsed.departureDate ?? null,
        arrivalDate: parsed.arrivalDate ?? null,
        tripType: parsed.tripType ?? parsed.firecrawlRequestBody?.tripType ?? "One Way",
        departureAirport: parsed.departureAirport ?? parsed.firecrawlRequestBody?.departureAirport ?? "",
        arrivalAirport: parsed.arrivalAirport ?? parsed.firecrawlRequestBody?.arrivalAirport ?? "",
        fromCache: parsed.fromCache === true,
      };
    } catch {
      return {
        flights: [],
        departureDate: null,
        arrivalDate: null,
        tripType: "One Way",
        departureAirport: "",
        arrivalAirport: "All",
        fromCache: false,
      };
    }
  }, [responseData]);

  const destinationCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const f of flights) {
      for (const leg of f.legs) {
        if (leg.origin) codes.add(leg.origin);
        if (leg.destination) codes.add(leg.destination);
      }
    }
    return Array.from(codes);
  }, [flights]);

  const [airportCoords, setAirportCoords] = useState<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    if (destinationCodes.length === 0) return;
    const fetchAirports = async () => {
      const { data } = await supabase
        .from("airports")
        .select("iata_code, name, latitude, longitude, location_id, locations(city, state_code)")
        .in("iata_code", destinationCodes);
      if (data) {
        const map: Record<string, { city: string; stateCode: string; name: string; locationId?: number | null }> = {};
        const coords: Record<string, { lat: number; lng: number }> = {};
        for (const a of data as any[]) {
          map[a.iata_code] = {
            city: a.locations?.city ?? "",
            stateCode: a.locations?.state_code ?? "",
            name: a.name ?? "",
            locationId: a.location_id ?? null,
          };
          if (a.latitude != null && a.longitude != null) {
            coords[a.iata_code] = { lat: a.latitude, lng: a.longitude };
          }
        }
        setAirportMap(map);
        setAirportCoords(coords);
      }
    };
    fetchAirports();
  }, [destinationCodes]);

  const airportMapWithCoords = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(airportMap).map(([k, v]) => [
          k,
          { ...v, lat: airportCoords[k]?.lat, lng: airportCoords[k]?.lng },
        ]),
      ),
    [airportMap, airportCoords],
  );

  // Base groups (ungrouped for single-dest case — always one group)
  const groups: DestinationGroup[] = useMemo(() => {
    const grouped: Record<string, ParsedFlight[]> = {};
    for (const f of flights) {
      const dest = f.legs.length ? f.legs[f.legs.length - 1].destination : "???";
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push(f);
    }
    return Object.entries(grouped)
      .map(([dest, flts]) => ({
        destination: dest,
        city: airportMap[dest]?.city ?? "",
        stateCode: airportMap[dest]?.stateCode ?? "",
        airportName: airportMap[dest]?.name ?? "",
        flights: flts,
        hasGoWild: flts.some((f) => isGoWildFlight(f)),
        hasNonstop: flts.some((f) => f.legs.length === 1),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [flights, airportMap]);

  // Per-group sorted+filtered flights for the timeline
  const sortedGroups: DestinationGroup[] = useMemo(() => {
    const parseDur = (s: string): number => {
      const raw = String(s ?? "").trim();
      if (!raw) return 0;
      if (raw.includes(":")) {
        const parts = raw.split(":").map(Number);
        if (parts.length >= 3) return (parts[0] || 0) * 60 + (parts[1] || 0);
        return (parts[0] || 0) * 60 + (parts[1] || 0);
      }
      const h = raw.match(/(\d+)\s*(hr|hrs|h)\b/i);
      const m = raw.match(/(\d+)\s*(min|m)\b/i);
      return (parseInt(h?.[1] ?? "0") || 0) * 60 + (parseInt(m?.[1] ?? "0") || 0);
    };
    const minFare = (f: ParsedFlight): number => {
      const vals = [f.fares.basic, f.fares.economy, f.fares.premium, f.fares.business].filter((v): v is number => v != null);
      return vals.length ? Math.min(...vals) : Infinity;
    };
    return groups.map((g) => {
      let flts = [...g.flights];
      // Apply filters
      if (filterNonstopOnly) flts = flts.filter((f) => f.legs.length === 1);
      if (filterGoWildOnly) flts = flts.filter((f) => isGoWildFlight(f));
      // Apply sort
      flts.sort((a, b) => {
        if (sortBy === "fare") return minFare(a) - minFare(b);
        if (sortBy === "duration") return parseDur(a.total_duration) - parseDur(b.total_duration);
        if (sortBy === "stops") return a.legs.length - b.legs.length;
        // "time" — sort by departure hour
        const ha = parseHour(a.legs[0]?.departure_time ?? "") ?? 0;
        const hb = parseHour(b.legs[0]?.departure_time ?? "") ?? 0;
        return ha - hb;
      });
      return { ...g, flights: flts };
    });
  }, [groups, sortBy, filterNonstopOnly, filterGoWildOnly]);

  const origin = useMemo(() => {
    if (flights.length === 0) return "";
    return flights[0].legs[0]?.origin ?? "";
  }, [flights]);

  const selectedGroup = useMemo(() => {
    if (!selectedDest) return null;
    return groups.find((g) => g.destination === selectedDest) ?? null;
  }, [selectedDest, groups]);

  const earliestDeparture = useMemo(() => {
    if (!selectedGroup) return null;
    let earliestH: number | null = null;
    for (const f of selectedGroup.flights) {
      const dep = f.legs[0]?.departure_time;
      if (dep) {
        const h = parseHour(dep);
        if (h !== null && (earliestH === null || h < earliestH)) earliestH = h;
      }
    }
    if (earliestH === null) return null;
    const d = new Date();
    d.setHours(earliestH, 0, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }, [selectedGroup]);

  return (
    <div className="relative flex flex-col h-full bg-[#F1F5F5] overflow-hidden">
      {/* ── Compact sticky header (appears when hero scrolls away) ── */}
      {!hideHeader && (
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
              onClick={handleBack}
              className="h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity flex-shrink-0"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              <span className="text-[17px] font-black text-white tracking-tight">{departureAirport}</span>
              <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={16} color="white" strokeWidth={2} />
              <span className="text-[17px] font-black text-white tracking-tight truncate">
                {arrivalAirport && arrivalAirport !== "All"
                  ? arrivalAirport
                  : "All Destinations"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSortSheet(true)}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-full border transition-all",
                  sortBy !== "time" ? "bg-white/20 border-white/40" : "bg-white/10 border-white/30",
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
              { label: "FLIGHTS", value: flights.length },
              { label: "NONSTOP", value: flights.filter((f) => f.legs.length === 1).length },
              { label: "GOWILD", value: flights.filter((f) => isGoWildFlight(f)).length },
              { label: "STOPS", value: flights.filter((f) => f.legs.length > 1).length },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-white/80">{label}</span>
                <span className="text-[12px] font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      {/* ── Scrollable content ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
      {!hideHeader &&
        (() => {
          const locationId = arrivalAirport && arrivalAirport !== "All" ? airportMap[arrivalAirport]?.locationId : null;
          const headerBg = locationId
            ? `/assets/locations/${locationId}_background.png`
            : `/assets/locations/init_background.png`;
          return (
            <header
              ref={heroRef}
              className="relative z-10 flex flex-col px-5 pt-6 pb-4 overflow-hidden shrink-0"
              style={{
                backgroundImage: `url('${headerBg}')`,
                backgroundSize: "cover",
                backgroundPosition: `center ${parallaxY}px`,
                willChange: "background-position",
              }}
            >
              {/* Green gradient overlay — REFINED FOR POP */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(6, 78, 59, 0.65) 0%, rgba(6, 78, 59, 0.40) 25%, rgba(6, 78, 59, 0.55) 50%, rgba(6, 78, 59, 0.65) 75%, rgba(6, 78, 59, 0.70) 100%)",
                }}
              />
              {/* Metrics scrim — bottom gradient */}
              <div
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                style={{ background: "linear-gradient(to bottom, rgba(6, 78, 59, 0) 0%, rgba(6, 78, 59, 0.85) 100%)" }}
              />
              {/* Top row: back only */}
              <div className="relative flex items-center w-full">
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
                </button>
              </div>
              {/* Route text below icons — POLISHED WITH TEXT-SHADOW */}
              <div className="relative mt-3">
                <p
                  className="text-white/70 text-[22px] font-light leading-tight"
                  style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
                >
                  {airportMap[departureAirport]?.city || departureAirport} to
                </p>
                <p
                  className="text-white leading-tight uppercase tracking-wide"
                  style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
                >
                  {arrivalAirport && arrivalAirport !== "All" ? (
                    <>
                      <span className="text-[30px] font-black">{arrivalAirport}</span>
                      {airportMap[arrivalAirport]?.city && airportMap[arrivalAirport]?.stateCode ? (
                        <span className="text-[30px] font-light">
                          {" "}
                          | {airportMap[arrivalAirport].city}, {airportMap[arrivalAirport].stateCode}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[36px] font-black">All Destinations</span>
                  )}
                </p>
                {(arrivalAirport && arrivalAirport !== "All" && airportMap[arrivalAirport]?.name) || departureDate ? (
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {arrivalAirport && arrivalAirport !== "All" && airportMap[arrivalAirport]?.name && (
                      <div
                        className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5"
                        style={{
                          boxShadow: "0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)",
                        }}
                      >
                        <HugeiconsIcon icon={Location01Icon} size={13} color="#065F46" strokeWidth={1.5} />
                        <span className="text-[#065F46] text-xs font-semibold leading-none">
                          {airportMap[arrivalAirport].name}
                        </span>
                      </div>
                    )}
                    {departureDate && (
                      <div
                        className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5"
                        style={{
                          boxShadow: "0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)",
                        }}
                      >
                        <HugeiconsIcon icon={Calendar03Icon} size={13} color="#065F46" strokeWidth={1.5} />
                        <span className="text-[#065F46] text-xs font-semibold leading-none">
                          {new Date(departureDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Metrics strip — flows naturally below route text */}
              {arrivalAirport && arrivalAirport !== "All" && (
                <div className="relative mt-4 flex items-center justify-between w-full gap-2 pt-3 border-t border-white/20">
                  {(() => {
                    const allFlights = flights;
                    let earliestH: number | null = null;
                    let latestH: number | null = null;
                    let nonstopCnt = 0;
                    let goWildCnt = 0;
                    for (const f of allFlights) {
                      const dep = f.legs[0]?.departure_time;
                      if (dep) {
                        const h = parseHour(dep);
                        if (h !== null) {
                          if (earliestH === null || h < earliestH) earliestH = h;
                          if (latestH === null || h > latestH) latestH = h;
                        }
                      }
                      if (f.legs.length === 1) nonstopCnt++;
                      if (isGoWildFlight(f)) goWildCnt++;
                    }
                    const fmt = (h: number) => {
                      const d = new Date();
                      d.setHours(h, 0, 0, 0);
                      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                    };
                    return [
                      { label: "EARLIEST", value: earliestH !== null ? fmt(earliestH) : "—" },
                      { label: "LATEST", value: latestH !== null ? fmt(latestH) : "—" },
                      { label: "NONSTOP", value: nonstopCnt },
                      { label: "GOWILD", value: goWildCnt },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex-1 flex flex-col items-center">
                        <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight text-center">
                          {label}
                        </span>
                        <span className="text-[15px] font-bold text-white leading-tight mt-0.5 text-center">
                          {value}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </header>
          );
        })()}
      {/* Tab group */}
      {!hideHeader && (
        <div className="relative z-10 flex items-center justify-around bg-white px-3 border-b border-gray-200">
          {(
            [
              { label: "Info", icon: InformationCircleIcon },
              { label: "Flights", icon: AirplaneTakeOff01Icon },
              { label: "Events", icon: Calendar03Icon },
            ] as { label: TabType; icon: any }[]
          ).map(({ label, icon }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-3.5 text-[15px] w-[30%] transition-colors relative",
                label === activeTab ? "text-[#10B981] font-bold" : "text-gray-400 hover:text-gray-600 font-semibold",
              )}
            >
              <HugeiconsIcon icon={icon} size={15} strokeWidth={label === activeTab ? 2.5 : 1.5} color={label === activeTab ? "#10B981" : undefined} />
              {label}
              {label === activeTab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#10B981] rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}
      {/* Tab: Info */}
      {activeTab === "Info" && (
        <div className="flex-1 flex flex-col px-5 pt-4 pb-6 gap-4 relative z-10">
          <div
            className="rounded-xl bg-white border border-[#E8EBEB] p-4"
            style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
          >
            <h3 className="text-base font-bold text-[#2E4A4A] mb-2">
              About {arrivalAirport !== "All" ? airportMap[arrivalAirport]?.city || arrivalAirport : "This Route"}
            </h3>
            {arrivalAirport && arrivalAirport !== "All" && airportMap[arrivalAirport]?.name && (
              <div className="flex items-center gap-1.5 mb-3">
                <HugeiconsIcon icon={Location01Icon} size={14} color="#6B7B7B" strokeWidth={1.5} />
                <span className="text-sm text-[#6B7B7B]">{airportMap[arrivalAirport].name}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Flights", value: flights.length },
                { label: "Destinations", value: groups.length },
                { label: "Nonstop Options", value: flights.filter((f) => f.legs.length === 1).length },
                { label: "GoWild Fares", value: flights.filter((f) => isGoWildFlight(f)).length },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col rounded-xl border border-[#E8EBEB] bg-[#F4F8F8] px-3 py-2.5">
                  <span className="text-[10px] font-semibold text-[#6B7B7B] uppercase tracking-wide">{label}</span>
                  <span className="text-[22px] font-bold text-[#2E4A4A] leading-tight">{value}</span>
                </div>
              ))}
            </div>
          </div>
          {departureDate && (
            <div
              className="rounded-xl bg-white border border-[#E8EBEB] p-4"
              style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
            >
              <h3 className="text-base font-bold text-[#2E4A4A] mb-3">Trip Details</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7B7B]">Trip Type</span>
                  <span className="text-sm font-semibold text-[#2E4A4A]">{tripType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7B7B]">Departure Date</span>
                  <span className="text-sm font-semibold text-[#2E4A4A]">{departureDate}</span>
                </div>
                {arrivalDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7B7B]">Return Date</span>
                    <span className="text-sm font-semibold text-[#2E4A4A]">{arrivalDate}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7B7B]">Origin</span>
                  <span className="text-sm font-semibold text-[#2E4A4A]">
                    {departureAirport}
                    {airportMap[departureAirport]?.city ? ` — ${airportMap[departureAirport].city}` : ""}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Tab: Flights */}
      {activeTab === "Flights" && (
        <div className="flex flex-col px-4 pt-3 pb-6 gap-3.5 relative z-10">
          {/* Count row + sort/filter */}
          {(() => {
            const isFiltered = filterNonstopOnly || filterGoWildOnly;
            const isSorted = sortBy !== "time";
            const hasActive = isFiltered || isSorted;
            const filteredCount = sortedGroups.reduce((sum, g) => sum + g.flights.length, 0);
            return (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                   {/* Left: count */}
                  <span className="text-[18px] font-semibold text-[#2E4A4A]">
                    {isFiltered ? (
                      <>
                        <span className="text-[#10B981] font-black">{filteredCount}</span>
                        <span className="text-[#6B7B7B] font-medium"> of </span>
                        <span className="text-[#2E4A4A] font-black">{flights.length}</span>
                        <span className="text-[#6B7B7B] font-medium"> Available Flights</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[#10B981] font-black">{flights.length}</span>
                        <span className="text-[#6B7B7B] font-medium"> Available Flights</span>
                      </>
                    )}
                  </span>
                  {/* Right: icon buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSortSheet(true)}
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
                        isSorted ? "bg-[#10B981] border-[#10B981]" : "border-[#E8EBEB] bg-white hover:bg-[#F4F8F8]",
                      )}
                      style={{ boxShadow: "0 1px 4px 0 rgba(53,92,90,0.08)" }}
                    >
                      <HugeiconsIcon icon={SortByDown02Icon} size={16} color={isSorted ? "white" : "#6B7B7B"} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterSheet(true)}
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
                        isFiltered ? "bg-[#10B981] border-[#10B981]" : "border-[#E8EBEB] bg-white hover:bg-[#F4F8F8]",
                      )}
                      style={{ boxShadow: "0 1px 4px 0 rgba(53,92,90,0.08)" }}
                    >
                      <HugeiconsIcon icon={FilterIcon} size={16} color={isFiltered ? "white" : "#6B7B7B"} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
                {/* Clear-all chip — only when sort or filter is active */}
                {hasActive && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isSorted && (
                      <span className="text-[11px] font-semibold text-[#10B981] bg-[#E6FAF4] px-2.5 py-1 rounded-full">
                        {{ time: "Time", fare: "Price", duration: "Duration", stops: "Stops" }[sortBy]}
                      </span>
                    )}
                    {filterNonstopOnly && (
                      <span className="text-[11px] font-semibold text-[#10B981] bg-[#E6FAF4] px-2.5 py-1 rounded-full">
                        Nonstop
                      </span>
                    )}
                    {filterGoWildOnly && (
                      <span className="text-[11px] font-semibold text-[#10B981] bg-[#E6FAF4] px-2.5 py-1 rounded-full">
                        GoWild
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSortBy("time"); setFilterNonstopOnly(false); setFilterGoWildOnly(false); }}
                      className="text-[11px] font-semibold text-[#9CA3AF] hover:text-[#EF4444] transition-colors px-2.5 py-1 rounded-full border border-[#E8EBEB] bg-white"
                    >
                      Clear all ×
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex flex-col gap-2.5">
            {sortedGroups.map((group) => {
              const nonstopCount = group.flights.filter((f) => f.legs.length === 1).length;
              const goWildCount = group.flights.filter((f) => isGoWildFlight(f)).length;

              // Compute cheapest and quickest indices for this group
              const parseDurForBadge = (s: string): number => {
                const raw = String(s ?? "").trim();
                if (!raw) return Infinity;
                if (raw.includes(":")) {
                  const parts = raw.split(":");
                  if (parts[0].includes(".")) {
                    const [d, h] = parts[0].split(".");
                    return (parseInt(d) || 0) * 24 * 60 + (parseInt(h) || 0) * 60 + (parseInt(parts[1]) || 0);
                  }
                  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
                }
                const h = raw.match(/(\d+)\s*(hr|hrs|h)\b/i);
                const m = raw.match(/(\d+)\s*(min|m)\b/i);
                return (parseInt(h?.[1] ?? "0") || 0) * 60 + (parseInt(m?.[1] ?? "0") || 0);
              };
              const minFareForBadge = (f: ParsedFlight): number => {
                const vals = [f.fares.basic, f.fares.economy, f.fares.premium, f.fares.business].filter((v): v is number => v != null);
                return vals.length ? Math.min(...vals) : Infinity;
              };
              let cheapestIdx = -1;
              let cheapestVal = Infinity;
              let quickestIdx = -1;
              let quickestVal = Infinity;
              group.flights.forEach((f, i) => {
                const fare = minFareForBadge(f);
                if (fare < cheapestVal) { cheapestVal = fare; cheapestIdx = i; }
                const dur = parseDurForBadge(f.total_duration);
                if (dur < quickestVal) { quickestVal = dur; quickestIdx = i; }
              });

              {
                /* Timeline — always visible, no parent card */
              }
              const flightsByHour: { hour: number; items: { flight: ParsedFlight; idx: number }[] }[] = [];
              const hourMap: Record<number, { flight: ParsedFlight; idx: number }[]> = {};
              group.flights.forEach((flight, idx) => {
                const dep = flight.legs[0]?.departure_time;
                // Use hour 0 as fallback so flights without a parseable time still appear
                const h = dep ? (parseHour(dep) ?? 0) : 0;
                if (!hourMap[h]) hourMap[h] = [];
                hourMap[h].push({ flight, idx });
              });
              Object.keys(hourMap)
                .map(Number)
                .sort((a, b) => a - b)
                .forEach((h) => flightsByHour.push({ hour: h, items: hourMap[h] }));

              const timelineItems: Array<
                { type: "hour"; hour: number } | { type: "flight"; flight: ParsedFlight; idx: number; hour: number }
              > = [];
              flightsByHour.forEach(({ hour: h, items }) => {
                timelineItems.push({ type: "hour", hour: h });
                items.forEach(({ flight, idx }) => timelineItems.push({ type: "flight", flight, idx, hour: h }));
              });
              const lastHour = flightsByHour[flightsByHour.length - 1]?.hour ?? 0;
              const trailingHour = (lastHour + 3) % 24;

              const fmtHourLabel = (h: number) => {
                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                const ampm = h < 12 ? "AM" : "PM";
                return { h12: `${h12}:00`, ampm };
              };

              return (
                <div key={group.destination} className="pt-1 pb-2">
                  {/* Timeline */}
                  <div>
                  <div className="relative flex flex-col items-center">
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#C8D5D5]" />
                    <div className="flex flex-col items-center w-full gap-0">
                      {timelineItems.map((item, tIdx) => {
                        if (item.type === "hour") {
                          const { h12, ampm } = fmtHourLabel(item.hour);
                          return (
                            <div
                              key={`hour-${item.hour}`}
                              className="relative flex items-center justify-center w-full py-2"
                              style={{ animationDelay: `${tIdx * 60}ms`, animation: "fade-in 0.35s ease-out both" }}
                            >
                              <div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#A8BEBE] z-10" />
                              <div className="z-10 bg-[#E8EBEB] px-2 rounded">
                                <span className="text-[15px] font-semibold text-[#6B7B7B] leading-tight">
                                  {h12} {ampm}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const { flight, idx } = item;
                        const fKey = `${group.destination}-${idx}`;
                        const isFlightOpen = expandedFlightKey === fKey;
                        const alertKey = flightKey(flight, "alert");
                        const goingKey = flightKey(flight, "going");
                        const hasAlert = !!userFlights[alertKey];
                        const hasGoing = !!userFlights[goingKey];

                        // Derive cheapest fare and Frontier booking URL
                        const isGoWild = isGoWildFlight(flight);
                        const cheapest = [
                          flight.fares.basic,
                          flight.fares.economy,
                          flight.fares.premium,
                          flight.fares.business,
                        ]
                          .filter((v): v is number => v != null)
                          .sort((a, b) => a - b)[0];
                        const priceLabel = cheapest != null ? `$${cheapest.toFixed(2)}` : null;
                        const depLeg = flight.legs[0];
                        const arrLeg = flight.legs[flight.legs.length - 1];
                        const depDate = (() => { try { return JSON.parse(responseData).departureDate ?? ""; } catch { return ""; } })();
                        const arrDate = (() => { try { return JSON.parse(responseData).arrivalDate ?? depDate; } catch { return depDate; } })();
                        const tType = (() => { try { return JSON.parse(responseData).tripType ?? "one-way"; } catch { return "one-way"; } })();
                        const isRound = tType.toLowerCase().includes("round");
                        const frontierUrl = isRound && arrDate
                          ? `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${depLeg?.origin}&d1=${arrLeg?.destination}&dd1=${encodeURIComponent(depDate + " 00:00:00")}&dd2=${encodeURIComponent(arrDate + " 00:00:00")}&r=true&adt=1&umnr=false&loy=false&mon=true&ftype=GW`
                          : `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${depLeg?.origin}&d1=${arrLeg?.destination}&dd1=${encodeURIComponent(depDate + " 00:00:00")}&adt=1&umnr=false&loy=false&mon=true&ftype=GW`;

                        const originCity = airportMap[depLeg?.origin ?? ""]?.city ?? depLeg?.origin ?? "";
                        const originState = airportMap[depLeg?.origin ?? ""]?.stateCode ?? "";
                        const destAirportInfo = airportMap[arrLeg?.destination ?? ""];
                        const destStateCode = destAirportInfo?.stateCode ?? "";
                        // Hide city name for international destinations (no US state code)
                        const destIsInternational = destStateCode === "" && destAirportInfo?.city !== undefined;
                        const destCity = destIsInternational ? "" : (destAirportInfo?.city ?? arrLeg?.destination ?? "");
                        const destState = destStateCode;

                        // Badge computations
                        const isCheapest = cheapestIdx === idx;
                        const isQuickest = quickestIdx === idx;
                        const isBlackout = depDate ? isBlackoutDate(depDate) : false;
                        const depHour = parseHour(depLeg?.departure_time ?? "") ?? -1;
                        const isRedEye = depHour >= 23 || depHour <= 4;
                        const hasBadges = isGoWild || isBlackout || flight.is_plus_one_day || isRedEye || isCheapest || isQuickest;

                        return (
                          <div
                            key={`flight-${idx}`}
                            data-flight-card
                            className="relative flex justify-center w-full py-1.5 px-[6px]"
                            style={{
                              animationDelay: `${tIdx * 70}ms`,
                              animation: "cascade-down 0.4s cubic-bezier(0.22,1,0.36,1) both",
                            }}
                          >
                            <div
                              className={cn(
                                "flex flex-col rounded-2xl bg-white overflow-hidden transition-all duration-200 w-full",
                                isGoWild ? "border border-[#059669]" : isFlightOpen ? "border border-[#345C5A]/20" : "border border-[#E8EBEB]",
                              )}
                              style={{ boxShadow: "0 2px 12px 0 rgba(53,92,90,0.10)" }}
                            >
                              {/* Collapsed / main card content — NOT a button, click only via Show Details */}
                              <div className="text-left w-full px-4 pt-3.5 pb-2">
                                {/* Row 1: Airline name + flight number + price badge */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src="/assets/logo/frontier/frontier_full_logo.png"
                                      alt="Frontier"
                                      className="h-[18px] w-auto object-contain"
                                    />
                                    {flight.flightNumber && (
                                      <span className="text-[12px] font-semibold text-[#6B7B7B]">
                                        {flight.flightNumber}
                                      </span>
                                    )}
                                  </div>
                                  {priceLabel && (
                                    <span
                                      className={cn(
                                        "text-[13px] font-bold px-2.5 py-0.5 rounded-full",
                                        isGoWild
                                          ? "bg-[#059669] text-white"
                                          : "bg-[#F0F4F4] text-[#2E4A4A]",
                                      )}
                                    >
                                      {priceLabel}
                                    </span>
                                  )}
                                </div>

                                {/* Row 2: Dep time — plane — Arr time */}
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">
                                    {formatTime(depLeg?.departure_time)}
                                  </span>
                                  <div className="flex-1 flex items-center gap-1 px-1">
                                    <div className="flex-1 h-px bg-[#C8D5D5]" />
                                    <svg fill="#2D6A4F" className="w-10 h-10 shrink-0" viewBox="-3.2 -3.2 38.40 38.40" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z"/>
                                      <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z"/>
                                    </svg>
                                    <div className="flex-1 h-px bg-[#C8D5D5]" />
                                  </div>
                                   <span className="text-[22px] font-bold text-[#1a2e2e] leading-none tabular-nums">
                                    {formatTime(arrLeg?.arrival_time)}
                                  </span>
                                </div>

                                {/* Row 3: Origin city — duration chip — Dest city */}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[13px] text-[#6B7B7B] font-medium leading-tight">
                                    {originCity}{originState ? `, ${originState}` : ""}
                                  </span>
                                  <span className="shrink-0 text-[11px] font-semibold text-[#065F46] bg-[#D1FAE5] px-2.5 py-0.5 rounded-full">
                                    {formatDuration(flight.total_duration)}
                                  </span>
                                  <span className="text-[13px] text-[#6B7B7B] font-medium leading-tight text-right">
                                    {destCity}{destState ? `, ${destState}` : ""}
                                  </span>
                                </div>

                                {/* Row 4: Status badges */}
                                {hasBadges && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {isCheapest && (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#1E3A5F", color: "#FFFFFF" }}>
                                        <HugeiconsIcon icon={DollarCircleIcon} size={11} color="#FFFFFF" strokeWidth={2} />
                                        Cheapest
                                      </span>
                                    )}
                                    {isQuickest && (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#D4AF37", color: "#1A1A1A" }}>
                                        <HugeiconsIcon icon={TrafficLightIcon} size={11} color="#1A1A1A" strokeWidth={2} />
                                        Quickest
                                      </span>
                                    )}
                                    {isGoWild && (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#4A7C59", color: "#FFFFFF" }}>
                                        <HugeiconsIcon icon={Rocket01Icon} size={11} color="#FFFFFF" strokeWidth={2} />
                                        GoWild
                                      </span>
                                    )}
                                    {isBlackout && (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#111827", color: "#FFFFFF" }}>
                                        <HugeiconsIcon icon={UnavailableIcon} size={11} color="#FFFFFF" strokeWidth={2} />
                                        Blackout
                                      </span>
                                    )}
                                    {flight.is_plus_one_day && (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#E89830", color: "#FFFFFF" }}>
                                        <HugeiconsIcon icon={Clock01Icon} size={11} color="#FFFFFF" strokeWidth={2} />
                                        +1 Day
                                      </span>
                                    )}
                                    {isRedEye && (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#DC2626", color: "#FFFFFF" }}>
                                        <HugeiconsIcon icon={Alert01Icon} size={11} color="#FFFFFF" strokeWidth={2} />
                                        Red Eye
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Show / Hide Details row */}
                              <button
                                onClick={(e) => {
                                  const next = isFlightOpen ? null : fKey;
                                  setExpandedFlightKey(next);
                                  if (next) {
                                    const card = (e.currentTarget as HTMLElement).closest("[data-flight-card]") as HTMLElement | null;
                                    if (card) setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150);
                                  }
                                }}
                                className="w-full flex items-center justify-center gap-1 py-2 border-t border-[#F0F4F4] text-[12px] font-semibold text-[#10B981] hover:text-[#059669] transition-colors"
                              >
                                {isFlightOpen ? "Hide Details" : "Show Details"}
                                <FontAwesomeIcon
                                  icon={faChevronDown}
                                  className={cn("w-3 h-3 transition-transform duration-200", isFlightOpen && "rotate-180")}
                                />
                              </button>

                              {/* Expanded detail */}
                              {isFlightOpen && (
                                <div className="bg-white animate-fade-in px-2 py-3 border-t border-[#E8EBEB]/50">
                                  <FlightLegTimeline legs={flight.legs} airportMap={airportMap} />
                                  <div className="flex items-center justify-end gap-2 px-3 pt-3 pb-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleUserFlight(flight, "alert"); }}
                                      className={cn(
                                        "flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold border transition-all duration-200",
                                        hasAlert
                                          ? "bg-[#E89830] text-white border-[#E89830]"
                                          : "bg-white text-[#4B5563] border-[#D1D5DB] hover:border-[#E89830] hover:text-[#E89830]",
                                      )}
                                    >
                                      Alert Me
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setBookingConfirm({ url: frontierUrl, flight });
                                      }}
                                      className={cn(
                                        "flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold border transition-all duration-200",
                                        isGoWild
                                          ? hasGoing ? "bg-[#047857] text-white border-[#047857]" : "bg-[#059669] text-white border-[#059669] hover:bg-[#047857]"
                                          : hasGoing ? "bg-[#E8EBEB] text-[#2E4A4A] border-[#D1D5DB]" : "bg-white text-[#4B5563] border-[#D1D5DB] hover:bg-[#F4F8F8]",
                                      )}
                                    >
                                      {priceLabel ? `${priceLabel} ›` : "Book ›"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    </div>
                  </div>
                  {/* Trailing time label — outside the line container so the line ends above it */}
                  {(() => {
                    const { h12, ampm } = fmtHourLabel(trailingHour);
                    return (
                      <div className="flex items-center justify-center w-full py-2">
                       <div className="bg-[#E8EBEB] px-2 rounded">
                          <span className="text-[15px] font-semibold text-[#6B7B7B] leading-tight">
                             {h12} {ampm}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                </div>
              );
            })}
          </div>

          {debugEnabled && (
            <div className="flex flex-col">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-2 text-xs font-bold text-[#345C5A] opacity-50 hover:opacity-100 transition-opacity self-center py-4"
              >
                {showRaw ? "HIDE DEBUG ELEMENTS" : "SHOW DEBUG ELEMENTS"}
              </button>

              {showRaw && (
                <div className="flex flex-col gap-4 animate-fade-in pb-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wide px-1">
                      Flights Array
                    </span>
                    <textarea
                      readOnly
                      value={JSON.stringify({ flights }, null, 2)}
                      className="w-full h-40 rounded-xl border border-[#E3E6E6] bg-white p-3 text-[10px] font-mono text-[#2E4A4A] resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-1"
                      style={{ color: fromCache ? "#16a34a" : "#6B7B7B" }}
                    >
                      Fetched from cache: {fromCache ? "True" : "No"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wide px-1">
                      Cache Status
                      {fromCache && <span className="ml-2 text-green-600">• from cache</span>}
                    </span>
                    <textarea
                      readOnly
                      value={JSON.stringify(
                        { fromCache, departureDate, arrivalDate, tripType, departureAirport, arrivalAirport },
                        null,
                        2,
                      )}
                      className="w-full h-28 rounded-xl border border-[#E3E6E6] bg-white p-3 text-[10px] font-mono text-[#2E4A4A] resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wide px-1">
                      Firecrawl Body
                    </span>
                    <textarea
                      readOnly
                      value={(() => {
                        try {
                          return JSON.stringify(JSON.parse(responseData)?.firecrawlRequestBody ?? null, null, 2);
                        } catch {
                          return "N/A";
                        }
                      })()}
                      className="w-full h-40 rounded-xl border border-[#E3E6E6] bg-white p-3 text-[10px] font-mono text-[#2E4A4A] resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wide px-1">
                      Full Raw Response
                    </span>
                    <textarea
                      readOnly
                      value={(() => {
                        try {
                          return JSON.stringify(JSON.parse(responseData), null, 2);
                        } catch {
                          return responseData;
                        }
                      })()}
                      className="w-full h-60 rounded-xl border border-[#E3E6E6] bg-white p-3 text-[10px] font-mono text-[#2E4A4A] resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}{" "}
      {/* end activeTab === "Flights" */}
      {/* Tab: Events */}
      {activeTab === "Events" && (
        <div className="flex-1 flex flex-col px-5 pt-4 pb-6 gap-4 relative z-10">
          <div
            className="rounded-xl bg-white border border-[#E8EBEB] p-6 flex flex-col items-center gap-3"
            style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
          >
            <HugeiconsIcon icon={TicketStarIcon} size={40} color="#A8BEBE" strokeWidth={1.5} />
            <p className="text-base font-semibold text-[#2E4A4A] text-center">Events Coming Soon</p>
            <p className="text-sm text-[#6B7B7B] text-center leading-relaxed">
              We're working on surfacing concerts, festivals, and local events near your destination.
            </p>
          </div>
        </div>
      )}
      {/* Toast popup */}
      <div
        className={cn(
          "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[#2E4A4A] text-white text-sm font-bold shadow-lg transition-all duration-300 pointer-events-none",
          toast.visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95",
        )}
      >
        {toast.message}
      </div>

      {/* ── Sort Sheet ──────────────────────────────────────── */}
      <BottomSheet open={sortSheet} onClose={() => setSortSheet(false)}>
              <div className="flex items-center gap-2.5 px-5 pt-2 pb-4 border-b border-[#F0F1F1]">
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                  <HugeiconsIcon icon={SortByDown02Icon} size={15} color="white" strokeWidth={2} />
                </div>
                <h2 className="text-base font-bold text-[#2E4A4A]">Sort By</h2>
              </div>
              <div className="flex flex-col py-2 pb-8">
                {([
                  { key: "time",     label: "Departure Time", desc: "Earliest flights first",    icon: Clock01Icon },
                  { key: "fare",     label: "Lowest Price",   desc: "Cheapest fares first",       icon: DollarCircleIcon },
                  { key: "duration", label: "Shortest Flight",desc: "Quickest flights first",     icon: AirplaneTakeOff02Icon },
                  { key: "stops",    label: "Fewest Stops",   desc: "Nonstop flights first",      icon: CheckmarkCircle02Icon },
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
      </BottomSheet>

      {/* ── Filter Sheet ─────────────────────────────────────── */}
      <BottomSheet open={filterSheet} onClose={() => setFilterSheet(false)}>
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
              <div className="flex flex-col py-2">
                {([
                  { key: "nonstop", label: "Nonstop Only",  desc: "Show only nonstop flights",            icon: AirplaneTakeOff01Icon, active: filterNonstopOnly, toggle: () => setFilterNonstopOnly((v) => !v) },
                  { key: "gowild",  label: "GoWild Fares",  desc: "Show only flights with GoWild pricing", icon: TicketStarIcon,        active: filterGoWildOnly,  toggle: () => setFilterGoWildOnly((v) => !v) },
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
              <div className="px-5 pb-8 pt-2">
                <button
                  type="button"
                  onClick={() => setFilterSheet(false)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  Apply Filters
                </button>
              </div>
      </BottomSheet>

      {/* Booking confirmation popup */}
      {bookingConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center px-5" onClick={() => setBookingConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl px-6 pt-6 pb-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[17px] font-bold text-[#1A2E2E]">Redirecting to Frontier</h2>
            <p className="text-[13px] text-[#4B5563] leading-relaxed">
              Continuing will take you to flyfrontier.com to finish your booking, as well as add this flight to your itinerary. Do you want to continue?
            </p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setBookingConfirm(null)}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-[#2E4A4A] border border-[#D1D5DB] transition-all hover:bg-[#F4F8F8]"
                style={{ background: "rgba(0,0,0,0.07)" }}
              >
                Back
              </button>
              <button
                onClick={() => {
                  addUserFlight(bookingConfirm.flight, "going");
                  window.open(bookingConfirm.url, "_blank", "noopener,noreferrer");
                  setBookingConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end scrollRef */}
    </div>
  );
};

export default FlightDestResults;
