import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { ChevronDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  AirplaneLandingIcon,
  Timer02Icon,
  Calendar03Icon,
  Airplane01Icon,
  Location01Icon,
  Share03Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import StaticRouteMapBase from "@/components/StaticRouteMapBase";
import RouteMapCard from "@/components/RouteMapCard";

interface UserFlight {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  type: string;
  flight_json: any;
  created_at: string;
  status: string | null;
}

interface Props {
  flight: UserFlight;
  onBack: () => void;
}

interface AirportInfo {
  lat: number;
  lng: number;
  city: string;
  stateCode: string;
  country: string;
  name: string;
}


function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(dep: string, arr: string): string {
  try {
    const diff = new Date(arr).getTime() - new Date(dep).getTime();
    if (diff <= 0) return "";
    const totalMin = Math.round(diff / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  } catch {
    return "";
  }
}

/** Haversine distance in miles between two lat/lng points */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── AccountHub-style collapsible card ───────────────────────────────────────

function SectionCard({
  icon,
  label,
  desc,
  open,
  onToggle,
  children,
}: {
  icon: any;
  label: string;
  desc: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-[#E3E6E6] overflow-hidden"
      style={{ boxShadow: "0 1px 4px 0 rgba(0,0,0,0.06)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center w-full px-4 py-3 text-left"
      >
        <span className="h-8 w-8 rounded-full bg-[#F0FAF6] flex items-center justify-center mr-3 shrink-0">
          <HugeiconsIcon icon={icon} size={15} color="#047857" strokeWidth={1.5} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#2E4A4A]">{label}</p>
          <p className="text-xs text-[#6B7B7B]">{desc}</p>
        </div>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className="text-[#9AADAD] transition-transform duration-200 ml-2 shrink-0"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {open && (
        <div className="border-t border-[#F0F1F1]">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const FlightDetails = ({ flight, onBack }: Props) => {
  const duration = formatDuration(flight.departure_time, flight.arrival_time);
  const fj = flight.flight_json ?? {};

  const [depInfo, setDepInfo] = useState<AirportInfo | null>(null);
  const [arrInfo, setArrInfo] = useState<AirportInfo | null>(null);
  const [depPx, setDepPx] = useState<{ x: number; y: number } | null>(null);
  const [arrPx, setArrPx] = useState<{ x: number; y: number } | null>(null);

  const [flightDetailsOpen, setFlightDetailsOpen] = useState(true);
  const [routeMapOpen, setRouteMapOpen] = useState(false);
  const [savedInfoOpen, setSavedInfoOpen] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("iata_code, name, latitude, longitude, locations(city, state_code, country)")
        .in("iata_code", [flight.departure_airport, flight.arrival_airport]);
      if (!data) return;
      const map: Record<string, AirportInfo> = {};
      for (const row of data as any[]) {
        if (row.latitude != null && row.longitude != null) {
          map[row.iata_code] = {
            lat: row.latitude,
            lng: row.longitude,
            city: row.locations?.city ?? "",
            stateCode: row.locations?.state_code ?? "",
            country: row.locations?.country ?? "",
            name: row.name ?? "",
          };
        }
      }
      setDepInfo(map[flight.departure_airport] ?? null);
      setArrInfo(map[flight.arrival_airport] ?? null);
    })();
  }, [flight.departure_airport, flight.arrival_airport]);

  // Pull extra fields from flight_json if available
  const flightNumber: string | null = fj.flightNumber ?? fj.flight_number ?? null;
  const aircraft: string | null = fj.aircraft ?? fj.aircraftType ?? null;
  const terminal: string | null = fj.terminal ?? null;
  const gate: string | null = fj.gate ?? null;
  const confirmationCode: string | null = fj.confirmationCode ?? fj.confirmation_code ?? fj.pnr ?? null;
  const stops: number | null = fj.stops != null ? Number(fj.stops) : (fj.legs?.length > 1 ? fj.legs.length - 1 : null);

  const distanceMiles =
    depInfo && arrInfo
      ? Math.round(haversineDistance(depInfo.lat, depInfo.lng, arrInfo.lat, arrInfo.lng))
      : null;

  const hasFlightDetails = !!(flightNumber || aircraft || confirmationCode || terminal || gate || flight.type);
  const hasRouteMap = !!(depInfo && arrInfo);

  return (
    <div className="relative flex flex-col h-full bg-[#F1F5F5] overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Hero header ── */}
        <header className="relative flex flex-col px-5 pt-12 pb-6 overflow-hidden shrink-0">
          {depInfo && arrInfo ? (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
              <StaticRouteMapBase
                depLatLng={[depInfo.lat, depInfo.lng]}
                arrLatLng={[arrInfo.lat, arrInfo.lng]}
                onProjected={(dep, arr) => { setDepPx(dep); setArrPx(arr); }}
              />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{ zIndex: 0, background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            />
          )}

          {/* SVG arc overlay */}
          {depPx && arrPx && (() => {
            const mx = (depPx.x + arrPx.x) / 2;
            const my = (depPx.y + arrPx.y) / 2;
            const dist = Math.hypot(arrPx.x - depPx.x, arrPx.y - depPx.y);
            const lift = Math.min(dist * 0.32, 80);
            const path = `M ${depPx.x} ${depPx.y} Q ${mx} ${my - lift} ${arrPx.x} ${arrPx.y}`;
            return (
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }} width="100%" height="100%">
                <path d={path} fill="none" stroke="rgba(5,150,105,0.3)" strokeWidth="7" strokeLinecap="round" style={{ filter: "blur(3px)" }} />
                <path d={path} fill="none" stroke="#059669" strokeWidth="2.5" strokeDasharray="8 5" strokeLinecap="round" />
                <circle cx={depPx.x} cy={depPx.y} r={9} fill="rgba(5,150,105,0.15)" />
                <circle cx={depPx.x} cy={depPx.y} r={5} fill="#059669" />
                <circle cx={arrPx.x} cy={arrPx.y} r={9} fill="rgba(5,150,105,0.15)" />
                <circle cx={arrPx.x} cy={arrPx.y} r={5} fill="#059669" />
              </svg>
            );
          })()}

          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="absolute top-5 left-5 h-10 w-10 flex items-center justify-start text-[#059669] hover:opacity-70 transition-opacity"
            style={{ zIndex: 10 }}
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
          </button>

          {/* Share button */}
          <button
            type="button"
            onClick={() => navigator.share?.({ title: `${flight.departure_airport} → ${flight.arrival_airport}`, text: `Flight on ${formatDate(flight.departure_time)}` })}
            className="absolute top-5 right-5 h-10 w-10 flex items-center justify-end hover:opacity-70 transition-opacity"
            style={{ zIndex: 10 }}
          >
            <HugeiconsIcon icon={Share03Icon} size={20} color="#059669" strokeWidth={1.8} />
          </button>

          {/* Text content */}
          <div className="relative z-10 flex flex-col">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center justify-center gap-6">
                <span
                  className="text-[42px] font-black text-[#059669] leading-none tracking-tight"
                  style={{ textShadow: "0 1px 4px rgba(5,150,105,0.18)" }}
                >
                  {flight.departure_airport}
                </span>
                <svg fill="#059669" className="w-8 h-8 shrink-0" viewBox="-3.2 -3.2 38.40 38.40" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z"/>
                  <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z"/>
                </svg>
                <span
                  className="text-[42px] font-black text-[#059669] leading-none tracking-tight"
                  style={{ textShadow: "0 1px 4px rgba(5,150,105,0.18)" }}
                >
                  {flight.arrival_airport}
                </span>
              </div>
              {duration && (
                <span
                  className="text-[11px] font-semibold text-[#059669] tracking-wide"
                  style={{ textShadow: "0 1px 3px rgba(5,150,105,0.15)" }}
                >
                  {duration}
                </span>
              )}
            </div>
            <p
              className="text-center text-[13px] font-medium mt-2"
              style={{ color: "#059669", textShadow: "0 1px 3px rgba(5,150,105,0.15)" }}
            >
              {formatDate(flight.departure_time)}
            </p>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex flex-col px-4 pt-4 pb-8 gap-3">

          {/* Times card */}
          <div
            className="bg-white rounded-2xl border border-[#E3E6E6] overflow-hidden"
            style={{ boxShadow: "0 1px 4px 0 rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-stretch">
              <div className="flex-1 flex flex-col items-center py-5 px-4 gap-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={15} color="#059669" strokeWidth={2} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AADAD]">Departs</span>
                </div>
                <span className="text-[28px] font-black text-[#1A2E2E] leading-none">{formatTime(flight.departure_time)}</span>
                <span className="text-[12px] font-semibold text-[#2E4A4A]">{flight.departure_airport}</span>
                <span className="text-[11px] text-[#9AADAD] font-medium text-center">{formatDate(flight.departure_time)}</span>
              </div>
              <div className="w-px bg-[#E8EBEB] my-4" />
              <div className="flex-1 flex flex-col items-center py-5 px-4 gap-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <HugeiconsIcon icon={AirplaneLandingIcon} size={15} color="#059669" strokeWidth={2} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AADAD]">Arrives</span>
                </div>
                <span className="text-[28px] font-black text-[#1A2E2E] leading-none">{formatTime(flight.arrival_time)}</span>
                <span className="text-[12px] font-semibold text-[#2E4A4A]">{flight.arrival_airport}</span>
                <span className="text-[11px] text-[#9AADAD] font-medium text-center">{formatDate(flight.arrival_time)}</span>
              </div>
            </div>
            {duration && (
              <div className="border-t border-[#E8EBEB] py-2.5 flex items-center justify-center gap-2">
                <HugeiconsIcon icon={Timer02Icon} size={14} color="#059669" strokeWidth={2} />
                <span className="text-[12px] font-semibold text-[#6B7B7B]">
                  Total flight time: <span className="text-[#2E4A4A] font-bold">{duration}</span>
                </span>
              </div>
            )}
          </div>

          {/* Flight Details */}
          {hasFlightDetails && (
            <SectionCard
              icon={Airplane01Icon}
              label="Flight Details"
              desc="View information about your flight, aircraft, terminal, etc."
              open={flightDetailsOpen}
              onToggle={() => setFlightDetailsOpen((o) => !o)}
            >
              <div className="flex flex-col divide-y divide-[#F0F1F1]">
                {flightNumber && <Row label="Flight Number" value={flightNumber} />}
                {flight.type && <Row label="Trip Type" value={flight.type} />}
                {aircraft && <Row label="Aircraft" value={aircraft} />}
                {terminal && <Row label="Terminal" value={terminal} />}
                {gate && <Row label="Gate" value={gate} />}
                {confirmationCode && <Row label="Confirmation" value={confirmationCode} />}
              </div>
            </SectionCard>
          )}

          {/* Route Map */}
          {hasRouteMap && (
            <SectionCard
              icon={Location01Icon}
              label="Route Map"
              desc="Shows distance, duration, and route details for this flight"
              open={routeMapOpen}
              onToggle={() => setRouteMapOpen((o) => !o)}
            >
              {/* Map */}
              <div className="px-3 pt-3 pb-2">
                <RouteMapCard
                  depLatLng={[depInfo!.lat, depInfo!.lng]}
                  arrLatLng={[arrInfo!.lat, arrInfo!.lng]}
                  depIata={flight.departure_airport}
                  arrIata={flight.arrival_airport}
                  depCity={depInfo!.city}
                  arrCity={arrInfo!.city}
                />
              </div>

              {/* Flight stats */}
              {(distanceMiles != null || duration || stops != null) && (
                <div className="px-4 py-3 flex items-center justify-around">
                  {distanceMiles != null && (
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center justify-center rounded-full border border-[#D5E6E2] bg-[#F6FBFA] p-1.5">
                        <HugeiconsIcon icon={Location01Icon} size={15} color="#059669" strokeWidth={2} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AADAD]">Distance</span>
                        <span className="text-sm font-semibold text-[#2E4A4A]">{distanceMiles.toLocaleString()} mi</span>
                      </div>
                    </div>
                  )}
                  {duration && (
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center justify-center rounded-full border border-[#D5E6E2] bg-[#F6FBFA] p-1.5">
                        <HugeiconsIcon icon={Timer02Icon} size={15} color="#059669" strokeWidth={2} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AADAD]">Duration</span>
                        <span className="text-sm font-semibold text-[#2E4A4A]">{duration}</span>
                      </div>
                    </div>
                  )}
                  {stops != null && (
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center justify-center rounded-full border border-[#D5E6E2] bg-[#F6FBFA] p-1.5">
                        <HugeiconsIcon icon={Airplane01Icon} size={15} color="#059669" strokeWidth={2} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AADAD]">Stops</span>
                        <span className="text-sm font-semibold text-[#2E4A4A]">{stops === 0 ? "Nonstop" : stops}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {/* Saved Info */}
          <SectionCard
            icon={Calendar03Icon}
            label="Saved Info"
            desc="When this flight was added to your itinerary"
            open={savedInfoOpen}
            onToggle={() => setSavedInfoOpen((o) => !o)}
          >
            <div className="flex flex-col divide-y divide-[#F0F1F1]">
              <Row label="Added to itinerary" value={formatDate(flight.created_at)} />
              {flight.status && <Row label="Status" value={flight.status} />}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <span className="text-[13px] text-[#9AADAD] font-medium">{label}</span>
      <span className="text-[13px] font-semibold text-[#2E4A4A] text-right">{value}</span>
    </div>
  );
}

export default FlightDetails;
