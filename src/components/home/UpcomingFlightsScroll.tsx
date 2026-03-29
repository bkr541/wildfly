import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import planeIcon from "@/assets/plane-icon.svg";
import { HugeiconsIcon } from "@hugeicons/react";
import { Timer02Icon } from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
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

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
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
  onFlightRemoved?: (flightId: string) => void;
}

export function UpcomingFlightsScroll({ flights, loading, onNavigate, isCollapsed = false, onToggle, onFlightRemoved }: Props) {
  const [flightToRemove, setFlightToRemove] = useState<UserFlight | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!flightToRemove) return;
    setRemoving(true);
    await supabase.from("user_flights").delete().eq("id", flightToRemove.id);
    setRemoving(false);
    setFlightToRemove(null);
    onFlightRemoved?.(flightToRemove.id);
  };

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Section header — clickable to toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-1 px-1 group"
      >
        <h2 className="text-[15px] font-semibold text-[#6B7280] capitalize tracking-widest flex items-center gap-2">
          <div className="inline-flex items-center justify-center rounded-full border border-[#D5E6E2] bg-[#F6FBFA] p-1.5">
            <HugeiconsIcon icon={Timer02Icon} size={18} color="#059669" strokeWidth={2} />
          </div>
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
                className="rounded-2xl px-3 py-3 flex items-center gap-3"
                style={{
                  background: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(18px)",
                  WebkitBackdropFilter: "blur(18px)",
                  border: "1px solid rgba(255,255,255,0.65)",
                  boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
                }}
              >
                <img
                  src="/assets/userhome/noupcomingflights.png"
                  alt="No upcoming flights"
                  className="flex-shrink-0 w-24 h-24 object-contain"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base text-[#1A2E2E] font-semibold leading-tight capitalize">No upcoming flights yet</p>
                  <p className="text-xs text-[#9AADAD] font-medium mt-0.5">
                    Book a trip or save a route to build your itinerary
                  </p>
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
                    className="relative flex-shrink-0 w-[232px] rounded-2xl px-4 pt-3 pb-4"
                    style={{
                      scrollSnapAlign: "start",
                      background: "rgba(255,255,255,0.72)",
                      backdropFilter: "blur(18px)",
                      WebkitBackdropFilter: "blur(18px)",
                      border: "1px solid rgba(255,255,255,0.55)",
                      boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
                    }}
                  >
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFlightToRemove(flight); }}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors"
                    >
                      <X size={13} strokeWidth={2.5} className="text-[#6B7280]" />
                    </button>

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

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!flightToRemove} onOpenChange={(open) => { if (!open) setFlightToRemove(null); }}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-lg font-bold text-[#2E4A4A]">
              Removing {flightToRemove?.departure_airport} to {flightToRemove?.arrival_airport}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7B7B]">
              Proceeding will remove {flightToRemove?.departure_airport} to {flightToRemove?.arrival_airport} on {flightToRemove ? formatShortDate(flightToRemove.departure_time) : ""} from your itinerary. Do you wish to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-2">
            <AlertDialogCancel disabled={removing} className="w-full text-xs py-1 mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-xs py-1"
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
