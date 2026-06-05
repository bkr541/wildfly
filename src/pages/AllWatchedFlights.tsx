import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  ArrowRight04Icon,
  CircleArrowReload01Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TicketDivider } from "@/components/home/TicketDivider";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface UserFlight {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  type: string;
  flight_json: any;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFullDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return dateStr; }
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return ""; }
}

function getPrice(flight_json: any): number | null {
  const fares = flight_json?.fares;
  if (!fares) return flight_json?.price ?? null;
  const val = fares.basic ?? fares.economy ?? fares.premium ?? fares.standard;
  return typeof val === "number" && val > 0 ? val : null;
}

function hasGoWild(flight_json: any): boolean {
  const fares = flight_json?.fares;
  if (!fares) return false;
  const gw = fares.gowild ?? fares.goWild ?? fares.go_wild;
  return typeof gw === "number" && gw > 0;
}

function isRoundTrip(flight: { flight_json: any }): boolean {
  if (flight.flight_json?.tripType === "round-trip" || flight.flight_json?.tripType === "round_trip") return true;
  if (Array.isArray(flight.flight_json?.legs) && flight.flight_json.legs.length > 1) {
    const first = flight.flight_json.legs[0];
    const last = flight.flight_json.legs[flight.flight_json.legs.length - 1];
    if (first?.origin && last?.destination && first.origin === last.destination) return true;
  }
  return false;
}

function groupByMonth(flights: UserFlight[]): [string, { date: Date; flights: UserFlight[] }][] {
  const map = new Map<string, { date: Date; flights: UserFlight[] }>();
  for (const f of flights) {
    const d = new Date(f.departure_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { date: d, flights: [] });
    map.get(key)!.flights.push(f);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function groupByDay(flights: UserFlight[]): [string, { date: Date; flights: UserFlight[] }][] {
  const map = new Map<string, { date: Date; flights: UserFlight[] }>();
  for (const f of flights) {
    const d = new Date(f.departure_time);
    const key = d.toDateString();
    if (!map.has(key)) map.set(key, { date: d, flights: [] });
    map.get(key)!.flights.push(f);
  }
  return [...map.entries()].sort(([, a], [, b]) => a.date.getTime() - b.date.getTime());
}

function getMonthAbbr(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}

function getMonthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FRONTIER_LOGO = "/assets/logo/frontier/frontier_full_logo.png";
const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";
const CARD_STYLE = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: CARD_SHADOW,
};

const PlaneSVG = ({ size = 20 }: { size?: number }) => (
  <svg fill="#2D6A4F" style={{ width: size, height: size, flexShrink: 0 }} viewBox="-3.2 -3.2 38.40 38.40" xmlns="http://www.w3.org/2000/svg">
    <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z" />
    <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z" />
  </svg>
);

// ── Compact flight card ───────────────────────────────────────────────────────

function FlightCard({ flight, onRemove }: { flight: UserFlight; onRemove: (f: UserFlight) => void }) {
  const price = getPrice(flight.flight_json);
  const gowild = hasGoWild(flight.flight_json);
  const roundTrip = isRoundTrip(flight);
  const tripIcon = roundTrip ? CircleArrowReload01Icon : ArrowRight04Icon;
  const tripLabel = roundTrip ? "Round Trip" : "One Way";

  return (
    <div
      className="relative rounded-2xl border-l-4 border-[#F59E0B] overflow-hidden"
      style={CARD_STYLE}
    >
      {/* Amber bottom strip */}
      <div className="absolute inset-x-0 bottom-0 h-[5px] pointer-events-none" style={{ background: "#F59E0B" }} />

      <div className="px-3 pt-2.5 pb-[14px]">
        {/* Header: logo + dismiss */}
        <div className="flex items-center justify-between mb-2">
          <img src={FRONTIER_LOGO} alt="Frontier" className="h-[14px] w-auto object-contain" loading="eager" />
          <button
            type="button"
            onClick={() => onRemove(flight)}
            className="flex items-center justify-center transition-opacity hover:opacity-70"
            aria-label="Remove watched flight"
          >
            <X size={12} strokeWidth={2.5} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Route row */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="text-2xl font-bold text-[#1A2E2E] leading-none tracking-tight">
            {flight.departure_airport}
          </span>
          <div className="flex-1 flex items-center px-1.5">
            <div className="flex-1 h-0 border-t border-dashed" style={{ borderColor: "#B8CECE" }} />
            <div className="mx-1.5"><PlaneSVG size={20} /></div>
            <div className="flex-1 h-0 border-t border-dashed" style={{ borderColor: "#B8CECE" }} />
          </div>
          <span className="text-2xl font-bold text-[#1A2E2E] leading-none tracking-tight">
            {flight.arrival_airport}
          </span>
        </div>

        {/* Time / date row */}
        <div className="flex items-start justify-between">
          <span className="leading-tight">
            <span className="block text-xs font-semibold text-[#059669]">{formatTime(flight.departure_time)}</span>
            <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">{formatFullDate(flight.departure_time)}</span>
          </span>
          <span className="leading-tight text-right">
            <span className="block text-xs font-semibold text-[#059669]">{formatTime(flight.arrival_time)}</span>
            <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">{formatFullDate(flight.arrival_time)}</span>
          </span>
        </div>

        <TicketDivider cardPx={12} notchSize={20} />

        {/* Badges */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap" style={{ paddingTop: 8 }}>
          {gowild && (
            <span
              className="inline-flex items-center gap-1 rounded-full text-[10px] font-semibold whitespace-nowrap"
              style={{ background: "#059669", color: "#fff", height: 20, padding: "0 8px" }}
            >
              <HugeiconsIcon icon={Rocket01Icon} size={10} color="white" strokeWidth={2.5} />
              GoWild
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full text-[10px] font-semibold whitespace-nowrap"
            style={{ background: "#1D4ED8", color: "#FFFFFF", height: 20, padding: "0 8px" }}
          >
            <HugeiconsIcon icon={tripIcon} size={10} color="#FFFFFF" strokeWidth={2.5} />
            {tripLabel}
          </span>
          {price !== null && (
            <span
              className="inline-flex items-center rounded-full text-[10px] font-semibold whitespace-nowrap"
              style={{ background: "#FFF4E0", border: "1.5px solid #F5C572", color: "#B45309", height: 20, padding: "0 8px" }}
            >
              ${Math.round(price)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Month group ───────────────────────────────────────────────────────────────

function MonthGroup({
  monthDate,
  flights,
  onRemove,
}: {
  monthDate: Date;
  flights: UserFlight[];
  onRemove: (f: UserFlight) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const dayGroups = groupByDay(flights);
  const monthAbbr = getMonthAbbr(monthDate);
  const monthLabel = getMonthLabel(monthDate);
  const flightCount = flights.length;

  return (
    <div className="mb-8">
      {/* Month header row */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 pr-2 mb-1"
      >
        {/* Month badge — sits on top of the vertical timeline line */}
        <div
          className="relative w-[52px] h-[52px] rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#F59E0B" }}
        >
          <span className="text-white font-black text-sm tracking-wide leading-none">{monthAbbr}</span>
        </div>

        {/* Month name + count */}
        <div className="flex-1 text-left">
          <p className="font-bold text-[#1A2E2E] text-[15px] leading-tight">{monthLabel}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            {flightCount} flight{flightCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Collapse chevron */}
        <motion.div
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          <ChevronDown size={16} strokeWidth={2.5} className="text-[#9AADAD]" />
        </motion.div>
      </button>

      {/* Day groups */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="month-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            {dayGroups.map(([dayKey, { date, flights: dayFlights }]) => (
              <div key={dayKey} className="mt-3">
                {/* Day header: circle + label */}
                <div className="flex items-center gap-3 mb-2.5">
                  {/* Day circle — centered on the timeline line (line at x=26, circle 28px wide at ml=12) */}
                  <div
                    className="relative w-[28px] h-[28px] rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#374151] flex-shrink-0"
                    style={{ border: "2px solid #F59E0B", marginLeft: 12 }}
                  >
                    {date.getDate()}
                  </div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                    {getDayLabel(date)}
                  </p>
                </div>

                {/* Flight cards — aligned with right-side content (past 52px badge + 12px gap) */}
                <div className="flex flex-col gap-2.5" style={{ marginLeft: 64 }}>
                  {dayFlights.map((flight, i) => (
                    <motion.div
                      key={flight.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.22, delay: i * 0.05, ease: EASE } }}
                    >
                      <FlightCard flight={flight} onRemove={onRemove} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AllWatchedFlights() {
  const { user } = useAuth();
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [flightToRemove, setFlightToRemove] = useState<UserFlight | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    supabase
      .from("user_flights")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "Current")
      .eq("type", "alert")
      .gte("departure_time", startOfToday.toISOString())
      .order("departure_time", { ascending: true })
      .then(({ data }) => {
        setFlights(data || []);
        setLoading(false);
      });
  }, [user]);

  const handleRemove = async () => {
    if (!flightToRemove) return;
    setRemoving(true);
    await supabase.from("user_flights").delete().eq("id", flightToRemove.id);
    setFlights((prev) => prev.filter((f) => f.id !== flightToRemove.id));
    setRemoving(false);
    setFlightToRemove(null);
  };

  const months = groupByMonth(flights);

  return (
    <div className="w-full flex justify-center pt-4 pb-10">
      <div className="relative w-full px-4 lg:max-w-[50%]">
      {/* Vertical timeline line — runs behind month badges and day circles */}
      {!loading && flights.length > 0 && (
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{ left: 42, width: 2, background: "#F59E0B" }}
        />
      )}

      {loading ? (
        <div className="flex flex-col gap-6 pt-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-[52px] h-[52px] rounded-xl bg-[#e5e7eb] animate-pulse flex-shrink-0" />
              <div className="flex-1 pt-2 space-y-1.5">
                <div className="h-4 w-28 rounded bg-[#e5e7eb] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[#e5e7eb] animate-pulse" />
                <div className="h-24 w-full rounded-2xl bg-[#e5e7eb] animate-pulse mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : flights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="h-20 w-20 rounded-full bg-[#FFF8E6] flex items-center justify-center mb-5">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#F59E0B" />
            </svg>
          </div>
          <p className="text-base text-[#1A2E2E] font-semibold mb-1">No watched flights</p>
          <p className="text-xs text-[#9AADAD] font-medium">Set an alert on a flight to track it here</p>
        </div>
      ) : (
        <>
          {months.map(([key, { date, flights: monthFlights }]) => (
            <MonthGroup
              key={key}
              monthDate={date}
              flights={monthFlights}
              onRemove={setFlightToRemove}
            />
          ))}
          {months.length > 0 && (
            <div
              className="relative rounded-full"
              style={{ width: 12, height: 12, background: "#F59E0B", border: "2px solid white", marginLeft: 20 }}
            />
          )}
        </>
      )}

      <AlertDialog open={!!flightToRemove} onOpenChange={(open) => { if (!open) setFlightToRemove(null); }}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4 pt-10 overflow-visible border border-[#EF4444]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-[#FEE2E2] border-2 border-[#EF4444] flex items-center justify-center shadow-sm">
            <HugeiconsIcon icon={Delete02Icon} size={22} color="#EF4444" strokeWidth={1.5} />
          </div>
          <AlertDialogHeader className="space-y-1 text-center">
            <AlertDialogTitle className="text-lg font-bold text-[#EF4444] text-center">Remove Alert</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7B7B] text-center">
              Remove the alert for {flightToRemove?.departure_airport} to {flightToRemove?.arrival_airport} on{" "}
              {flightToRemove ? formatShortDate(flightToRemove.departure_time) : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-3">
            <AlertDialogCancel disabled={removing} className="w-full text-xs py-1 mt-0 bg-white text-[#4B5563] border-[#D1D5DB] hover:bg-[#F4F8F8] hover:text-[#2E4A4A]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing} className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-xs py-1">
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
