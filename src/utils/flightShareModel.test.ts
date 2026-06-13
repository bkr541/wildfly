import { describe, it, expect } from "vitest";
import {
  getGoWildInfo,
  getCanonicalFlightKey,
  dedupeFlights,
  buildFlightShareModel,
  prettifyCityCode,
  parseDurationToMinutes,
  type RawFlightPayload,
  type BuildFlightShareModelArgs,
} from "./flightShareModel";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFlight(overrides: Partial<RawFlightPayload> = {}): RawFlightPayload {
  return {
    total_duration: "02:30:00",
    is_plus_one_day: false,
    fares: { basic: 89, economy: 89, premium: 119, business: null },
    legs: [
      { origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" },
    ],
    flightNumber: "F9123",
    ...overrides,
  };
}

function makeBaseArgs(overrides: Partial<BuildFlightShareModelArgs> = {}): BuildFlightShareModelArgs {
  return {
    departureAirport: "ORD",
    arrivalAirport: "MCO",
    departureDate: "2026-06-13",
    arrivalDate: null,
    tripType: "One Way",
    isRoundTrip: false,
    oneWayFlights: [],
    outboundFlights: [],
    returnFlights: [],
    airportMap: {
      ORD: { city: "Chicago", stateCode: "IL", name: "O'Hare International", locationId: 42, country: "United States of America" },
      MDW: { city: "Chicago", stateCode: "IL", name: "Midway International", locationId: 42, country: "United States of America" },
      MCO: { city: "Orlando", stateCode: "FL", name: "Orlando International", locationId: 55, country: "United States of America" },
      ATL: { city: "Atlanta", stateCode: "GA", name: "Hartsfield-Jackson", locationId: 7, country: "United States of America" },
    },
    ...overrides,
  };
}

// ── Test 1: CITY:CHICAGO → two airport groups ─────────────────────────────────

describe("buildFlightShareModel", () => {
  it("groups CITY:CHICAGO flights into ORD and MDW groups", () => {
    const ordFlight = makeFlight({ legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }], flightNumber: "F9100" });
    const mdwFlight = makeFlight({ legs: [{ origin: "MDW", destination: "MCO", departure_time: "2026-06-13T09:00:00", arrival_time: "2026-06-13T12:30:00" }], flightNumber: "F9200" });

    const model = buildFlightShareModel(
      makeBaseArgs({
        departureAirport: "CITY:CHICAGO",
        oneWayFlights: [ordFlight, mdwFlight],
      }),
    );

    expect(model.sections).toHaveLength(1);
    const section = model.sections[0];
    expect(section.sectionType).toBe("ONE-WAY");
    const iatas = section.airportGroups.map((g) => g.iata);
    expect(iatas).toContain("ORD");
    expect(iatas).toContain("MDW");
    expect(section.airportGroups).toHaveLength(2);
  });

  // ── Test 2: Deduplication — same flight-number, route, departure, different arrival ──

  it("deduplicates flights with same flight number, route, and departure even when arrivals differ", () => {
    const f1 = makeFlight({ flightNumber: "F9123", legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }] });
    const f2 = makeFlight({ flightNumber: "F9123", legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:45:00" }] }); // different arrival

    const model = buildFlightShareModel(makeBaseArgs({ oneWayFlights: [f1, f2] }));
    const group = model.sections[0].airportGroups.find((g) => g.iata === "ORD");
    expect(group?.optionCount).toBe(1);
  });

  // ── Test 3: Same flight number, different departure date → NOT deduped ────────

  it("keeps flights with same flight number but different departure times as distinct", () => {
    const f1 = makeFlight({ flightNumber: "F9123", legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }] });
    const f2 = makeFlight({ flightNumber: "F9123", legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-14T07:00:00", arrival_time: "2026-06-14T10:30:00" }] }); // different date

    const deduped = dedupeFlights([f1, f2]);
    expect(deduped).toHaveLength(2);
  });

  // ── Test 4: GoWild fare $114.39 is recognized ─────────────────────────────────

  it("recognizes a GoWild fare of $114.39 from rawPayload.fares.go_wild", () => {
    const flight = makeFlight({
      fares: { basic: 89, economy: 89, premium: 119, business: null },
      rawPayload: { fares: { go_wild: { total: 114.39, availableSeats: 5 } } },
    });

    const info = getGoWildInfo(flight);
    expect(info.available).toBe(true);
    expect(info.price).toBeCloseTo(114.39);
  });

  // ── Test 5: Basic fare $39 with no go_wild → NOT GoWild ──────────────────────

  it("does not mark a $39 basic fare as GoWild when no go_wild field is present", () => {
    const flight = makeFlight({
      fares: { basic: 39, economy: 39, premium: 59, business: null },
      rawPayload: { fares: {} },
    });

    const info = getGoWildInfo(flight);
    expect(info.available).toBe(false);
    expect(info.price).toBeNull();
  });

  // ── Test 6: GoWild seats from availableSeats ──────────────────────────────────

  it("extracts GoWild seat count from availableSeats", () => {
    const flight = makeFlight({
      rawPayload: { fares: { go_wild: { total: 80, availableSeats: 3 } } },
    });
    const info = getGoWildInfo(flight);
    expect(info.seats).toBe(3);
  });

  // ── Test 7: GoWild seats from available_seats ─────────────────────────────────

  it("extracts GoWild seat count from available_seats (snake_case)", () => {
    const flight = makeFlight({
      rawPayload: { fares: { go_wild: { total: 80, available_seats: 7 } } },
    });
    const info = getGoWildInfo(flight);
    expect(info.seats).toBe(7);
  });

  // ── Test 8: Connecting flight route and stop count ────────────────────────────

  it("produces route ORD>MCO>ATL and stopCount of 1 for a connecting flight", () => {
    const flight: RawFlightPayload = {
      total_duration: "05:00:00",
      is_plus_one_day: false,
      fares: { basic: 99, economy: 99, premium: null, business: null },
      legs: [
        { origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" },
        { origin: "MCO", destination: "ATL", departure_time: "2026-06-13T11:30:00", arrival_time: "2026-06-13T12:45:00" },
      ],
      flightNumber: "F9301",
    };

    const model = buildFlightShareModel(makeBaseArgs({ oneWayFlights: [flight] }));
    const option = model.sections[0].airportGroups[0].options[0];

    expect(option.route).toBe("ORD>MCO>ATL");
    expect(option.stopCount).toBe(1);
    expect(option.isNonstop).toBe(false);
  });

  // ── Test 9: Round-trip produces DEPARTING and RETURN sections ─────────────────

  it("produces DEPARTING and RETURN sections for a round-trip search", () => {
    const outbound = makeFlight({ flightNumber: "F9001", legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }] });
    const returning = makeFlight({ flightNumber: "F9002", legs: [{ origin: "MCO", destination: "ORD", departure_time: "2026-06-17T14:00:00", arrival_time: "2026-06-17T16:30:00" }] });

    const model = buildFlightShareModel(
      makeBaseArgs({
        isRoundTrip: true,
        tripType: "Round Trip",
        arrivalDate: "2026-06-17",
        outboundFlights: [outbound],
        returnFlights: [returning],
      }),
    );

    const types = model.sections.map((s) => s.sectionType);
    expect(types).toEqual(["DEPARTING", "RETURN"]);
    expect(model.sections[0].airportGroups[0].iata).toBe("ORD");
    expect(model.sections[1].airportGroups[0].iata).toBe("MCO");
  });

  // ── Test 10: Date labels ──────────────────────────────────────────────────────

  it("formats one-way date label with year and round-trip label with em-dash", () => {
    const oneWay = buildFlightShareModel(makeBaseArgs({ oneWayFlights: [makeFlight()] }));
    expect(oneWay.combinedDateLabel).toMatch(/2026/);
    expect(oneWay.combinedDateLabel).toMatch(/One-way/);

    const roundTrip = buildFlightShareModel(
      makeBaseArgs({
        isRoundTrip: true,
        arrivalDate: "2026-06-17",
        outboundFlights: [makeFlight()],
        returnFlights: [],
      }),
    );
    expect(roundTrip.combinedDateLabel).toMatch(/–/);
    expect(roundTrip.combinedDateLabel).toMatch(/Round-trip/);
    // Year appears only once (at the end)
    expect(roundTrip.combinedDateLabel).toMatch(/2026 • Round-trip/);
  });

  // ── Test 11: Missing fares don't crash ────────────────────────────────────────

  it("does not crash when fares are entirely absent", () => {
    const flight: RawFlightPayload = {
      total_duration: "02:00:00",
      is_plus_one_day: false,
      fares: {},
      legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T08:00:00", arrival_time: "2026-06-13T11:00:00" }],
    };

    expect(() => buildFlightShareModel(makeBaseArgs({ oneWayFlights: [flight] }))).not.toThrow();

    const model = buildFlightShareModel(makeBaseArgs({ oneWayFlights: [flight] }));
    const option = model.sections[0].airportGroups[0].options[0];
    expect(option.emphasizedFare).toBeNull();
    expect(option.isGoWild).toBe(false);
  });

  // ── Test 12: Missing airport metadata → fallback to airport codes ─────────────

  it("falls back to the airport IATA code when airportMap has no entry for that code", () => {
    const flight = makeFlight({
      legs: [{ origin: "XYZ", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }],
      flightNumber: "F9999",
    });

    const model = buildFlightShareModel(makeBaseArgs({ oneWayFlights: [flight] }));
    const group = model.sections[0].airportGroups[0];

    expect(group.iata).toBe("XYZ");
    expect(group.city).toBe("XYZ");
    expect(group.name).toBe("XYZ");
  });
});

// ── Standalone unit tests ─────────────────────────────────────────────────────

describe("getGoWildInfo", () => {
  it("recognizes go_wild as a plain numeric value in rawPayload", () => {
    const flight = makeFlight({ rawPayload: { fares: { go_wild: 59.99 } } });
    const info = getGoWildInfo(flight);
    expect(info.available).toBe(true);
    expect(info.price).toBeCloseTo(59.99);
  });

  it("falls back to fares.go_wild when rawPayload is absent", () => {
    const flight = makeFlight({ fares: { basic: 50, economy: 50, premium: 80, business: null, go_wild: 50 } });
    const info = getGoWildInfo(flight);
    expect(info.available).toBe(true);
  });

  it("returns available=false when go_wild is 0 or negative", () => {
    const flight = makeFlight({ rawPayload: { fares: { go_wild: 0 } } });
    expect(getGoWildInfo(flight).available).toBe(false);
  });
});

describe("getCanonicalFlightKey", () => {
  it("builds key from segment flight numbers when rawPayload.segments is present", () => {
    const flight: RawFlightPayload = {
      legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }],
      rawPayload: {
        segments: [{ flight_number: "F9123", departure_airport: "ORD", arrival_airport: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }],
      },
    };
    const key = getCanonicalFlightKey(flight);
    expect(key).toContain("F9123");
    expect(key).toContain("ORD>MCO");
  });

  it("uses nonum prefix when no flight numbers exist", () => {
    const flight: RawFlightPayload = {
      legs: [{ origin: "ORD", destination: "MCO", departure_time: "2026-06-13T07:00:00", arrival_time: "2026-06-13T10:30:00" }],
    };
    const key = getCanonicalFlightKey(flight);
    expect(key).toMatch(/^nonum\|/);
  });
});

describe("prettifyCityCode", () => {
  it("strips CITY: prefix and title-cases", () => {
    expect(prettifyCityCode("CITY:CHICAGO")).toBe("Chicago");
    expect(prettifyCityCode("CITY:NEW+YORK+CITY")).toBe("New York City");
  });

  it("returns non-CITY strings unchanged", () => {
    expect(prettifyCityCode("ORD")).toBe("ORD");
    expect(prettifyCityCode("")).toBe("");
  });
});

describe("parseDurationToMinutes", () => {
  it("parses HH:MM:SS format", () => {
    expect(parseDurationToMinutes("02:30:00")).toBe(150);
  });

  it("parses D.HH:MM:SS format (1 day, 7h, 3m)", () => {
    expect(parseDurationToMinutes("1.07:03:00")).toBe(1440 + 423);
  });

  it("parses human-readable strings", () => {
    expect(parseDurationToMinutes("2 hrs 44 min")).toBe(164);
  });

  it("returns 0 for empty string", () => {
    expect(parseDurationToMinutes("")).toBe(0);
  });
});
