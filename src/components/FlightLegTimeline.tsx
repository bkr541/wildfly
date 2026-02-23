import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWrench } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

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

function calcDuration(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (isNaN(start) || isNaN(end)) return "";
    const diffMin = Math.round((end - start) / 60000);
    if (diffMin < 0) return "";
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  } catch {
    return "";
  }
}

const FlightLegTimeline = ({ legs, airportMap }: FlightLegTimelineProps) => {
  return (
    <div className="pl-2 pr-1 py-2">
      {legs.map((leg, i) => {
        const depTime = formatTime(leg.departure_time);
        const arrTime = formatTime(leg.arrival_time);
        const legDuration = calcDuration(leg.departure_time, leg.arrival_time);
        const originName = airportMap[leg.origin]?.city ?? "";
        const destName = airportMap[leg.destination]?.city ?? "";

        // Layover between this leg's arrival and next leg's departure
        const nextLeg = legs[i + 1];
        const layoverDuration = nextLeg ? calcDuration(leg.arrival_time, nextLeg.departure_time) : null;

        return (
          <div key={i} className="flex flex-col">
            {/* Origin stop */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full border-2 border-[#5A9E8F] bg-white mt-1" />
                <div className="w-px flex-1 border-l-2 border-dashed border-[#C8CDCD] min-h-[28px]" />
              </div>
              <div className="flex-1 pb-1">
                <span className="text-sm font-semibold text-[#2E4A4A]">
                  {leg.origin} {depTime}
                </span>
                {originName && (
                  <p className="text-xs text-[#6B7B7B]">{originName}</p>
                )}
              </div>
            </div>

            {/* Leg duration */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[#C8CDCD] mt-1" />
                <div className="w-px flex-1 border-l-2 border-dashed border-[#C8CDCD] min-h-[20px]" />
              </div>
              <div className="pb-1">
                <span className="text-xs text-[#6B7B7B]">{legDuration}</span>
              </div>
            </div>

            {/* Destination stop */}
            {!nextLeg ? (
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full border-2 border-[#5A9E8F] bg-white mt-1" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-[#2E4A4A]">
                    {leg.destination} {arrTime}
                  </span>
                  {destName && (
                    <p className="text-xs text-[#6B7B7B]">{destName}</p>
                  )}
                </div>
              </div>
            ) : (
              /* Layover */
              <>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full border-2 border-[#E89830] bg-white mt-1" />
                    <div className="w-px flex-1 border-l-2 border-dashed border-[#C8CDCD] min-h-[20px]" />
                  </div>
                  <div className="flex-1 rounded-lg bg-[#F0F4F3] px-3 py-1.5 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#2E4A4A]">
                        Layover in {leg.destination}
                      </span>
                      <span className="text-xs text-[#6B7B7B]">· {layoverDuration}</span>
                      <FontAwesomeIcon icon={faWrench} className="w-3 h-3 text-[#6B7B7B] ml-auto" />
                    </div>
                  </div>
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
