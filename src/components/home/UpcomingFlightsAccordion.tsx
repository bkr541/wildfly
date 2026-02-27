import { useState, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

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

function formatDateLabel(createdAt: string) {
  try {
    const d = new Date(createdAt);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const EASE = [0.2, 0.8, 0.2, 1] as const;
const DURATION = 0.28;

interface Props {
  flights: UserFlight[];
  loading: boolean;
}

export function UpcomingFlightsAccordion({ flights, loading }: Props) {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const panelId = useId();
  const triggerId = useId();

  const chevronVariants = {
    collapsed: { rotate: 0 },
    expanded: { rotate: 180 },
  };

  return (
    <motion.div layout className="px-6 pb-4 relative z-10">
      <div className="rounded-2xl border border-[#e3e6e6] bg-white shadow-sm overflow-hidden">

        {/* Trigger header */}
        <button
          id={triggerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left px-4 py-3 group"
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

          {/* Collapsed preview rows */}
          <AnimatePresence initial={false}>
            {!open && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4, transition: { duration: 0.15, ease: EASE } }}
                className="mt-2.5 flex flex-col gap-1.5"
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
                  <p className="text-xs text-[#6B7B7B]">No upcoming flights scheduled.</p>
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

        {/* Expanded flight cards */}
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          aria-hidden={!open}
          style={{ overflow: "hidden" }}
        >
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="flights-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: "auto",
                  opacity: 1,
                  transition: {
                    height: { duration: shouldReduceMotion ? 0.12 : DURATION, ease: EASE },
                    opacity: { duration: shouldReduceMotion ? 0.12 : DURATION, ease: EASE },
                  },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: {
                    height: { duration: shouldReduceMotion ? 0.12 : DURATION, ease: EASE },
                    opacity: { duration: shouldReduceMotion ? 0.08 : 0.18, ease: EASE },
                  },
                }}
                style={{ overflow: "hidden" }}
              >
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } }}
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 6, transition: { duration: 0.15, ease: EASE } }}
                  className="flex flex-col gap-2 px-3 pb-3"
                >
                  {flights.length === 0 ? (
                    <div className="rounded-xl border border-[#e3e6e6] px-4 py-4 text-center">
                      <p className="text-sm text-[#6B7B7B]">No upcoming flights scheduled.</p>
                    </div>
                  ) : (
                    flights.map((flight) => {
                      const depTime = flight.departure_time;
                      const arrTime = flight.arrival_time;
                      const dateLabel = formatDateLabel(flight.created_at);
                      return (
                        <div
                          key={flight.id}
                          className="rounded-2xl border px-5 py-4"
                          style={{ background: "#F0FAF7", borderColor: "#05966922" }}
                        >
                          {/* Date badge */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#059669]">{dateLabel}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#d1fae5] text-[#059669] uppercase tracking-wide">{flight.type}</span>
                          </div>

                          {/* Route row */}
                          <div className="flex items-center gap-2">
                            {/* Departure */}
                            <div className="flex flex-col items-start flex-1">
                              <span className="text-[11px] text-[#6B7B7B] mb-0.5">{flight.departure_airport}</span>
                              <span className="text-3xl font-extrabold text-[#D97706] leading-none tracking-tight">{flight.departure_airport}</span>
                              <span className="text-[11px] text-[#4B6060] mt-1">{depTime}</span>
                            </div>

                            {/* Arc path */}
                            <div className="flex flex-col items-center flex-shrink-0 w-20 relative -mt-3">
                              <svg viewBox="0 0 80 36" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 30 Q40 2 76 30" stroke="#2E4A4A" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
                                {/* plane icon at midpoint */}
                                <g transform="translate(36, 10) rotate(-10)">
                                  <path d="M4 2 L0 6 L1.5 6 L3 4.5 L3 7.5 L4.5 7 L4.5 4.5 L6 6 L7.5 6 L3.5 2 Z" fill="#2E4A4A"/>
                                </g>
                              </svg>
                              {/* origin dot */}
                              <div className="absolute left-1 bottom-1 w-3.5 h-3.5 rounded-full bg-[#D97706] flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                              </div>
                              {/* dest dot */}
                              <div className="absolute right-1 bottom-1 w-3.5 h-3.5 rounded-full bg-[#07444a] flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                              </div>
                            </div>

                            {/* Arrival */}
                            <div className="flex flex-col items-end flex-1">
                              <span className="text-[11px] text-[#6B7B7B] mb-0.5">{flight.arrival_airport}</span>
                              <span className="text-3xl font-extrabold text-[#07444a] leading-none tracking-tight">{flight.arrival_airport}</span>
                              <span className="text-[11px] text-[#4B6060] mt-1">{arrTime}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
}
