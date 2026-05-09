import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CrownIcon, AnalyticsUpIcon, AnalyticsDownIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { formatPct, type FrequentRoute } from "./routeHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const TREND_CONFIG = {
  up: { label: "Trending Up", color: "#059669", icon: AnalyticsUpIcon },
  down: { label: "Trending Down", color: "#EF4444", icon: AnalyticsDownIcon },
  stable: { label: "Stable", color: "#9CA3AF", icon: null },
} as const;

interface Props {
  data: FrequentRoute | null;
}

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-1.5 border-t border-gray-50">
    <span className="text-xs text-[#6B7B7B]">{label}</span>
    <span className="text-xs font-semibold text-[#2E4A4A]">{value}</span>
  </div>
);

const MostFrequentGoWildRouteCard = ({ data }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className="rounded-2xl bg-white p-5 flex flex-col" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={CrownIcon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Most Frequent GoWild</p>
          <p className="text-xs text-[#6B7B7B]">Most GoWild matches</p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
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
                <span className="text-3xl font-semibold text-green-600">{data.goWildMatches}</span>
                <p className="text-xs text-[#9CA3AF] mt-0.5">GoWild matches</p>
              </div>
              <div>
                <StatRow label="Seen in snapshot days" value={String(data.snapshotCount)} />
                <StatRow label="Current rate" value={formatPct(data.currentRate)} />
                <div className="flex items-center justify-between py-1.5 border-t border-gray-50">
                  <span className="text-xs text-[#6B7B7B]">Trending</span>
                  <div className="flex items-center gap-1">
                    {TREND_CONFIG[data.trend].icon && (
                      <HugeiconsIcon
                        icon={TREND_CONFIG[data.trend].icon!}
                        size={13}
                        color={TREND_CONFIG[data.trend].color}
                        strokeWidth={2}
                      />
                    )}
                    <span
                      className="text-xs font-semibold"
                      style={{ color: TREND_CONFIG[data.trend].color }}
                    >
                      {TREND_CONFIG[data.trend].label}
                    </span>
                  </div>
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
