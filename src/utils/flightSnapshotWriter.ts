/**
 * flightSnapshotWriter.ts
 *
 * Maps normalized NormalizedFlight[] → flight_snapshots rows and bulk-inserts
 * them non-blockingly after a flight_searches record is created.
 *
 * ONE ROW PER ITINERARY (regardless of nonstop or connecting). Fare data is
 * itinerary-level and is NOT duplicated per leg. Detailed per-segment data
 * lives in flight_searches.json_body and in the raw payload cache; this table
 * is for snapshot-level analytics only.
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

/** Pull a fare value, checking snake_case then camelCase. */
const fareField = (fare: any, snake: string, camel: string): any => {
  if (!fare) return null;
  return fare[snake] ?? fare[camel] ?? null;
};

/**
 * Build snapshot rows (one per itinerary) from normalized flights and insert them.
 */
export async function writeFlightSnapshots(
  flightSearchId: string,
  normalizedFlights: any[],
  originIata: string,
): Promise<void> {
  if (!normalizedFlights?.length) return;

  const snapshotAt = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const f of normalizedFlights) {
    const legs: Array<{
      origin: string;
      destination: string;
      departure_time: string;
      arrival_time: string;
    }> = Array.isArray(f.legs) ? f.legs : [];

    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];

    // ── Itinerary identity ───────────────────────────────────────────────────
    const itineraryOrigin =
      firstLeg?.origin || f.origin || f.departure_airport || originIata;
    const itineraryDest =
      lastLeg?.destination || f.destination || f.arrival_airport || "";

    const departureAt =
      firstLeg?.departure_time || f.departureTime || f.depart_time || "";
    const arrivalAt =
      lastLeg?.arrival_time || f.arrivalTime || f.arrive_time || "";

    // Skip itineraries with no usable times (NOT NULL columns).
    if (!departureAt || !arrivalAt) continue;

    const stops =
      cleanInt(f.stops) ?? Math.max(0, legs.length - 1);
    const flightType =
      f.flightType ?? f.flight_type ?? (stops > 0 ? "Connect" : "NonStop");

    const itineraryId: string =
      f.id?.toString() ??
      f.itinerary_id?.toString() ??
      [itineraryOrigin, itineraryDest, departureAt].join("|");

    // ── Itinerary-level fare data (from rawPayload.fares) ────────────────────
    const rp = f.rawPayload ?? {};
    const rpFares = rp.fares ?? {};
    const gwFare = rpFares.go_wild ?? {};
    const stFare = rpFares.standard ?? {};
    const ddFare = rpFares.discount_den ?? {};
    const miFare = rpFares.miles ?? {};

    const gwTotal = cleanNum(gwFare.total ?? f.fares?.go_wild);
    const hasGoWild = gwTotal != null;

    rows.push({
      flight_search_id: flightSearchId,
      snapshot_at: snapshotAt,

      // itinerary identity
      source_itinerary_id: itineraryId,
      airline: f.airline ?? f.carrier ?? null,
      origin_iata: itineraryOrigin,
      display_cabin: f.cabin ?? f.displayCabin ?? null,
      display_price: cleanNum(f.price ?? f.display_price),
      currency: f.currency ?? "USD",
      notes: f.notes ?? null,

      // trip context (itinerary-level)
      flight_type: flightType,
      stops,
      total_duration_display: f.total_duration ?? f.duration ?? null,

      // legacy leg columns retained — populated with itinerary-level values
      leg_index: 1,
      flight_number:
        f.flightNumber ??
        f.flight_number ??
        `${f.airline ?? "XX"}1`,
      leg_origin_iata: itineraryOrigin,
      leg_destination_iata: itineraryDest,
      leg_route: `${itineraryOrigin}-${itineraryDest}`,
      departure_at: departureAt,
      arrival_at: arrivalAt,

      // Go Wild (itinerary-level)
      has_go_wild: hasGoWild,
      go_wild_available_seats: cleanInt(fareField(gwFare, "available_seats", "availableSeats")),
      go_wild_fare_status: cleanInt(fareField(gwFare, "fare_status", "fareStatus")),
      go_wild_total: gwTotal,
      go_wild_loyalty_points: cleanInt(fareField(gwFare, "loyalty_points", "loyaltyPoints")),

      // Standard (itinerary-level)
      standard_available_seats: cleanInt(fareField(stFare, "available_seats", "availableSeats")),
      standard_fare_status: cleanInt(fareField(stFare, "fare_status", "fareStatus")),
      standard_total: cleanNum(stFare.total ?? f.fares?.standard),
      standard_loyalty_points: cleanInt(fareField(stFare, "loyalty_points", "loyaltyPoints")),

      // Discount Den (itinerary-level)
      discount_den_available_seats: cleanInt(fareField(ddFare, "available_seats", "availableSeats")),
      discount_den_fare_status: cleanInt(fareField(ddFare, "fare_status", "fareStatus")),
      discount_den_total: cleanNum(ddFare.total ?? f.fares?.discount_den),
      discount_den_loyalty_points: cleanInt(fareField(ddFare, "loyalty_points", "loyaltyPoints")),

      // Miles (itinerary-level)
      miles_available_seats: cleanInt(fareField(miFare, "available_seats", "availableSeats")),
      miles_fare_status: cleanInt(fareField(miFare, "fare_status", "fareStatus")),
      miles_total: cleanNum(miFare.total ?? f.fares?.miles),
      miles_loyalty_points: cleanInt(fareField(miFare, "loyalty_points", "loyaltyPoints")),
    });
  }

  if (rows.length === 0) {
    log.debug("writeFlightSnapshots: no rows to insert", { flightSearchId });
    return;
  }

  // Insert in batches of 100 to stay well under Supabase row limits
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await (supabase.from("flight_snapshots") as any).insert(batch);
    if (error) {
      log.warn("flight_snapshots batch insert failed (non-blocking)", {
        batchStart: i,
        error: error.message,
      });
    }
  }

  log.info("writeFlightSnapshots complete", { flightSearchId, rows: rows.length });
}
