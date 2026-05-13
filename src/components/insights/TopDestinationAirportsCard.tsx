import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { formatPercent, type AirportStat, type AirportStatsResult } from "./airportHelpers";
import { type AirportDict } from "@/hooks/useAirportDictionary";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

function barColor(rate: number): string {
  if (rate <= 40) return "bg-green-100";
  if (rate <= 60) return "bg-green-300";
  if (rate <= 80) return "bg-green-500";
  return "bg-emerald-600";
}

interface Props {
  result?: AirportStatsResult;
  airportDict?: AirportDict;
}

const TopDestinationAirportsCard = ({ result, airportDict = {} }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const stats: AirportStat[] = result?.rows ?? [];
  const limited = result?.limitedData ?? false;

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      <div className={`flex items-center justify-between cursor-pointer ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}>
        <HugeiconsIcon icon={Location01Icon} size={28} color="#059669" strokeWidth={1.5} />
        <div className="flex-1 ml-2">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Top Destination Airports</p>
            {limited && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Limited data</span>}
          </div>
          <p className="text-xs text-[#6B7B7B]">By itinerary GoWild rate (≥{result?.threshold ?? 30} itineraries)</p>
        </div>
        <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>
      <div className={`grid transition-all duration-300 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {stats.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">No destination airport data yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.map((stat) => {
                const cityLabel = airportDict[stat.code]?.name ?? null;
                return (
                  <div key={stat.code}>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col leading-none">
                        <span className="text-3xl font-bold text-[#2E4A4A]">{stat.code}</span>
                        {cityLabel && <span className="text-[11px] text-[#9CA3AF] mt-0.5">{cityLabel}</span>}
                      </div>
                      <span className="text-3xl font-semibold text-green-600">{formatPercent(stat.goWildRate)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor(stat.goWildRate)}`}
                        style={{ width: `${Math.min(stat.goWildRate, 100)}%` }} />
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      {stat.goWildItineraries} / {stat.totalItineraries} itineraries
                      {stat.avgSeats !== null ? ` · avg ${stat.avgSeats.toFixed(1)} seats` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopDestinationAirportsCard;
