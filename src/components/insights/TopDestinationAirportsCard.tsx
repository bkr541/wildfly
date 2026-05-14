import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import {
  getDestinationAirportStats,
  formatPercent,
  type FlightSnapshot,
} from "./airportHelpers";
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
  snapshots: FlightSnapshot[];
  airportDict?: AirportDict;
}

const TopDestinationAirportsCard = ({ snapshots, airportDict = {} }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const stats = getDestinationAirportStats(snapshots);

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={Location01Icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Top Destination Airports</p>
          <p className="text-xs text-[#6B7B7B]">Highest arrival GoWild rate</p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      {/* Collapsible body */}
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {stats.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">No destination airport data yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.map((stat) => {
                const info = airportDict[stat.code];
                const cityLabel = info?.name ?? null;
                return (
                  <div key={stat.code}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col leading-none">
                          <span className="text-3xl font-bold text-[#2E4A4A]">{stat.code}</span>
                          {cityLabel && (
                            <span className="text-[11px] text-[#9CA3AF] mt-0.5">{cityLabel}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-3xl font-semibold text-green-600">
                        {formatPercent(stat.goWildRate)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(stat.goWildRate)}`}
                        style={{ width: `${Math.min(stat.goWildRate, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      {stat.goWildLegs} / {stat.totalLegs} legs
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
