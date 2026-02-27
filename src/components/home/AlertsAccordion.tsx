import { useState, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

const MOCK_ALERTS = [
  {
    icon: "🔥",
    title: "Go Wild sale ends soon",
    body: "Book by Sunday to lock in $49 fares to Bozeman & Missoula.",
    time: "2h ago",
    color: "#FEF3C7",
    accent: "#D97706",
  },
  {
    icon: "✈️",
    title: "New route: ORD → BZN",
    body: "Frontier just added daily nonstops from Chicago starting June 1.",
    time: "Yesterday",
    color: "#ECFDF5",
    accent: "#059669",
  },
  {
    icon: "⚡",
    title: "Flash deal: ORD → DEN",
    body: "Round-trip from $79. Only 12 seats left.",
    time: "3d ago",
    color: "#EFF6FF",
    accent: "#3B82F6",
  },
];

const EASE = [0.2, 0.8, 0.2, 1] as const;
const DURATION = 0.28;

export function AlertsAccordion() {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const panelId = useId();
  const triggerId = useId();

  const chevronVariants = {
    collapsed: { rotate: 0 },
    expanded: { rotate: 180 },
  };

  return (
    <motion.div layout className="px-[18px] pb-4 relative z-10">
      {/* Unified white card — grows to contain expanded cards */}
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
              Alerts
              <span className="ml-2 text-xs font-medium text-[#6B7B7B] normal-case tracking-normal">
                {MOCK_ALERTS.length} new
              </span>
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

          {/* Collapsed summary rows — fade out when opening */}
          <AnimatePresence initial={false}>
            {!open && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4, transition: { duration: 0.15, ease: EASE } }}
                className="mt-2.5 flex flex-col gap-1.5"
              >
                {MOCK_ALERTS.map((alert, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: alert.accent }}
                    />
                    <span className="text-xs text-[#345C5A] truncate flex-1">{alert.title}</span>
                    <span className="text-[10px] text-[#6B7B7B] whitespace-nowrap">{alert.time}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Expanding alert cards — inside the same white card */}
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
                key="alerts-panel"
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
                  {MOCK_ALERTS.map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border px-4 py-3"
                      style={{ background: alert.color, borderColor: alert.accent + "33" }}
                    >
                      <span className="text-xl mt-0.5">{alert.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#1a2e2e]">{alert.title}</p>
                          <span className="text-[10px] text-[#6B7B7B] whitespace-nowrap">{alert.time}</span>
                        </div>
                        <p className="text-xs text-[#345C5A] mt-0.5 leading-snug">{alert.body}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
}
