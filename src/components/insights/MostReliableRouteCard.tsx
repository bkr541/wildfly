import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Medal01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { type ReliableRoute } from "./routeHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

interface Props {
  data: ReliableRoute | null;
}

const ScoreGauge = ({ score, route }: { score: number; route: string }) => {
  const cx = 100;
  const cy = 105;
  const r = 80;
  const strokeWidth = 17;
  const fullCirc = 2 * Math.PI * r;
  const halfCirc = Math.PI * r;
  const progressLen = (score / 100) * halfCirc;

  return (
    <svg width="200" height="158" viewBox="0 0 200 158">
      <defs>
        <linearGradient id="reliableGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>

      {/* Background track — upper semi-circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#F3F4F6"
        strokeWidth={strokeWidth}
        strokeDasharray={`${halfCirc} ${fullCirc}`}
        transform={`rotate(-180 ${cx} ${cy})`}
      />

      {/* Progress arc */}
      {score > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#reliableGaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progressLen} ${fullCirc}`}
          transform={`rotate(-180 ${cx} ${cy})`}
        />
      )}

      {/* Score */}
      <text
        x={cx}
        y={cy - 18}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="36"
        fontWeight="600"
        fill="#2E4A4A"
        fontFamily="inherit"
      >
        {score}
      </text>

      {/* / 100 */}
      <text
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="13"
        fill="#9CA3AF"
        fontFamily="inherit"
      >
        / 100
      </text>

      {/* GoWild Consistency Score label */}
      <text
        x={cx}
        y={cy + 24}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="10"
        fill="#9CA3AF"
        fontFamily="inherit"
      >
        GoWild Consistency Score
      </text>

      {/* Route label */}
      <text
        x={cx}
        y={cy + 44}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="600"
        fill="#059669"
        fontFamily="inherit"
      >
        {route}
      </text>
    </svg>
  );
};

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
          <p className="text-sm text-[#6B7B7B]">Highest consistency score</p>
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
            <div className="flex items-center gap-4">
              {/* Gauge */}
              <div className="flex-1 flex justify-center">
                <ScoreGauge score={data.consistencyScore} route={data.route} />
              </div>

              {/* Stats */}
              <div className="flex-1 flex flex-col gap-3 justify-center">
                <div>
                  <p className="text-sm text-[#6B7B7B] mb-1">Variance</p>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-semibold text-green-600 leading-none">
                      ±{data.variance.toFixed(1)}%
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm text-[#9CA3AF]">variance in</span>
                      <span className="text-sm text-[#9CA3AF]">success rate</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div>
                  <p className="text-sm text-[#6B7B7B] mb-1">Snapshot Days</p>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-semibold text-green-600 leading-none">
                      {String(data.snapshotCount).padStart(3, '0')}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm text-[#9CA3AF]">days of</span>
                      <span className="text-sm text-[#9CA3AF]">data tracked</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MostReliableRouteCard;
