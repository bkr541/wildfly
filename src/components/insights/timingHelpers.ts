import { isGoWild, type FlightSnapshot, type Confidence } from "./airportHelpers";

export type TimingRow = {
  label: string;
  rating: Confidence;
  percentage: number;
  successCount: number;
  totalCount: number;
};

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIME_WINDOWS = [
  "12 AM – 2 AM",
  "2 AM – 4 AM",
  "4 AM – 6 AM",
  "6 AM – 8 AM",
  "8 AM – 10 AM",
  "10 AM – 12 PM",
  "12 PM – 2 PM",
  "2 PM – 4 PM",
  "4 PM – 6 PM",
  "6 PM – 8 PM",
  "8 PM – 10 PM",
  "10 PM – 12 AM",
];

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
  return day === 0 ? 6 : day - 1; // Mon=0 … Sun=6
}

function getWindowIndex(departure_at: string | null | undefined): number | null {
  if (!departure_at) return null;
  const d = new Date(departure_at);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getHours() / 2);
}

export function getDayOfWeekStats(snapshots: FlightSnapshot[]): TimingRow[] {
  const counts = Array.from({ length: 7 }, () => ({ total: 0, goWild: 0 }));
  for (const s of snapshots) {
    const idx = getDayIndex(s.departure_at);
    if (idx === null) continue;
    counts[idx].total++;
    if (isGoWild(s.has_go_wild)) counts[idx].goWild++;
  }
  return counts
    .map((c, i) => {
      const pct = c.total > 0 ? (c.goWild / c.total) * 100 : 0;
      return { label: DAY_LABELS[i], rating: getRating(pct), percentage: pct, successCount: c.goWild, totalCount: c.total };
    })
    .filter((r) => r.totalCount > 0);
}

export function getTimeWindowStats(snapshots: FlightSnapshot[]): TimingRow[] {
  const counts = Array.from({ length: 12 }, () => ({ total: 0, goWild: 0 }));
  for (const s of snapshots) {
    const idx = getWindowIndex(s.departure_at);
    if (idx === null) continue;
    counts[idx].total++;
    if (isGoWild(s.has_go_wild)) counts[idx].goWild++;
  }
  return counts
    .map((c, i) => {
      const pct = c.total > 0 ? (c.goWild / c.total) * 100 : 0;
      return { label: TIME_WINDOWS[i], rating: getRating(pct), percentage: pct, successCount: c.goWild, totalCount: c.total };
    })
    .filter((r) => r.totalCount > 0);
}
