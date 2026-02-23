/** GoWild Pass blackout date ranges (2025–2027). */
export interface BlackoutPeriod {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  description: string;
}

export const BLACKOUT_PERIODS: BlackoutPeriod[] = [
  // ─── 2025 ───
  { start: "2025-01-01", end: "2025-01-01", description: "New Year's Day" },
  { start: "2025-01-04", end: "2025-01-05", description: "Early January" },
  { start: "2025-01-16", end: "2025-01-17", description: "MLK Weekend" },
  { start: "2025-01-20", end: "2025-01-20", description: "MLK Day" },
  { start: "2025-02-13", end: "2025-02-14", description: "Valentine's/Presidents Day Weekend" },
  { start: "2025-02-17", end: "2025-02-17", description: "Presidents Day" },
  { start: "2025-03-14", end: "2025-03-16", description: "Spring Break Period" },
  { start: "2025-03-21", end: "2025-03-23", description: "Spring Break Peak" },
  { start: "2025-03-28", end: "2025-03-30", description: "Late Spring Break" },
  { start: "2025-04-04", end: "2025-04-06", description: "Early April" },
  { start: "2025-04-11", end: "2025-04-13", description: "Mid-April" },
  { start: "2025-04-18", end: "2025-04-21", description: "Easter Weekend" },
  { start: "2025-05-22", end: "2025-05-23", description: "Memorial Day Weekend" },
  { start: "2025-05-26", end: "2025-05-26", description: "Memorial Day" },
  { start: "2025-06-22", end: "2025-06-22", description: "Late June" },
  { start: "2025-06-26", end: "2025-06-29", description: "Summer Start" },
  { start: "2025-07-03", end: "2025-07-07", description: "Independence Day Weekend" },
  { start: "2025-08-28", end: "2025-08-29", description: "Late August" },
  { start: "2025-09-01", end: "2025-09-01", description: "Labor Day" },
  { start: "2025-10-09", end: "2025-10-10", description: "Columbus Day Weekend" },
  { start: "2025-10-12", end: "2025-10-13", description: "Mid-October" },
  { start: "2025-11-25", end: "2025-11-26", description: "Thanksgiving" },
  { start: "2025-11-29", end: "2025-11-30", description: "Post-Thanksgiving Weekend" },
  { start: "2025-12-01", end: "2025-12-01", description: "Early December" },
  { start: "2025-12-20", end: "2025-12-23", description: "Pre-Christmas" },
  { start: "2025-12-26", end: "2025-12-31", description: "Post-Christmas/New Year's" },

  // ─── 2026 ───
  { start: "2026-01-01", end: "2026-01-01", description: "New Year's Day" },
  { start: "2026-01-03", end: "2026-01-04", description: "Early January" },
  { start: "2026-01-15", end: "2026-01-16", description: "MLK Weekend" },
  { start: "2026-01-19", end: "2026-01-19", description: "MLK Day" },
  { start: "2026-02-12", end: "2026-02-13", description: "Valentine's/Presidents Day Weekend" },
  { start: "2026-02-16", end: "2026-02-16", description: "Presidents Day" },
  { start: "2026-03-13", end: "2026-03-15", description: "Spring Break Period" },
  { start: "2026-03-20", end: "2026-03-22", description: "Spring Break Peak" },
  { start: "2026-03-27", end: "2026-03-29", description: "Late Spring Break" },
  { start: "2026-04-03", end: "2026-04-06", description: "Easter Weekend" },
  { start: "2026-04-10", end: "2026-04-12", description: "Mid-April" },
  { start: "2026-05-21", end: "2026-05-22", description: "Memorial Day Weekend" },
  { start: "2026-05-25", end: "2026-05-25", description: "Memorial Day" },
  { start: "2026-06-25", end: "2026-06-28", description: "Summer Start" },
  { start: "2026-07-02", end: "2026-07-06", description: "Independence Day Weekend" },
  { start: "2026-09-03", end: "2026-09-04", description: "Labor Day Weekend" },
  { start: "2026-09-07", end: "2026-09-07", description: "Labor Day" },
  { start: "2026-10-08", end: "2026-10-09", description: "Columbus Day Weekend" },
  { start: "2026-10-11", end: "2026-10-12", description: "Mid-October" },
  { start: "2026-11-24", end: "2026-11-25", description: "Thanksgiving" },
  { start: "2026-11-28", end: "2026-11-30", description: "Post-Thanksgiving Weekend" },
  { start: "2026-12-19", end: "2026-12-24", description: "Pre-Christmas" },
  { start: "2026-12-26", end: "2026-12-31", description: "Post-Christmas/New Year's" },

  // ─── 2027 ───
  { start: "2027-01-01", end: "2027-01-03", description: "New Year's Holiday" },
  { start: "2027-01-14", end: "2027-01-15", description: "MLK Weekend" },
  { start: "2027-01-18", end: "2027-01-18", description: "MLK Day" },
  { start: "2027-02-11", end: "2027-02-12", description: "Valentine's/Presidents Day Weekend" },
  { start: "2027-02-15", end: "2027-02-15", description: "Presidents Day" },
  { start: "2027-03-12", end: "2027-03-14", description: "Spring Break Period" },
  { start: "2027-03-19", end: "2027-03-21", description: "Spring Break Peak" },
  { start: "2027-03-26", end: "2027-03-29", description: "Late Spring Break/Easter" },
  { start: "2027-04-02", end: "2027-04-04", description: "Easter Weekend" },
];

/** Check if a given YYYY-MM-DD date falls within any blackout period. */
export function isBlackoutDate(dateStr: string): boolean {
  if (!dateStr) return false;
  // Normalize to YYYY-MM-DD (handle ISO strings)
  const day = dateStr.slice(0, 10);
  return BLACKOUT_PERIODS.some((p) => day >= p.start && day <= p.end);
}
