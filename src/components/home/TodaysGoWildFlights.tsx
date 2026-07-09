import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RefreshCw } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Airplane01Icon,
  Alert01Icon,
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  Search01Icon,
  SunCloud01Icon,
} from "@hugeicons/core-free-icons";
import { useTodaysGoWildFlights, type TodaysGoWildFlight } from "@/hooks/useTodaysGoWildFlights";

interface Props {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: (page: string) => void;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const CARD_STYLE = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow:
    "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
};

function money(value: number | null, currency: string) {
  if (value == null) return "GoWild";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function ticketDate(value?: string) {
  if (!value) return "Today";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function FlightCard({ flight, index }: { flight: TodaysGoWildFlight; index: number }) {
  const destination = [flight.destinationCity, flight.destinationState].filter(Boolean).join(", ");
  const stops = flight.stops == null ? null : Number(flight.stops);
  const nonstop = stops === 0;
  const stopLabel = stops == null ? "Stops —" : nonstop ? "Nonstop" : `${stops} stop${stops === 1 ? "" : "s"}`;
  const tripBadge = flight.flightType || "One Way";

  return (
    <motion.article
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.3, delay: index * 0.06, ease: EASE } }}
      className="relative flex-shrink-0 w-[360px] sm:w-[390px] max-w-[calc(100vw-48px)] overflow-hidden rounded-[22px] bg-white"
      style={{ ...CARD_STYLE, scrollSnapAlign: "start" }}
    >
      <div className="absolute -left-[18px] top-[122px] h-9 w-9 rounded-full bg-[#DDEAE7] border border-[#D3E2DF] z-20" />
      <div className="absolute -right-[18px] top-[122px] h-9 w-9 rounded-full bg-[#DDEAE7] border border-[#D3E2DF] z-20" />

      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#059669] truncate">
              {destination || flight.destinationIata}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[34px] font-black leading-none tracking-tight text-[#1A2E2E]">
                {flight.originIata}
              </span>
              <div className="flex items-center min-w-[76px] flex-1 pb-2.5">
                <span className="h-px flex-1 border-t border-dashed border-[#B8CECE]" />
                <HugeiconsIcon icon={Airplane01Icon} size={21} color="#2F665F" strokeWidth={2.5} className="mx-2" />
                <span className="h-px flex-1 border-t border-dashed border-[#B8CECE]" />
              </div>
              <span className="text-[34px] font-black leading-none tracking-tight text-[#1A2E2E]">
                {flight.destinationIata}
              </span>
            </div>
          </div>
          {flight.flightNumber && (
            <span className="mt-8 text-[11px] font-black text-[#6B7280] whitespace-nowrap">
              {flight.flightNumber}
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <div className="min-w-0">
            <p className="text-[20px] font-black leading-none text-[#059669]">{flight.departureTime}</p>
            <p className="mt-1 text-[12px] font-semibold text-[#7B8C8C]">{ticketDate(flight.departureDate)}</p>
          </div>
          <div className="mt-2 flex h-8 items-center justify-center text-[#2F665F]">
            <HugeiconsIcon icon={Airplane01Icon} size={20} color="currentColor" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[20px] font-black leading-none text-[#059669]">{flight.arrivalTime}</p>
            <p className="mt-1 text-[12px] font-semibold text-[#7B8C8C]">{ticketDate(flight.arrivalDate)}</p>
          </div>
        </div>
      </div>

      <div className="relative border-t border-dashed border-[#B8CECE] px-5 py-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex h-9 items-center rounded-full bg-[#1D4ED8] px-4 text-[14px] font-black text-white shadow-[0_4px_10px_rgba(29,78,216,0.20)]">
            → {tripBadge}
          </span>
          <span className="inline-flex h-9 items-center gap-1 rounded-full bg-[#059669] px-4 text-[14px] font-black text-white shadow-[0_4px_10px_rgba(5,150,105,0.20)]">
            <HugeiconsIcon icon={SunCloud01Icon} size={14} color="white" strokeWidth={2.3} />
            {money(flight.goWildPrice, flight.currency)}
          </span>
          <span className="inline-flex h-9 items-center rounded-full border border-[#A7D8CB] bg-white px-3 text-[12px] font-black text-[#2F665F]">
            {stopLabel}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#6B7B7B]">
          {flight.duration && <span>{flight.duration}</span>}
          {flight.availableSeats != null && <span>{flight.availableSeats} seats seen</span>}
        </div>
      </div>
      <div className="h-1.5 bg-[#059669]" />
    </motion.article>
  );
}

function StateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl px-4 py-4 flex items-center gap-3" style={CARD_STYLE}>
      <div className="h-11 w-11 rounded-full bg-[#E6F7F2] flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={icon} size={20} color="#059669" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1A2E2E]">{title}</p>
        <p className="text-xs text-[#7B8C8C] mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function TodaysGoWildFlights({ isCollapsed = false, onToggle, onNavigate }: Props) {
  const { feed, loading, error, refetch } = useTodaysGoWildFlights();
  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => event.key === "Enter" && onToggle?.()}
        className="w-full flex items-center justify-between mb-1 px-1 group cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <HugeiconsIcon icon={SunCloud01Icon} size={13} color="#059669" strokeWidth={2} />
          <h2 className="text-xs font-semibold text-[#059669] uppercase tracking-wider truncate">
            Today's GoWild
          </h2>
          {feed.homeAirport && (
            <span className="text-[10px] font-bold text-[#7B8C8C] bg-white/70 rounded-full px-2 py-0.5">
              From {feed.homeAirport}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isCollapsed && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void refetch();
              }}
              aria-label="Refresh Today's GoWild"
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/80 transition-colors"
            >
              <RefreshCw size={13} className="text-[#6B7B7B]" />
            </button>
          )}
          <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
            <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="todays-gowild-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "visible" }}
          >
            {loading ? (
              <div className="rounded-2xl p-4 animate-pulse" style={CARD_STYLE}>
                <div className="h-3 w-32 rounded bg-[#E5EAEA] mb-3" />
                <div className="h-16 rounded-xl bg-[#EEF2F2]" />
              </div>
            ) : error ? (
              <StateCard
                icon={Alert01Icon}
                title="Today's inventory could not load"
                description={error}
                action={(
                  <button type="button" onClick={() => void refetch()} className="text-xs font-bold text-[#059669]">
                    Retry
                  </button>
                )}
              />
            ) : feed.status === "home_airport_missing" ? (
              <StateCard
                icon={Location01Icon}
                title="Choose your home airport"
                description="Add a home airport to see today's GoWild departures automatically."
                action={(
                  <button type="button" onClick={() => onNavigate?.("account")} className="text-xs font-bold text-[#059669]">
                    Set up
                  </button>
                )}
              />
            ) : feed.status === "timezone_missing" ? (
              <StateCard
                icon={Alert01Icon}
                title="Airport timezone is unavailable"
                description="Wildfly needs timezone metadata for this home airport before it can build today's feed."
              />
            ) : ["processing", "not_ready"].includes(feed.status) ? (
              <StateCard
                icon={Clock01Icon}
                title="Today's flights are still landing"
                description={`The nightly search for ${feed.homeAirport ?? "your airport"} is processing. This card refreshes automatically.`}
              />
            ) : feed.status === "job_failed" ? (
              <StateCard
                icon={Alert01Icon}
                title="The nightly airport search needs attention"
                description="No current inventory was published for this airport. Try again shortly or run a live search."
                action={(
                  <button type="button" onClick={() => onNavigate?.("flights")} className="text-xs font-bold text-[#059669]">
                    Search
                  </button>
                )}
              />
            ) : feed.flights.length === 0 ? (
              <StateCard
                icon={Calendar03Icon}
                title="No GoWild flights found today"
                description={`The latest scheduled scan from ${feed.homeAirport ?? "your home airport"} did not return an available GoWild fare.`}
                action={(
                  <button type="button" onClick={() => onNavigate?.("flights")} className="flex items-center gap-1 text-xs font-bold text-[#059669]">
                    <HugeiconsIcon icon={Search01Icon} size={13} color="#059669" strokeWidth={2} /> Live search
                  </button>
                )}
              />
            ) : (
              <div className="overflow-x-auto scrollbar-hide" style={{ margin: "0 -20px" }}>
                <div className="flex gap-3" style={{ padding: "2px 20px 5px", scrollSnapType: "x mandatory" }}>
                  {feed.flights.map((flight, index) => (
                    <FlightCard key={`${flight.itineraryKey}-${flight.id}`} flight={flight} index={index} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
