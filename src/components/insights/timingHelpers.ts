import type { Itinerary, LimitedDataMeta } from "./insightTypes";
import type { Confidence } from "./airportHelpers";

export type TimingRow = {
  label: string;
  rating: Confidence;
  percentage: number;
  successCount: number;
  totalCount: number;
  limitedData: boolean;
};

export type TimingResult = LimitedDataMeta & {
  rows: TimingRow[];
};

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIME_WINDOWS = [
  "12 AM – 2 AM", "2 AM – 4 AM", "4 AM – 6 AM", "6 AM – 8 AM",
  "8 AM – 10 AM", "10 AM – 12 PM", "12 PM – 2 PM", "2 PM – 4 PM",
  "4 PM – 6 PM", "6 PM – 8 PM", "8 PM – 10 PM", "10 PM – 12 AM",
];

const TIMING_THRESHOLD = 30;

function getRating(rate: number): Confidence {
  if (rate >= 30) return "high";
  if (rate >= 10) return "medium";
  return "low";
}

function getDayIndex(departure_at: string | null | undefined): number | null {
  if (!departure_at) return null;
  const d = new Date(departure_at);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function getWindowIndex(departure_at: string | null | undefined): number | null {
  if (!departure_at) return null;
  const d = new Date(departure_at);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getHours() / 2);
}

function buildBuckets(
  itineraries: Itinerary[],
  bucketCount: number,
  pickIndex: (departure_at: string | null) => number | null,
  labels: string[]
): TimingResult {
  const counts = Array.from({ length: bucketCount }, () => ({ total: 0, goWild: 0 }));
  for (const it of itineraries) {
    const idx = pickIndex(it.departureAt);
    if (idx === null) continue;
    counts[idx].total++;
    if (it.isGoWildAvailable) counts[idx].goWild++;
  }
  const rows: TimingRow[] = counts
    .map((c, i) => {
      const pct = c.total > 0 ? (c.goWild / c.total) * 100 : 0;
      return {
        label: labels[i],
        rating: getRating(pct),
        percentage: pct,
        successCount: c.goWild,
        totalCount: c.total,
        limitedData: c.total > 0 && c.total < TIMING_THRESHOLD,
      };
    })
    .filter((r) => r.totalCount > 0);

  const qualified = rows.filter((r) => r.totalCount >= TIMING_THRESHOLD);

  return {
    rows,
    limitedData: qualified.length === 0 && rows.length > 0,
    qualifiedCount: qualified.length,
    threshold: TIMING_THRESHOLD,
  };
}

export function getDayOfWeekStats(itineraries: Itinerary[]): TimingResult {
  return buildBuckets(itineraries, 7, getDayIndex, DAY_LABELS);
}

export function getTimeWindowStats(itineraries: Itinerary[]): TimingResult {
  return buildBuckets(itineraries, 12, getWindowIndex, TIME_WINDOWS);
}
