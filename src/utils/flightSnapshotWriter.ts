/**
 * flightSnapshotWriter.ts
 *
 * Maps normalized NormalizedFlight[] → flight_snapshots rows and bulk-inserts
 * them non-blockingly after a flight_searches record is created.
 *
 * ONE ROW PER ITINERARY (regardless of nonstop or connecting). Each row carries
 * a stable_itinerary_key derived from the real-world itinerary identity so the
 * same flight can be tracked across separate provider searches.
 */

import { supabase } from "@/integrations/supabase/client";
import { getLogger } from "@/lib/logger";

const log = getLogger("SnapshotWriter");

const cleanNum = (v: any): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const cleanInt = (v: any): number | null => {
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const fareField = (fare: any, snake: string, camel: string): any => {
  if (!fare) return null;
  return fare[snake] ?? fare[camel] ?? null;
};

/** Normalize a datetime to a stable ISO string suitable for an identity key. */
function normIso(s: any): string {
  if (!s) return "?";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toISOString().slice(0, 19);
}

const up = (v: any) => (v ? String(v).toUpperCase() : "?");
const tok = (v: any) => (v == null || v === "" ? "?" : String(v));

/**
 * Build a stable identity key for a real-world itinerary.
 * Nonstop: ORIGIN|DEST|CARRIER|FLIGHTNO|DEPARTURE|ARRIVAL
 * Connecting: segments joined with '>'.
 */
export function buildStableItineraryKey(f: any): string | null {
  const segments: any[] = Array.isArray(f?.rawPayload?.segments)
    ? f.rawPayload.segments
    : [];
  const topCarrier = f?.airline ?? f?.carrier ?? null;
  const topNum = f?.flightNumber ?? f?.flight_number ?? null;

  if (segments.length > 1) {
    const parts = segments.map((s: any) => {
      const o = up(s.departure_airport ?? s.origin);
      const d = up(s.arrival_airport ?? s.destination);
      const c = up(s.airline ?? s.carrier ?? topCarrier);
      const n = tok(s.flight_number ?? s.flightNumber ?? "");
      const dep = normIso(s.departure_time);
      const arr = normIso(s.arrival_time);
      if (o === "?" || d === "?" || dep === "?" || arr === "?") return null;
      return `${o}|${d}|${c}|${n}|${dep}|${arr}`;
    });
    if (parts.some((p) => p === null)) return null;
    return parts.join(">");
  }

  // Nonstop (or unknown segments fallback)
  const legs: any[] = Array.isArray(f?.legs) ? f.legs : [];
  const first = segments[0] ?? legs[0];
  const last = segments[segments.length - 1] ?? legs[legs.length - 1];
  const o = up(first?.departure_airport ?? first?.origin ?? f?.origin);
  const d = up(last?.arrival_airport ?? last?.destination ?? f?.destination);
  const dep = normIso(first?.departure_time ?? f?.departureTime ?? f?.depart_time);
  const arr = normIso(last?.arrival_time ?? f?.arrivalTime ?? f?.arrive_time);
  if (o === "?" || d === "?" || dep === "?" || arr === "?") return null;
  return `${o}|${d}|${up(topCarrier)}|${tok(topNum)}|${dep}|${arr}`;
}

export type ResultSource =
  | "live_api"
  | "scheduled_bulk_search"
  | "admin_bulk_search"
  | "cache_hit";

export type WriteSnapshotsResult = {
  inserted: number;
  stableKeys: string[];
};

/**
 * Build snapshot rows (one per itinerary) from normalized flights and insert them.
 * Returns the stable_itinerary_keys observed so callers can trigger the
 * "disappeared itinerary" tracker.
 */
export async function writeFlightSnapshots(
  flightSearchId: string,
  normalizedFlights: any[],
  originIata: string,
): Promise<WriteSnapshotsResult> {
  if (!normalizedFlights?.length) return { inserted: 0, stableKeys: [] };

  const snapshotAt = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const stableKeys = new Set<string>();

  for (const f of normalizedFlights) {
    const legs: Array<{
      origin: string;
      destination: string;
      departure_time: string;
      arrival_time: string;
    }> = Array.isArray(f.legs) ? f.legs : [];

    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];

    const itineraryOrigin =
      firstLeg?.origin || f.origin || f.departure_airport || originIata;
    const itineraryDest =
      lastLeg?.destination || f.destination || f.arrival_airport || "";

    const departureAt =
      firstLeg?.departure_time || f.departureTime || f.depart_time || "";
    const arrivalAt =
      lastLeg?.arrival_time || f.arrivalTime || f.arrive_time || "";

    if (!departureAt || !arrivalAt) continue;

    const stops = cleanInt(f.stops) ?? Math.max(0, legs.length - 1);
    const flightType =
      f.flightType ?? f.flight_type ?? (stops > 0 ? "Connect" : "NonStop");

    const itineraryId: string =
      f.id?.toString() ??
      f.itinerary_id?.toString() ??
      [itineraryOrigin, itineraryDest, departureAt].join("|");

    const rp = f.rawPayload ?? {};
    const rpFares = rp.fares ?? {};
    const gwFare = rpFares.go_wild ?? {};
    const stFare = rpFares.standard ?? {};
    const ddFare = rpFares.discount_den ?? {};
    const miFare = rpFares.miles ?? {};

    const gwTotal = cleanNum(gwFare.total ?? f.fares?.go_wild);
    const gwSeats = cleanInt(fareField(gwFare, "available_seats", "availableSeats"));
    const hasGoWild = gwTotal != null;
    const availability_status: string =
      hasGoWild ? "returned" : "no_gowild_fare";

    const stableKey = buildStableItineraryKey(f);
    if (stableKey) stableKeys.add(stableKey);

    rows.push({
      flight_search_id: flightSearchId,
      snapshot_at: snapshotAt,

      source_itinerary_id: itineraryId,
      airline: f.airline ?? f.carrier ?? null,
      origin_iata: itineraryOrigin,
      display_cabin: f.cabin ?? f.displayCabin ?? null,
      display_price: cleanNum(f.price ?? f.display_price),
      currency: f.currency ?? "USD",
      notes: f.notes ?? null,

      flight_type: flightType,
      stops,
      total_duration_display: f.total_duration ?? f.duration ?? null,

      leg_index: 1,
      flight_number:
        f.flightNumber ?? f.flight_number ?? `${f.airline ?? "XX"}1`,
      leg_origin_iata: itineraryOrigin,
      leg_destination_iata: itineraryDest,
      departure_at: departureAt,
      arrival_at: arrivalAt,

      // identity + status (new)
      stable_itinerary_key: stableKey,
      availability_status,

      has_go_wild: hasGoWild,
      go_wild_available_seats: hasGoWild ? gwSeats : 0,
      go_wild_fare_status: cleanInt(fareField(gwFare, "fare_status", "fareStatus")),
      go_wild_total: gwTotal,
      go_wild_loyalty_points: cleanInt(fareField(gwFare, "loyalty_points", "loyaltyPoints")),

      standard_available_seats: cleanInt(fareField(stFare, "available_seats", "availableSeats")),
      standard_fare_status: cleanInt(fareField(stFare, "fare_status", "fareStatus")),
      standard_total: cleanNum(stFare.total ?? f.fares?.standard),
      standard_loyalty_points: cleanInt(fareField(stFare, "loyalty_points", "loyaltyPoints")),

      discount_den_available_seats: cleanInt(fareField(ddFare, "available_seats", "availableSeats")),
      discount_den_fare_status: cleanInt(fareField(ddFare, "fare_status", "fareStatus")),
      discount_den_total: cleanNum(ddFare.total ?? f.fares?.discount_den),
      discount_den_loyalty_points: cleanInt(fareField(ddFare, "loyalty_points", "loyaltyPoints")),

      miles_available_seats: cleanInt(fareField(miFare, "available_seats", "availableSeats")),
      miles_fare_status: cleanInt(fareField(miFare, "fare_status", "fareStatus")),
      miles_total: cleanNum(miFare.total ?? f.fares?.miles),
      miles_loyalty_points: cleanInt(fareField(miFare, "loyalty_points", "loyaltyPoints")),
    });
  }

  if (rows.length === 0) {
    log.debug("writeFlightSnapshots: no rows to insert", { flightSearchId });
    return { inserted: 0, stableKeys: [] };
  }

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await (supabase.from("flight_snapshots") as any).insert(batch);
    if (error) {
      log.warn("flight_snapshots batch insert failed (non-blocking)", {
        batchStart: i,
        error: error.message,
      });
    } else {
      inserted += batch.length;
    }
  }

  log.info("writeFlightSnapshots complete", { flightSearchId, rows: inserted });
  return { inserted, stableKeys: Array.from(stableKeys) };
}

/**
 * After a fresh provider search, mark previously-available GoWild itineraries
 * that are absent from the new returned set as 'not_returned'.
 * Scope guard: only for the same origin + (specific destination OR all) + travel date.
 */
export async function markDisappearedGoWildObservations(args: {
  flightSearchId: string;
  originIata: string;
  destinationIata: string | null; // null when all-destinations
  travelDate: string;             // YYYY-MM-DD
  returnedStableKeys: string[];
}): Promise<number> {
  try {
    const { data, error } = await (supabase.rpc as any)(
      "mark_disappeared_gowild_observations",
      {
        p_flight_search_id: args.flightSearchId,
        p_origin_iata: args.originIata,
        p_destination_iata: args.destinationIata,
        p_travel_date: args.travelDate,
        p_returned_stable_keys: args.returnedStableKeys,
      },
    );
    if (error) {
      log.warn("mark_disappeared_gowild_observations failed", { error: error.message });
      return 0;
    }
    return (data as number) ?? 0;
  } catch (e: any) {
    log.warn("mark_disappeared_gowild_observations threw", { error: e?.message });
    return 0;
  }
}
