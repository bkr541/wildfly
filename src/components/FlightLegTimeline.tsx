import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlaneDeparture, faPlaneArrival } from "@fortawesome/free-solid-svg-icons";

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
  if (end < start) end += 24 * 60 * 60 * 1000;
  const diffMin = Math.round((end - start) / 60000);
  if (diffMin < 0) return "";
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

// Fixed-width icon column: 20px. All rows share this width so the text
// column always starts at the same horizontal position.
const ICON_COL = "w-5 flex-shrink-0 flex items-center justify-center";
const TEXT_GAP = "gap-3"; // gap between icon col and text col

const FlightLegTimeline = ({ legs, airportMap }: FlightLegTimelineProps) => {
  return (
    <div className="pl-3 pr-2 py-1.5 flex flex-col">
      {legs.map((leg, i) => {
        const depTime = formatTime(leg.departure_time);
        const arrTime = formatTime(leg.arrival_time);
        const legDuration = calcDuration(leg.departure_time, leg.arrival_time);
        const nextLeg = legs[i + 1];
        const layoverDuration = nextLeg ? calcDuration(leg.arrival_time, nextLeg.departure_time) : null;
        const destCity = airportMap[leg.destination]?.city ?? "";
        const originCity = airportMap[leg.origin]?.city ?? "";

        return (
          <div key={i} className="flex flex-col">
            {/* Departure stop */}
            <div className={`flex items-center ${TEXT_GAP}`}>
              <div className={ICON_COL}>
                {i === 0 ? (
                  <FontAwesomeIcon icon={faPlaneDeparture} className="w-4 h-4 text-[#6B7B7B]" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-[#6B7B7B]" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold text-[#2E4A4A]">
                  {leg.origin} <span className="font-normal">{depTime}</span>
                </span>
                {originCity && <span className="text-[10px] text-[#6B7B7B]">{originCity}</span>}
              </div>
            </div>

            {/* Flight leg vertical line + duration */}
            <div className={`flex items-stretch ${TEXT_GAP}`}>
              <div className={`${ICON_COL} self-stretch`}>
                <div className="w-0.5 border-l-2 border-dashed border-[#C8CDCD] min-h-[22px] self-stretch" />
              </div>
              {legDuration && (
                <div className="flex items-center py-0.5">
                  <span className="text-[10px] text-[#6B7B7B] font-medium">{legDuration}</span>
                </div>
              )}
            </div>

            {/* Arrival / layover */}
            {!nextLeg ? (
              /* Final arrival */
              <div className={`flex items-center ${TEXT_GAP}`}>
                <div className={ICON_COL}>
                  <FontAwesomeIcon icon={faPlaneArrival} className="w-4 h-4 text-[#345C5A]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-semibold text-[#2E4A4A]">
                    {leg.destination} <span className="font-normal">{arrTime}</span>
                  </span>
                  {destCity && <span className="text-[10px] text-[#6B7B7B]">{destCity}</span>}
                </div>
              </div>
            ) : (
              <>
                {/* Connecting airport arrival */}
                <div className={`flex items-center ${TEXT_GAP}`}>
                  <div className={ICON_COL}>
                    <div className="w-2 h-2 rounded-full bg-[#6B7B7B]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold text-[#2E4A4A]">
                      {leg.destination} <span className="font-normal">{arrTime}</span>
                    </span>
                    {airportMap[leg.destination]?.city && (
                      <span className="text-[10px] text-[#6B7B7B]">{airportMap[leg.destination].city}</span>
                    )}
                  </div>
                </div>

                {/* Dotted line to layover */}
                <div className={`flex items-stretch ${TEXT_GAP}`}>
                  <div className={`${ICON_COL} self-stretch`}>
                    <div className="w-0.5 border-l-2 border-dotted border-[#C8CDCD] min-h-[8px] self-stretch" />
                  </div>
                  <span className="py-0.5" />
                </div>

                {/* Layover node */}
                <div className={`flex items-center ${TEXT_GAP}`}>
                  <div className={ICON_COL}>
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-[#E89830] bg-[#FFF7ED]" />
                  </div>
                  <span className="text-[10px] text-[#E89830] font-semibold">
                    Layover · {layoverDuration}
                  </span>
                </div>

                {/* Dotted line from layover */}
                <div className={`flex items-stretch ${TEXT_GAP}`}>
                  <div className={`${ICON_COL} self-stretch`}>
                    <div className="w-0.5 border-l-2 border-dotted border-[#C8CDCD] min-h-[8px] self-stretch" />
                  </div>
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
