import { describe, expect, it } from "vitest";
import type { FlightShareModel } from "./flightShareModel";
import type { MultiDestShareModelV2 } from "./multiDestShareModel";
import { normalizeStoredFlightShareEnvelope } from "./flightShareNormalize";

function makeV1(): FlightShareModel {
  return {
    originLabel: "Chicago",
    destinationLabel: "Miami",
    tripTypeLabel: "One-way",
    combinedDateLabel: "Sat, Jul 18, 2026 • One-way",
    heroImageUrl: "/assets/locations/42_background.png",
    arrivalImageUrl: "/assets/locations/7_background.png",
    totalOptionCount: 1,
    totalNonstopCount: 1,
    totalGoWildCount: 0,
    sections: [{
      sectionType: "ONE-WAY",
      label: "One-Way",
      dateValue: "2026-07-18",
      formattedDateLabel: "Sat, Jul 18",
      totalCount: 1,
      nonstopCount: 1,
      goWildCount: 0,
      airportGroups: [{
        iata: "MIA",
        name: "Miami International Airport",
        city: "Miami",
        stateCode: "FL",
        country: "United States",
        locationId: 7,
        optionCount: 1,
        options: [{
          canonicalKey: "F9|ORD>MIA|2026-07-18T06:00:00",
          airline: "Frontier",
          carrierCode: "F9",
          departureTimeLabel: "6:00 AM",
          arrivalTimeLabel: "10:00 AM",
          departureRaw: "2026-07-18T06:00:00",
          arrivalRaw: "2026-07-18T10:00:00",
          timeOfDay: "MORNING",
          route: "ORD>MIA",
          routeAirports: ["ORD", "MIA"],
          stopCount: 0,
          isNonstop: true,
          isPlusOneDay: false,
          formattedDuration: "3h",
          flightNumbers: ["F9123"],
          lowestPublicFare: 79,
          goWildFare: null,
          isGoWild: false,
          goWildSeats: null,
          emphasizedFare: 79,
        }],
      }],
    }],
    hasResults: true,
  };
}

export function makeV2(): MultiDestShareModelV2 {
  return {
    kind: "multi-destination",
    originCode: "ORD",
    originLabel: "Chicago",
    destinationLabel: "All Destinations",
    tripTypeLabel: "One-way",
    departureDate: "2026-07-18",
    returnDate: null,
    combinedDateLabel: "Sat, Jul 18, 2026 • One-way",
    heroImageUrl: "/assets/locations/42_background.png",
    totals: {
      destinationCount: 1,
      flightCount: 5,
      nonstopDestinationCount: 1,
      goWildDestinationCount: 1,
    },
    appliedView: {
      sortBy: "fare",
      nonstopOnly: true,
      goWildOnly: false,
      destinationType: "domestic",
    },
    destinations: [{
      destination: "MIA",
      city: "Miami",
      stateCode: "FL",
      country: "United States",
      airportName: "Miami International Airport",
      locationId: 7,
      flightCount: 5,
      minFare: 49,
      maxFare: 159,
      isMinFareGoWild: true,
      hasGoWild: true,
      hasNonstop: true,
      nonstopCount: 3,
      avgDurationMin: 190,
      minDurationMin: 175,
      departureWindow: "6:00 AM – 8:00 PM",
      earliestDeparture: "6:00 AM",
    }],
    hasResults: true,
  };
}

describe("normalizeStoredFlightShareEnvelope", () => {
  it("returns a discriminated version-1 result", () => {
    const result = normalizeStoredFlightShareEnvelope(1, makeV1());
    expect(result.displayModelVersion).toBe(1);
    expect(result.displayModel.originLabel).toBe("Chicago");
  });

  it("returns a discriminated version-2 result", () => {
    const result = normalizeStoredFlightShareEnvelope(2, makeV2());
    expect(result.displayModelVersion).toBe(2);
    if (result.displayModelVersion === 2) {
      expect(result.displayModel.kind).toBe("multi-destination");
      expect(result.displayModel.destinations[0].destination).toBe("MIA");
    }
  });

  it("does not silently interpret a version-2 model as version 1", () => {
    expect(() => normalizeStoredFlightShareEnvelope(1, makeV2())).toThrow("INVALID_PAYLOAD");
  });

  it("rejects unsupported versions with the structured error prefix", () => {
    expect(() => normalizeStoredFlightShareEnvelope(99, makeV2())).toThrow("UNSUPPORTED_VERSION");
  });

  it("rejects malformed version-2 totals", () => {
    const malformed = makeV2();
    malformed.totals.flightCount = 999;
    expect(() => normalizeStoredFlightShareEnvelope(2, malformed)).toThrow("INVALID_PAYLOAD");
  });

  it("rejects unexpected destination flight arrays", () => {
    const malformed = makeV2() as MultiDestShareModelV2 & {
      destinations: Array<MultiDestShareModelV2["destinations"][number] & { flights?: unknown[] }>;
    };
    malformed.destinations[0].flights = [{ secret: "raw flight" }];
    expect(() => normalizeStoredFlightShareEnvelope(2, malformed)).toThrow("INVALID_PAYLOAD");
  });

  it("rejects duplicate destination airport codes case-insensitively", () => {
    const malformed = makeV2();
    malformed.destinations.push({
      ...malformed.destinations[0],
      destination: "mia",
    });
    malformed.totals.destinationCount = 2;
    malformed.totals.flightCount = 10;
    malformed.totals.nonstopDestinationCount = 2;
    malformed.totals.goWildDestinationCount = 2;

    expect(() => normalizeStoredFlightShareEnvelope(2, malformed)).toThrow(
      "destinations must not contain duplicate airport codes",
    );
  });
});
