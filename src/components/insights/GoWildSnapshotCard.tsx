import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

export type FlightSnapshot = {
  id: string;
  snapshot_at: string;
  departure_at: string;
  leg_origin_iata: string;
  leg_destination_iata: string;
  has_go_wild: boolean;
  go_wild_available_seats: number | null;
};

export interface GoWildSnapshotCardProps {
  snapshots: FlightSnapshot[];
}

function computeAvailabilityRate(snapshots: FlightSnapshot[]): number | null {
  if (snapshots.length === 0) return null;
  return (snapshots.filter((s) => s.has_go_wild).length / snapshots.length) * 100;
}

function formatRate(rate: number | null): string {
  if (rate === null) return "--";
  return rate.toFixed(1) + "%";
}

function computeAvgSeats(snapshots: FlightSnapshot[]): number | null {
  const qualifying = snapshots.filter(
    (s) => s.has_go_wild && s.go_wild_available_seats !== null
  );
  if (qualifying.length === 0) return null;
  const total = qualifying.reduce((sum, s) => sum + (s.go_wild_available_seats as number), 0);
  return total / qualifying.length;
}

function computeChange(snapshots: FlightSnapshot[]): number | null {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const current: FlightSnapshot[] = [];
  const previous: FlightSnapshot[] = [];

  for (const s of snapshots) {
    const t = new Date(s.snapshot_at).getTime();
    if (isNaN(t)) continue;
    const age = now - t;
    if (age >= 0 && age < sevenDaysMs) current.push(s);
    else if (age >= sevenDaysMs && age < 2 * sevenDaysMs) previous.push(s);
  }

  if (current.length === 0 || previous.length === 0) return null;

  const currentRate = computeAvailabilityRate(current);
  const previousRate = computeAvailabilityRate(previous);
  if (currentRate === null || previousRate === null) return null;
  return currentRate - previousRate;
}

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const DonutChart = ({ rate }: { rate: number | null }) => {
  const size = 200;
  const strokeWidth = 17;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(rate ?? 0, 0), 100);
  const offset = circumference - (pct / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="gwDonutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      {/* Background track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#F3F4F6"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      {pct > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="url(#gwDonutGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {/* Percentage text */}
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="32"
        fontWeight="600"
        fill="#2E4A4A"
        fontFamily="inherit"
      >
        {formatRate(rate)}
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fill="#9CA3AF"
        fontFamily="inherit"
      >
        Avg GoWild
      </text>
      <text
        x={cx}
        y={cy + 36}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fill="#9CA3AF"
        fontFamily="inherit"
      >
        Availability
      </text>
    </svg>
  );
};

const GoWildSnapshotCard = ({ snapshots }: GoWildSnapshotCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const rate = computeAvailabilityRate(snapshots);
  const availableLegs = snapshots.filter((s) => s.has_go_wild).length;
  const totalLegs = snapshots.length;
  const avgSeats = computeAvgSeats(snapshots);
  const change = computeChange(snapshots);

  const trendPositive = change !== null && change > 0;
  const trendNegative = change !== null && change < 0;

  const trendBg = trendPositive ? "bg-green-100" : trendNegative ? "bg-red-100" : "bg-gray-100";
  const trendColor = trendPositive ? "#16a34a" : trendNegative ? "#ef4444" : "#9ca3af";
  const trendTextClass = trendPositive ? "text-green-600" : trendNegative ? "text-red-500" : "text-gray-400";
  const trendLabel =
    change === null
      ? "Not enough data"
      : change === 0
      ? "No change vs last 7 days"
      : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs last 7 days`;

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className={`flex items-start justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <HugeiconsIcon icon={Analytics01Icon} size={20} color="#059669" strokeWidth={2} />
            <p className="text-xl font-semibold text-[#059669] uppercase tracking-wider">GoWild Snapshot</p>
          </div>
          <p className="text-sm text-[#6B7B7B]">Live availability across tracked flight legs</p>
        </div>
        <div className={`flex-shrink-0 mt-1 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={18} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      {/* Collapsible body */}
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="overflow-hidden">

      {/* Main row: donut left, stats right — equal halves */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex justify-center">
          <DonutChart rate={rate} />
        </div>

        {/* Stacked stats */}
        <div className="flex-1 flex flex-col gap-4 justify-center">
          {/* Available Legs */}
          <div>
            <p className="text-sm text-[#6B7B7B] mb-1">Available Legs</p>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-semibold text-green-600 leading-none">
                {totalLegs === 0 ? "--" : availableLegs}
              </span>
              {totalLegs > 0 && (
                <div className="flex flex-col">
                  <span className="text-sm text-[#9CA3AF]">of {totalLegs}</span>
                  <span className="text-sm text-[#9CA3AF]">legs tracked</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Avg Seats Available */}
          <div>
            <p className="text-sm text-[#6B7B7B] mb-1">Avg Seats Available</p>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-semibold text-green-600 leading-none">
                {avgSeats === null ? "--" : Math.round(avgSeats)}
              </span>
              <div className="flex flex-col">
                <span className="text-sm text-[#9CA3AF]">seats per leg</span>
                <span className="text-sm text-[#9CA3AF]">on GoWild legs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend row */}
      <div className="border-t border-gray-100 mt-4 pt-3 flex items-center gap-2">
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${trendBg}`}
        >
          {trendNegative ? (
            <TrendingDown size={13} color={trendColor} />
          ) : (
            <TrendingUp size={13} color={trendColor} />
          )}
        </div>
        <span className={`text-sm font-semibold ${trendTextClass}`}>{trendLabel}</span>
      </div>

      </div>
      </div>
    </div>
  );
};

export default GoWildSnapshotCard;
