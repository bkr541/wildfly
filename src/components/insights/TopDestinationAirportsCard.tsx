import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import {
  getDestinationAirportStats,
  formatPercent,
  type FlightSnapshot,
  type Confidence,
} from "./airportHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

function barColor(rate: number): string {
  if (rate <= 40) return "bg-green-100";
  if (rate <= 60) return "bg-green-300";
  if (rate <= 80) return "bg-green-500";
  return "bg-emerald-600";
}

const confidenceConfig: Record<Confidence, { label: string; classes: string }> = {
  high: { label: "High", classes: "bg-green-50 text-green-600" },
  medium: { label: "Medium", classes: "bg-amber-50 text-amber-600" },
  low: { label: "Low", classes: "bg-gray-100 text-gray-500" },
};

const ConfidenceBadge = ({ confidence }: { confidence: Confidence }) => {
  const { label, classes } = confidenceConfig[confidence];
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${classes}`}>
      {label}
    </span>
  );
};

interface Props {
  snapshots: FlightSnapshot[];
}

const TopDestinationAirportsCard = ({ snapshots }: Props) => {
  const stats = getDestinationAirportStats(snapshots);

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
            <HugeiconsIcon icon={Location01Icon} size={18} color="#059669" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#2E4A4A] leading-tight">
              Top Destination Airports
            </h3>
            <p className="text-xs text-[#6B7B7B]">Highest arrival GoWild rate</p>
          </div>
        </div>
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#9CA3AF" strokeWidth={1.5} />
      </div>

      {/* List */}
      {stats.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] text-center py-6">No destination airport data yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {stats.map((stat) => (
            <div key={stat.code}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-3xl font-bold text-[#2E4A4A]">{stat.code}</span>
                  <ConfidenceBadge confidence={stat.confidence} />
                </div>
                <span className="text-3xl font-semibold text-green-600">
                  {formatPercent(stat.goWildRate)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(stat.goWildRate)}`}
                  style={{ width: `${Math.min(stat.goWildRate, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {stat.goWildLegs} / {stat.totalLegs} legs
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopDestinationAirportsCard;
