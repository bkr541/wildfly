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
              <div className="flex items-start justify-center gap-3 mb-4">
                <div className="flex flex-col items-center">
                  <span className="text-5xl font-black text-[#2E4A4A] leading-none tracking-tight">{route.origin}</span>
                </div>
                <svg fill="#059669" className="w-7 h-7 shrink-0 mt-2.5" viewBox="-3.2 -3.2 38.40 38.40" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z" />
                  <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z" />
                </svg>
                <div className="flex flex-col items-center">
                  <span className="text-5xl font-black text-[#2E4A4A] leading-none tracking-tight">{route.destination}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-xl px-3 py-2.5 flex flex-col">
                  <p className="text-[9px] font-semibold text-green-700 uppercase tracking-wider mb-1">GoWild Rate</p>
                  <p className="text-xl font-bold text-green-700 leading-none">{formatPct(route.goWildRate)}</p>
                </div>
                <div className="bg-green-50 rounded-xl px-3 py-2.5 flex flex-col">
                  <p className="text-[9px] font-semibold text-green-700 uppercase tracking-wider mb-1">GoWild Itineraries</p>
                  <p className="text-xl font-bold text-green-700 leading-none">{route.goWildItineraries}</p>
                </div>
                <div className="border border-gray-100 rounded-xl px-3 py-2.5 flex flex-col">
                  <p className="text-[9px] font-semibold text-[#6B7B7B] uppercase tracking-wider mb-1">Total Itineraries</p>
                  <p className="text-base font-bold text-[#2E4A4A] leading-none">{route.totalItineraries}</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">{route.goWildItineraries} GoWild matches</p>
                </div>
                <div className="border border-gray-100 rounded-xl px-3 py-2.5 flex flex-col">
                  <p className="text-[9px] font-semibold text-[#6B7B7B] uppercase tracking-wider mb-1">Avg GoWild Seats</p>
                  <p className="text-base font-bold text-[#2E4A4A] leading-none">{route.avgGoWildSeatsPerItinerary.toFixed(1)}</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">per itinerary</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MostFrequentGoWildRouteCard;
