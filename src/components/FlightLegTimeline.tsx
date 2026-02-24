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
                <div className="w-3 h-3 rounded-full border-2 border-[#6B7B7B] bg-white" />
              </div>
              <span className="text-sm font-semibold text-[#2E4A4A]">
                {leg.origin} <span className="font-normal">{depTime}</span>
              </span>
            </div>

            {/* Flight leg line + label */}
            <div className="flex items-stretch gap-3 ml-[5px]">
              <div className="w-0.5 border-l-2 border-dashed border-[#C8CDCD] min-h-[28px]" />
              <span className="text-xs text-[#6B7B7B] py-1">
                Flight · {leg.origin} → {leg.destination}&nbsp;&nbsp;{legDuration}
              </span>
            </div>

            {/* Arrival / layover */}
            {!nextLeg ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full border-2 border-[#345C5A] bg-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#2E4A4A]">
                      {leg.destination} <span className="font-normal">{arrTime}</span>
                    </span>
                    {destCity && <span className="text-xs text-[#6B7B7B]">{destCity}</span>}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Connecting airport arrival */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full border-2 border-[#6B7B7B] bg-white" />
                  </div>
                  <span className="text-sm font-semibold text-[#2E4A4A]">
                    {leg.destination} <span className="font-normal">{arrTime}</span>
                  </span>
                </div>

                {/* Layover */}
                <div className="flex items-stretch gap-3 ml-[5px]">
                  <div className="w-0.5 border-l-2 border-dotted border-[#C8CDCD] min-h-[24px]" />
                  <span className="text-xs text-[#E89830] font-medium py-1">
                    Layover {layoverDuration}
                  </span>
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
