// Define the shape of the raw incoming data for safety

interface RawFareData {
  basic: number | null;
  economy: number | null;
  premium: number | null;
  business: number | null;
}

interface RawLegData {
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
}

interface RawFlightData {
  total_duration: string | number;
  is_plus_one_day: boolean;
  fares: RawFareData;
  legs: RawLegData[];
}

interface RawAnchorData {
  origin: string;
  destination: string;
}

interface RawResponseJson {
  anchor?: RawAnchorData;
  flights?: RawFlightData[];
}

// Define the shape of your clean, normalized output

export interface NormalizedFlight {
  // Anchor route (the searched route), used to keep things sane if legs get weird
  search_origin: string;
  search_destination: string;

  // Flight summary (derived, with anchor as fallback)
  origin: string;
  destination: string;
  stops: number;
  is_plus_one_day: boolean;

  fares: {
    basic: number | null;
    economy: number | null;
    premium: number | null;
    business: number | null;
  };

  total_duration_raw: string;
  total_duration_minutes: number;

  depart_time_raw: string;
  arrive_time_raw: string;

  // Keep legs for debugging / detail views
  legs: RawLegData[];
}

function cleanNumberOrNull(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseDurationToMinutes(duration: string | number): number {
  const raw = String(duration).trim();
  if (!raw) return 0;

  let totalMinutes = 0;

  // Case 1: colon formats
  // Examples:
  // - "01:51:00"
  // - "1.03:06:00" (days.hours:minutes:seconds)
  // - "02:30" (hours:minutes)
  if (raw.includes(":")) {
    const parts = raw.split(":").map((p) => p.trim());

    if (parts.length === 2) {
      // HH:MM
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return hours * 60 + minutes;
    }

    if (parts.length >= 3) {
      // HH:MM:SS or D.HH:MM:SS
      let days = 0;
      let hours = 0;

      const hoursPart = parts[0];
      if (hoursPart.includes(".")) {
        const [d, h] = hoursPart.split(".");
        days = parseInt(d, 10) || 0;
        hours = parseInt(h, 10) || 0;
      } else {
        hours = parseInt(hoursPart, 10) || 0;
      }

      const minutes = parseInt(parts[1], 10) || 0;

      totalMinutes = days * 24 * 60 + hours * 60 + minutes;
      return totalMinutes;
    }
  }

  // Case 2: text formats
  // Examples:
  // - "2 hrs 21 min"
  // - "1 day(s) 1 hrs 40 min"
  // - "2h 21m"
  const daysMatch = raw.match(/(\d+)\s*day/i);
  const hoursMatch = raw.match(/(\d+)\s*(hr|hrs|hour|hours|h)\b/i);
  const minsMatch = raw.match(/(\d+)\s*(min|mins|minute|minutes|m)\b/i);

  if (daysMatch) totalMinutes += (parseInt(daysMatch[1], 10) || 0) * 24 * 60;
  if (hoursMatch) totalMinutes += (parseInt(hoursMatch[1], 10) || 0) * 60;
  if (minsMatch) totalMinutes += parseInt(minsMatch[1], 10) || 0;

  return totalMinutes;
}

export function normalizeWildflyFlightData(flightResponses: any[]): NormalizedFlight[] {
  const normalizedFlights: NormalizedFlight[] = [];

  for (const response of flightResponses) {
    const json: RawResponseJson = response?.data?.json || {};

    const anchor = json.anchor;
    const searchOrigin = anchor?.origin ?? "";
    const searchDestination = anchor?.destination ?? "";

    const flights: RawFlightData[] = json.flights || [];

    for (const flight of flights) {
      const legs = Array.isArray(flight.legs) ? flight.legs : [];

      // Prefer anchor (searched route) as the top-level origin/destination.
      // Fall back to legs if anchor is missing.
      const derivedOrigin = legs[0]?.origin ?? "";
      const derivedDestination = legs.length ? (legs[legs.length - 1]?.destination ?? "") : "";

      const origin = searchOrigin || derivedOrigin;
      const destination = searchDestination || derivedDestination;

      const departTime = legs[0]?.departure_time ?? "";
      const arriveTime = legs.length ? (legs[legs.length - 1]?.arrival_time ?? "") : "";

      const stops = Math.max(0, (legs?.length ?? 0) - 1);

      const totalDurationRaw = String(flight.total_duration ?? "");
      const totalDurationMinutes = parseDurationToMinutes(flight.total_duration);

      const fares = flight.fares || ({} as RawFareData);

      normalizedFlights.push({
        search_origin: searchOrigin,
        search_destination: searchDestination,

        origin,
        destination,
        stops,
        is_plus_one_day: Boolean(flight.is_plus_one_day),

        fares: {
          basic: cleanNumberOrNull(fares.basic),
          economy: cleanNumberOrNull(fares.economy),
          premium: cleanNumberOrNull(fares.premium),
          business: cleanNumberOrNull(fares.business),
        },

        total_duration_raw: totalDurationRaw,
        total_duration_minutes: totalDurationMinutes,

        depart_time_raw: departTime,
        arrive_time_raw: arriveTime,

        legs,
      });
    }
  }

  return normalizedFlights;
}
