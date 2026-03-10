import { getLogger } from "@/lib/logger";

const log = getLogger("Normalize");

// ── Types ────────────────────────────────────────────────────

export interface NormalizedFlight {
  total_duration: string;
  is_plus_one_day: boolean;
  fares: {
    basic: number | null;
    economy: number | null;
    premium: number | null;
    business: number | null;
  };
  legs: Array<{
    origin: string;
    destination: string;
    departure_time: string;
    arrival_time: string;
  }>;
}

export interface NormalizedFlightsResponse {
  flights: NormalizedFlight[];
}

// ── Helpers ──────────────────────────────────────────────────

/** Convert "02:44:00" → "2 hrs 44 min". Leaves human-readable strings unchanged. */
export function hhmmssToLabel(duration: string): string {
  const match = duration.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!match) return duration; // already human-readable or unknown format
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hrs`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(" ") || "0 min";
}

/** true if arrival calendar date is after departure date (handles ISO strings). */
export function isPlusOneDay(departIso: string, arriveIso: string): boolean {
  try {
    const depDate = new Date(departIso);
    const arrDate = new Date(arriveIso);
    if (isNaN(depDate.getTime()) || isNaN(arrDate.getTime())) return false;
    // Compare calendar dates only
    const depDay = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate());
    const arrDay = new Date(arrDate.getFullYear(), arrDate.getMonth(), arrDate.getDate());
    return arrDay.getTime() > depDay.getTime();
  } catch {
    return false;
  }
}

/** Return the smallest non-null number, or null if all are null/undefined. */
export function lowestNonNull(...nums: (number | null | undefined)[]): number | null {
  let min: number | null = null;
  for (const n of nums) {
    if (n != null && isFinite(n)) {
      if (min === null || n < min) min = n;
    }
  }
  return min;
}

// ── Normalizers ──────────────────────────────────────────────

/**
 * Normalize a getSingleRoute response (legacy edge function shape).
 * Input: raw.data.json.flights[] already has the target schema shape.
 */
export function normalizeSingleRouteResponse(raw: any): NormalizedFlightsResponse {
  const rawFlights: any[] = raw?.data?.json?.flights || [];
  log.info("normalizeSingleRoute", { inputCount: rawFlights.length });
  const flights: NormalizedFlight[] = rawFlights.map((f: any) => ({
    total_duration: f.total_duration ?? "",
    is_plus_one_day: f.is_plus_one_day ?? false,
    fares: {
      basic: f.fares?.basic ?? null,
      economy: f.fares?.economy ?? null,
      premium: f.fares?.premium ?? null,
      business: f.fares?.business ?? null,
    },
    legs: Array.isArray(f.legs)
      ? f.legs.map((leg: any) => ({
          origin: leg.origin ?? "",
          destination: leg.destination ?? "",
          departure_time: leg.departure_time ?? "",
          arrival_time: leg.arrival_time ?? "",
        }))
      : [],
  }));

  log.info("normalizeSingleRoute complete", { outputCount: flights.length });
  return { flights };
}

/**
 * Convert "HH:MM AM/PM" time string + a date string "YYYY-MM-DD" to an ISO datetime string.
 * Used for the getmydata.fly.dev API which returns time-only strings for departureTime/arrivalTime.
 */
function timeStringToISO(timeStr: string, dateStr: string): string {
  try {
    const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return timeStr;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
  } catch {
    return timeStr;
  }
}

/**
 * Normalize a getmydata.fly.dev /api/flights/search response.
 *
 * Input schema:
 *   { flights: Array<{ id, airline, flightNumber, origin, destination,
 *       departureTime ("HH:MM AM/PM"), arrivalTime ("HH:MM AM/PM"),
 *       duration ("HH:MM:SS"), stops, cabin, price, currency, notes,
 *       rawPayload: { departure_time (ISO), arrival_time (ISO),
 *         fares: { go_wild, discount_den, standard, miles } (each with .total),
 *         segments: [{ departure_airport, arrival_airport,
 *                      departure_time (ISO), arrival_time (ISO), ... }]
 *       }
 *     }>
 *   }
 *
 * Output: NormalizedFlightsResponse (unified schema used by FlightDestResults).
 */
export function normalizeGetMyDataResponse(raw: any, departureDate?: string): NormalizedFlightsResponse {
  const rawFlights: any[] = raw?.flights || [];
  log.info("normalizeGetMyData", { inputCount: rawFlights.length });

  const cleanFare = (val: any): number | null => {
    if (val == null) return null;
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const flights: NormalizedFlight[] = rawFlights.map((f: any) => {
    const rp = f.rawPayload ?? {};
    const segments: any[] = Array.isArray(rp.segments) ? rp.segments : [];

    // Build legs from segments (ISO times available there), fall back to top-level
    const legs = segments.length > 0
      ? segments.map((seg: any) => ({
          origin: seg.departure_airport ?? f.origin ?? "",
          destination: seg.arrival_airport ?? f.destination ?? "",
          departure_time: seg.departure_time ?? "",
          arrival_time: seg.arrival_time ?? "",
        }))
      : [
          {
            origin: f.origin ?? "",
            destination: f.destination ?? "",
            // Convert "HH:MM AM/PM" to ISO using departureDate when available
            departure_time: departureDate ? timeStringToISO(f.departureTime ?? "", departureDate) : (f.departureTime ?? ""),
            arrival_time: departureDate ? timeStringToISO(f.arrivalTime ?? "", departureDate) : (f.arrivalTime ?? ""),
          },
        ];

    // Fares: rawPayload.fares has go_wild / discount_den / standard / miles each with .total
    const fares = rp.fares ?? {};
    const goWild = cleanFare(fares.go_wild?.total);
    const discountDen = cleanFare(fares.discount_den?.total);
    const standard = cleanFare(fares.standard?.total);
    // "basic" = cheapest available; "economy" = discount_den; "premium" = standard
    const basic = lowestNonNull(goWild, discountDen, standard) ?? cleanFare(f.price);

    // is_plus_one_day: compare ISO dates of first dep and last arr
    const firstDep = legs[0]?.departure_time ?? "";
    const lastArr = legs[legs.length - 1]?.arrival_time ?? "";
    const plusOne = isPlusOneDay(firstDep, lastArr);

    return {
      total_duration: f.duration ?? "",
      is_plus_one_day: plusOne,
      fares: {
        basic,
        economy: discountDen,
        premium: standard,
        business: null,
      },
      legs,
    };
  });

  log.info("normalizeGetMyData complete", { outputCount: flights.length });
  return { flights };
}

/**
 * Normalize a getAllDestinations response.
 * Input: raw.data.json.flights[] with origin, destination, depart_time, arrive_time,
 *        duration (HH:MM:SS), stops, fares { standard, discount_den, go_wild }.
 */
export function normalizeAllDestinationsResponse(raw: any): NormalizedFlightsResponse {
  const rawFlights: any[] = raw?.data?.json?.flights || [];
  log.info("normalizeAllDestinations", { inputCount: rawFlights.length });
  // Deduplicate by composite key
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const f of rawFlights) {
    const key = `${f.origin}|${f.destination}|${f.depart_time}|${f.arrive_time}|${f.duration}|${f.stops}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(f);
    }
  }

  const cleanFare = (val: any): number | null =>
    val == null || val === -1 || val === undefined ? null : Number(val);

  const flights: NormalizedFlight[] = unique.map((f: any) => {
    const standard = cleanFare(f.fares?.standard);
    const discountDen = cleanFare(f.fares?.discount_den);
    const goWild = cleanFare(f.fares?.go_wild);

    return {
      total_duration: hhmmssToLabel(String(f.duration ?? "")),
      is_plus_one_day: isPlusOneDay(f.depart_time ?? "", f.arrive_time ?? ""),
      fares: {
        basic: lowestNonNull(goWild, discountDen, standard),
        economy: discountDen,
        premium: standard,
        business: null,
      },
      legs: [
        {
          origin: f.origin ?? "",
          destination: f.destination ?? "",
          departure_time: f.depart_time ?? "",
          arrival_time: f.arrive_time ?? "",
        },
      ],
    };
  });

  log.info("normalizeAllDestinations complete", { outputCount: flights.length, deduped: rawFlights.length - unique.length });
  return { flights };
}
