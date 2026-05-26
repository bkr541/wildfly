import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CrownIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { MostFrequentGoWildResult } from "./itineraryHelpers";
import { formatPct } from "./routeHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

interface Props {
  data: MostFrequentGoWildResult;
}

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-1.5 border-t border-gray-50">
    <span className="text-xs text-[#6B7B7B]">{label}</span>
    <span className="text-xs font-semibold text-[#2E4A4A]">{value}</span>
  </div>
);

const MostFrequentGoWildRouteCard = ({ data }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const route = data?.route ?? null;
  const limited = data?.limited ?? false;

  return (
    <div className="rounded-2xl bg-white p-5 flex flex-col" style={{ boxShadow: CARD_SHADOW }}>
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={CrownIcon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Most Frequent GoWild</p>
            {limited && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Limited data
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7B7B]">
            Route with the highest GoWild frequency across all observed itineraries in the selected period
          </p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {!route ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">
              Not enough route data yet. Search more GoWild flights to build route insights.
            </p>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-2xl font-bold text-[#2E4A4A] leading-tight">{route.route}</p>
                <span className="text-3xl font-semibold text-green-600">{formatPct(route.goWildRate)}</span>
                <p className="text-xs text-[#9CA3AF] mt-0.5">GoWild frequency</p>
              </div>
              <div>
                <StatRow
                  label="Itineraries observed"
                  value={`${route.goWildItineraries} GoWild / ${route.totalItineraries} total itineraries`}
                />
                <StatRow label="GoWild matches" value={String(route.goWildItineraries)} />
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-3 leading-snug">
                GoWild Frequency is calculated as GoWild-available complete itineraries divided by all complete itineraries observed for this route. Raw match count is used only as a tie-breaker.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MostFrequentGoWildRouteCard;
