import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsDownIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { formatPct, type RouteStatsResult } from "./routeHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

function barColor(rate: number): string {
  if (rate <= 20) return "bg-red-500";
  if (rate <= 40) return "bg-orange-400";
  if (rate <= 60) return "bg-amber-400";
  if (rate <= 80) return "bg-green-300";
  return "bg-green-500";
}

interface Props {
  result?: RouteStatsResult;
  routes?: any[];
}

const WorstRoutesCard = ({ result, routes }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const list = result?.rows ?? routes ?? [];
  const limited = result?.limitedData ?? false;
  return (
    <div className="rounded-2xl bg-white p-5 flex flex-col" style={{ boxShadow: CARD_SHADOW }}>
      <div className={`flex items-center justify-between cursor-pointer ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}>
        <HugeiconsIcon icon={AnalyticsDownIcon} size={28} color="#059669" strokeWidth={1.5} />
        <div className="flex-1 ml-2">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Worst 5 Routes</p>
            {limited && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Limited data</span>}
          </div>
          <p className="text-xs text-[#6B7B7B]">Lowest GoWild itinerary rate (≥{result?.threshold ?? 30} itineraries)</p>
        </div>
        <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>
      <div className={`grid transition-all duration-300 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {list.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">Not enough route data yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {list.map((r: any, i: number) => (
                <div key={r.route}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-[#9CA3AF] w-4">{i + 1}</span>
                      <span className="text-sm font-semibold text-[#2E4A4A] truncate">{r.route}</span>
                    </div>
                    <span className="text-sm font-bold text-[#9CA3AF] ml-2">{formatPct(r.goWildRate)}</span>
                  </div>
                  <div className="mt-1 ml-6 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor(r.goWildRate)}`}
                      style={{ width: `${Math.max(r.goWildRate, r.goWildRate === 0 ? 2 : 0)}%` }} />
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 ml-6">
                    {r.goWildItineraries ?? r.goWildLegs} / {r.totalItineraries ?? r.totalLegs} itineraries
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorstRoutesCard;
