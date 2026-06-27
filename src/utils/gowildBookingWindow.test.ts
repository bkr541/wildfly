import { describe, it, expect } from "vitest";
import {
  calculateBookingWindowOpen,
  formatCountdown,
  subtractCalendarDays,
} from "./gowildBookingWindow";

describe("subtractCalendarDays", () => {
  it("subtracts days across month boundaries", () => {
    expect(subtractCalendarDays("2026-03-02", 1)).toBe("2026-03-01");
    expect(subtractCalendarDays("2026-03-02", 2)).toBe("2026-02-28");
    expect(subtractCalendarDays("2026-01-01", 1)).toBe("2025-12-31");
  });
});

describe("calculateBookingWindowOpen", () => {
  it("domestic = previous calendar day at origin midnight", () => {
    const r = calculateBookingWindowOpen({
      departureDate: "2027-04-05",
      travelType: "domestic",
      originTimezone: "America/New_York",
    });
    expect(r.opensOnDate).toBe("2027-04-04");
    expect(r.exactTimezone).toBe(true);
    expect(r.opensAtIso).toBeTruthy();
    // 2027-04-04 midnight EDT = 2027-04-04T04:00:00Z
    expect(r.opensAtIso).toBe("2027-04-04T04:00:00.000Z");
  });

  it("international = 10 calendar days earlier", () => {
    const r = calculateBookingWindowOpen({
      departureDate: "2027-04-15",
      travelType: "international",
      originTimezone: "America/Los_Angeles",
    });
    expect(r.opensOnDate).toBe("2027-04-05");
    // midnight PDT = 07:00Z
    expect(r.opensAtIso).toBe("2027-04-05T07:00:00.000Z");
  });

  it("falls back gracefully when timezone is missing", () => {
    const r = calculateBookingWindowOpen({
      departureDate: "2027-06-15",
      travelType: "domestic",
      originTimezone: null,
    });
    expect(r.exactTimezone).toBe(false);
    expect(r.opensAtIso).toBeNull();
    expect(r.opensOnDate).toBe("2027-06-14");
    expect(r.originTimezone).toBeNull();
  });

  it("handles a DST spring-forward boundary", () => {
    // US DST starts 2027-03-14. Departure 2027-03-15.
    const r = calculateBookingWindowOpen({
      departureDate: "2027-03-15",
      travelType: "domestic",
      originTimezone: "America/New_York",
    });
    expect(r.opensOnDate).toBe("2027-03-14");
    // Midnight on 03-14 is still EST (offset -5) → 05:00Z
    expect(r.opensAtIso).toBe("2027-03-14T05:00:00.000Z");
  });

  it("flags blackout departure dates", () => {
    const r = calculateBookingWindowOpen({
      departureDate: "2026-12-21",
      travelType: "domestic",
      originTimezone: "America/Chicago",
    });
    expect(r.isBlackoutDeparture).toBe(true);
  });
});

describe("formatCountdown", () => {
  it("returns isOpen when target is in the past", () => {
    expect(formatCountdown("2020-01-01T00:00:00Z", Date.now()).isOpen).toBe(true);
  });
  it("returns a label for future targets", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const r = formatCountdown(future, Date.now());
    expect(r.isOpen).toBe(false);
    expect(r.label).toMatch(/\d+h/);
  });
  it("returns empty label when target is null", () => {
    expect(formatCountdown(null, Date.now()).label).toBe("");
  });
});
