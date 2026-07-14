import { describe, expect, it } from "vitest";
import {
  MULTI_DEST_SHARE_HERO_FALLBACK,
  buildMultiDestShareModel,
  type BuildMultiDestShareModelArgs,
  type MultiDestShareCardInput,
} from "./multiDestShareModel";

interface TestCard extends MultiDestShareCardInput {
  flights?: unknown[];
  rawPayload?: unknown;
}

const FORBIDDEN_DISPLAY_KEYS = new Set([
  "flights",
  "legs",
  "fares",
  "rawPayload",
  "raw_search_payload",
  "headers",
  "authorization",
  "access_token",
  "refresh_token",
  "token",
  "apikey",
  "pageRef",
  "ref",
]);

function collectForbiddenKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, found));
    return found;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_DISPLAY_KEYS.has(key)) found.push(key);
      collectForbiddenKeys(nested, found);
    }
  }
  return found;
}

function makeCard(overrides: Partial<TestCard> = {}): TestCard {
  return {
    destination: "MCO",
    city: "Orlando",
    stateCode: "FL",
    country: "United States of America",
    airportName: "Orlando International Airport",
    locationId: 55,
    flightCount: 4,
    minFare: 29,
    maxFare: 119,
    isMinFareGoWild: true,
    hasGoWild: true,
    hasNonstop: true,
    nonstopCount: 3,
    avgDurationMin: 165,
    minDurationMin: 150,
    departureWindow: "7:00 AM – 8:30 PM",
    earliestDeparture: "7:00 AM",
    flights: [{ rawPayload: { secret: "must-not-leak" } }],
    rawPayload: { response: "must-not-leak" },
    ...overrides,
  };
}

function makeArgs(overrides: Partial<BuildMultiDestShareModelArgs> = {}): BuildMultiDestShareModelArgs {
  return {
    destinationCards: [makeCard()],
    originCode: "ORD",
    destinationCode: "All",
    departureDate: "2026-08-03",
    returnDate: null,
    tripType: "One Way",
    sortBy: "city",
    nonstopOnly: false,
    goWildOnly: false,
    destinationType: "all",
    airportMap: {
      ORD: {
        city: "Chicago",
        stateCode: "IL",
        country: "United States of America",
        name: "O'Hare International Airport",
        locationId: 42,
      },
    },
    ...overrides,
  };
}

describe("buildMultiDestShareModel", () => {
  it("preserves the exact destination-card order", () => {
    const cards = [
      makeCard({ destination: "SEA", city: "Seattle" }),
      makeCard({ destination: "ATL", city: "Atlanta" }),
      makeCard({ destination: "LAS", city: "Las Vegas" }),
    ];

    const model = buildMultiDestShareModel(makeArgs({ destinationCards: cards }));

    expect(model.destinations.map((destination) => destination.destination)).toEqual([
      "SEA",
      "ATL",
      "LAS",
    ]);
  });

  it("derives destination, flight, nonstop, and GoWild totals from visible cards", () => {
    const model = buildMultiDestShareModel(
      makeArgs({
        destinationCards: [
          makeCard({ destination: "MCO", flightCount: 4, hasNonstop: true, hasGoWild: true }),
          makeCard({ destination: "ATL", flightCount: 7, hasNonstop: false, hasGoWild: true }),
          makeCard({ destination: "SEA", flightCount: 2, hasNonstop: true, hasGoWild: false }),
        ],
      }),
    );

    expect(model.totals).toEqual({
      destinationCount: 3,
      flightCount: 13,
      nonstopDestinationCount: 2,
      goWildDestinationCount: 2,
    });
  });

  it("captures the active sort and filter state", () => {
    const model = buildMultiDestShareModel(
      makeArgs({
        sortBy: "duration",
        nonstopOnly: true,
        goWildOnly: true,
        destinationType: "international",
      }),
    );

    expect(model.appliedView).toEqual({
      sortBy: "duration",
      nonstopOnly: true,
      goWildOnly: true,
      destinationType: "international",
    });
  });

  it("produces an explicit empty model for no displayed destinations", () => {
    const model = buildMultiDestShareModel(makeArgs({ destinationCards: [] }));

    expect(model.destinations).toEqual([]);
    expect(model.totals).toEqual({
      destinationCount: 0,
      flightCount: 0,
      nonstopDestinationCount: 0,
      goWildDestinationCount: 0,
    });
    expect(model.hasResults).toBe(false);
  });

  it("falls back to the origin code when airport metadata is missing", () => {
    const model = buildMultiDestShareModel(
      makeArgs({ originCode: "XYZ", airportMap: {} }),
    );

    expect(model.originCode).toBe("XYZ");
    expect(model.originLabel).toBe("XYZ");
  });

  it("uses only a local origin image path and the safe fallback without metadata", () => {
    const withMetadata = buildMultiDestShareModel(makeArgs());
    const withoutMetadata = buildMultiDestShareModel(
      makeArgs({ airportMap: {}, originCode: "XYZ" }),
    );

    expect(withMetadata.heroImageUrl).toBe("/assets/locations/42_background.png");
    expect(withMetadata.heroImageUrl.startsWith("/assets/")).toBe(true);
    expect(withoutMetadata.heroImageUrl).toBe(MULTI_DEST_SHARE_HERO_FALLBACK);
  });

  it("formats one-way and round-trip date and trip-type labels", () => {
    const oneWay = buildMultiDestShareModel(makeArgs());
    const roundTrip = buildMultiDestShareModel(
      makeArgs({
        tripType: "Round Trip",
        departureDate: "2026-08-03",
        returnDate: "2026-08-09",
      }),
    );

    expect(oneWay.tripTypeLabel).toBe("One-way");
    expect(oneWay.combinedDateLabel).toBe("Mon, Aug 3, 2026 • One-way");
    expect(roundTrip.tripTypeLabel).toBe("Round-trip");
    expect(roundTrip.combinedDateLabel).toBe(
      "Mon, Aug 3 – Sun, Aug 9, 2026 • Round-trip",
    );
    expect(roundTrip.departureDate).toBe("2026-08-03");
    expect(roundTrip.returnDate).toBe("2026-08-09");
  });

  it("keeps the display model compact by excluding flights and raw payloads", () => {
    const model = buildMultiDestShareModel(
      makeArgs({ destinationCards: [makeCard()] }),
    );
    const destination = model.destinations[0] as Record<string, unknown>;
    const serialized = JSON.stringify(model);

    expect(destination).not.toHaveProperty("flights");
    expect(destination).not.toHaveProperty("rawPayload");
    expect(serialized).not.toContain("must-not-leak");
  });

  it("recursively excludes raw response, credential, page-ref, leg, and fare keys", () => {
    const card = makeCard({
      flights: [{
        legs: [{ fares: { token: "secret" } }],
        rawPayload: {
          headers: { authorization: "secret" },
          pageRef: { current: "react-ref" },
        },
      }],
      rawPayload: { access_token: "secret" },
    });

    const model = buildMultiDestShareModel(makeArgs({ destinationCards: [card] }));
    expect(collectForbiddenKeys(model)).toEqual([]);
  });

  it("builds a deterministic compact snapshot for 300 destinations", () => {
    const cards = Array.from({ length: 300 }, (_, index) => makeCard({
      destination: `D${String(index).padStart(3, "0")}`,
      city: `Destination ${index}`,
      flightCount: (index % 7) + 1,
      hasNonstop: index % 2 === 0,
      nonstopCount: index % 2 === 0 ? 1 : 0,
      hasGoWild: index % 3 === 0,
      flights: [{ rawPayload: { secret: `flight-${index}` } }],
      rawPayload: { secret: `card-${index}` },
    }));

    const first = buildMultiDestShareModel(makeArgs({ destinationCards: cards }));
    const second = buildMultiDestShareModel(makeArgs({ destinationCards: cards }));

    expect(first).toEqual(second);
    expect(first.destinations).toHaveLength(300);
    expect(first.totals.destinationCount).toBe(300);
    expect(first.destinations.map((item) => item.destination)).toEqual(
      cards.map((item) => item.destination),
    );
    expect(collectForbiddenKeys(first)).toEqual([]);
    expect(JSON.stringify(first)).not.toContain("card-299");
  });

  it("returns deeply equal output for identical input", () => {
    const args = makeArgs({
      destinationCards: [
        makeCard({ destination: "DEN", city: "Denver" }),
        makeCard({ destination: "PHX", city: "Phoenix" }),
      ],
    });

    expect(buildMultiDestShareModel(args)).toEqual(buildMultiDestShareModel(args));
  });

  it("distinguishes the minimum fare source from broader GoWild availability", () => {
    const model = buildMultiDestShareModel(
      makeArgs({
        destinationCards: [
          makeCard({
            destination: "ATL",
            minFare: 39,
            isMinFareGoWild: false,
            hasGoWild: true,
          }),
          makeCard({
            destination: "MCO",
            minFare: 19,
            isMinFareGoWild: true,
            hasGoWild: true,
          }),
        ],
      }),
    );

    expect(model.destinations[0]).toMatchObject({
      destination: "ATL",
      isMinFareGoWild: false,
      hasGoWild: true,
    });
    expect(model.destinations[1]).toMatchObject({
      destination: "MCO",
      isMinFareGoWild: true,
      hasGoWild: true,
    });
  });

  it("uses airport metadata for origin labels and city-search labels for destinations", () => {
    const model = buildMultiDestShareModel(
      makeArgs({ destinationCode: "CITY:NEW+YORK+CITY" }),
    );

    expect(model.kind).toBe("multi-destination");
    expect(model.originLabel).toBe("Chicago");
    expect(model.destinationLabel).toBe("New York City");
    expect(model.hasResults).toBe(true);
  });
});
