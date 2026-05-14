import type { FlightLegRow, Itinerary } from "./insightTypes";

export type ItineraryAirportStat = {
  code: string;
  totalItineraries: number;
  goWildItineraries: number;
  goWildRate: number; // 0-100
  avgSeats: number | null;
};

export type ItinerarySnapshotMetrics = {
  totalItineraries: number;
  goWildItineraries: number;
  availabilityRate: number | null; // 0-100
  avgSeats: number | null;
  trend: number | null; // current rate - previous rate, percentage points
};

function isGoWild(value: FlightLegRow["has_go_wild"]): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1";
  }
  return false;
}

function pickOrigin(leg: FlightLegRow): string {
  return (leg.leg_origin_iata ?? leg.origin_iata ?? "").trim().toUpperCase();
}

function pickDestination(leg: FlightLegRow): string {
  return (leg.leg_destination_iata ?? leg.destination_iata ?? "").trim().toUpperCase();
}

/**
 * Groups raw flight leg rows into itinerary objects keyed by source_itinerary_id.
 * Legs without a source_itinerary_id are skipped.
 */
export function groupLegsIntoItineraries(rows: FlightLegRow[]): Itinerary[] {
  const groups = new Map<string, FlightLegRow[]>();

  for (const row of rows) {
    const id = row.source_itinerary_id;
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
  }

  const itineraries: Itinerary[] = [];

  for (const [itineraryId, legsRaw] of groups) {
    const legs = [...legsRaw].sort(
      (a, b) => (a.leg_index ?? 0) - (b.leg_index ?? 0)
    );
    if (legs.length === 0) continue;

    const first = legs[0];
    const last = legs[legs.length - 1];

    const origin = pickOrigin(first);
    const destination = pickDestination(last);

    const allGoWild = legs.every((l) => isGoWild(l.has_go_wild));

    let availableSeats = 0;
    if (allGoWild) {
      const seats = legs
        .map((l) => l.go_wild_available_seats)
        .filter((s): s is number => typeof s === "number");
      availableSeats = seats.length === legs.length ? Math.min(...seats) : 0;
    }

    const sumOrNull = (vals: (number | null | undefined)[]): number | null => {
      const nums = vals.filter((v): v is number => typeof v === "number");
      return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
    };

    // Snapshot consistency: use the most recent snapshot_at across legs.
    const snapshotAt = legs
      .map((l) => l.snapshot_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] ?? first.snapshot_at;

    itineraries.push({
      itineraryId,
      legs,
      origin,
      destination,
      routeKey: `${origin}-${destination}`,
      routeLabel: `${origin} → ${destination}`,
      departureAt: first.departure_at,
      arrivalAt: last.arrival_at,
      snapshotAt,
      isGoWildAvailable: allGoWild,
      availableSeats,
      totalGoWildPrice: sumOrNull(legs.map((l) => l.go_wild_total)),
      totalStandardPrice: sumOrNull(legs.map((l) => l.standard_total)),
    });
  }

  return itineraries;
}
