import { describe, expect, it } from "vitest";
import { formatAirportDate, formatAirportTime } from "./airportTime";

describe("airport-local flight display formatting", () => {
  it("formats departure and arrival instants in each airport's own timezone", () => {
    const departureUtc = "2026-08-20T01:44:00.000Z";
    const arrivalUtc = "2026-08-20T03:47:00.000Z";

    expect(formatAirportTime(departureUtc, "America/New_York")).toBe("9:44 PM");
    expect(formatAirportTime(arrivalUtc, "America/Chicago")).toBe("10:47 PM");

    expect(
      formatAirportDate(arrivalUtc, "America/Chicago", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    ).toBe("Wednesday, August 19, 2026");
  });
});
