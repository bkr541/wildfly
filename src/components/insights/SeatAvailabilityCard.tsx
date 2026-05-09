import { useState, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import type { SeatRating, SeatRouteRow, SeatAirportRow } from "./seatHelpers";
import { type AirportDict } from "@/hooks/useAirportDictionary";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

function barColor(rating: SeatRating, variant: string): string {
  if (variant === "lowest-seats") {
    if (rating === "high")   return "bg-green-400";
    if (rating === "medium") return "bg-amber-400";
    return "bg-gray-300";
  }
  if (rating === "high")   return "bg-emerald-600";
  if (rating === "medium") return "bg-green-400";
  return "bg-green-200";
}

function metricColor(variant: string, rating: SeatRating): string {
  if (variant === "lowest-seats" && rating === "low") return "text-[#9CA3AF]";
  return "text-green-600";
}

type RouteCardProps = {
  title: string;
  subtitle: string;
  icon: any;
  variant: "most-seats" | "lowest-seats";
  rows: SeatRouteRow[];
  emptyMessage?: string;
};

type AirportCardProps = {
  title: string;
  subtitle: string;
  icon: any;
  variant: "airport-average";
  rows: SeatAirportRow[];
  emptyMessage?: string;
  airportDict?: AirportDict;
};

type Props = RouteCardProps | AirportCardProps;

const SeatAvailabilityCard = (props: Props) => {
  const { title, subtitle, icon, variant, emptyMessage = "Not enough seat data yet. Search more GoWild flights to build seat availability insights." } = props;
  const airportDict = variant === "airport-average" ? ((props as AirportCardProps).airportDict ?? {}) : {};
  const [isExpanded, setIsExpanded] = useState(true);

  const maxAvg = useMemo(() => {
    if (props.rows.length === 0) return 1;
    return Math.max(...props.rows.map((r) => r.averageSeats), 0.1);
  }, [props.rows]);

  

  return (
    <div className="rounded-2xl bg-white p-5 flex flex-col" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">{title}</p>
          <p className="text-xs text-[#6B7B7B]">{subtitle}</p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      {/* Collapsible body */}
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {props.rows.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">{emptyMessage}</p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {variant === "airport-average"
                  ? (props as AirportCardProps).rows.map((r) => {
                      const pct = (r.averageSeats / maxAvg) * 100;
                      const info = airportDict[r.label];
                      const cityLabel = info?.name ?? null;
                      return (
                        <div key={r.label}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="flex flex-col leading-none">
                                <span className="text-3xl font-bold text-[#2E4A4A]">{r.label}</span>
                                {cityLabel && (
                                  <span className="text-[11px] text-[#9CA3AF] mt-0.5">{cityLabel}</span>
                                )}
                              </div>
                            </div>
                            <span className={`text-sm font-bold ml-2 flex-shrink-0 ${metricColor(variant, r.rating)}`}>
                              {r.averageSeats.toFixed(1)} avg
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor(r.rating, variant)}`}
                              style={{ width: `${pct}%` }}
                              role="progressbar"
                              aria-label={`${r.label} average seats: ${r.averageSeats.toFixed(1)}`}
                              aria-valuenow={r.averageSeats}
                              aria-valuemin={0}
                              aria-valuemax={maxAvg}
                            />
                          </div>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                            {r.totalAvailableSeats} seats across {r.goWildLegCount} legs
                            {r.routeCount > 1 ? ` · ${r.routeCount} routes` : ""}
                          </p>
                        </div>
                      );
                    })
                  : (props as RouteCardProps).rows.map((r, i) => {
                      const pct = (r.averageSeats / maxAvg) * 100;
                      return (
                        <div key={r.label}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold text-[#9CA3AF] w-4 flex-shrink-0">{i + 1}</span>
                              <span className="text-sm font-semibold text-[#2E4A4A] truncate">{r.label}</span>
                            </div>
                            <span className={`text-sm font-bold ml-2 flex-shrink-0 ${metricColor(variant, r.rating)}`}>
                              {r.averageSeats.toFixed(1)} avg
                            </span>
                          </div>
                          <div className="mt-1 ml-6 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor(r.rating, variant)}`}
                              style={{ width: `${pct}%` }}
                              role="progressbar"
                              aria-label={`${r.label} average seats: ${r.averageSeats.toFixed(1)}`}
                              aria-valuenow={r.averageSeats}
                              aria-valuemin={0}
                              aria-valuemax={maxAvg}
                            />
                          </div>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5 ml-6">
                            {r.totalAvailableSeats} seats across {r.goWildLegCount} legs
                          </p>
                        </div>
                      );
                    })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeatAvailabilityCard;
