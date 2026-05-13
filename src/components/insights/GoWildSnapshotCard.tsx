import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon } from "@hugeicons/core-free-icons";
import type { Itinerary, RawSnapshotRow } from "./insightTypes";
import { groupIntoItineraries } from "./itineraryHelpers";

export interface GoWildSnapshotCardProps {
  itineraries?: Itinerary[];
  snapshots?: RawSnapshotRow[] | any[];
}

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

function rate(its: Itinerary[]): number | null {
  if (its.length === 0) return null;
  return (its.filter((i) => i.isGoWildAvailable).length / its.length) * 100;
}

function avgSeats(its: Itinerary[]): number | null {
  const gw = its.filter((i) => i.isGoWildAvailable && i.availableSeats > 0);
  if (gw.length === 0) return null;
  return gw.reduce((s, i) => s + i.availableSeats, 0) / gw.length;
}

function periodChange(its: Itinerary[]): number | null {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const cur: Itinerary[] = [];
  const prev: Itinerary[] = [];
  for (const it of its) {
    const t = new Date(it.snapshotAt).getTime();
    if (isNaN(t)) continue;
    const age = now - t;
    if (age >= 0 && age < week) cur.push(it);
    else if (age >= week && age < 2 * week) prev.push(it);
  }
  const c = rate(cur);
  const p = rate(prev);
  if (c === null || p === null) return null;
  return c - p;
}

const Donut = ({
  value, pct, l1, l2, gradId,
}: { value: string; pct: number; l1: string; l2: string; gradId: string }) => {
  const size = 152, sw = 14, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(pct, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={sw} />
      {pct > 0 && (
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${gradId})`}
          strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform={`rotate(-90 ${size/2} ${size/2})`} />
      )}
      <text x={size/2} y={size/2-10} textAnchor="middle" dominantBaseline="middle"
        fontSize="24" fontWeight="600" fill="#2E4A4A">{value}</text>
      <text x={size/2} y={size/2+14} textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fill="#9CA3AF">{l1}</text>
      <text x={size/2} y={size/2+28} textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fill="#9CA3AF">{l2}</text>
    </svg>
  );
};

const GoWildSnapshotCard = ({ itineraries, snapshots }: GoWildSnapshotCardProps) => {
  const its = useMemo(
    () => itineraries ?? groupIntoItineraries((snapshots ?? []) as RawSnapshotRow[]),
    [itineraries, snapshots]
  );
  const r = rate(its);
  const seats = avgSeats(its);
  const change = periodChange(its);
  const goWildCount = its.filter((i) => i.isGoWildAvailable).length;

  const positive = change !== null && change > 0;
  const negative = change !== null && change < 0;
  const trendBg = positive ? "bg-green-100" : negative ? "bg-red-100" : "bg-gray-100";
  const trendColor = positive ? "#16a34a" : negative ? "#ef4444" : "#9ca3af";
  const trendText = positive ? "text-green-600" : negative ? "text-red-500" : "text-gray-400";
  const trendLabel = change === null
    ? "Not enough data for week-over-week trend"
    : change === 0
    ? "No change vs last 7 days"
    : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs last 7 days`;

  const seatsPct = seats === null ? 0 : Math.min((seats / 30) * 100, 100);

  return (
    <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
      <div className="flex items-center mb-4">
        <HugeiconsIcon icon={Analytics01Icon} size={28} color="#059669" strokeWidth={1.5} />
        <div className="flex-1 ml-2">
          <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">GoWild Snapshot</p>
          <p className="text-xs text-[#6B7B7B]">GoWild availability across selected itinerary results</p>
        </div>
      </div>

      <div className="flex justify-around items-center">
        <Donut value={r === null ? "--" : r.toFixed(1) + "%"} pct={r ?? 0}
          l1="Itinerary" l2="Availability" gradId="gwDonutGradient" />
        <Donut value={seats === null ? "--" : String(Math.round(seats))} pct={seatsPct}
          l1="Avg Seats" l2="(min across legs)" gradId="gwSeatsGradient" />
      </div>

      <p className="text-[11px] text-[#9CA3AF] text-center mt-2">
        {goWildCount} / {its.length} itineraries are GoWild-available
      </p>

      <div className="border-t border-gray-100 mt-4 pt-3 flex items-center gap-2">
        <div className={`h-7 w-7 rounded-full flex items-center justify-center ${trendBg}`}>
          {negative ? <TrendingDown size={13} color={trendColor} /> : <TrendingUp size={13} color={trendColor} />}
        </div>
        <span className={`text-sm font-semibold ${trendText}`}>{trendLabel}</span>
      </div>
    </div>
  );
};

export default GoWildSnapshotCard;
