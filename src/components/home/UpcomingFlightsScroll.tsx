import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlane } from "@fortawesome/free-solid-svg-icons";
import airplaneIcon from "@/assets/airplane-icon.svg";

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

const FRONTIER_LOGO = "/assets/logo/frontier/frontier_logo.png";

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface Props {
  flights: UserFlight[];
  loading: boolean;
}

export function UpcomingFlightsScroll({ flights, loading }: Props) {
  return (
    <section className="px-5 pb-4 relative z-10">
      <h2 className="text-xs font-bold text-[#6B7B7B] uppercase tracking-widest mb-3 px-1">
        Upcoming Flights
        {!loading && (
          <span className="ml-1.5 font-medium normal-case tracking-normal">
            · {flights.length} {flights.length === 1 ? "flight" : "flights"}
          </span>
        )}
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
        {loading ? (
          [1, 2].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-52 rounded-2xl border border-[#e3e6e6] bg-white px-4 pt-3 pb-4 animate-pulse"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="h-3 w-24 rounded bg-[#e5e7eb] mb-3" />
              <div className="h-8 w-full rounded bg-[#e5e7eb] mb-2" />
              <div className="h-3 w-32 rounded bg-[#e5e7eb]" />
            </div>
          ))
        ) : flights.length === 0 ? (
          <div className="w-full text-center py-6 text-sm text-[#6B7B7B]">No upcoming flights scheduled.</div>
        ) : (
          flights.map((flight, i) => (
            <motion.div
              key={flight.id}
              custom={i}
              variants={itemVariants}
              initial="hidden"
              animate="show"
              className="flex-shrink-0 w-52 rounded-2xl border border-[#e3e6e6] bg-white px-4 pt-3 pb-4"
              style={{ scrollSnapAlign: "start" }}
            >
              {/* Airline logo row */}
              <div className="h-4 flex items-center gap-2 mb-3">
                <img
                  src={FRONTIER_LOGO}
                  alt="Frontier Airlines"
                  className="h-full w-auto object-contain"
                  loading="eager"
                />
                <span className="text-[10px] font-semibold text-[#2E4A4A] tracking-wide uppercase">
                  Frontier
                </span>
              </div>

              {/* IATA + separator */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-2xl font-bold text-[#1a2e2e] leading-none tracking-tight">
                  {flight.departure_airport}
                </span>

                <div className="flex-1 flex items-center px-1">
                  <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-30" />
                  <span className="mx-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full border border-[#e3e6e6] bg-[#F9FBFA] flex-shrink-0">
                    <img src={airplaneIcon} alt="flight" className="w-3.5 h-3.5 object-contain" />
                  </span>
                  <div className="flex-1 h-[1.5px] bg-[#2E4A4A] opacity-30" />
                </div>

                <span className="text-2xl font-bold text-[#1a2e2e] leading-none tracking-tight">
                  {flight.arrival_airport}
                </span>
              </div>

              {/* Times */}
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-[#059669] leading-tight">
                  <span className="block">{formatTime(flight.departure_time)}</span>
                  <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">
                    {formatFullDate(flight.departure_time)}
                  </span>
                </span>
                <span className="text-xs font-medium text-[#059669] text-right leading-tight">
                  <span className="block">{formatTime(flight.arrival_time)}</span>
                  <span className="block text-[10px] font-medium text-[#6B7B7B] mt-0.5">
                    {formatFullDate(flight.arrival_time)}
                  </span>
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </section>
  );
}
