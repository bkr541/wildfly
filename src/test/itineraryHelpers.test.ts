import { describe, it, expect } from "vitest";
import {
  groupLegsIntoItineraries,
  computeGoWildSnapshotMetrics,
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
});
