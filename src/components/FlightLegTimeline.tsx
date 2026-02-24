import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlaneDeparture, faPlaneArrival, faPlane } from "@fortawesome/free-solid-svg-icons";

interface Leg {
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
}

interface FlightLegTimelineProps {
  legs: Leg[];
  airportMap: Record<string, { city: string; stateCode: string }>;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}

/** Parse a time value (ISO or "H:MM AM/PM") to epoch ms, or NaN */
function parseToMs(raw: string): number {
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getTime();
  // Try "H:MM AM/PM"
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const base = new Date();
    base.setHours(h, min, 0, 0);
    return base.getTime();
  }
  return NaN;
}

function calcDuration(startRaw: string, endRaw: string): string {
  const start = parseToMs(startRaw);
  let end = parseToMs(endRaw);
  if (isNaN(start) || isNaN(end)) return "";
  // Handle overnight / +1 day
  if (end < start) end += 24 * 60 * 60 * 1000;
  const diffMin = Math.round((end - start) / 60000);
  if (diffMin < 0) return "";
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

const FlightLegTimeline = ({ legs, airportMap }: FlightLegTimelineProps) => {
  return (
    <div className="pl-2 pr-1 py-2 flex flex-col">
      {legs.map((leg, i) => {
        const depTime = formatTime(leg.departure_time);
        const arrTime = formatTime(leg.arrival_time);
        const legDuration = calcDuration(leg.departure_time, leg.arrival_time);
        const nextLeg = legs[i + 1];
        const layoverDuration = nextLeg ? calcDuration(leg.arrival_time, nextLeg.departure_time) : null;
        const destCity = airportMap[leg.destination]?.city ?? "";

        return (
          <div key={i} className="flex flex-col">
            {/* Departure stop */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                {i === 0 ? (
                  <FontAwesomeIcon icon={faPlaneDeparture} className="w-3 h-3 text-[#6B7B7B]" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#6B7B7B]" />
                )}
              </div>
              <span className="text-sm font-semibold text-[#2E4A4A]">
                {leg.origin} <span className="font-normal">{depTime}</span>
              </span>
            </div>

             {/* Flight leg line + duration in air */}
            <div className="flex items-center gap-3 ml-[5px]">
              <div className="w-0.5 border-l-2 border-dashed border-[#C8CDCD] min-h-[28px] self-stretch" />
              {legDuration && (
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs text-[#6B7B7B] font-medium">{legDuration}</span>
                  <span className="text-[#C8CDCD] text-xs">——</span>
                  <FontAwesomeIcon icon={faPlane} className="w-3 h-3 text-[#C8CDCD]" />
                </div>
              )}
            </div>

            {/* Arrival / layover */}
            {!nextLeg ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <FontAwesomeIcon icon={faPlaneArrival} className="w-3 h-3 text-[#345C5A]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#2E4A4A]">
                    {leg.destination} <span className="font-normal">{arrTime}</span>
                  </span>
                  {destCity && <span className="text-xs text-[#6B7B7B]">{destCity}</span>}
                </div>
              </div>
            ) : (
              <>
              {/* Connecting airport arrival */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#6B7B7B]" />
                  </div>
                  <span className="text-sm font-semibold text-[#2E4A4A]">
                    {leg.destination} <span className="font-normal">{arrTime}</span>
                  </span>
                </div>

                {/* Layover node */}
                <div className="flex items-stretch gap-3 ml-[5px]">
                  <div className="w-0.5 border-l-2 border-dotted border-[#C8CDCD] min-h-[10px]" />
                  <span className="py-0.5" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full border-2 border-[#E89830] bg-[#FFF7ED]" />
                  </div>
                  <span className="text-xs text-[#E89830] font-semibold">
                    Layover · {layoverDuration}
                  </span>
                </div>
                <div className="flex items-stretch gap-3 ml-[5px]">
                  <div className="w-0.5 border-l-2 border-dotted border-[#C8CDCD] min-h-[10px]" />
                  <span className="py-0.5" />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FlightLegTimeline;
