import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsDownIcon } from "@hugeicons/core-free-icons";
import { formatPct, type RouteStat } from "./routeHelpers";

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
  routes: RouteStat[];
}

const WorstRoutesCard = ({ routes }: Props) => (
  <div className="rounded-2xl bg-white p-5 flex flex-col" style={{ boxShadow: CARD_SHADOW }}>
    {/* Header */}
    <div className="flex items-start gap-3 mb-4">
      <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
        <HugeiconsIcon icon={AnalyticsDownIcon} size={18} color="#EF4444" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-[#2E4A4A] leading-tight">Worst 5 Routes</h3>
        <p className="text-xs text-[#6B7B7B]">Lowest GoWild success rate</p>
      </div>
    </div>

    {/* List */}
    {routes.length === 0 ? (
      <p className="text-sm text-[#9CA3AF] text-center py-6 flex-1 flex items-center justify-center">
        Not enough route data yet.
      </p>
    ) : (
      <>
      <div className="flex flex-col gap-3">
        {routes.map((r, i) => (
          <div key={r.route}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-[#9CA3AF] w-4 flex-shrink-0">{i + 1}</span>
                <span className="text-sm font-semibold text-[#2E4A4A] truncate">{r.route}</span>
              </div>
              <span className="text-sm font-bold text-[#9CA3AF] ml-2 flex-shrink-0">
                {formatPct(r.goWildRate)}
              </span>
            </div>
            <div className="mt-1 ml-6 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(r.goWildRate)}`}
                style={{ width: `${Math.max(r.goWildRate, r.goWildRate === 0 ? 2 : 0)}%` }}
                role="progressbar"
                aria-valuenow={r.goWildRate}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 ml-6">
              {r.goWildLegs} / {r.totalLegs} legs
            </p>
          </div>
        ))}
      </div>
      {routes.length > 0 && (
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[10px] text-[#9CA3AF]">Low</span>
          <div className="flex gap-0.5 flex-1">
            {["bg-red-500", "bg-orange-400", "bg-amber-400", "bg-green-300", "bg-green-500"].map((bg, i) => (
              <div key={i} className={`h-2 flex-1 rounded-sm ${bg}`} />
            ))}
          </div>
          <span className="text-[10px] text-[#9CA3AF]">High</span>
        </div>
      )}
      </>
    )}
  </div>
);

export default WorstRoutesCard;
