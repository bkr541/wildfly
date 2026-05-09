import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GridViewIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { getHeatmapData, WEEKDAYS, type FlightSnapshot, type HeatmapCell } from "./airportHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

function getCellStyle(cell: HeatmapCell): { bg: string; text: string; dim: boolean } {
  if (!cell) return { bg: "bg-gray-100", text: "", dim: false };
  const { goWildRate, totalLegs } = cell;
  const dim = totalLegs < 2;
  if (goWildRate >= 75) return { bg: "bg-green-600", text: "text-white", dim };
  if (goWildRate >= 50) return { bg: "bg-green-400", text: "text-white", dim };
  if (goWildRate >= 25) return { bg: "bg-green-200", text: "text-green-800", dim };
  if (goWildRate > 0) return { bg: "bg-green-100", text: "text-green-700", dim };
  return { bg: "bg-gray-100", text: "text-gray-400", dim };
}

interface Props {
  snapshots: FlightSnapshot[];
}

const AirportAvailabilityHeatmapCard = ({ snapshots }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const rows = getHeatmapData(snapshots);

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div
        className={`flex items-center justify-between cursor-pointer select-none ${isExpanded ? "mb-4" : ""}`}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <HugeiconsIcon icon={GridViewIcon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
        <div className="flex-1 ml-2">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Availability Heatmap</p>
          <p className="text-xs text-[#6B7B7B]">GoWild rate by origin &amp; weekday</p>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
        </div>
      </div>

      {/* Collapsible body */}
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">

      {/* Heatmap */}
      {rows.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] text-center py-6">No heatmap data yet</p>
      ) : (
        <>
          {/* Day header row */}
          <div className="grid grid-cols-[36px_repeat(7,1fr)] gap-0.5 mb-1">
            <div />
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-semibold text-[#6B7B7B]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Airport rows */}
          <div className="flex flex-col gap-0.5">
            {rows.map((row) => (
              <div key={row.airport} className="grid grid-cols-[36px_repeat(7,1fr)] gap-0.5">
                <div className="flex items-center text-[11px] font-bold text-[#2E4A4A] pr-1">
                  {row.airport}
                </div>
                {row.cells.map((cell, i) => {
                  const { bg, text, dim } = getCellStyle(cell);
                  return (
                    <div
                      key={i}
                      className={`h-7 rounded flex items-center justify-center ${bg} ${dim ? "opacity-50" : ""}`}
                    >
                      {cell && cell.totalLegs >= 2 && (
                        <span className={`text-[9px] font-semibold leading-none ${text}`}>
                          {Math.round(cell.goWildRate)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

        </>
      )}

        </div>
      </div>
    </div>
  );
};

export default AirportAvailabilityHeatmapCard;
