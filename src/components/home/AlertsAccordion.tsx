import { useState, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, CheckmarkCircle01Icon, Alert01Icon, Airplane01Icon } from "@hugeicons/core-free-icons";

const MOCK_ALERTS = [
  {
    type: "sale",
    title: "Go Wild sale ends soon",
    body: "Book by Sunday to lock in $49 fares to Bozeman & Missoula.",
    time: "2h ago",
  },
  {
    type: "route",
    title: "New route: ORD → BZN",
    body: "Frontier just added daily nonstops from Chicago starting June 1.",
    time: "Yesterday",
  },
  {
    type: "deal",
    title: "Flash deal: ORD → DEN",
    body: "Round-trip from $79. Only 12 seats left.",
    time: "3d ago",
  },
];

const ALERT_CONFIG = {
  sale:  { Icon: Alert01Icon,          iconColor: "#D97706", dotColor: "#D97706" },
  route: { Icon: Airplane01Icon,       iconColor: "#059669", dotColor: "#059669" },
  deal:  { Icon: CheckmarkCircle01Icon, iconColor: "#3B82F6", dotColor: "#3B82F6" },
};

const EASE = [0.2, 0.8, 0.2, 1] as const;
const DURATION = 0.28;

export function AlertsAccordion() {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const panelId = useId();
  const triggerId = useId();

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
              Alerts
              <span className="ml-2 text-xs font-medium text-[#6B7B7B] normal-case tracking-normal">
                {MOCK_ALERTS.length} new
              </span>
            </h2>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: shouldReduceMotion ? 0.1 : DURATION, ease: EASE }}
              className="text-[#6B7B7B] group-hover:text-[#2E4A4A] transition-colors"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="currentColor" strokeWidth={1.5} />
            </motion.span>
          </div>

          {/* Collapsed summary */}
          <AnimatePresence initial={false}>
            {!open && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4, transition: { duration: 0.15, ease: EASE } }}
                className="mt-2.5 flex flex-col gap-1.5"
              >
                {MOCK_ALERTS.map((alert, i) => {
                  const cfg = ALERT_CONFIG[alert.type as keyof typeof ALERT_CONFIG];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dotColor }} />
                      <span className="text-xs text-[#345C5A] truncate flex-1">{alert.title}</span>
                      <span className="text-[10px] text-[#6B7B7B] whitespace-nowrap">{alert.time}</span>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Expanded alert cards */}
        <div id={panelId} role="region" aria-labelledby={triggerId} aria-hidden={!open} style={{ overflow: "hidden" }}>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="alerts-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { height: { duration: shouldReduceMotion ? 0.12 : DURATION, ease: EASE }, opacity: { duration: shouldReduceMotion ? 0.12 : DURATION, ease: EASE } } }}
                exit={{ height: 0, opacity: 0, transition: { height: { duration: shouldReduceMotion ? 0.12 : DURATION, ease: EASE }, opacity: { duration: shouldReduceMotion ? 0.08 : 0.18, ease: EASE } } }}
                style={{ overflow: "hidden" }}
              >
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } }}
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 6, transition: { duration: 0.15, ease: EASE } }}
                  className="flex flex-col px-3 pb-3"
                >
                  {MOCK_ALERTS.map((alert, i) => {
                    const cfg = ALERT_CONFIG[alert.type as keyof typeof ALERT_CONFIG];
                    const isLast = i === MOCK_ALERTS.length - 1;
                    return (
                      <div key={i} className={`flex items-start gap-3 px-1 py-3 ${!isLast ? "border-b border-[#f0f0f0]" : ""}`}>
                        {/* Icon circle */}
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#f5f5f5] flex items-center justify-center mt-0.5">
                          <HugeiconsIcon icon={cfg.Icon} size={18} color={cfg.iconColor} strokeWidth={1.5} />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[#1a2e2e]">{alert.title}</p>
                            <span className="text-[11px] text-[#9CA3AF] whitespace-nowrap">{alert.time}</span>
                          </div>
                          <p className="text-xs text-[#6B7B7B] mt-0.5 leading-snug">{alert.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
}
