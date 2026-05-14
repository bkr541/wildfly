import { describe, it, expect } from "vitest";
import { groupLegsIntoItineraries } from "@/components/insights/itineraryHelpers";
import type { FlightLegRow } from "@/components/insights/insightTypes";

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
