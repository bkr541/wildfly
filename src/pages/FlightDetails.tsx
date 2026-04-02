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

const FRONTIER_LOGO = "/assets/logo/frontier/frontier_full_logo.png";

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

const FlightDetails = ({ flight, onBack }: Props) => {
  const duration = formatDuration(flight.departure_time, flight.arrival_time);
  const fj = flight.flight_json ?? {};

  const [depCoords, setDepCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [arrCoords, setArrCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Pixel positions projected by Leaflet after fitBounds — used to draw the
  // SVG route overlay above the gradient in perfect map alignment.
  const [depPx, setDepPx] = useState<{ x: number; y: number } | null>(null);
  const [arrPx, setArrPx] = useState<{ x: number; y: number } | null>(null);
  const [flightDetailsOpen, setFlightDetailsOpen] = useState(true);
  const [savedInfoOpen, setSavedInfoOpen] = useState(true);
  const [routeMapOpen, setRouteMapOpen] = useState(false);
  const [depCity, setDepCity] = useState<string | undefined>(undefined);
  const [arrCity, setArrCity] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("iata_code, latitude, longitude, locations(city)")
        .in("iata_code", [flight.departure_airport, flight.arrival_airport]);
      if (!data) return;
      const coordMap: Record<string, { lat: number; lng: number }> = {};
      const cityMap: Record<string, string> = {};
      for (const row of data as any[]) {
        if (row.latitude != null && row.longitude != null)
          coordMap[row.iata_code] = { lat: row.latitude, lng: row.longitude };
        if (row.locations?.city)
          cityMap[row.iata_code] = row.locations.city;
      }
      setDepCoords(coordMap[flight.departure_airport] ?? null);
      setArrCoords(coordMap[flight.arrival_airport] ?? null);
      setDepCity(cityMap[flight.departure_airport]);
      setArrCity(cityMap[flight.arrival_airport]);
    })();
  }, [flight.departure_airport, flight.arrival_airport]);

  // Pull extra fields from flight_json if available
  const flightNumber: string | null = fj.flightNumber ?? fj.flight_number ?? null;
  const aircraft: string | null = fj.aircraft ?? fj.aircraftType ?? null;
  const terminal: string | null = fj.terminal ?? null;
  const gate: string | null = fj.gate ?? null;
  const confirmationCode: string | null =
    fj.confirmationCode ?? fj.confirmation_code ?? fj.pnr ?? null;

  return (
    <div className="relative flex flex-col h-full bg-[#F1F5F5] overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ── Hero header ── */}
        <header
          className="relative flex flex-col px-5 pt-12 pb-6 overflow-hidden shrink-0"
        >
          {/*
            Layer 1 — real Leaflet map.
            zIndex: 0 is REQUIRED: it creates a stacking context that contains
            Leaflet's own internal z-index: 400 tile pane, preventing it from
            bleeding above the gradient and text layers above.
          */}
          {/* Layer 1 — real Leaflet map (zIndex:0 creates a stacking context that
              contains Leaflet's internal z-index:400 tile pane) */}
          {depCoords && arrCoords ? (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
              <StaticRouteMapBase
                depLatLng={[depCoords.lat, depCoords.lng]}
                arrLatLng={[arrCoords.lat, arrCoords.lng]}
                onProjected={(dep, arr) => { setDepPx(dep); setArrPx(arr); }}
              />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{ zIndex: 0, background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            />
          )}

          {/* Layer 2 — green gradient wash */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              background: "linear-gradient(135deg, rgba(5,150,105,0.62) 0%, rgba(16,185,129,0.58) 100%)",
            }}
          />

          {/* Layer 3 — SVG route drawn above the gradient using Leaflet-projected
              pixel coordinates, so it aligns perfectly with the map tiles. */}
          {depPx && arrPx && (() => {
            const mx = (depPx.x + arrPx.x) / 2;
            const my = (depPx.y + arrPx.y) / 2;
            const dist = Math.hypot(arrPx.x - depPx.x, arrPx.y - depPx.y);
            // Lift the arc northward (upward in pixel space = smaller y).
            const lift = Math.min(dist * 0.32, 80);
            const cpX = mx;
            const cpY = my - lift;
            const path = `M ${depPx.x} ${depPx.y} Q ${cpX} ${cpY} ${arrPx.x} ${arrPx.y}`;
            const r = 5;
            return (
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 2 }}
                width="100%"
                height="100%"
              >
                {/* Glow pass */}
                <path d={path} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="7" strokeLinecap="round" style={{ filter: "blur(3px)" }} />
                {/* Dashed route line */}
                <path d={path} fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="8 5" strokeLinecap="round" />
                {/* Departure marker */}
                <circle cx={depPx.x} cy={depPx.y} r={r + 4} fill="rgba(255,255,255,0.25)" />
                <circle cx={depPx.x} cy={depPx.y} r={r} fill="white" />
                {/* Arrival marker */}
                <circle cx={arrPx.x} cy={arrPx.y} r={r + 4} fill="rgba(255,255,255,0.25)" />
                <circle cx={arrPx.x} cy={arrPx.y} r={r} fill="white" />
              </svg>
            );
          })()}

          {/* Back button — anchored to the header's top-left corner */}
          <button
            type="button"
            onClick={onBack}
            className="absolute top-5 left-5 h-10 w-10 flex items-center justify-start text-white hover:opacity-70 transition-opacity"
            style={{ zIndex: 10 }}
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
          </button>

          {/* Layer 4 — header text content */}
          <div className="relative z-10 flex flex-col">
            {/* Route */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center justify-center gap-3">
                <span className="text-[42px] font-black text-white leading-none tracking-tight">
                  {flight.departure_airport}
                </span>
                <svg fill="rgba(255,255,255,0.85)" className="w-8 h-8 shrink-0" viewBox="-3.2 -3.2 38.40 38.40" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z"/>
                  <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z"/>
                </svg>
                <span className="text-[42px] font-black text-white leading-none tracking-tight">
                  {flight.arrival_airport}
                </span>
              </div>
              {duration && (
                <span className="text-[11px] font-semibold text-white/70 tracking-wide">
                  {duration}
                </span>
              )}
            </div>

            {/* Date */}
            <p className="text-center text-white/75 text-[13px] font-medium mt-2">
              {formatDate(flight.departure_time)}
            </p>

          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex flex-col px-4 pt-4 pb-8 gap-3">
          {/* Times card */}
          <div
            className="rounded-2xl bg-white border border-[#E8EBEB] overflow-hidden"
            style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
          >
            <div className="flex items-stretch">
              {/* Departure */}
              <div className="flex-1 flex flex-col items-center py-5 px-4 gap-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={15} color="#059669" strokeWidth={2} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AADAD]">Departs</span>
                </div>
                <span className="text-[28px] font-black text-[#1A2E2E] leading-none">
                  {formatTime(flight.departure_time)}
                </span>
                <span className="text-[12px] font-semibold text-[#2E4A4A]">
                  {flight.departure_airport}
                </span>
                <span className="text-[11px] text-[#9AADAD] font-medium text-center">
                  {formatDate(flight.departure_time)}
                </span>
              </div>

              {/* Divider */}
              <div className="w-px bg-[#E8EBEB] my-4" />

              {/* Arrival */}
              <div className="flex-1 flex flex-col items-center py-5 px-4 gap-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <HugeiconsIcon icon={AirplaneLandingIcon} size={15} color="#059669" strokeWidth={2} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AADAD]">Arrives</span>
                </div>
                <span className="text-[28px] font-black text-[#1A2E2E] leading-none">
                  {formatTime(flight.arrival_time)}
                </span>
                <span className="text-[12px] font-semibold text-[#2E4A4A]">
                  {flight.arrival_airport}
                </span>
                <span className="text-[11px] text-[#9AADAD] font-medium text-center">
                  {formatDate(flight.arrival_time)}
                </span>
              </div>
            </div>

            {/* Duration strip */}
            {duration && (
              <div className="border-t border-[#E8EBEB] py-2.5 flex items-center justify-center gap-2">
                <HugeiconsIcon icon={Timer02Icon} size={14} color="#059669" strokeWidth={2} />
                <span className="text-[12px] font-semibold text-[#6B7B7B]">
                  Total flight time: <span className="text-[#2E4A4A] font-bold">{duration}</span>
                </span>
              </div>
            )}
          </div>

          {/* Flight details card */}
          {(flightNumber || aircraft || confirmationCode || terminal || gate || flight.type) && (
            <div
              className="rounded-2xl bg-white border border-[#E8EBEB] overflow-hidden"
              style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
            >
              <button
                type="button"
                onClick={() => setFlightDetailsOpen((o) => !o)}
                className="w-full flex items-center gap-2 p-4 text-left"
              >
                <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#059669 0%,#10b981 100%)" }}>
                  <HugeiconsIcon icon={Airplane01Icon} size={13} color="white" strokeWidth={2} />
                </div>
                <h3 className="flex-1 text-[13px] font-bold text-[#2E4A4A] uppercase tracking-widest">Flight Details</h3>
                <ChevronDown size={16} strokeWidth={2.5} className="text-[#9AADAD] transition-transform duration-200" style={{ transform: flightDetailsOpen ? "rotate(0deg)" : "rotate(-90deg)" }} />
              </button>

              {flightDetailsOpen && (
                <div className="flex flex-col gap-2.5 px-4 pb-4">
                  {flightNumber && <Row label="Flight Number" value={flightNumber} />}
                  {flight.type && <Row label="Trip Type" value={flight.type} />}
                  {aircraft && <Row label="Aircraft" value={aircraft} />}
                  {terminal && <Row label="Terminal" value={terminal} />}
                  {gate && <Row label="Gate" value={gate} />}
                  {confirmationCode && <Row label="Confirmation" value={confirmationCode} />}
                </div>
              )}
            </div>
          )}

          {/* Route Map card */}
          {depCoords && arrCoords && (
            <div
              className="rounded-2xl bg-white border border-[#E8EBEB] overflow-hidden"
              style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
            >
              <button
                type="button"
                onClick={() => setRouteMapOpen((o) => !o)}
                className="w-full flex items-center gap-2 p-4 text-left"
              >
                <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#059669 0%,#10b981 100%)" }}>
                  <HugeiconsIcon icon={Location01Icon} size={13} color="white" strokeWidth={2} />
                </div>
                <h3 className="flex-1 text-[13px] font-bold text-[#2E4A4A] uppercase tracking-widest">Route Map</h3>
                <ChevronDown size={16} strokeWidth={2.5} className="text-[#9AADAD] transition-transform duration-200" style={{ transform: routeMapOpen ? "rotate(0deg)" : "rotate(-90deg)" }} />
              </button>

              {routeMapOpen && (
                <div className="px-3 pb-3">
                  <RouteMapCard
                    depLatLng={[depCoords.lat, depCoords.lng]}
                    arrLatLng={[arrCoords.lat, arrCoords.lng]}
                    depIata={flight.departure_airport}
                    arrIata={flight.arrival_airport}
                    depCity={depCity}
                    arrCity={arrCity}
                  />
                </div>
              )}
            </div>
          )}

          {/* Added date card */}
          <div
            className="rounded-2xl bg-white border border-[#E8EBEB] overflow-hidden"
            style={{ boxShadow: "0 4px 16px 0 rgba(53,92,90,0.10)" }}
          >
            <button
              type="button"
              onClick={() => setSavedInfoOpen((o) => !o)}
              className="w-full flex items-center gap-2 p-4 text-left"
            >
              <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#059669 0%,#10b981 100%)" }}>
                <HugeiconsIcon icon={Calendar03Icon} size={13} color="white" strokeWidth={2} />
              </div>
              <h3 className="flex-1 text-[13px] font-bold text-[#2E4A4A] uppercase tracking-widest">Saved Info</h3>
              <ChevronDown size={16} strokeWidth={2.5} className="text-[#9AADAD] transition-transform duration-200" style={{ transform: savedInfoOpen ? "rotate(0deg)" : "rotate(-90deg)" }} />
            </button>

            {savedInfoOpen && (
              <div className="px-4 pb-4">
                <Row label="Added to itinerary" value={formatDate(flight.created_at)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-[#9AADAD] font-medium">{label}</span>
      <span className="text-[13px] font-semibold text-[#2E4A4A] text-right">{value}</span>
    </div>
  );
}

export default FlightDetails;
