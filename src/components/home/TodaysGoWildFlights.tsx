import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RefreshCw } from "lucide-react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AirplaneSeatIcon,
  Alert01Icon,
  ArrowRight04Icon,
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  Rocket01Icon,
  Search01Icon,
  SunCloud01Icon,
} from "@hugeicons/core-free-icons";
import { TicketDivider } from "./TicketDivider";
import { useTodaysGoWildFlights, type TodaysGoWildFlight } from "@/hooks/useTodaysGoWildFlights";

interface Props {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: (page: string) => void;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const CARD_STYLE = {
  background: "rgba(255,255,255,0.96)",
  boxShadow:
    "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
};

const PlaneSVG = ({ size = 22 }: { size?: number }) => (
  <svg
    aria-hidden="true"
    data-testid="flight-route-plane"
    fill="#2D6A4F"
    style={{ width: size, height: size, flexShrink: 0 }}
    viewBox="-3.2 -3.2 38.40 38.40"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z" />
    <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z" />
  </svg>
);

function money(value: number, currency: string) {
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
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function seatBadgeColor(availableSeats: number) {
  if (availableSeats > 10) return "#496F5D";
  if (availableSeats >= 5) return "#EE9F0B";
  return "#A01818";
}

function FlightCard({ flight, index }: { flight: TodaysGoWildFlight; index: number }) {
  const destination = [flight.destinationCity, flight.destinationState].filter(Boolean).join(", ");

  return (
    <motion.article
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.3, delay: index * 0.06, ease: EASE } }}
      className="relative flex-shrink-0 w-[256px] max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl"
      style={{ ...CARD_STYLE, scrollSnapAlign: "start" }}
    >
      <div className="relative px-3 pt-2 pb-[18px]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[12px] font-black uppercase tracking-[0.18em] text-[#059669]">
              {destination || flight.destinationIata}
            </span>
            {flight.flightNumber && (
              <span className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
                {flight.flightNumber}
              </span>
            )}
          </div>
          {flight.availableSeats != null && (
            <span
              aria-label={`${flight.availableSeats} GoWild seats available`}
              className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full px-2 text-[11px] font-bold text-white"
              style={{ background: seatBadgeColor(flight.availableSeats) }}
            >
              <HugeiconsIcon icon={AirplaneSeatIcon} size={12} color="#FFFFFF" strokeWidth={2.5} />
              {flight.availableSeats}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="text-2xl font-bold text-[#1A2E2E] leading-none tracking-tight">
            {flight.originIata}
          </span>
          <div className="flex-1 flex items-center px-1.5">
            <div className="flex-1 h-0 border-t border-dashed" style={{ borderColor: "#B8CECE" }} />
            <div className="mx-1.5">
              <PlaneSVG size={22} />
            </div>
            <div className="flex-1 h-0 border-t border-dashed" style={{ borderColor: "#B8CECE" }} />
          </div>
          <span className="text-2xl font-bold text-[#1A2E2E] leading-none tracking-tight">
            {flight.destinationIata}
          </span>
        </div>

        <div className="flex items-start justify-between">
          <span className="leading-tight">
            <span className="block text-xs font-medium text-[#059669]">{flight.departureTime}</span>
            <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">
              {ticketDate(flight.departureDate)}
            </span>
          </span>
          <span className="leading-tight text-right">
            <span className="block text-xs font-medium text-[#059669]">{flight.arrivalTime}</span>
            <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">
              {ticketDate(flight.arrivalDate)}
            </span>
          </span>
        </div>

        <TicketDivider notchSize={26} />

        <div className="flex items-center justify-center gap-1.5 flex-wrap" style={{ paddingTop: "10px" }}>
          <span
            className="inline-flex items-center gap-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{ background: "#059669", color: "#FFFFFF", height: "24px", padding: "0 10px" }}
          >
            <HugeiconsIcon icon={Rocket01Icon} size={11} color="white" strokeWidth={2.5} />
            GoWild
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{ background: "#1D4ED8", color: "#FFFFFF", height: "24px", padding: "0 10px" }}
          >
            <HugeiconsIcon icon={ArrowRight04Icon} size={11} color="#FFFFFF" strokeWidth={2.5} />
            One Way
          </span>
          {flight.goWildPrice != null && (
            <span
              className="inline-flex items-center rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{
                background: "#FFF4E0",
                border: "1.5px solid #F5C572",
                color: "#B45309",
                height: "24px",
                padding: "0 10px",
              }}
            >
              {money(flight.goWildPrice, flight.currency)}
            </span>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2 pointer-events-none bg-[#059669]" />
    </motion.article>
  );
}

function StateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: IconSvgElement;
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
            {feed.homeAirport && (
              <>
                {" From "}
                <span className="font-extrabold">{feed.homeAirport}</span>
              </>
            )}
          </h2>
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
