import { describe, expect, it } from "vitest";
import {
  deriveMultiDestinationMeta,
  deriveSingleDestinationMeta,
  findRawFlights,
} from "../../supabase/functions/_shared/sharedFlightResultMeta";

describe("sharedFlightResultMeta", () => {
  it("discovers raw flights under response.flights", () => {
    const flights = [{ origin: "DEN", destination: "LAS" }];
    expect(findRawFlights({ response: { flights } })).toBe(flights);
  });

  it("preserves version-1 metadata behavior with response.flights fallback", () => {
    expect(deriveSingleDestinationMeta({
      originLabel: "Denver",
      destinationLabel: "Las Vegas",
      tripTypeLabel: "One-way",
      totalOptionCount: 4,
      sections: [{ sectionType: "ONE-WAY", dateValue: "2026-07-20" }],
    }, {
      response: { flights: [{ origin: "DEN", destination: "LAS" }] },
    })).toEqual({
      departureAirport: "DEN",
      arrivalAirport: "LAS",
      departureDate: "2026-07-20",
      returnDate: null,
      tripType: "one-way",
      allDestinations: false,
      flightCount: 4,
    });
  });

  it("derives version-2 metadata only from the validated display model", () => {
    expect(deriveMultiDestinationMeta({
      kind: "multi-destination",
      originCode: "ORD",
      tripTypeLabel: "Round-trip",
      departureDate: "2026-07-20",
      returnDate: "2026-07-27",
      totals: { flightCount: 83 },
    })).toEqual({
      departureAirport: "ORD",
      arrivalAirport: null,
      departureDate: "2026-07-20",
      returnDate: "2026-07-27",
      tripType: "round-trip",
      allDestinations: true,
      flightCount: 83,
    });
  });
});
