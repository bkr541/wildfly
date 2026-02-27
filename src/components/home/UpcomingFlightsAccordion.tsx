import { useState, useId, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlane } from "@fortawesome/free-solid-svg-icons";

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

function formatDateLabel(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "";
  }
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

const EASE = [0.2, 0.8, 0.2, 1] as const;
const DURATION = 0.28;
const EXPAND_DURATION = 0.24;
const FRONTIER_LOGO = "/assets/logo/frontier/frontier_logo.png";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: 5,
    transition: { duration: 0.15 },
  },
};

interface Props {
  flights: UserFlight[];
  loading: boolean;
}

export function UpcomingFlightsAccordion({ flights, loading }: Props) {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const panelId = useId();
  const triggerId = useId();

  // Preload the logo on mount to ensure it's in the cache
  useEffect(() => {
    const img = new Image();
    img.src = FRONTIER_LOGO;
  }, []);

  const chevronVariants = {
    collapsed: { rotate: 0 },
    expanded: { rotate: 180 },
  };

  return (
    <motion.div layout className="px-6 pb-4 relative z-10">
      <button
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left mb-2 group"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#2E4A4A] uppercase tracking-widest">
            Upcoming Flights
            {!loading && (
              <span className="ml-2 text-xs font-medium text-[#6B7B7B] normal-case tracking-normal">
                {flights.length} {flights.length === 1 ? "flight" : "flights"}
              </span>
            )}
          </h2>
          <motion.span
            variants={chevronVariants}
            animate={open ? "expanded" : "collapsed"}
            transition={{ duration: shouldReduceMotion ? 0.1 : DURATION, ease: EASE }}
            className="text-[#6B7B7B] group-hover:text-[#2E4A4A] transition-colors"
          >
            <FontAwesomeIcon icon={faChevronDown} className="w-3.5 h-3.5" />
          </motion.span>
        </div>

        <AnimatePresence initial={false}>
          {!open && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : -4,
                transition: { duration: 0.15, ease: EASE },
              }}
              className="mt-2 flex flex-col gap-1.5"
            >
              {loading ? (
                <>
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#d1d5db] animate-pulse" />
                      <span className="h-3 w-40 rounded bg-[#e5e7eb] animate-pulse" />
                    </div>
                  ))}
                </>
              ) : flights.length === 0 ? (
                <p className="text-xs text-[#6B7B7B] text-center py-1">No upcoming flights</p>
              ) : (
                flights.map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#059669]" />
                    <span className="text-xs text-[#345C5A] truncate flex-1">
                      {f.departure_airport} → {f.arrival_airport}
                    </span>
                    <span className="text-[10px] text-[#6B7B7B] whitespace-nowrap">
                      {formatDateLabel(f.created_at)}
                    </span>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <div id={panelId} role="region" aria-labelledby={triggerId} style={{ overflow: "hidden" }}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="flights-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: "auto",
                opacity: 1,
                transition: {
                  height: { duration: shouldReduceMotion ? 0.12 : EXPAND_DURATION, ease: EASE },
                  opacity: { duration: shouldReduceMotion ? 0.12 : EXPAND_DURATION },
                },
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: {
                  height: { duration: DURATION, ease: EASE },
                  opacity: { duration: 0.18 },
                },
              }}
              style={{ overflow: "hidden" }}
            >
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col gap-2"
              >
                {flights.length === 0 ? (
                  <motion.div
                    variants={itemVariants}
                    className="rounded-xl border border-[#e3e6e6] px-4 py-4 text-center"
                  >
                    <p className="text-sm text-[#6B7B7B]">No upcoming flights scheduled.</p>
                  </motion.div>
                ) : (
                  flights.map((flight) => {
                    return (
                      <motion.div
                        key={flight.id}
                        variants={itemVariants}
                        className="rounded-xl border border-[#e3e6e6] bg-white px-4 pt-3 pb-4"
                      >
                        {/* FIXED HEIGHT CONTAINER: Prevents layout shift when logo loads */}
                        <div className="h-4 flex items-center gap-2 mb-3">
                          <img
                            src={FRONTIER_LOGO}
                            alt="Frontier Airlines"
                            className="h-full w-auto object-contain"
                            loading="eager"
                          />
                          <span className="text-xs font-semibold text-[#2E4A4A] tracking-wide uppercase">
                            Frontier Airlines
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-3xl font-bold text-[#1a2e2e] leading-none tracking-tight">
                            {flight.departure_airport}
                          </span>

                          {/* Separator with plane icon centered between the IATA codes */}
                          <div className="flex-1 flex items-center px-2">
                            <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-40" />
                            <span className="mx-2 inline-flex items-center justify-center w-7 h-7 rounded-full border border-[#e3e6e6] bg-[#F9FBFA] flex-shrink-0">
                              <FontAwesomeIcon icon={faPlane} style={{ transform: "rotate(45deg)" }} className="w-3.5 h-3.5 text-[#2E4A4A]" />
                            </span>
                            <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-40" />
                          </div>

                          <span className="text-3xl font-bold text-[#1a2e2e] leading-none tracking-tight">
                            {flight.arrival_airport}
                          </span>
                        </div>

                        {/* Times are aligned on the same top line; date is underneath on a new line */}
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-medium text-[#059669] leading-tight">
                            <span className="block">{formatTime(flight.departure_time)}</span>
                            <span className="block text-[11px] font-medium text-[#6B7B7B] mt-0.5">
                              {formatFullDate(flight.departure_time)}
                            </span>
                          </span>

                          <span className="text-sm font-medium text-[#059669] text-right leading-tight">
                            <span className="block">{formatTime(flight.arrival_time)}</span>
                            <span className="block text-[11px] font-medium text-[#6B7B7B] mt-0.5">
                              {formatFullDate(flight.arrival_time)}
                            </span>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
