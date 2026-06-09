import { cn } from "@/lib/utils";
import type { FlightSearchSnapshotSummary } from "./types";

interface GoWildSignalMiniProps {
  goWildFound: boolean | null;
  summary?: FlightSearchSnapshotSummary | null;
}

function seatDepthDots(avgSeats: number | null) {
  if (avgSeats == null || avgSeats === 0) return { count: 0, color: "bg-gray-200" };
  if (avgSeats <= 2) return { count: 2, color: "bg-amber-400" };
  if (avgSeats <= 5) return { count: 4, color: "bg-cyan-500" };
  return { count: 6, color: "bg-emerald-500" };
}

export function GoWildSignalMini({ goWildFound, summary }: GoWildSignalMiniProps) {
  if (!goWildFound) {
    return (
      <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gray-100 text-gray-500 border-gray-200">
        No GoWild
      </span>
    );
  }

  if (!summary) {
    return (
      <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">
        GoWild Found
      </span>
    );
  }

  const { count: dotCount, color: dotColor } = seatDepthDots(summary.avg_gowild_seats);
  const rate = summary.gowild_rate;
  const avgSeats = summary.avg_gowild_seats;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {/* Badge + count */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200 flex-shrink-0">
          GoWild
        </span>
        <span className="text-[11px] text-[#2E4A4A] font-medium whitespace-nowrap">
          {summary.gowild_itineraries}/{summary.unique_itineraries}
          {avgSeats != null ? ` · ${avgSeats.toFixed(1)} avg` : ""}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[#F0F1F1] overflow-hidden w-full max-w-[100px]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
          style={{ width: `${Math.min(100, rate * 100)}%` }}
        />
      </div>

      {/* Seat depth dots */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn("w-2 h-2 rounded-sm", i < dotCount ? dotColor : "bg-[#F0F1F1]")}
          />
        ))}
      </div>
    </div>
  );
}
