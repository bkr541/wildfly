import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { TimingItineraryRow } from "./itineraryHelpers";

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
  title: string;
  subtitle: string;
  icon: any;
  rows: TimingItineraryRow[];
  limited?: boolean;
  emptyMessage?: string;
}

const RankedInsightCard = ({
  title,
  subtitle,
  icon,
  rows,
  limited = false,
  emptyMessage = "Not enough data yet.",
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className="rounded-2xl bg-white p-5 flex flex-col" style={{ boxShadow: CARD_SHADOW }}>
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">{title}</p>
            {limited && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Limited data
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7B7B]">{subtitle}</p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {rows.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">{emptyMessage}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#2E4A4A] truncate">{row.label}</span>
                    <span className="text-sm font-bold ml-2 flex-shrink-0 text-green-600">
                      {row.goWildRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor(row.goWildRate)}`}
                      style={{ width: `${row.goWildRate === 0 ? 2 : Math.min(row.goWildRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                    {row.goWildItineraries} / {row.totalItineraries} itineraries
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

export default RankedInsightCard;
