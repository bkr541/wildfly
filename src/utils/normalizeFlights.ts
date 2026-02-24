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
 * Normalize a getSingleRoute response.
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
