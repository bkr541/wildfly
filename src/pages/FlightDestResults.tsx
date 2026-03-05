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
import { SunriseIcon, SunsetIcon, Navigator02Icon, TicketStarIcon, Location01Icon, InformationCircleIcon, AirplaneTakeOff01Icon, Calendar03Icon, Location06Icon, FilterIcon, SortByDown02Icon } from "@hugeicons/core-free-icons";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { isBlackoutDate } from "@/utils/blackoutDates";
import { cn } from "@/lib/utils";
import FlightLegTimeline from "@/components/FlightLegTimeline";
import { fetchDeveloperSettings } from "@/lib/logSettings";

// ── RouteMap ─────────────────────────────────────────────────────────────────

interface RouteMapProps {
  departureAirport: string;
  arrivalAirport: string;
  airportMap: Record<string, { city: string; stateCode: string; name: string; lat?: number; lng?: number }>;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Generate intermediate great-circle points for a curved route arc */
function greatCirclePoints(
  lat1: number, lng1: number, lat2: number, lng2: number, steps = 60
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lng1);
  const φ2 = toRad(lat2), λ2 = toRad(lng2);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [[lat1, lng1]];
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push([toDeg(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))), toDeg(Math.atan2(y, x))]);
  }
  return points;
}

/** Auto-fit map bounds to the two airports */
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [map, bounds]);
  return null;
}

function createAirplaneIcon() {
  return L.divIcon({
    html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">✈️</div>`,
    className: "",
    iconAnchor: [11, 11],
  });
}

function createDotIcon() {
  return L.divIcon({
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#059669;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    className: "",
    iconAnchor: [6, 6],
  });
}

const RouteMap = ({ departureAirport, arrivalAirport, airportMap }: RouteMapProps) => {
  const dep = airportMap[departureAirport];
  const arr = airportMap[arrivalAirport && arrivalAirport !== "All" ? arrivalAirport : ""];

  const hasCoords = dep?.lat != null && dep?.lng != null && arr?.lat != null && arr?.lng != null;

  if (!hasCoords) {
    return (
      <div className="flex-1 flex flex-col px-5 pt-4 pb-6 gap-4 relative z-10">
        <div className="rounded-xl bg-white border border-[#E8EBEB] p-6 flex flex-col items-center gap-3" style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}>
          <HugeiconsIcon icon={Navigator02Icon} size={40} color="#A8BEBE" strokeWidth={1.5} />
          <p className="text-base font-semibold text-[#2E4A4A] text-center">Map unavailable</p>
          <p className="text-sm text-[#6B7B7B] text-center leading-relaxed">
            {arrivalAirport === "All" ? "Select a specific destination to view the route map." : "Airport coordinates not available for this route."}
          </p>
        </div>
      </div>
    );
  }

  const depLatLng: [number, number] = [dep.lat!, dep.lng!];
  const arrLatLng: [number, number] = [arr.lat!, arr.lng!];

  const arcPoints = greatCirclePoints(dep.lat!, dep.lng!, arr.lat!, arr.lng!);

  // Midpoint for airplane icon
  const mid = arcPoints[Math.floor(arcPoints.length / 2)];

  const bounds = L.latLngBounds([depLatLng, arrLatLng]);

  return (
    <div className="flex-1 flex flex-col px-5 pt-4 pb-6 gap-3 relative z-10">
      {/* Route label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-black text-[#2E4A4A] tracking-wider">{departureAirport}</span>
          <span className="text-[#A8BEBE] text-sm">→</span>
          <span className="text-[15px] font-black text-[#2E4A4A] tracking-wider">{arrivalAirport}</span>
        </div>
        <span className="text-xs text-[#6B7B7B] font-medium">
          {Math.round(haversineKm(dep.lat!, dep.lng!, arr.lat!, arr.lng!)).toLocaleString()} km
        </span>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-[#E8EBEB]" style={{ height: 320, boxShadow: "0 4px 20px 0 rgba(53,92,90,0.13)" }}>
        <MapContainer
          style={{ height: "100%", width: "100%" }}
          center={[
            (dep.lat! + arr.lat!) / 2,
            (dep.lng! + arr.lng!) / 2,
          ]}
          zoom={4}
          zoomControl={false}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <FitBounds bounds={bounds} />
          {/* Arc */}
          <Polyline
            positions={arcPoints}
            pathOptions={{ color: "#059669", weight: 2.5, dashArray: "6 5", opacity: 0.85 }}
          />
          {/* Airport dots */}
          <Marker position={depLatLng} icon={createDotIcon()} />
          <Marker position={arrLatLng} icon={createDotIcon()} />
          {/* Airplane at midpoint */}
          {mid && <Marker position={mid} icon={createAirplaneIcon()} />}
        </MapContainer>
      </div>

      {/* Airport name labels */}
      <div className="flex justify-between px-1">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#2E4A4A]">{departureAirport}</span>
          <span className="text-[11px] text-[#6B7B7B]">{dep.city}{dep.stateCode ? `, ${dep.stateCode}` : ""}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-[#2E4A4A]">{arrivalAirport}</span>
          <span className="text-[11px] text-[#6B7B7B]">{arr.city}{arr.stateCode ? `, ${arr.stateCode}` : ""}</span>
        </div>
      </div>
    </div>
  );
};

interface ParsedFlight {
  total_duration: string;
  is_plus_one_day: boolean;
  fares: { basic: number | null; economy: number | null; premium: number | null; business: number | null };
  legs: { origin: string; destination: string; departure_time: string; arrival_time: string }[];
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
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    // Already a formatted time string like "3:01 PM"
    return raw;
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
      <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
        style={{ background: animating ? "#b0b5bdaa" : "#064E3Baa" }} />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: animating ? "#e8eaed" : "#10B981", borderColor: animating ? "#d1d5db" : "#064E3B" }} />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: animating ? "#e8eaed" : "#10B981", borderColor: animating ? "#d1d5db" : "#064E3B" }} />
      <span className="font-black text-sm leading-none select-none z-10"
        style={{ color: animating ? "#6b7280" : "#fff", letterSpacing: "0.04em" }}>
        {char}
      </span>
    </div>
  );
}

function RouteFlap({ word }: { word: string }) {
  const upper = word.toUpperCase().slice(0, 4);
  const [displayChars, setDisplayChars] = useState<string[]>(upper.split("").map(() => CHARS[Math.floor(Math.random() * CHARS.length)]));
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
            setDisplayChars(prev => { const n = [...prev]; n[idx] = finalChar; return n; });
            setSettled(prev => { const n = [...prev]; n[idx] = true; return n; });
          } else {
            setDisplayChars(prev => { const n = [...prev]; n[idx] = CHARS[Math.floor(Math.random() * CHARS.length)]; return n; });
          }
        }, 45);
        intervals.push(iv);
      }, idx * 70);
      timeouts.push(to);
    });
    return () => { timeouts.forEach(clearTimeout); intervals.forEach(clearInterval); };
  }, [upper]);

  return (
    <div className="flex gap-0.5">
      {upper.split("").map((_, i) => (
        <RouteFlapTile key={i} char={displayChars[i] ?? ""} animating={!settled[i]} />
      ))}
    </div>
  );
}

type TabType = "Info" | "Flights" | "Events" | "Map";

const FlightDestResults = ({ onBack, responseData, hideHeader, hideBackground }: { onBack: () => void; responseData: string; hideHeader?: boolean; hideBackground?: boolean }) => {
  const [activeTab, setActiveTab] = useState<TabType>("Flights");
  const [expandedDest, setExpandedDest] = useState<string | null>(null);
  const [expandedFlightKey, setExpandedFlightKey] = useState<string | null>(null);
  const [airportMap, setAirportMap] = useState<Record<string, { city: string; stateCode: string; name: string }>>({});
  const [showRaw, setShowRaw] = useState(false);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    fetchDeveloperSettings().then((s) => setDebugEnabled(s?.debug_enabled ?? false));
  }, []);

  // user_flights tracking
  const [userFlights, setUserFlights] = useState<Record<string, { id: string; type: string }>>({});
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1800);
  }, []);

  // Build a unique key for a flight to match against user_flights
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
        .select("iata_code, name, latitude, longitude, locations(city, state_code)")
        .in("iata_code", destinationCodes);
      if (data) {
        const map: Record<string, { city: string; stateCode: string; name: string }> = {};
        const coords: Record<string, { lat: number; lng: number }> = {};
        for (const a of data as any[]) {
          map[a.iata_code] = {
            city: a.locations?.city ?? "",
            stateCode: a.locations?.state_code ?? "",
            name: a.name ?? "",
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
    () => Object.fromEntries(
      Object.entries(airportMap).map(([k, v]) => [
        k,
        { ...v, lat: airportCoords[k]?.lat, lng: airportCoords[k]?.lng },
      ])
    ),
    [airportMap, airportCoords]
  );

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
        hasGoWild: flts.some((f) => f.fares.basic != null),
        hasNonstop: flts.some((f) => f.legs.length === 1),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [flights, airportMap]);

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
    <div className="relative flex flex-col min-h-screen bg-[#F1F5F5] overflow-hidden">

      {!hideHeader && (
      <header
        className="relative z-10 flex flex-col px-5 pt-6 pb-[136px] overflow-hidden"
        style={{
          backgroundImage: "url('/assets/locations/destpage_lasvegas.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.55) 100%)" }} />
        {/* Metrics scrim — bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.52) 100%)" }} />
        {/* Top row: back only */}
        <div className="relative flex items-center w-full">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
          </button>
        </div>
        {/* Route text below icons */}
        <div className="relative mt-3">
          <p className="text-white/70 text-[22px] font-light leading-tight">
            {airportMap[departureAirport]?.city || departureAirport} to
          </p>
          <p className="text-white leading-tight uppercase tracking-wide">
            {arrivalAirport && arrivalAirport !== "All" ? (
              <>
                <span className="text-[30px] font-black">{arrivalAirport}</span>
                {airportMap[arrivalAirport]?.city ? (
                  <span className="text-[30px] font-light"> | {airportMap[arrivalAirport].city}{airportMap[arrivalAirport].stateCode ? `, ${airportMap[arrivalAirport].stateCode}` : ""}</span>
                ) : null}
              </>
            ) : (
              <span className="text-[36px] font-black">All Destinations</span>
            )}
          </p>
          {arrivalAirport && arrivalAirport !== "All" && airportMap[arrivalAirport]?.name && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
              <HugeiconsIcon icon={Location01Icon} size={13} color="white" strokeWidth={1.5} />
              <span className="text-white text-xs font-medium leading-none">{airportMap[arrivalAirport].name}</span>
            </div>
          )}
        </div>

        {/* Metrics strip at bottom of header — no background, bottom-justified */}
        {arrivalAirport && arrivalAirport !== "All" && (
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end justify-between w-full gap-2">
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
                if (f.fares.basic != null) goWildCnt++;
              }
              const fmt = (h: number) => {
                const d = new Date(); d.setHours(h, 0, 0, 0);
                return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
              };
              return [
                { label: "EARLIEST", value: earliestH !== null ? fmt(earliestH) : "—", suffix: "" },
                { label: "LATEST", value: latestH !== null ? fmt(latestH) : "—", suffix: "" },
                { label: "NONSTOP", value: nonstopCnt, suffix: " Avail." },
                { label: "GOWILD", value: goWildCnt, suffix: " Avail." },
              ].map(({ label, value, suffix }) => (
                <div key={label} className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide leading-tight text-center">{label}</span>
                  <span className="text-[17px] font-bold text-white leading-tight mt-0.5 text-center">{value}{suffix}</span>
                </div>
              ));
            })()}
          </div>
        )}
      </header>
      )}

      {/* Tab group */}
      {!hideHeader && (
        <div className="relative z-10 flex items-center gap-0 bg-white px-3 border-b border-gray-200">
          {([
            { label: "Info", icon: InformationCircleIcon },
            { label: "Flights", icon: AirplaneTakeOff01Icon },
            { label: "Events", icon: Calendar03Icon },
            { label: "Map", icon: Location06Icon },
          ] as { label: TabType; icon: any }[]).map(({ label, icon }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3.5 text-[15px] font-semibold transition-colors relative",
                label === activeTab ? "text-[#2E5C58]" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <HugeiconsIcon icon={icon} size={15} strokeWidth={label === activeTab ? 2 : 1.5} />
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
          <div className="rounded-xl bg-white border border-[#E8EBEB] p-4" style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}>
            <h3 className="text-base font-bold text-[#2E4A4A] mb-2">About {arrivalAirport !== "All" ? (airportMap[arrivalAirport]?.city || arrivalAirport) : "This Route"}</h3>
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
                { label: "Nonstop Options", value: flights.filter(f => f.legs.length === 1).length },
                { label: "GoWild Fares", value: flights.filter(f => f.fares.basic != null).length },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col rounded-xl border border-[#E8EBEB] bg-[#F4F8F8] px-3 py-2.5">
                  <span className="text-[10px] font-semibold text-[#6B7B7B] uppercase tracking-wide">{label}</span>
                  <span className="text-[22px] font-bold text-[#2E4A4A] leading-tight">{value}</span>
                </div>
              ))}
            </div>
          </div>
          {departureDate && (
            <div className="rounded-xl bg-white border border-[#E8EBEB] p-4" style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}>
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
                  <span className="text-sm font-semibold text-[#2E4A4A]">{departureAirport}{airportMap[departureAirport]?.city ? ` — ${airportMap[departureAirport].city}` : ""}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Flights */}
      {activeTab === "Flights" && (
      <div className="flex-1 flex flex-col px-5 pt-3 pb-6 gap-3.5 relative z-10">
        {/* Count row + sort/filter */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#2E4A4A]">
            <span className="text-[#10B981] font-black">{flights.length}</span>
            <span className="text-[#6B7B7B] font-medium"> Available Flights</span>
          </span>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#E8EBEB] bg-white hover:bg-[#F4F8F8] transition-colors" style={{ boxShadow: "0 1px 4px 0 rgba(53,92,90,0.08)" }}>
              <HugeiconsIcon icon={SortByDown02Icon} size={16} color="#6B7B7B" strokeWidth={1.5} />
            </button>
            <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#E8EBEB] bg-white hover:bg-[#F4F8F8] transition-colors" style={{ boxShadow: "0 1px 4px 0 rgba(53,92,90,0.08)" }}>
              <HugeiconsIcon icon={FilterIcon} size={16} color="#6B7B7B" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {groups.map((group) => {
            const isDestOpen = expandedDest === group.destination;
            const nonstopCount = group.flights.filter((f) => f.legs.length === 1).length;
            const goWildCount = group.flights.filter((f) => f.fares.basic != null).length;
            let earliestTime: Date | null = null;
            let latestTime: Date | null = null;
            for (const f of group.flights) {
              const dep = f.legs[0]?.departure_time;
              if (dep) {
                const h = parseHour(dep);
                if (h !== null) {
                  const d = new Date();
                  d.setHours(h, 0, 0, 0);
                  if (!earliestTime || d < earliestTime) earliestTime = d;
                  if (!latestTime || d > latestTime) latestTime = d;
                }
              }
            }
            const earliestLabel = earliestTime
              ? earliestTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
              : null;
            const latestLabel = latestTime
              ? latestTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
              : null;
            return (
              <div
                key={group.destination}
                className="rounded-xl bg-white border border-[#E8EBEB] overflow-hidden"
                style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10), 0 1.5px 4px 0 rgba(53,92,90,0.07)" }}
              >
                {/* Header row — clickable to expand */}
                <button
                  onClick={() => {
                    setExpandedDest(isDestOpen ? null : group.destination);
                    setExpandedFlightKey(null);
                  }}
                  className="w-full flex flex-col px-4 pt-4 pb-3 text-left"
                >
                  {/* IATA | City, State */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="leading-tight uppercase">
                      <span className="text-[22px] font-bold text-[#2E4A4A]">{group.destination}</span>
                      {(group.city || group.stateCode) && (
                        <>
                          <span className="text-[22px] font-bold text-[#2E4A4A]"> | </span>
                          <span className="text-[22px] font-light text-[#2E4A4A]">
                            {group.city || group.destination}{group.stateCode ? `, ${group.stateCode}` : ""}
                          </span>
                        </>
                      )}
                    </span>
                    {/* Airport name with pin */}
                    {group.airportName && (
                      <span className="flex items-center gap-1 mt-0.5">
                        <HugeiconsIcon icon={Location01Icon} size={12} color="#6B7B7B" strokeWidth={1.5} />
                        <span className="text-xs text-[#6B7B7B] font-normal leading-tight">{group.airportName}</span>
                      </span>
                    )}
                    {/* Info icon cards row — no icon, label above value */}
                    <div className="flex items-stretch justify-between w-full mt-2.5 gap-1.5">
                      {[
                        { label: "EARLIEST", value: earliestLabel ?? "—", suffix: "" },
                        { label: "LATEST", value: latestLabel ?? "—", suffix: "" },
                        { label: "NONSTOP", value: nonstopCount, suffix: " Avail." },
                        { label: "GOWILD", value: goWildCount, suffix: " Avail." },
                      ].map(({ label, value, suffix }) => (
                        <div
                          key={label}
                          className="flex-1 flex flex-col items-center rounded-xl border border-[#E8EBEB] bg-[#F4F8F8] px-1.5 py-1"
                        >
                          <span className="text-[12px] font-semibold text-[#6B7B7B] uppercase tracking-wide leading-tight text-center">{label}</span>
                          <span className="text-[17px] font-bold text-[#2E4A4A] leading-tight mt-0.5 text-center">
                            {value}{suffix}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Down chevron on its own bottom row */}
                  <div className="flex justify-center w-full mt-2">
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={cn(
                        "w-4 h-4 text-[#9CA3AF] transition-transform duration-200",
                        isDestOpen && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                {isDestOpen &&
                  (() => {
                    // Group flights by hour, only keep hours with flights
                    const flightsByHour: { hour: number; items: { flight: ParsedFlight; idx: number }[] }[] = [];
                    const hourMap: Record<number, { flight: ParsedFlight; idx: number }[]> = {};
                    group.flights.forEach((flight, idx) => {
                      const dep = flight.legs[0]?.departure_time;
                      if (!dep) return;
                      const h = parseHour(dep);
                      if (h === null) return;
                      if (!hourMap[h]) hourMap[h] = [];
                      hourMap[h].push({ flight, idx });
                    });
                    Object.keys(hourMap)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .forEach((h) => flightsByHour.push({ hour: h, items: hourMap[h] }));

                    // Flatten all items in chronological order with hour separators
                    const timelineItems: Array<{ type: "hour"; hour: number } | { type: "flight"; flight: ParsedFlight; idx: number; hour: number }> = [];
                    flightsByHour.forEach(({ hour: h, items }) => {
                      timelineItems.push({ type: "hour", hour: h });
                      items.forEach(({ flight, idx }) => timelineItems.push({ type: "flight", flight, idx, hour: h }));
                    });
                    // Add trailing hour label after last flight
                    const lastHour = flightsByHour[flightsByHour.length - 1]?.hour ?? 0;
                    const trailingHour = (lastHour + 3) % 24;

                    const fmtHourLabel = (h: number) => {
                      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      const ampm = h < 12 ? "AM" : "PM";
                      return { h12: `${h12}:00`, ampm };
                    };

                    return (
                      <div className="border-t border-[#F2F3F3] pt-3 pb-4 px-0">
                        {/* Centered spine timeline */}
                        <div className="relative flex flex-col items-center">
                          {/* Vertical spine line */}
                          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#C8D5D5]" />

                          <div className="flex flex-col items-center w-full gap-0">
                            {timelineItems.map((item, tIdx) => {
                              if (item.type === "hour") {
                                const { h12, ampm } = fmtHourLabel(item.hour);
                                return (
                                  <div
                                    key={`hour-${item.hour}`}
                                    className="relative flex items-center justify-center w-full py-2"
                                    style={{
                                      animationDelay: `${tIdx * 60}ms`,
                                      animation: "fade-in 0.35s ease-out both",
                                    }}
                                  >
                                     {/* Dot on spine */}
                                     <div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#A8BEBE] z-10" />
                                     {/* Time label centered over spine */}
                                     <div className="z-10 bg-white px-2 rounded">
                                       <span className="text-[11px] font-semibold text-[#6B7B7B] leading-tight">{h12}{ampm}</span>
                                     </div>
                                  </div>
                                );
                              }

                              // Flight card
                              const { flight, idx } = item;
                              const fKey = `${group.destination}-${idx}`;
                              const isFlightOpen = expandedFlightKey === fKey;
                              const alertKey = flightKey(flight, "alert");
                              const goingKey = flightKey(flight, "going");
                              const hasAlert = !!userFlights[alertKey];
                              const hasGoing = !!userFlights[goingKey];

                               return (
                                  <div
                                    key={`flight-${idx}`}
                                    data-flight-card
                                    className="relative flex justify-center w-full py-1.5 px-4"
                                   style={{
                                     animationDelay: `${tIdx * 70}ms`,
                                     animation: "cascade-down 0.4s cubic-bezier(0.22,1,0.36,1) both",
                                   }}
                                 >
                                   {/* Spine continues through card */}
                                    <div
                                     className={cn(
                                       "flex flex-col rounded-xl border bg-white overflow-hidden transition-all duration-200 shadow-sm",
                                       "w-full",
                                      flight.fares.basic != null
                                        ? "border-[#10B981]"
                                        : isFlightOpen
                                          ? "border-[#345C5A]/20"
                                          : "border-[#E8EBEB]",
                                    )}
                                    style={{ boxShadow: "0 2px 10px 0 rgba(53,92,90,0.08)" }}
                                  >
                                     <button
                                       onClick={(e) => {
                                         const next = isFlightOpen ? null : fKey;
                                         setExpandedFlightKey(next);
                                         if (next) {
                                           const card = (e.currentTarget as HTMLElement).closest('[data-flight-card]') as HTMLElement | null;
                                           if (card) setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150);
                                         }
                                       }}
                                       className="flex items-center px-3 py-3 text-left w-full"
                                    >
                                      <div className="flex items-center gap-2.5 w-full">
                                        <img
                                          src="/assets/logo/frontier/frontier_logo.png"
                                          alt="Frontier"
                                          className="w-[32px] h-[32px] rounded object-contain shrink-0"
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-base font-bold text-[#2E4A4A]">
                                            {formatTime(flight.legs[0]?.departure_time)} →{" "}
                                            {formatTime(flight.legs[flight.legs.length - 1]?.arrival_time)}
                                          </span>
                                          <span className="text-[13px] text-[#6B7B7B] font-medium">
                                            {flight.total_duration}
                                            {flight.is_plus_one_day && (
                                              <span className="ml-1 text-[#E89830] font-semibold">+1 Day</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </button>

                                    {isFlightOpen && (
                                      <div className="bg-white animate-fade-in px-2 py-3 border-t border-[#E8EBEB]/50">
                                        <FlightLegTimeline legs={flight.legs} airportMap={airportMap} />
                                        <div className="flex items-center justify-end gap-2 px-3 pt-3 pb-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleUserFlight(flight, "alert");
                                            }}
                                            className={cn(
                                              "flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold border transition-all duration-200",
                                              hasAlert
                                                ? "bg-[#E89830] text-white border-[#E89830]"
                                                : "bg-white text-[#4B5563] border-[#D1D5DB] hover:border-[#E89830] hover:text-[#E89830]",
                                            )}
                                          >
                                            Alert Me
                                          </button>
                                           {(() => {
                                             const isGoWild = flight.fares.basic != null;
                                             const cheapest = [flight.fares.basic, flight.fares.economy, flight.fares.premium, flight.fares.business]
                                               .filter((v): v is number => v != null)
                                               .sort((a, b) => a - b)[0];
                                             const priceLabel = cheapest != null ? `$${cheapest}` : "Book";
                                             const depLeg = flight.legs[0];
                                             const arrLeg = flight.legs[flight.legs.length - 1];
                                             const depDate = (() => {
                                               try { return JSON.parse(responseData).departureDate ?? ""; } catch { return ""; }
                                             })();
                                             const arrDate = (() => {
                                               try { return JSON.parse(responseData).arrivalDate ?? depDate; } catch { return depDate; }
                                             })();
                                             const tType = (() => {
                                               try { return JSON.parse(responseData).tripType ?? "one-way"; } catch { return "one-way"; }
                                             })();
                                             const isRound = tType.toLowerCase().includes("round");
                                             const frontierUrl = isRound && arrDate
                                               ? `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${depLeg?.origin}&d1=${arrLeg?.destination}&dd1=${encodeURIComponent(depDate + " 00:00:00")}&dd2=${encodeURIComponent(arrDate + " 00:00:00")}&r=true&adt=1&umnr=false&loy=false&mon=true&ftype=GW`
                                               : `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${depLeg?.origin}&d1=${arrLeg?.destination}&dd1=${encodeURIComponent(depDate + " 00:00:00")}&adt=1&umnr=false&loy=false&mon=true&ftype=GW`;
                                             return (
                                               <button
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   toggleUserFlight(flight, "going");
                                                   window.open(frontierUrl, "_blank", "noopener,noreferrer");
                                                 }}
                                                className={cn(
                                                  "flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold border transition-all duration-200",
                                                  isGoWild
                                                    ? hasGoing
                                                      ? "bg-[#047857] text-white border-[#047857]"
                                                      : "bg-[#059669] text-white border-[#059669] hover:bg-[#047857]"
                                                    : hasGoing
                                                      ? "bg-[#E8EBEB] text-[#2E4A4A] border-[#D1D5DB]"
                                                      : "bg-white text-[#4B5563] border-[#D1D5DB] hover:bg-[#F4F8F8]",
                                                )}
                                              >
                                                {priceLabel} ›
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Trailing time label */}
                            {(() => {
                              const { h12, ampm } = fmtHourLabel(trailingHour);
                              return (
                                <div className="relative flex items-center justify-center w-full py-2">
                                  <div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#A8BEBE] z-10" />
                                     <div className="flex items-center gap-1.5 z-10">
                                       <span className="text-[11px] font-semibold text-[#6B7B7B] leading-tight">{h12}{ampm}</span>
                                       <div className="w-2.5 h-2.5" />
                                     </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
      )} {/* end activeTab === "Flights" */}

      {/* Tab: Events */}
      {activeTab === "Events" && (
        <div className="flex-1 flex flex-col px-5 pt-4 pb-6 gap-4 relative z-10">
          <div className="rounded-xl bg-white border border-[#E8EBEB] p-6 flex flex-col items-center gap-3" style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}>
            <HugeiconsIcon icon={TicketStarIcon} size={40} color="#A8BEBE" strokeWidth={1.5} />
            <p className="text-base font-semibold text-[#2E4A4A] text-center">Events Coming Soon</p>
            <p className="text-sm text-[#6B7B7B] text-center leading-relaxed">
              We're working on surfacing concerts, festivals, and local events near your destination.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Map */}
      {activeTab === "Map" && (
        <RouteMap
          departureAirport={departureAirport}
          arrivalAirport={arrivalAirport}
          airportMap={airportMapWithCoords}
        />
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
    </div>
  );
};

export default FlightDestResults;
