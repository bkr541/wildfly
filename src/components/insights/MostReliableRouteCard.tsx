import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Medal01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { formatPct, type ReliableRoute } from "./routeHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

interface Props {
  data: ReliableRoute | null;
}

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-1.5 border-t border-gray-50">
    <span className="text-xs text-[#6B7B7B]">{label}</span>
    <span className="text-xs font-semibold text-[#2E4A4A]">{value}</span>
  </div>
);

const MostReliableRouteCard = ({ data }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className="rounded-2xl bg-white p-5 flex flex-col" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className={`flex items-start justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <HugeiconsIcon icon={Medal01Icon} size={20} color="#059669" strokeWidth={2} />
            <p className="text-xl font-semibold text-[#059669] uppercase tracking-wider">Most Reliable Route</p>
          </div>
          <p className="text-sm text-[#6B7B7B]">Low variance</p>
        </div>
        <div className={`flex-shrink-0 mt-1 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={18} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      {/* Collapsible body */}
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {!data ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">
              Not enough route data yet. Search more GoWild flights to build route insights.
            </p>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-2xl font-bold text-[#2E4A4A] leading-tight">{data.route}</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-3xl font-semibold text-green-600">{data.consistencyScore}</span>
                  <span className="text-sm text-[#6B7B7B]">/ 100</span>
                </div>
                <p className="text-xs text-[#9CA3AF]">Consistency score</p>
                {data.limitedData && (
                  <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    Limited data
                  </span>
                )}
              </div>
              <div>
                <StatRow label="GoWild rate" value={formatPct(data.goWildRate)} />
                <StatRow label="Variance" value={`±${data.variance.toFixed(1)}%`} />
                <StatRow label="Snapshot days" value={String(data.snapshotCount)} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MostReliableRouteCard;
