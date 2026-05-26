import { describe, it, expect } from "vitest";
import {
  groupLegsIntoItineraries,
  computeGoWildSnapshotMetrics,
  getItineraryHeatmapData,
  getMostSeatsItineraryRoutes,
  getLowestSeatsItineraryRoutes,
  getSeatItineraryAirportStats,
  getMostFrequentGoWildItineraryRoute,
  getOriginItineraryStats,
  getDestinationItineraryStats,
  getTopItineraryRoutes,
  getWorstItineraryRoutes,
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

// ─── GoWild Snapshot page-wiring (raw rows → group → compute) ───────────────
//
// Mirrors what GoWildInsights.tsx does: fetch raw flight_snapshots spanning
// current + prior windows, group into itineraries, then call
// computeGoWildSnapshotMetrics. Catches the regression where the page
// pre-filters to the current period and starves the trend comparison.

const WIRE_NOW = new Date("2026-05-27T12:00:00Z").getTime();

function rawLeg(
  itinId: string,
  snapshotAt: string,
  goWild: boolean,
  seats: number | null = null,
): FlightLegRow {
  return baseLeg({
    id: `${itinId}-leg`,
    source_itinerary_id: itinId,
    leg_index: 0,
    leg_origin_iata: "DEN",
    leg_destination_iata: "LAS",
    departure_at: snapshotAt,
    arrival_at: snapshotAt,
    snapshot_at: snapshotAt,
    has_go_wild: goWild,
    go_wild_available_seats: seats,
  });
}

function buildRawDataset(): FlightLegRow[] {
  const currentTs = new Date(WIRE_NOW - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1d ago
  const priorTs   = new Date(WIRE_NOW - 8 * 24 * 60 * 60 * 1000).toISOString(); // 8d ago
  const rows: FlightLegRow[] = [];
  // Current 7d: 10 GoWild / 40 total = 25%
  for (let i = 0; i < 10; i++) rows.push(rawLeg(`cur-gw-${i}`,   currentTs, true,  3));
  for (let i = 0; i < 30; i++) rows.push(rawLeg(`cur-no-${i}`,   currentTs, false));
  // Prior 7d: 6 GoWild / 40 total = 15%
  for (let i = 0; i < 6;  i++) rows.push(rawLeg(`prior-gw-${i}`, priorTs,   true,  2));
  for (let i = 0; i < 34; i++) rows.push(rawLeg(`prior-no-${i}`, priorTs,   false));
  return rows;
}

describe("GoWildSnapshotCard page wiring", () => {
  it("Case A: full dataset → headline scoped to current period AND trend computed", () => {
    const raw = buildRawDataset();
    // Correct page wiring: group the FULL fetched dataset.
    const itins = groupLegsIntoItineraries(raw);
    const m = computeGoWildSnapshotMetrics(itins, "7d", WIRE_NOW);

    // Headline reflects only the current 7d window (not the doubled fetch).
    expect(m.totalItineraries).toBe(40);
    expect(m.goWildAvailableItineraries).toBe(10);
    expect(m.goWildAvailabilityRate).toBeCloseTo(25.0, 5);

    // Prior 7d data is now visible to the helper → real trend, not "unavailable".
    expect(m.trendDirection).toBe("up");
    expect(m.trendPercentagePoints).not.toBeNull();
    expect(m.trendPercentagePoints!).toBeCloseTo(10.0, 5);
  });

  it("Case B: chart trend buckets only contain current-period snapshot timestamps", () => {
    const raw = buildRawDataset();
    const itins = groupLegsIntoItineraries(raw);
    const m = computeGoWildSnapshotMetrics(itins, "7d", WIRE_NOW);
    const windowStart = WIRE_NOW - 7 * 24 * 60 * 60 * 1000;
    for (const bucket of m.trendData) {
      // Bucket keys are local-day strings; allow one day of slack for TZ.
      const t = new Date(bucket.bucketKey + "T00:00:00Z").getTime();
      expect(isNaN(t)).toBe(false);
      expect(t).toBeGreaterThanOrEqual(windowStart - 24 * 60 * 60 * 1000);
      expect(t).toBeLessThanOrEqual(WIRE_NOW);
    }
  });

  it("Case C: broken page wiring (pre-filter to current) regresses to no-prior-data", () => {
    // This is the bug the fix prevents: if the page pre-filters raw rows to the
    // current window before grouping, the helper never sees prior itineraries.
    const raw = buildRawDataset();
    const currentCutoff = WIRE_NOW - 7 * 24 * 60 * 60 * 1000;
    const currentOnly = raw.filter((r) => new Date(r.snapshot_at).getTime() >= currentCutoff);
    const itins = groupLegsIntoItineraries(currentOnly);
    const m = computeGoWildSnapshotMetrics(itins, "7d", WIRE_NOW);
    expect(m.totalItineraries).toBe(40);
    expect(m.trendPercentagePoints).toBeNull();
    expect(m.trendDirection).toBe("unavailable");
  });

  it("Case D: true missing prior data → neutral state, current metrics still render", () => {
    const currentTs = new Date(WIRE_NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    const raw: FlightLegRow[] = [
      rawLeg("only-gw", currentTs, true, 4),
      rawLeg("only-no", currentTs, false),
    ];
    const itins = groupLegsIntoItineraries(raw);
    const m = computeGoWildSnapshotMetrics(itins, "7d", WIRE_NOW);
    expect(m.totalItineraries).toBe(2);
    expect(m.goWildAvailableItineraries).toBe(1);
    expect(m.goWildAvailabilityRate).toBeCloseTo(50.0, 5);
    expect(m.trendPercentagePoints).toBeNull();
    expect(m.trendDirection).toBe("unavailable");
  });
});

// ─── Most Frequent GoWild (rate-based ranking) ──────────────────────────────

function routeLegs(
  itinId: string,
  origin: string,
  destination: string,
  goWild: boolean,
): FlightLegRow[] {
  return [
    baseLeg({
      id: `${itinId}-leg`,
      source_itinerary_id: itinId,
      leg_index: 0,
      leg_origin_iata: origin,
      leg_destination_iata: destination,
      has_go_wild: goWild,
      go_wild_available_seats: goWild ? 3 : null,
    }),
  ];
}

function buildRoute(
  origin: string,
  destination: string,
  prefix: string,
  goWildCount: number,
  totalCount: number,
): FlightLegRow[] {
  const rows: FlightLegRow[] = [];
  for (let i = 0; i < goWildCount; i++) {
    rows.push(...routeLegs(`${prefix}-gw-${i}`, origin, destination, true));
  }
  for (let i = 0; i < totalCount - goWildCount; i++) {
    rows.push(...routeLegs(`${prefix}-no-${i}`, origin, destination, false));
  }
  return rows;
}

describe("getMostFrequentGoWildItineraryRoute", () => {
  it("Case A: higher rate beats higher raw GoWild count", () => {
    const rows = [
      ...buildRoute("DEN", "LAS", "A", 42, 110), // 38.2%
      ...buildRoute("ATL", "MCO", "B", 30, 40),  // 75.0%
    ];
    const result = getMostFrequentGoWildItineraryRoute(groupLegsIntoItineraries(rows));
    expect(result).not.toBeNull();
    expect(result!.limited).toBe(false);
    expect(result!.route.routeKey).toBe("ATL-MCO");
  });

  it("Case B: tied rate broken by higher raw GoWild count", () => {
    const rows = [
      ...buildRoute("DEN", "LAS", "A", 30, 60), // 50%, 30 matches
      ...buildRoute("ATL", "MCO", "B", 20, 40), // 50%, 20 matches
    ];
    const result = getMostFrequentGoWildItineraryRoute(groupLegsIntoItineraries(rows));
    expect(result!.route.routeKey).toBe("DEN-LAS");
    expect(result!.limited).toBe(false);
  });

  it("Case C: 1/1=100% low-volume route cannot beat a qualified route", () => {
    const rows = [
      ...buildRoute("XXX", "YYY", "tiny", 1, 1),  // 100% but below threshold
      ...buildRoute("ATL", "MCO", "qual", 20, 40), // 50%, qualified
    ];
    const result = getMostFrequentGoWildItineraryRoute(groupLegsIntoItineraries(rows));
    expect(result!.route.routeKey).toBe("ATL-MCO");
    expect(result!.limited).toBe(false);
  });

  it("Case D: no qualified routes → falls back and flags Limited data", () => {
    const rows = [
      ...buildRoute("AAA", "BBB", "a", 4, 8),  // 50%
      ...buildRoute("CCC", "DDD", "b", 2, 10), // 20%
    ];
    const result = getMostFrequentGoWildItineraryRoute(groupLegsIntoItineraries(rows));
    expect(result).not.toBeNull();
    expect(result!.limited).toBe(true);
    expect(result!.route.routeKey).toBe("AAA-BBB");
  });

  it("returns null when no route has any GoWild itineraries", () => {
    const rows = buildRoute("AAA", "BBB", "none", 0, 5);
    const result = getMostFrequentGoWildItineraryRoute(groupLegsIntoItineraries(rows));
    expect(result).toBeNull();
  });
});

describe("airport & route supporting avg seats (all-itinerary denominator)", () => {
  it("Case A: DEN origin — avg uses total itineraries (15/20 = 0.75)", () => {
    const items: Itinerary[] = [
      seatItin({ origin: "DEN", routeKey: "DEN-XXX", routeLabel: "DEN → XXX", destination: "XXX", isGoWildAvailable: true, availableSeats: 3 }),
      seatItin({ origin: "DEN", routeKey: "DEN-XXX", routeLabel: "DEN → XXX", destination: "XXX", isGoWildAvailable: true, availableSeats: 2 }),
      seatItin({ origin: "DEN", routeKey: "DEN-XXX", routeLabel: "DEN → XXX", destination: "XXX", isGoWildAvailable: true, availableSeats: 4 }),
      seatItin({ origin: "DEN", routeKey: "DEN-XXX", routeLabel: "DEN → XXX", destination: "XXX", isGoWildAvailable: true, availableSeats: 1 }),
      seatItin({ origin: "DEN", routeKey: "DEN-XXX", routeLabel: "DEN → XXX", destination: "XXX", isGoWildAvailable: true, availableSeats: 5 }),
      ...repeat(15, () => seatItin({ origin: "DEN", routeKey: "DEN-XXX", routeLabel: "DEN → XXX", destination: "XXX", isGoWildAvailable: false })),
    ];
    const { stats } = getOriginItineraryStats(items);
    const den = stats.find((s) => s.code === "DEN")!;
    expect(den.totalItineraries).toBe(20);
    expect(den.goWildItineraries).toBe(5);
    expect(den.goWildRate).toBeCloseTo(25, 5);
    expect(den.totalGoWildAvailableSeats).toBe(15);
    expect(den.avgGoWildSeatsPerItinerary).toBeCloseTo(0.75, 5);
  });

  it("Case B: LAS destination — avg uses arriving itineraries (30/50 = 0.6)", () => {
    const items: Itinerary[] = [
      ...repeat(10, (i) => seatItin({ origin: "XXX", destination: "LAS", routeKey: "XXX-LAS", routeLabel: "XXX → LAS", isGoWildAvailable: true, availableSeats: 3 })),
      ...repeat(40, () => seatItin({ origin: "XXX", destination: "LAS", routeKey: "XXX-LAS", routeLabel: "XXX → LAS", isGoWildAvailable: false })),
    ];
    const { stats } = getDestinationItineraryStats(items);
    const las = stats.find((s) => s.code === "LAS")!;
    expect(las.totalItineraries).toBe(50);
    expect(las.goWildItineraries).toBe(10);
    expect(las.goWildRate).toBeCloseTo(20, 5);
    expect(las.totalGoWildAvailableSeats).toBe(30);
    expect(las.avgGoWildSeatsPerItinerary).toBeCloseTo(0.6, 5);
  });

  it("Case C: Top route DEN→LAS — avg uses all route itineraries (45/50 = 0.9)", () => {
    const items: Itinerary[] = [
      ...repeat(15, () => seatItin({ origin: "DEN", destination: "LAS", routeKey: "DEN-LAS", routeLabel: "DEN → LAS", isGoWildAvailable: true, availableSeats: 3 })),
      ...repeat(35, () => seatItin({ origin: "DEN", destination: "LAS", routeKey: "DEN-LAS", routeLabel: "DEN → LAS", isGoWildAvailable: false })),
      // padding qualified routes to avoid limited
      ...repeat(5, (i) => Array.from({ length: 30 }, () => seatItin({ origin: `O${i}`, destination: `D${i}`, routeKey: `O${i}-D${i}`, routeLabel: `O${i} → D${i}`, isGoWildAvailable: true, availableSeats: 1 }))).flat(),
    ];
    const { routes } = getTopItineraryRoutes(items);
    const denLas = routes.find((r) => r.routeKey === "DEN-LAS")!;
    expect(denLas).toBeDefined();
    expect(denLas.totalItineraries).toBe(50);
    expect(denLas.goWildItineraries).toBe(15);
    expect(denLas.goWildRate).toBeCloseTo(30, 5);
    expect(denLas.totalGoWildAvailableSeats).toBe(45);
    expect(denLas.avgGoWildSeatsPerItinerary).toBeCloseTo(0.9, 5);
  });

  it("Case D: Worst route ATL→ORD with 0 GoWild — 0% rate and 0 avg", () => {
    const items: Itinerary[] = [
      ...repeat(40, () => seatItin({ origin: "ATL", destination: "ORD", routeKey: "ATL-ORD", routeLabel: "ATL → ORD", isGoWildAvailable: false })),
    ];
    const { routes } = getWorstItineraryRoutes(items);
    const r = routes.find((x) => x.routeKey === "ATL-ORD")!;
    expect(r).toBeDefined();
    expect(r.goWildRate).toBe(0);
    expect(r.avgGoWildSeatsPerItinerary).toBe(0);
    expect(r.totalGoWildAvailableSeats).toBe(0);
  });
});
