import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { Itinerary } from "./insightTypes";
import {
  computeGoWildSnapshotMetrics,
  type GoWildSnapshotPeriod,
} from "./itineraryHelpers";

export interface GoWildSnapshotCardProps {
  itineraries: Itinerary[];
  period: GoWildSnapshotPeriod;
}

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const PERIOD_LABEL: Record<GoWildSnapshotPeriod, string> = {
  "24h": "prior 24h",
  "7d":  "prior 7 days",
  "30d": "prior 30 days",
  "all": "prior period",
};

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

type TooltipPayloadItem = {
  payload?: {
    bucketLabel: string;
    totalItineraries: number;
    goWildAvailableItineraries: number;
    goWildAvailabilityRate: number | null;
  };
};

const ChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) => {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) return null;
  const p = payload[0].payload;
  if (p.goWildAvailabilityRate === null) return null;
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-lg border border-gray-100 text-xs">
      <p className="font-semibold text-[#2E4A4A] mb-0.5">{p.bucketLabel}</p>
      <p className="text-[#059669]">
        GoWild Availability: {p.goWildAvailabilityRate.toFixed(1)}%
      </p>
      <p className="text-gray-500 mt-0.5">
        {p.goWildAvailableItineraries} GoWild / {p.totalItineraries} total itineraries
      </p>
    </div>
  );
};

const GoWildSnapshotCard = ({ itineraries, period }: GoWildSnapshotCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const metrics = useMemo(
    () => computeGoWildSnapshotMetrics(itineraries, period),
    [itineraries, period],
  );

  const {
    totalItineraries,
    goWildAvailableItineraries,
    goWildAvailabilityRate,
    avgGoWildSeatsPerItinerary,
    trendPercentagePoints,
    trendDirection,
    trendData,
  } = metrics;

  const hasData = totalItineraries > 0;

  // Visual fill for seats donut: scale relative to 30 seats max.
  const seatsPct = Math.min((avgGoWildSeatsPerItinerary / 30) * 100, 100);

  // Trend pill styling
  const trendStyles = {
    up:          { bg: "bg-green-100",  color: "#16a34a",  text: "text-green-600",  Icon: TrendingUp },
    down:        { bg: "bg-red-100",    color: "#ef4444",  text: "text-red-500",    Icon: TrendingDown },
    flat:        { bg: "bg-gray-100",   color: "#6b7280",  text: "text-gray-500",   Icon: Minus },
    unavailable: { bg: "bg-gray-100",   color: "#9ca3af",  text: "text-gray-400",   Icon: Minus },
  }[trendDirection];

  const trendLabel = (() => {
    if (trendDirection === "unavailable" || trendPercentagePoints === null) {
      return "Not enough prior data";
    }
    if (trendDirection === "flat") return `No change vs ${PERIOD_LABEL[period]}`;
    const sign = trendPercentagePoints > 0 ? "+" : "";
    return `${sign}${trendPercentagePoints.toFixed(1)} pts vs ${PERIOD_LABEL[period]}`;
  })();

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={Analytics01Icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">GoWild Snapshot</p>
          <p className="text-xs text-[#6B7B7B]">Availability across all complete itineraries</p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="flex justify-around items-center flex-wrap gap-y-3">
            <DonutChart
              displayValue={!hasData ? "--" : goWildAvailabilityRate.toFixed(1) + "%"}
              pct={goWildAvailabilityRate}
              label1="GoWild"
              label2="Availability"
              gradientId="gwDonutGradient"
            />
            <DonutChart
              displayValue={!hasData ? "--" : avgGoWildSeatsPerItinerary.toFixed(1)}
              pct={seatsPct}
              label1="Avg GoWild Seats"
              label2="per Itinerary"
              gradientId="gwSeatsGradient"
            />
          </div>

          <p className="text-xs text-[#6B7B7B] mt-3 text-center">
            {goWildAvailableItineraries.toLocaleString()} GoWild / {totalItineraries.toLocaleString()} total itineraries
          </p>

          {/* Trend graph */}
          <div className="mt-4 -mx-1" style={{ width: "calc(100% + 0.5rem)", height: 160 }}>
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No itinerary observations in this period yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gwTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a8a" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="bucketLabel"
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    width={36}
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="goWildAvailabilityRate"
                    stroke="#1e3a8a"
                    strokeWidth={2}
                    fill="url(#gwTrendFill)"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="border-t border-gray-100 mt-3 pt-3 flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${trendStyles.bg}`}>
              <trendStyles.Icon size={13} color={trendStyles.color} />
            </div>
            <span className={`text-sm font-semibold ${trendStyles.text}`}>{trendLabel}</span>
          </div>

          <p className="text-[11px] text-[#9CA3AF] mt-3 leading-snug">
            Availability is calculated from every complete itinerary in the period. Connecting itineraries count once and are GoWild-available only when every leg is. Average seats uses the bottleneck (lowest) seat count; non-available itineraries contribute zero.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoWildSnapshotCard;
