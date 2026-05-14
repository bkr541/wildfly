import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { Itinerary } from "./insightTypes";
import { computeItinerarySnapshotMetrics } from "./itineraryHelpers";

export interface GoWildSnapshotCardProps {
  itineraries: Itinerary[];
}

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const DonutChart = ({
  displayValue,
  pct,
  label1,
  label2,
  gradientId,
}: {
  displayValue: string;
  pct: number;
  label1: string;
  label2: string;
  gradientId: string;
}) => {
  const size = 152;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(pct, 0), 100);
  const offset = circumference - (clampedPct / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
      {clampedPct > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="600" fill="#2E4A4A" fontFamily="inherit">
        {displayValue}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#9CA3AF" fontFamily="inherit">
        {label1}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#9CA3AF" fontFamily="inherit">
        {label2}
      </text>
    </svg>
  );
};

const GoWildSnapshotCard = ({ itineraries }: GoWildSnapshotCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { totalItineraries, goWildItineraries, availabilityRate, avgSeats, trend } =
    computeItinerarySnapshotMetrics(itineraries);

  const trendPositive = trend !== null && trend > 0;
  const trendNegative = trend !== null && trend < 0;
  const trendBg = trendPositive ? "bg-green-100" : trendNegative ? "bg-red-100" : "bg-gray-100";
  const trendColor = trendPositive ? "#16a34a" : trendNegative ? "#ef4444" : "#9ca3af";
  const trendTextClass = trendPositive ? "text-green-600" : trendNegative ? "text-red-500" : "text-gray-400";
  const trendLabel =
    trend === null
      ? "Not enough data"
      : trend === 0
      ? "No change vs last 7 days"
      : `${trend > 0 ? "+" : ""}${trend.toFixed(1)}% vs last 7 days`;

  const seatsPct = avgSeats === null ? 0 : Math.min((avgSeats / 30) * 100, 100);

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={Analytics01Icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">GoWild Snapshot</p>
          <p className="text-xs text-[#6B7B7B]">Live availability across tracked itineraries</p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="flex justify-around items-center">
            <DonutChart
              displayValue={availabilityRate === null ? "--" : availabilityRate.toFixed(1) + "%"}
              pct={availabilityRate ?? 0}
              label1="Avg GoWild"
              label2="Availability"
              gradientId="gwDonutGradient"
            />
            <DonutChart
              displayValue={avgSeats === null ? "--" : String(Math.round(avgSeats))}
              pct={seatsPct}
              label1="Avg Seats"
              label2="Available"
              gradientId="gwSeatsGradient"
            />
          </div>

          <p className="text-xs text-[#6B7B7B] mt-3 text-center">
            {goWildItineraries.toLocaleString()} / {totalItineraries.toLocaleString()} itineraries
          </p>

          <div className="border-t border-gray-100 mt-4 pt-3 flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${trendBg}`}>
              {trendNegative ? (
                <TrendingDown size={13} color={trendColor} />
              ) : (
                <TrendingUp size={13} color={trendColor} />
              )}
            </div>
            <span className={`text-sm font-semibold ${trendTextClass}`}>{trendLabel}</span>
          </div>

          <p className="text-[11px] text-[#9CA3AF] mt-3 leading-snug">
            Connecting itineraries count as GoWild-available only when every leg is GoWild-available. Seat availability uses the lowest seat count across the itinerary.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoWildSnapshotCard;
