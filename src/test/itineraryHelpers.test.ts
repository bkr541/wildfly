import { describe, it, expect } from "vitest";
import {
  groupLegsIntoItineraries,
  computeGoWildSnapshotMetrics,
  getItineraryHeatmapData,
  getMostSeatsItineraryRoutes,
  getLowestSeatsItineraryRoutes,
  getSeatItineraryAirportStats,
} from "@/components/insights/itineraryHelpers";
import type { FlightLegRow, Itinerary } from "@/components/insights/insightTypes";

const baseLeg = (overrides: Partial<FlightLegRow>): FlightLegRow => ({
  id: Math.random().toString(),
  source_itinerary_id: "itin-1",
  leg_index: 0,
  origin_iata: null,
  destination_iata: null,
  leg_origin_iata: null,
  leg_destination_iata: null,
  departure_at: "2026-01-01T10:00:00Z",
  arrival_at: "2026-01-01T13:00:00Z",
  snapshot_at: "2026-01-01T08:00:00Z",
  has_go_wild: false,
  go_wild_available_seats: null,
  go_wild_total: null,
  standard_total: null,
  ...overrides,
});

describe("groupLegsIntoItineraries", () => {
  it("direct itinerary AUS → ORD with GoWild true and 12 seats", () => {
    const rows = [
      baseLeg({
        source_itinerary_id: "A",
        leg_index: 0,
        leg_origin_iata: "AUS",
        leg_destination_iata: "ORD",
        has_go_wild: true,
        go_wild_available_seats: 12,
      }),
    ];
    const [it] = groupLegsIntoItineraries(rows);
    expect(it.origin).toBe("AUS");
    expect(it.destination).toBe("ORD");
    expect(it.routeKey).toBe("AUS-ORD");
    expect(it.isGoWildAvailable).toBe(true);
    expect(it.availableSeats).toBe(12);
  });

  it("connecting AUS → DEN → ORD, both GoWild, seats 20 and 4 → 4", () => {
    const rows = [
      baseLeg({
        source_itinerary_id: "B",
        leg_index: 1,
        leg_origin_iata: "DEN",
        leg_destination_iata: "ORD",
        has_go_wild: true,
        go_wild_available_seats: 4,
      }),
      baseLeg({
        source_itinerary_id: "B",
        leg_index: 0,
        leg_origin_iata: "AUS",
        leg_destination_iata: "DEN",
        has_go_wild: true,
        go_wild_available_seats: 20,
      }),
    ];
    const [it] = groupLegsIntoItineraries(rows);
    expect(it.origin).toBe("AUS");
    expect(it.destination).toBe("ORD");
    expect(it.isGoWildAvailable).toBe(true);
    expect(it.availableSeats).toBe(4);
    expect(it.legs[0].leg_index).toBe(0);
  });

  it("connecting itinerary with one leg not GoWild → not available, 0 seats", () => {
    const rows = [
      baseLeg({
        source_itinerary_id: "C",
        leg_index: 0,
        leg_origin_iata: "AUS",
        leg_destination_iata: "DEN",
        has_go_wild: true,
        go_wild_available_seats: 20,
      }),
      baseLeg({
        source_itinerary_id: "C",
        leg_index: 1,
        leg_origin_iata: "DEN",
        leg_destination_iata: "ORD",
        has_go_wild: false,
        go_wild_available_seats: 8,
      }),
    ];
    const [it] = groupLegsIntoItineraries(rows);
    expect(it.isGoWildAvailable).toBe(false);
    expect(it.availableSeats).toBe(0);
    expect(it.routeKey).toBe("AUS-ORD");
  });
});

// ── computeGoWildSnapshotMetrics ────────────────────────────────────────────

const NOW = new Date("2026-05-27T12:00:00Z").getTime();

const makeItin = (overrides: Partial<Itinerary>): Itinerary => ({
  itineraryId: Math.random().toString(),
  legs: [],
  origin: "AAA",
  destination: "BBB",
  routeKey: "AAA-BBB",
  routeLabel: "AAA → BBB",
  departureAt: null,
  arrivalAt: null,
  snapshotAt: new Date(NOW - 60 * 60 * 1000).toISOString(), // 1h ago by default
  isGoWildAvailable: false,
  availableSeats: 0,
  totalGoWildPrice: null,
  totalStandardPrice: null,
  ...overrides,
});

describe("computeGoWildSnapshotMetrics", () => {
  it("Case A: availability and average seats across all itineraries", () => {
    const items = [
      makeItin({ isGoWildAvailable: true,  availableSeats: 4 }),
      makeItin({ isGoWildAvailable: true,  availableSeats: 2 }),
      makeItin({ isGoWildAvailable: false, availableSeats: 0 }),
      makeItin({ isGoWildAvailable: false, availableSeats: 0 }),
    ];
    const m = computeGoWildSnapshotMetrics(items, "7d", NOW);
    expect(m.totalItineraries).toBe(4);
    expect(m.goWildAvailableItineraries).toBe(2);
    expect(m.goWildAvailabilityRate).toBeCloseTo(50.0, 5);
    expect(m.totalGoWildAvailableSeats).toBe(6);
    expect(m.avgGoWildSeatsPerItinerary).toBeCloseTo(1.5, 5);
  });

  it("Case B: connecting itinerary bottleneck seats via groupLegsIntoItineraries", () => {
    const rows: FlightLegRow[] = [
      baseLeg({
        source_itinerary_id: "BX",
        leg_index: 0,
        leg_origin_iata: "ATL",
        leg_destination_iata: "DEN",
        has_go_wild: true,
        go_wild_available_seats: 5,
        snapshot_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
      }),
      baseLeg({
        source_itinerary_id: "BX",
        leg_index: 1,
        leg_origin_iata: "DEN",
        leg_destination_iata: "LAS",
        has_go_wild: true,
        go_wild_available_seats: 2,
        snapshot_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
      }),
      baseLeg({
        source_itinerary_id: "BY",
        leg_index: 0,
        leg_origin_iata: "ATL",
        leg_destination_iata: "LAS",
        has_go_wild: false,
        go_wild_available_seats: 0,
        snapshot_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
      }),
    ];
    const itineraries = groupLegsIntoItineraries(rows);
    const m = computeGoWildSnapshotMetrics(itineraries, "7d", NOW);
    expect(m.totalItineraries).toBe(2);
    expect(m.goWildAvailableItineraries).toBe(1);
    expect(m.goWildAvailabilityRate).toBeCloseTo(50.0, 5);
    expect(m.totalGoWildAvailableSeats).toBe(2);
    expect(m.avgGoWildSeatsPerItinerary).toBeCloseTo(1.0, 5);
  });

  it("Case C: trend = current − prior in percentage points", () => {
    const currentTs = new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString();
    const priorTs   = new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString();
    const items: Itinerary[] = [];
    // Current: 10 GoWild / 40 total = 25%
    for (let i = 0; i < 10; i++) items.push(makeItin({ snapshotAt: currentTs, isGoWildAvailable: true, availableSeats: 1 }));
    for (let i = 0; i < 30; i++) items.push(makeItin({ snapshotAt: currentTs, isGoWildAvailable: false }));
    // Prior: 6 GoWild / 40 total = 15%
    for (let i = 0; i < 6;  i++) items.push(makeItin({ snapshotAt: priorTs, isGoWildAvailable: true, availableSeats: 1 }));
    for (let i = 0; i < 34; i++) items.push(makeItin({ snapshotAt: priorTs, isGoWildAvailable: false }));

    const m = computeGoWildSnapshotMetrics(items, "7d", NOW);
    expect(m.totalItineraries).toBe(40);
    expect(m.goWildAvailableItineraries).toBe(10);
    expect(m.goWildAvailabilityRate).toBeCloseTo(25.0, 5);
    expect(m.trendPercentagePoints).not.toBeNull();
    expect(m.trendPercentagePoints!).toBeCloseTo(10.0, 5);
    expect(m.trendDirection).toBe("up");
  });

  it("Case D: no prior data → trendDirection = 'unavailable'", () => {
    const items = [
      makeItin({ snapshotAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), isGoWildAvailable: true, availableSeats: 3 }),
      makeItin({ snapshotAt: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), isGoWildAvailable: false }),
    ];
    const m = computeGoWildSnapshotMetrics(items, "24h", NOW);
    expect(m.totalItineraries).toBe(2);
    expect(m.trendPercentagePoints).toBeNull();
    expect(m.trendDirection).toBe("unavailable");
});

// ─── Availability heatmap (itinerary-level) ────────────────────────────────

// 2026-01-02 is a Friday (UTC), 2026-01-05 is a Monday, 2026-01-06 is a Tuesday.
const FRIDAY = "2026-01-02T15:00:00Z";
const MONDAY = "2026-01-05T15:00:00Z";

function itinLegs(
  id: string,
  legs: Array<{ origin: string; destination: string; goWild: boolean; departure: string }>,
): FlightLegRow[] {
  return legs.map((l, idx) =>
    baseLeg({
      id: `${id}-${idx}`,
      source_itinerary_id: id,
      leg_index: idx,
      leg_origin_iata: l.origin,
      leg_destination_iata: l.destination,
      has_go_wild: l.goWild,
      departure_at: l.departure,
      go_wild_available_seats: l.goWild ? 5 : null,
    }),
  );
}

describe("getItineraryHeatmapData", () => {
  it("Case A: connecting itinerary counts once in ATL/Friday", () => {
    const rows = [
      ...itinLegs("A", [
        { origin: "ATL", destination: "DEN", goWild: true, departure: FRIDAY },
        { origin: "DEN", destination: "LAS", goWild: true, departure: FRIDAY },
      ]),
      ...itinLegs("B", [
        { origin: "ATL", destination: "LAS", goWild: false, departure: FRIDAY },
      ]),
    ];
    const itins = groupLegsIntoItineraries(rows);
    const heatmap = getItineraryHeatmapData(itins);
    const atl = heatmap.find((r) => r.airport === "ATL")!;
    expect(atl).toBeDefined();
    expect(atl.totalItineraries).toBe(2);
    const friCell = atl.cells[4]; // Fri = index 4
    expect(friCell).not.toBeNull();
    expect(friCell!.totalItineraries).toBe(2);
    expect(friCell!.goWildItineraries).toBe(1);
    expect(friCell!.goWildRate).toBeCloseTo(50);
  });

  it("Case B: zero-success Monday vs empty Tuesday for DEN", () => {
    const rows = [
      ...itinLegs("D1", [
        { origin: "DEN", destination: "PHX", goWild: false, departure: MONDAY },
      ]),
      ...itinLegs("D2", [
        { origin: "DEN", destination: "SLC", goWild: false, departure: MONDAY },
      ]),
    ];
    const heatmap = getItineraryHeatmapData(groupLegsIntoItineraries(rows));
    const den = heatmap.find((r) => r.airport === "DEN")!;
    const monCell = den.cells[0];
    const tueCell = den.cells[1];
    expect(monCell).not.toBeNull();
    expect(monCell!.totalItineraries).toBe(2);
    expect(monCell!.goWildItineraries).toBe(0);
    expect(monCell!.goWildRate).toBe(0);
    expect(tueCell).toBeNull();
  });

  it("Case C: busiest origins ranked by itinerary count, not raw legs", () => {
    const rows = [
      // 1 connecting ATL itinerary with 3 legs
      ...itinLegs("AT", [
        { origin: "ATL", destination: "DFW", goWild: false, departure: FRIDAY },
        { origin: "DFW", destination: "DEN", goWild: false, departure: FRIDAY },
        { origin: "DEN", destination: "LAS", goWild: false, departure: FRIDAY },
      ]),
      // 2 direct DEN itineraries
      ...itinLegs("D1", [
        { origin: "DEN", destination: "SEA", goWild: true, departure: FRIDAY },
      ]),
      ...itinLegs("D2", [
        { origin: "DEN", destination: "PHX", goWild: false, departure: FRIDAY },
      ]),
    ];
    const heatmap = getItineraryHeatmapData(groupLegsIntoItineraries(rows));
    expect(heatmap[0].airport).toBe("DEN");
    expect(heatmap[0].totalItineraries).toBe(2);
    const atl = heatmap.find((r) => r.airport === "ATL")!;
    expect(atl.totalItineraries).toBe(1);
  });
});
});

// ─── Seat availability (route + airport, itinerary-based denominator) ──────

function seatItin(overrides: Partial<Itinerary>): Itinerary {
  return {
    itineraryId: Math.random().toString(),
    legs: [],
    origin: "AAA",
    destination: "BBB",
    routeKey: "AAA-BBB",
    routeLabel: "AAA → BBB",
    departureAt: null,
    arrivalAt: null,
    snapshotAt: "2026-05-27T00:00:00Z",
    isGoWildAvailable: false,
    availableSeats: 0,
    totalGoWildPrice: null,
    totalStandardPrice: null,
    ...overrides,
  };
}

function repeat<T>(n: number, factory: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => factory(i));
}

describe("seat availability — route-level (itinerary denominator)", () => {
  it("Case A: DEN→LAS — avg uses ALL itineraries, not only successful ones", () => {
    const items: Itinerary[] = [
      seatItin({ origin: "DEN", destination: "LAS", routeKey: "DEN-LAS", routeLabel: "DEN → LAS", isGoWildAvailable: true,  availableSeats: 4 }),
      seatItin({ origin: "DEN", destination: "LAS", routeKey: "DEN-LAS", routeLabel: "DEN → LAS", isGoWildAvailable: true,  availableSeats: 2 }),
      seatItin({ origin: "DEN", destination: "LAS", routeKey: "DEN-LAS", routeLabel: "DEN → LAS", isGoWildAvailable: false }),
      seatItin({ origin: "DEN", destination: "LAS", routeKey: "DEN-LAS", routeLabel: "DEN → LAS", isGoWildAvailable: false }),
    ];
    const { stats } = getMostSeatsItineraryRoutes(items);
    const r = stats.find((s) => s.routeKey === "DEN-LAS")!;
    expect(r.totalItineraries).toBe(4);
    expect(r.goWildItineraries).toBe(2);
    expect(r.totalSeats).toBe(6);
    expect(r.avgSeats).toBeCloseTo(1.5, 5);
    expect(r.maxSeats).toBe(4);
  });

  it("Case B: connecting ATL→DEN→LAS uses bottleneck seats and counts once", () => {
    const rows: FlightLegRow[] = [
      baseLeg({
        source_itinerary_id: "X",
        leg_index: 0,
        leg_origin_iata: "ATL",
        leg_destination_iata: "DEN",
        has_go_wild: true,
        go_wild_available_seats: 5,
      }),
      baseLeg({
        source_itinerary_id: "X",
        leg_index: 1,
        leg_origin_iata: "DEN",
        leg_destination_iata: "LAS",
        has_go_wild: true,
        go_wild_available_seats: 2,
      }),
      baseLeg({
        source_itinerary_id: "Y",
        leg_index: 0,
        leg_origin_iata: "ATL",
        leg_destination_iata: "LAS",
        has_go_wild: false,
        go_wild_available_seats: null,
      }),
    ];
    const itineraries = groupLegsIntoItineraries(rows);
    const { stats } = getMostSeatsItineraryRoutes(itineraries);
    const r = stats.find((s) => s.routeKey === "ATL-LAS")!;
    expect(r.totalItineraries).toBe(2);
    expect(r.goWildItineraries).toBe(1);
    expect(r.totalSeats).toBe(2);
    expect(r.avgSeats).toBeCloseTo(1.0, 5);
  });

  it("Case C: Lowest Seat Availability excludes routes with zero GoWild successes", () => {
    const items: Itinerary[] = [
      ...repeat(10, () => seatItin({ origin: "AAA", destination: "BBB", routeKey: "AAA-BBB", routeLabel: "AAA → BBB", isGoWildAvailable: false })),
      ...repeat(9, () => seatItin({ origin: "CCC", destination: "DDD", routeKey: "CCC-DDD", routeLabel: "CCC → DDD", isGoWildAvailable: false })),
      seatItin({ origin: "CCC", destination: "DDD", routeKey: "CCC-DDD", routeLabel: "CCC → DDD", isGoWildAvailable: true, availableSeats: 1 }),
    ];
    const { stats } = getLowestSeatsItineraryRoutes(items);
    expect(stats.find((s) => s.routeKey === "AAA-BBB")).toBeUndefined();
    const b = stats.find((s) => s.routeKey === "CCC-DDD")!;
    expect(b).toBeDefined();
    expect(b.totalItineraries).toBe(10);
    expect(b.goWildItineraries).toBe(1);
    expect(b.avgSeats).toBeCloseTo(0.1, 5);
  });
});

describe("seat availability — origin airport (itinerary denominator)", () => {
  it("Case D: ATL avg seats = totalGoWildSeats / totalItineraries", () => {
    const items: Itinerary[] = [
      seatItin({ origin: "ATL", isGoWildAvailable: true, availableSeats: 2 }),
      seatItin({ origin: "ATL", isGoWildAvailable: true, availableSeats: 3 }),
      seatItin({ origin: "ATL", isGoWildAvailable: true, availableSeats: 1 }),
      seatItin({ origin: "ATL", isGoWildAvailable: true, availableSeats: 4 }),
      ...repeat(16, () => seatItin({ origin: "ATL", isGoWildAvailable: false })),
    ];
    const stats = getSeatItineraryAirportStats(items);
    const atl = stats.find((s) => s.code === "ATL")!;
    expect(atl).toBeDefined();
    expect(atl.totalItineraries).toBe(20);
    expect(atl.goWildItineraries).toBe(4);
    expect(atl.totalSeats).toBe(10);
    expect(atl.avgSeats).toBeCloseTo(0.5, 5);
  });

  it("Case E: airport with zero GoWild observations is excluded", () => {
    const items: Itinerary[] = [
      ...repeat(5, () => seatItin({ origin: "ZZZ", isGoWildAvailable: false })),
      seatItin({ origin: "ATL", isGoWildAvailable: true, availableSeats: 2 }),
    ];
    const stats = getSeatItineraryAirportStats(items);
    expect(stats.find((s) => s.code === "ZZZ")).toBeUndefined();
    expect(stats.find((s) => s.code === "ATL")).toBeDefined();
  });
});
