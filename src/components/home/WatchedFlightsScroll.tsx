import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
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

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatShortDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function getPrice(flight_json: any): number | null {
  const fares = flight_json?.fares;
  if (!fares) return flight_json?.price ?? null;
  const val = fares.basic ?? fares.economy ?? fares.premium ?? fares.standard;
  return typeof val === "number" && val > 0 ? val : null;
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

export function WatchedFlightsScroll({
  flights,
  loading,
  onNavigate,
  isCollapsed = false,
  onToggle,
  onFlightRemoved,
}: Props) {
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
      {/* Section header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-1 px-1 group"
      >
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Alert01Icon} size={13} color="#059669" strokeWidth={2} />
          <h2 className="text-xs font-semibold text-[#059669] uppercase tracking-wider">
            Watched Flights
          </h2>
        </div>
        <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
          <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="watched-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "visible" }}
          >
            <div style={{ padding: "2px 6px 0" }}>
              {loading ? (
                <div
                  className="rounded-2xl px-4 py-5"
                  style={{
                    background: "rgba(255,255,255,0.72)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.55)",
                    boxShadow: "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
                  }}
                >
                  {[1, 2].map((i) => (
                    <div key={i} className={`animate-pulse ${i > 1 ? "mt-3" : ""}`}>
                      <div className="h-3 w-24 rounded bg-[#e5e7eb] mb-2" />
                      <div className="h-7 w-40 rounded bg-[#e5e7eb] mb-2" />
                      <div className="h-3 w-32 rounded bg-[#e5e7eb]" />
                    </div>
                  ))}
                </div>
              ) : flights.length === 0 ? (
                <div
                  className="rounded-2xl px-3 py-3 flex items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    boxShadow: "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
                  }}
                >
                  <div className="flex-1 min-w-0 py-1">
                    <p className="text-base text-[#1A2E2E] font-semibold leading-tight capitalize">No watched flights</p>
                    <p className="text-xs text-[#9AADAD] font-medium mt-0.5">
                      Set an alert on a flight to track it here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {flights.map((flight, i) => {
                    const price = getPrice(flight.flight_json);
                    const depLabel = formatShortDate(flight.departure_time);
                    const arrLabel = formatShortDateLabel(flight.arrival_time);

                    return (
                      <motion.div
                        key={flight.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.28, delay: i * 0.07, ease: EASE },
                        }}
                        className="relative rounded-2xl px-4 pt-3 pb-4"
                        style={{
                          background: "rgba(255,255,255,0.92)",
                          backdropFilter: "blur(18px)",
                          WebkitBackdropFilter: "blur(18px)",
                          border: "1px solid rgba(255,255,255,0.65)",
                          boxShadow: "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
                        }}
                      >
                        {/* Dismiss button */}
                        <button
                          type="button"
                          onClick={() => setFlightToRemove(flight)}
                          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors"
                        >
                          <X size={13} strokeWidth={2.5} className="text-[#6B7280]" />
                        </button>

                        <div className="flex items-center justify-between gap-3">
                          {/* Left: logo + route + date */}
                          <div className="flex-1 min-w-0">
                            <img
                              src={FRONTIER_LOGO}
                              alt="Frontier"
                              className="h-[18px] w-auto object-contain mb-2.5"
                              loading="eager"
                            />
                            {/* Route */}
                            <div className="flex items-center gap-1 mb-1.5">
                              <span className="text-2xl font-bold text-[#1a2e2e] leading-none tracking-tight">
                                {flight.departure_airport}
                              </span>
                              <div className="flex-1 flex items-center px-1">
                                <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-20" />
                                <svg fill="#2D6A4F" className="mx-1.5 w-5 h-5 shrink-0" viewBox="-3.2 -3.2 38.40 38.40" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z" />
                                  <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z" />
                                </svg>
                                <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-20" />
                              </div>
                              <span className="text-2xl font-bold text-[#1a2e2e] leading-none tracking-tight">
                                {flight.arrival_airport}
                              </span>
                            </div>
                            {/* Date */}
                            <p className="text-[13px] text-[#9AADAD] font-medium">
                              {depLabel}{arrLabel && arrLabel !== depLabel ? ` • ${arrLabel}` : ""}
                            </p>
                          </div>

                          {/* Price pill */}
                          {price !== null && (
                            <div
                              className="shrink-0 rounded-full px-4 py-2.5 flex items-center justify-center"
                              style={{ background: "#E5A320" }}
                            >
                              <span className="text-white font-bold text-base leading-none">
                                ${Math.round(price)}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!flightToRemove} onOpenChange={(open) => { if (!open) setFlightToRemove(null); }}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4 pt-10 overflow-visible border border-[#EF4444]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-[#FEE2E2] border-2 border-[#EF4444] flex items-center justify-center shadow-sm">
            <HugeiconsIcon icon={Delete02Icon} size={22} color="#EF4444" strokeWidth={1.5} />
          </div>
          <AlertDialogHeader className="space-y-1 text-center">
            <AlertDialogTitle className="text-lg font-bold text-[#EF4444] text-center">
              Remove Alert
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7B7B] text-center">
              Remove the alert for {flightToRemove?.departure_airport} to {flightToRemove?.arrival_airport}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-3">
            <AlertDialogCancel disabled={removing} className="w-full text-xs py-1 mt-0 bg-white text-[#4B5563] border-[#D1D5DB] hover:bg-[#F4F8F8] hover:text-[#2E4A4A]">
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
