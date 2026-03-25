import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import planeIcon from "@/assets/plane-icon.svg";
import { HugeiconsIcon } from "@hugeicons/react";
import { Timer02Icon } from "@hugeicons/core-free-icons";

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

function formatFullDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return dateStr;
  }
}

const FRONTIER_LOGO = "/assets/logo/frontier/frontier_full_logo.png";
const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface Props {
  flights: UserFlight[];
  loading: boolean;
  onNavigate?: (page: string) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function UpcomingFlightsScroll({ flights, loading, onNavigate, isCollapsed = false, onToggle }: Props) {
  return (
    <section className="px-5 pt-1 pb-4 relative z-10">
      {/* Section header — clickable to toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-1 px-1 group"
      >
        <h2 className="text-[15px] font-black text-[#6B7280] uppercase tracking-widest flex items-center gap-2">
          <HugeiconsIcon icon={Timer02Icon} className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
          Upcoming Flights
        </h2>
        <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
          <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
        </motion.div>
      </button>

      {/* Collapsible content with cascading animation */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="upcoming-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "visible" }}
          >
            <div style={{ padding: "2px 6px 10px" }}>
            {loading ? (
              <div
                className="rounded-2xl px-4 py-5"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  backdropFilter: "blur(18px)",
                  WebkitBackdropFilter: "blur(18px)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
                }}
              >
                <div className="flex gap-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex-1 animate-pulse">
                      <div className="h-3 w-20 rounded bg-[#e5e7eb] mb-2" />
                      <div className="h-7 w-full rounded bg-[#e5e7eb] mb-2" />
                      <div className="h-3 w-24 rounded bg-[#e5e7eb]" />
                    </div>
                  ))}
                </div>
              </div>
            ) : flights.length === 0 ? (
              <div
                className="rounded-2xl px-[14px] py-[14px] flex items-center gap-4"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  backdropFilter: "blur(18px)",
                  WebkitBackdropFilter: "blur(18px)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
                }}
              >
                <div className="flex-shrink-0 w-[110px] h-[70px] relative flex items-center justify-center">
                  <img
                    src="/assets/userhome/no_upcoming_flights.png"
                    alt="No upcoming flights"
                    className="w-full h-full object-contain scale-[1.4] origin-center"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1a2e2e] leading-tight mb-0.5">No upcoming flights yet</p>
                  <p className="text-[11px] text-[#6B7B7B] leading-tight mb-2.5">
                    Book a trip or save a route to build your itinerary
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate?.("flights")}
                    className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                  >
                    Book a Flight
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
                style={{ scrollSnapType: "x mandatory" }}
              >
                {flights.map((flight, i) => (
                  <motion.div
                    key={flight.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      transition: { duration: 0.3, delay: i * 0.08, ease: EASE },
                    }}
                    className="flex-shrink-0 w-[232px] rounded-2xl px-4 pt-3 pb-4"
                    style={{
                      scrollSnapAlign: "start",
                      background: "rgba(255,255,255,0.72)",
                      backdropFilter: "blur(18px)",
                      WebkitBackdropFilter: "blur(18px)",
                      border: "1px solid rgba(255,255,255,0.55)",
                      boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="flex items-center mb-3">
                      <img src={FRONTIER_LOGO} alt="Frontier" className="h-[18px] w-auto object-contain" loading="eager" />
                    </div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-2xl font-bold text-[#1a2e2e] leading-none tracking-tight">{flight.departure_airport}</span>
                      <div className="flex-1 flex items-center px-1">
                        <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-20" />
                        <img src={planeIcon} alt="flight" className="mx-1.5 w-8 h-8 object-contain flex-shrink-0" />
                        <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-20" />
                      </div>
                      <span className="text-2xl font-bold text-[#1a2e2e] leading-none tracking-tight">{flight.arrival_airport}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-[#059669] leading-tight">
                        <span className="block">{formatTime(flight.departure_time)}</span>
                        <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">{formatFullDate(flight.departure_time)}</span>
                      </span>
                      <span className="text-xs font-medium text-[#059669] text-right leading-tight">
                        <span className="block">{formatTime(flight.arrival_time)}</span>
                        <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">{formatFullDate(flight.arrival_time)}</span>
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
