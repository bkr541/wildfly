import type { Itinerary, RawSnapshotRow } from "./insightTypes";

export function isGoWildLeg(value: boolean | string | number | null | undefined): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1";
  }
  return false;
}

function normalizeAirportCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const t = code.trim().toUpperCase();
  if (t.length < 2 || t.length > 4) return null;
  return t;
}

/**
 * Group raw flight_snapshots leg rows into full itineraries by source_itinerary_id.
 * Each itinerary represents a complete trip (potentially multi-leg/connecting).
 *
 * Rules:
 * - Origin = first leg's leg_origin_iata (fallback origin_iata)
 * - Destination = last leg's leg_destination_iata (fallback destination_iata)
 * - GoWild availability is true ONLY if every leg has has_go_wild = true
 * - Available seats = MIN seats across all legs (weakest leg limits the trip)
 * - Departure = first leg departure_at, Arrival = last leg arrival_at
 */
export function groupIntoItineraries(rows: RawSnapshotRow[]): Itinerary[] {
  const map = new Map<string, RawSnapshotRow[]>();

  for (const r of rows) {
    if (!r.source_itinerary_id) continue;
    const key = r.source_itinerary_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  const itineraries: Itinerary[] = [];

  for (const [itineraryId, group] of map.entries()) {
    const legs = [...group].sort(
      (a, b) => (a.leg_index ?? 0) - (b.leg_index ?? 0)
    );
    if (legs.length === 0) continue;

    const first = legs[0];
    const last = legs[legs.length - 1];

    const origin =
      normalizeAirportCode(first.leg_origin_iata) ??
      normalizeAirportCode(first.origin_iata);
    const destination =
      normalizeAirportCode(last.leg_destination_iata) ??
      normalizeAirportCode(last.destination_iata ?? null);

    if (!origin || !destination) continue;

    const allGoWild = legs.every((l) => isGoWildLeg(l.has_go_wild));
    let availableSeats = 0;
    if (allGoWild) {
      const seatNumbers = legs.map((l) => l.go_wild_available_seats ?? 0);
      availableSeats = seatNumbers.length > 0 ? Math.min(...seatNumbers) : 0;
    }

    const sumOrNull = (vals: (number | null)[]): number | null => {
      const filtered = vals.filter((v): v is number => typeof v === "number");
      if (filtered.length === 0) return null;
      return filtered.reduce((a, b) => a + b, 0);
    };

    // Use the most recent snapshot_at across the legs for consistency
    const snapshotAt = legs
      .map((l) => l.snapshot_at)
      .filter((s): s is string => !!s)
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
      totalGoWildPrice: allGoWild ? sumOrNull(legs.map((l) => l.go_wild_total)) : null,
      totalStandardPrice: sumOrNull(legs.map((l) => l.standard_total)),
      isDirect: legs.length === 1,
    });
  }

  return itineraries;
}

/** Filter itineraries to those whose snapshotAt falls within an inclusive ISO range. */
export function filterItinerariesByDateRange(
  itineraries: Itinerary[],
  range?: { start: string; end: string }
): Itinerary[] {
  if (!range) return itineraries;
  const startTs = new Date(range.start).getTime();
  const endTs = new Date(range.end).getTime();
  return itineraries.filter((it) => {
    const t = new Date(it.snapshotAt).getTime();
    return !isNaN(t) && t >= startTs && t <= endTs;
  });
}
