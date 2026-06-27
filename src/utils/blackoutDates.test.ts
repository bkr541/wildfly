import { describe, it, expect } from "vitest";
import {
  BLACKOUT_PERIODS,
  getBlackoutDatesForMonth,
  getBlackoutPeriodsForYear,
  getBlackoutYears,
  getNextBlackoutPeriod,
  isBlackoutDate,
} from "./blackoutDates";

describe("blackoutDates existing behavior", () => {
  it("isBlackoutDate matches a known holiday range", () => {
    expect(isBlackoutDate("2026-12-21")).toBe(true);
    expect(isBlackoutDate("2026-09-15")).toBe(false);
    expect(isBlackoutDate("")).toBe(false);
  });

  it("normalizes ISO datetimes", () => {
    expect(isBlackoutDate("2026-12-21T13:00:00Z")).toBe(true);
  });
});

describe("blackoutDates new helpers", () => {
  it("getBlackoutYears returns ascending unique years", () => {
    const ys = getBlackoutYears();
    expect(ys.length).toBeGreaterThan(0);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys).toContain(2026);
  });

  it("getBlackoutPeriodsForYear filters correctly", () => {
    const ps = getBlackoutPeriodsForYear(2026);
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.start.slice(0, 4) <= "2026" && p.end.slice(0, 4) >= "2026").toBe(true);
    }
  });

  it("getBlackoutDatesForMonth expands a known period", () => {
    const days = getBlackoutDatesForMonth(2026, 11); // December
    expect(days).toContain("2026-12-21");
    expect(days).toContain("2026-12-22");
  });

  it("getNextBlackoutPeriod returns a future-or-current period", () => {
    const p = getNextBlackoutPeriod("2026-09-15");
    expect(p).not.toBeNull();
    if (p) expect(p.end >= "2026-09-15").toBe(true);
  });

  it("does not mutate BLACKOUT_PERIODS", () => {
    const count = BLACKOUT_PERIODS.length;
    getBlackoutDatesForMonth(2026, 0);
    expect(BLACKOUT_PERIODS.length).toBe(count);
  });
});
