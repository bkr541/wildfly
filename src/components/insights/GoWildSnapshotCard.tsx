import { TrendingUp, TrendingDown } from "lucide-react";

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

function formatAvgSeats(avg: number | null): string {
  if (avg === null) return "--";
  return avg.toFixed(1);
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

const GoWildSnapshotCard = ({ snapshots }: GoWildSnapshotCardProps) => {
  const rate = computeAvailabilityRate(snapshots);
  const availableLegs = snapshots.filter((s) => s.has_go_wild).length;
  const totalLegs = snapshots.length;
  const avgSeats = computeAvgSeats(snapshots);
  const change = computeChange(snapshots);

  const trendPositive = change !== null && change > 0;
  const trendNegative = change !== null && change < 0;
  const trendZero = change !== null && change === 0;

  const trendBg = trendPositive
    ? "bg-green-100"
    : trendNegative
    ? "bg-red-100"
    : "bg-gray-100";

  const trendColor = trendPositive
    ? "#16a34a"
    : trendNegative
    ? "#ef4444"
    : "#9ca3af";

  const trendTextClass = trendPositive
    ? "text-green-600"
    : trendNegative
    ? "text-red-500"
    : "text-gray-400";

  const trendLabel =
    change === null
      ? "Not enough data"
      : change === 0
      ? "No change vs last 7 days"
      : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs last 7 days`;

  return (
    <div
      className="rounded-2xl bg-white p-5"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {/* Hero block */}
      <div className="flex flex-col items-start gap-0.5 mb-4">
        <span className="text-5xl font-semibold text-green-600 leading-none">
          {formatRate(rate)}
        </span>
        <span className="text-sm text-wf-text-muted">
          of legs have GoWild availability
        </span>
      </div>

      {/* Trend row */}
      <div className="flex items-center gap-2 mt-1">
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${trendBg}`}
        >
          {trendNegative ? (
            <TrendingDown size={14} color={trendColor} />
          ) : (
            <TrendingUp size={14} color={trendColor} />
          )}
        </div>
        <span className={`text-sm font-semibold ${trendTextClass}`}>
          {trendLabel}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 my-4" />

      {/* Bottom stats */}
      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <div className="flex flex-col items-center py-1 pr-4">
          <span className="text-sm text-muted-foreground mb-1">Available Legs</span>
          <span className="text-3xl font-semibold text-green-600">
            {totalLegs === 0 ? "--" : availableLegs}
          </span>
          <span className="text-xs text-muted-foreground">
            {totalLegs === 0 ? "" : `of ${totalLegs}`}
          </span>
        </div>
        <div className="flex flex-col items-center py-1 pl-4">
          <span className="text-sm text-muted-foreground mb-1">Avg Seats Available</span>
          <span className="text-3xl font-semibold text-green-600">
            {formatAvgSeats(avgSeats)}
          </span>
          <span className="text-xs text-muted-foreground">seats per leg</span>
        </div>
      </div>
    </div>
  );
};

export default GoWildSnapshotCard;
