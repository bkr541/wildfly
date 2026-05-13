import { describe, it, expect } from "vitest";
import { groupIntoItineraries, isGoWildLeg } from "@/components/insights/itineraryHelpers";
import type { RawSnapshotRow } from "@/components/insights/insightTypes";

function row(partial: Partial<RawSnapshotRow>): RawSnapshotRow {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    source_itinerary_id: partial.source_itinerary_id ?? "itin-1",
    leg_index: partial.leg_index ?? 0,
    origin_iata: partial.origin_iata ?? null,
    destination_iata: partial.destination_iata ?? null,
    leg_origin_iata: partial.leg_origin_iata ?? null,
    leg_destination_iata: partial.leg_destination_iata ?? null,
    departure_at: partial.departure_at ?? "2025-05-01T10:00:00",
    arrival_at: partial.arrival_at ?? "2025-05-01T12:00:00",
    snapshot_at: partial.snapshot_at ?? "2025-05-01T09:00:00Z",
    has_go_wild: partial.has_go_wild ?? false,
    go_wild_available_seats: partial.go_wild_available_seats ?? null,
    go_wild_total: partial.go_wild_total ?? null,
    standard_total: partial.standard_total ?? null,
  };
}

describe("itineraryHelpers", () => {
  it("isGoWildLeg parses string + boolean truthy values", () => {
    expect(isGoWildLeg(true)).toBe(true);
    expect(isGoWildLeg("true")).toBe(true);
    expect(isGoWildLeg("1")).toBe(true);
    expect(isGoWildLeg(false)).toBe(false);
    expect(isGoWildLeg(null)).toBe(false);
    expect(isGoWildLeg("no")).toBe(false);
  });

  it("direct itinerary marks GoWild and uses leg seats", () => {
    const result = groupIntoItineraries([
      row({
        source_itinerary_id: "a",
        leg_index: 0,
        leg_origin_iata: "AUS",
        leg_destination_iata: "ORD",
        has_go_wild: true,
        go_wild_available_seats: 12,
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].routeKey).toBe("AUS-ORD");
    expect(result[0].isGoWildAvailable).toBe(true);
    expect(result[0].availableSeats).toBe(12);
    expect(result[0].isDirect).toBe(true);
  });

  it("connecting itinerary with all GoWild uses MIN seats across legs", () => {
    const result = groupIntoItineraries([
      row({
        source_itinerary_id: "b",
        leg_index: 0,
        leg_origin_iata: "AUS",
        leg_destination_iata: "DEN",
        has_go_wild: true,
        go_wild_available_seats: 20,
      }),
      row({
        source_itinerary_id: "b",
        leg_index: 1,
        leg_origin_iata: "DEN",
        leg_destination_iata: "ORD",
        has_go_wild: true,
        go_wild_available_seats: 4,
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].routeKey).toBe("AUS-ORD");
    expect(result[0].isGoWildAvailable).toBe(true);
    expect(result[0].availableSeats).toBe(4);
    expect(result[0].isDirect).toBe(false);
  });

  it("connecting itinerary with one non-GoWild leg is NOT GoWild and seats=0", () => {
    const result = groupIntoItineraries([
      row({
        source_itinerary_id: "c",
        leg_index: 0,
        leg_origin_iata: "AUS",
        leg_destination_iata: "DEN",
        has_go_wild: true,
        go_wild_available_seats: 10,
      }),
      row({
        source_itinerary_id: "c",
        leg_index: 1,
        leg_origin_iata: "DEN",
        leg_destination_iata: "ORD",
        has_go_wild: false,
        go_wild_available_seats: null,
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].routeKey).toBe("AUS-ORD");
    expect(result[0].isGoWildAvailable).toBe(false);
    expect(result[0].availableSeats).toBe(0);
  });

  it("sorts legs by leg_index regardless of input order", () => {
    const result = groupIntoItineraries([
      row({
        source_itinerary_id: "d",
        leg_index: 1,
        leg_origin_iata: "DEN",
        leg_destination_iata: "ORD",
        has_go_wild: true,
        go_wild_available_seats: 5,
      }),
      row({
        source_itinerary_id: "d",
        leg_index: 0,
        leg_origin_iata: "AUS",
        leg_destination_iata: "DEN",
        has_go_wild: true,
        go_wild_available_seats: 8,
      }),
    ]);
    expect(result[0].origin).toBe("AUS");
    expect(result[0].destination).toBe("ORD");
    expect(result[0].availableSeats).toBe(5);
  });
});
