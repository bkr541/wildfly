/**
 * flightSnapshotWriter.ts
 *
 * Maps normalized NormalizedFlight[] → flight_snapshots rows and bulk-inserts
 * them non-blockingly after a flight_searches record is created.
 *
 * One row per flight leg is inserted so analytics can run per-segment queries.
 */

import { supabase } from "@/integrations/supabase/client";
import { getLogger } from "@/lib/logger";

const log = getLogger("SnapshotWriter");

/**
 * Build snapshot rows from normalized flights and insert them.
 *
 * @param flightSearchId  UUID of the just-created flight_searches row
 * @param normalizedFlights  flights array from normalizeGetMyDataResponse / normalizeAllDestinationsResponse
 * @param originIata  itinerary departure airport (top-level search origin)
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
    // ── Resolve legs ──────────────────────────────────────────────────────────
    // normalizeGetMyDataResponse builds legs from rawPayload.segments.
    // normalizeAllDestinationsResponse builds a single synthetic leg.
    const legs: Array<{
      origin: string;
      destination: string;
      departure_time: string;
      arrival_time: string;
    }> = Array.isArray(f.legs) && f.legs.length > 0 ? f.legs : [];

    if (legs.length === 0) {
      // Fallback: synthesise a single leg from top-level fields
      legs.push({
        origin: f.origin ?? f.departure_airport ?? originIata,
        destination: f.destination ?? f.arrival_airport ?? "",
        departure_time: f.departureTime ?? f.depart_time ?? "",
        arrival_time: f.arrivalTime ?? f.arrive_time ?? "",
      });
    }

    // ── Itinerary-level fare data (from rawPayload.fares) ────────────────────
    const rp = f.rawPayload ?? {};
    const rpFares = rp.fares ?? {};

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

    // Go Wild
    const gwFare = rpFares.go_wild ?? {};
    const hasgw = gwFare.total != null || f.fares?.go_wild != null;

    // Standard
    const stFare = rpFares.standard ?? {};

    // Discount Den
    const ddFare = rpFares.discount_den ?? {};

    // Miles
    const miFare = rpFares.miles ?? {};

    // ── Itinerary context ────────────────────────────────────────────────────
    const itineraryId: string =
      f.id?.toString() ??
      f.itinerary_id?.toString() ??
      // synthesise a stable id if none provided
      [f.origin ?? originIata, f.destination, f.departureTime ?? f.depart_time].join("|");

    const finalDest: string =
      f.destination ??
      f.arrival_airport ??
      legs[legs.length - 1]?.destination ??
      "";

    // ── One row per leg ──────────────────────────────────────────────────────
    legs.forEach((leg, idx) => {
      // Skip legs with missing times — can't satisfy NOT NULL constraint
      if (!leg.departure_time || !leg.arrival_time) return;

      rows.push({
        flight_search_id: flightSearchId,
        snapshot_at: snapshotAt,

        // itinerary identity
        source_itinerary_id: itineraryId,
        itinerary_flight_number: f.flightNumber ?? f.flight_number ?? null,
        airline: f.airline ?? f.carrier ?? null,
        origin_iata: originIata,
        final_destination_iata: finalDest || originIata,
        display_cabin: f.cabin ?? f.displayCabin ?? null,
        display_price: cleanNum(f.price ?? f.display_price),
        currency: f.currency ?? "USD",
        notes: f.notes ?? null,

        // trip context
        flight_type: f.flightType ?? f.flight_type ?? (f.stops === 0 ? "NonStop" : "Connect"),
        stops: cleanInt(f.stops),
        total_trip_minutes: cleanInt(f.totalTripMinutes ?? f.total_trip_minutes),
        total_duration_display: f.total_duration ?? f.duration ?? null,

        // leg grain
        leg_index: idx + 1,
        carrier_code: leg.origin ? (f.carrierCode ?? f.carrier_code ?? null) : null,
        flight_number: f.flightNumber ?? f.flight_number ?? `${f.airline ?? "XX"}${idx + 1}`,
        leg_origin_iata: leg.origin,
        leg_destination_iata: leg.destination,
        departure_at: leg.departure_time,
        arrival_at: leg.arrival_time,

        // Go Wild
        has_go_wild: hasgw,
        go_wild_available_seats: cleanInt(gwFare.availableSeats ?? gwFare.available_seats),
        go_wild_fare_status: cleanInt(gwFare.fareStatus ?? gwFare.fare_status),
        go_wild_total: cleanNum(gwFare.total ?? f.fares?.go_wild),
        go_wild_loyalty_points: cleanInt(gwFare.loyaltyPoints ?? gwFare.loyalty_points),

        // Standard
        standard_available_seats: cleanInt(stFare.availableSeats ?? stFare.available_seats),
        standard_fare_status: cleanInt(stFare.fareStatus ?? stFare.fare_status),
        standard_total: cleanNum(stFare.total ?? f.fares?.standard),
        standard_loyalty_points: cleanInt(stFare.loyaltyPoints ?? stFare.loyalty_points),

        // Discount Den
        discount_den_available_seats: cleanInt(ddFare.availableSeats ?? ddFare.available_seats),
        discount_den_fare_status: cleanInt(ddFare.fareStatus ?? ddFare.fare_status),
        discount_den_total: cleanNum(ddFare.total ?? f.fares?.discount_den),
        discount_den_loyalty_points: cleanInt(ddFare.loyaltyPoints ?? ddFare.loyalty_points),

        // Miles
        miles_available_seats: cleanInt(miFare.availableSeats ?? miFare.available_seats),
        miles_fare_status: cleanInt(miFare.fareStatus ?? miFare.fare_status),
        miles_total: cleanNum(miFare.total ?? f.fares?.miles),
        miles_loyalty_points: cleanInt(miFare.loyaltyPoints ?? miFare.loyalty_points),
      });
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
