// ─────────────────────────────────────────────────────────────────────────────
// flightShareModel.ts — framework-independent share-image data foundation
//
// Provides: typed model, GoWild detection, deduplication, and model builder.
// No React, no Supabase, no side-effects.
// ─────────────────────────────────────────────────────────────────────────────

// ── Raw payload types ─────────────────────────────────────────────────────────

/** A GoWild fare entry from the API: object, plain number, or absent. */
export type RawFareEntry =
  | number
  | {
      total?: number;
      price?: number;
      amount?: number;
      availableSeats?: number;
      available_seats?: number;
      [key: string]: unknown;
    }
  | null
  | undefined;

/** Flexible raw flight payload — the API surfaces multiple shapes. */
export interface RawFlightPayload {
  total_duration?: string;
  is_plus_one_day?: boolean;
  fares?: {
    basic?: number | null;
    economy?: number | null;
    premium?: number | null;
    business?: number | null;
    go_wild?: RawFareEntry;
    discount_den?: number | null;
    standard?: number | null;
    [key: string]: unknown;
  };
  legs?: Array<{
    origin: string;
    destination: string;
    departure_time: string;
    arrival_time: string;
  }>;
  flightNumber?: string;
  flight_number?: string;
  rawPayload?: {
    fares?: {
      go_wild?: RawFareEntry;
      discount_den?: RawFareEntry;
      standard?: RawFareEntry;
      [key: string]: unknown;
    };
    segments?: Array<{
      flight_number?: string;
      flightNumber?: string;
      departure_airport?: string;
      arrival_airport?: string;
      departure_time?: string;
      arrival_time?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface GoWildInfo {
  available: boolean;
  price: number | null;
  seats: number | null;
}

export interface FlightShareAirportInfo {
  iata: string;
  name: string;
  city: string;
  stateCode: string;
  country: string;
  locationId: number | null;
}

export type TimeOfDay = "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING";

export interface FlightShareOption {
  canonicalKey: string;
  airline: string;
  carrierCode: string;
  departureTimeLabel: string;
  arrivalTimeLabel: string;
  departureRaw: string;
  arrivalRaw: string;
  timeOfDay: TimeOfDay;
  /** e.g. "ORD>MCO>ATL" */
  route: string;
  routeAirports: string[];
  stopCount: number;
  isNonstop: boolean;
  isPlusOneDay: boolean;
  formattedDuration: string;
  flightNumbers: string[];
  lowestPublicFare: number | null;
  goWildFare: number | null;
  isGoWild: boolean;
  goWildSeats: number | null;
  /** Fare to emphasize on the share image: GoWild if available, else lowest public. */
  emphasizedFare: number | null;
}

export interface FlightShareAirportGroup {
  iata: string;
  name: string;
  city: string;
  stateCode: string;
  country: string;
  locationId: number | null;
  optionCount: number;
  /** Chronologically sorted by departure time. */
  options: FlightShareOption[];
}

export type FlightShareSectionType = "ONE-WAY" | "DEPARTING" | "RETURN";

export interface FlightShareSection {
  sectionType: FlightShareSectionType;
  label: string;
  dateValue: string | null;
  formattedDateLabel: string;
  airportGroups: FlightShareAirportGroup[];
  totalCount: number;
  nonstopCount: number;
  goWildCount: number;
}

export interface FlightShareModel {
  originLabel: string;
  destinationLabel: string;
  tripTypeLabel: string;
  combinedDateLabel: string;
  heroImageUrl: string;
  totalOptionCount: number;
  totalNonstopCount: number;
  totalGoWildCount: number;
  sections: FlightShareSection[];
  hasResults: boolean;
}

export interface BuildFlightShareModelArgs {
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string | null;
  arrivalDate: string | null;
  tripType: string;
  isRoundTrip: boolean;
  oneWayFlights: RawFlightPayload[];
  outboundFlights: RawFlightPayload[];
  returnFlights: RawFlightPayload[];
  airportMap: Record<
    string,
    { city: string; stateCode: string; name: string; locationId?: number | null; country?: string }
  >;
}

// ── Fare helpers ──────────────────────────────────────────────────────────────

/** Convert an unknown value to a finite positive number, or null. */
export function toFinitePositive(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Centralized GoWild detection.
 *
 * Checks explicit GoWild fields in order — does NOT infer from price thresholds.
 * A GoWild fare of $114 is recognized; a plain $39 basic fare is not.
 */
export function getGoWildInfo(flight: RawFlightPayload): GoWildInfo {
  let price: number | null = null;
  let seats: number | null = null;

  // 1. rawPayload.fares.go_wild — most authoritative API source
  const rawGw = flight.rawPayload?.fares?.go_wild;
  if (rawGw != null) {
    if (typeof rawGw === "object" && !Array.isArray(rawGw)) {
      const gw = rawGw as {
        total?: unknown;
        price?: unknown;
        amount?: unknown;
        availableSeats?: unknown;
        available_seats?: unknown;
      };
      const t = toFinitePositive(gw.total ?? gw.price ?? gw.amount);
      if (t !== null) price = t;
      const s = gw.availableSeats ?? gw.available_seats;
      if (s != null) {
        const sn = Number(s);
        if (Number.isFinite(sn) && sn >= 0) seats = sn;
      }
    } else {
      const t = toFinitePositive(rawGw);
      if (t !== null) price = t;
    }
  }

  // 2. fares.go_wild — set by normalizeAllDestinationsResponse
  if (price === null) {
    const normGw = flight.fares?.go_wild;
    if (normGw != null) {
      if (typeof normGw === "object" && !Array.isArray(normGw)) {
        const gw = normGw as { total?: unknown; price?: unknown; amount?: unknown };
        const t = toFinitePositive(gw.total ?? gw.price ?? gw.amount);
        if (t !== null) price = t;
      } else {
        const t = toFinitePositive(normGw);
        if (t !== null) price = t;
      }
    }
  }

  return { available: price !== null, price, seats };
}

/**
 * Lowest non-GoWild public fare.
 *
 * Uses economy (=discountDen) and premium (=standard) from the normalized fares,
 * with rawPayload discount_den/standard as additional fallbacks.
 * Does NOT use fares.basic, which can include the GoWild price.
 */
export function getLowestPublicFare(flight: RawFlightPayload): number | null {
  const fares = flight.fares ?? {};
  const rpFares = flight.rawPayload?.fares ?? {};

  const candidates: number[] = [];

  for (const v of [fares.economy, fares.premium, fares.business]) {
    const n = toFinitePositive(v);
    if (n !== null) candidates.push(n);
  }

  // rawPayload fallbacks (discount_den, standard)
  for (const key of ["discount_den", "standard"] as const) {
    const entry = rpFares[key];
    if (entry != null) {
      let n: number | null = null;
      if (typeof entry === "object" && !Array.isArray(entry)) {
        const e = entry as { total?: unknown; price?: unknown };
        n = toFinitePositive(e.total ?? e.price);
      } else {
        n = toFinitePositive(entry);
      }
      if (n !== null) candidates.push(n);
    }
  }

  return candidates.length > 0 ? Math.min(...candidates) : null;
}

/**
 * Fare to emphasize on the share image.
 * GoWild flights → GoWild fare; non-GoWild → lowest public fare.
 */
export function getEmphasizedFare(flight: RawFlightPayload): number | null {
  const gw = getGoWildInfo(flight);
  if (gw.available && gw.price !== null) return gw.price;
  return getLowestPublicFare(flight);
}

// ── Duration helpers ──────────────────────────────────────────────────────────

/** Parse duration strings in multiple formats to total minutes. */
export function parseDurationToMinutes(raw: string): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;

  if (s.includes(":")) {
    const parts = s.split(":");
    // "D.HH:MM:SS" — leading segment contains days.hours
    if (parts[0].includes(".")) {
      const [d, h] = parts[0].split(".");
      return (parseInt(d) || 0) * 1440 + (parseInt(h) || 0) * 60 + (parseInt(parts[1]) || 0);
    }
    // "D:H:MM:SS" — four segments
    if (parts.length === 4) {
      return (
        (parseInt(parts[0]) || 0) * 1440 +
        (parseInt(parts[1]) || 0) * 60 +
        (parseInt(parts[2]) || 0)
      );
    }
    // "H:MM:SS" or "H:MM"
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  }

  const h = s.match(/(\d+)\s*(hr|hrs|h)\b/i);
  const m = s.match(/(\d+)\s*(min|m)\b/i);
  return (parseInt(h?.[1] ?? "0") || 0) * 60 + (parseInt(m?.[1] ?? "0") || 0);
}

function formatDurationMinutes(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${String(m).padStart(2, "0")}m`);
  return parts.join(" ");
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/**
 * Parse a departure time string to a Date, supporting:
 * - ISO timestamps ("2026-06-13T07:00:00")
 * - Formatted times ("3:01 PM", "3:01PM")
 */
export function parseDepTime(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const result = new Date();
    result.setHours(h, min, 0, 0);
    return result;
  }
  return null;
}

function formatTimeLabel(raw: string): string {
  const d = parseDepTime(raw);
  if (d) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return raw.replace(/(\d)(AM|PM)/i, "$1 $2").replace(/\s{2,}/, " ");
}

function getTimeOfDay(depRaw: string): TimeOfDay {
  const d = parseDepTime(depRaw);
  if (!d) return "MORNING";
  const h = d.getHours();
  if (h < 12) return "MORNING";
  if (h < 14) return "MIDDAY";
  if (h < 18) return "AFTERNOON";
  return "EVENING";
}

// ── Date label helpers ────────────────────────────────────────────────────────

/**
 * Parse a date-only "YYYY-MM-DD" string as a local calendar date.
 * Appending T00:00:00 prevents UTC-to-local offset from shifting the day.
 */
function parseLocalDate(dateStr: string): Date {
  const iso = dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr;
  return new Date(iso);
}

function formatLocalDateNoYear(dateStr: string): string {
  try {
    const d = parseLocalDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatLocalDateWithYear(dateStr: string): string {
  try {
    const d = parseLocalDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ── City code helper ──────────────────────────────────────────────────────────

/** Strip "CITY:NEW+YORK+CITY" prefix and title-case the city name. */
export function prettifyCityCode(raw: string): string {
  if (!raw) return "";
  if (!raw.startsWith("CITY:")) return raw;
  return raw
    .slice(5)
    .toLowerCase()
    .split(/[\s+]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Flight identity and deduplication ─────────────────────────────────────────

function buildFlightNumbers(flight: RawFlightPayload): string[] {
  const nums: string[] = [];
  const segs = flight.rawPayload?.segments;
  if (Array.isArray(segs) && segs.length > 0) {
    for (const seg of segs) {
      const fn = seg.flight_number ?? seg.flightNumber;
      if (fn != null) nums.push(String(fn));
    }
  }
  if (nums.length === 0) {
    const fn = flight.flightNumber ?? flight.flight_number;
    if (fn != null) nums.push(String(fn));
  }
  return nums;
}

function buildRouteSequence(flight: RawFlightPayload): string {
  const legs = flight.legs ?? [];
  if (legs.length === 0) return "";
  const airports = [legs[0].origin, ...legs.map((l) => l.destination)];
  return airports.join(">");
}

/**
 * Stable canonical identity key for a flight record.
 *
 * When flight numbers are available: flightNums|route|departure
 * Arrival is deliberately excluded — the same actual flight can return
 * conflicting arrival metadata across API calls.
 *
 * Without flight numbers: falls back to route|departure|arrival|duration.
 */
export function getCanonicalFlightKey(flight: RawFlightPayload): string {
  const nums = buildFlightNumbers(flight);
  const route = buildRouteSequence(flight);
  const firstDep = flight.legs?.[0]?.departure_time ?? "";

  if (nums.length > 0) {
    return `${nums.join(",")}|${route}|${firstDep}`;
  }

  const lastArr = flight.legs?.[flight.legs!.length - 1]?.arrival_time ?? "";
  const dur = flight.total_duration ?? "";
  return `nonum|${route}|${firstDep}|${lastArr}|${dur}`;
}

/**
 * Remove duplicate flight records, preserving the first occurrence unless
 * a later duplicate has rawPayload where the first did not (richer data wins).
 */
export function dedupeFlights(flights: RawFlightPayload[]): RawFlightPayload[] {
  const seen = new Map<string, RawFlightPayload>();
  for (const flight of flights) {
    const key = getCanonicalFlightKey(flight);
    if (!seen.has(key)) {
      seen.set(key, flight);
    } else {
      // Prefer the record with rawPayload over one without
      const existing = seen.get(key)!;
      if (existing.rawPayload == null && flight.rawPayload != null) {
        seen.set(key, flight);
      }
    }
  }
  return Array.from(seen.values());
}

// ── Option builder ────────────────────────────────────────────────────────────

function buildFlightShareOption(flight: RawFlightPayload): FlightShareOption {
  const gwInfo = getGoWildInfo(flight);
  const lowestPublic = getLowestPublicFare(flight);
  const emphasizedFare = gwInfo.available ? gwInfo.price : lowestPublic;

  const legs = flight.legs ?? [];
  const depLeg = legs[0];
  const arrLeg = legs[legs.length - 1];

  const routeAirports =
    legs.length > 0 ? [legs[0].origin, ...legs.map((l) => l.destination)] : [];
  const route = routeAirports.join(">");

  const depRaw = depLeg?.departure_time ?? "";
  const arrRaw = arrLeg?.arrival_time ?? "";

  const durMins = parseDurationToMinutes(flight.total_duration ?? "");

  return {
    canonicalKey: getCanonicalFlightKey(flight),
    airline: "Frontier",
    carrierCode: "F9",
    departureTimeLabel: formatTimeLabel(depRaw),
    arrivalTimeLabel: formatTimeLabel(arrRaw),
    departureRaw: depRaw,
    arrivalRaw: arrRaw,
    timeOfDay: getTimeOfDay(depRaw),
    route,
    routeAirports,
    stopCount: Math.max(0, legs.length - 1),
    isNonstop: legs.length === 1,
    isPlusOneDay: flight.is_plus_one_day ?? false,
    formattedDuration:
      durMins > 0 ? formatDurationMinutes(durMins) : (flight.total_duration ?? ""),
    flightNumbers: buildFlightNumbers(flight),
    lowestPublicFare: lowestPublic,
    goWildFare: gwInfo.price,
    isGoWild: gwInfo.available,
    goWildSeats: gwInfo.seats,
    emphasizedFare,
  };
}

// ── Section builder ───────────────────────────────────────────────────────────

function buildFlightShareSection(
  sectionType: FlightShareSectionType,
  dateValue: string | null,
  flights: RawFlightPayload[],
  airportMap: BuildFlightShareModelArgs["airportMap"],
): FlightShareSection {
  const deduped = dedupeFlights(flights);

  // Group by first-leg origin, preserving encounter order
  const groupMap = new Map<string, RawFlightPayload[]>();
  const groupOrder: string[] = [];
  for (const f of deduped) {
    const origin = f.legs?.[0]?.origin ?? "???";
    if (!groupMap.has(origin)) {
      groupMap.set(origin, []);
      groupOrder.push(origin);
    }
    groupMap.get(origin)!.push(f);
  }

  const airportGroups: FlightShareAirportGroup[] = groupOrder.map((iata) => {
    const groupFlights = groupMap.get(iata)!;
    const info = airportMap[iata];

    const options = groupFlights
      .map((f) => buildFlightShareOption(f))
      .sort((a, b) => {
        const da = parseDepTime(a.departureRaw);
        const db = parseDepTime(b.departureRaw);
        if (da && db) return da.getTime() - db.getTime();
        return 0;
      });

    return {
      iata,
      name: info?.name ?? iata,
      city: info?.city ?? iata,
      stateCode: info?.stateCode ?? "",
      country: info?.country ?? "",
      locationId: info?.locationId ?? null,
      optionCount: options.length,
      options,
    };
  });

  const totalCount = airportGroups.reduce((s, g) => s + g.optionCount, 0);
  const nonstopCount = airportGroups.reduce(
    (s, g) => s + g.options.filter((o) => o.isNonstop).length,
    0,
  );
  const goWildCount = airportGroups.reduce(
    (s, g) => s + g.options.filter((o) => o.isGoWild).length,
    0,
  );

  const sectionLabels: Record<FlightShareSectionType, string> = {
    "ONE-WAY": "One-Way",
    DEPARTING: "Departing",
    RETURN: "Return",
  };
  const label = sectionLabels[sectionType];

  const formattedDateLabel = dateValue ? formatLocalDateNoYear(dateValue) : "";

  return {
    sectionType,
    label,
    dateValue,
    formattedDateLabel,
    airportGroups,
    totalCount,
    nonstopCount,
    goWildCount,
  };
}

// ── Top-level builder ─────────────────────────────────────────────────────────

/**
 * Build a complete FlightShareModel from raw search results.
 *
 * - Deduplicates flights per section independently.
 * - Groups by actual first-leg origin airport (not the CITY: prefix).
 * - Does not depend on UI filters, sort state, or expanded card state.
 */
export function buildFlightShareModel(args: BuildFlightShareModelArgs): FlightShareModel {
  const {
    departureAirport,
    arrivalAirport,
    departureDate,
    arrivalDate,
    isRoundTrip,
    oneWayFlights,
    outboundFlights,
    returnFlights,
    airportMap,
  } = args;

  // Origin display label
  const originLabel = departureAirport.startsWith("CITY:")
    ? prettifyCityCode(departureAirport)
    : (airportMap[departureAirport]?.city || departureAirport);

  // Destination display label
  const destinationLabel =
    !arrivalAirport || arrivalAirport === "All"
      ? "All Destinations"
      : arrivalAirport.startsWith("CITY:")
        ? prettifyCityCode(arrivalAirport)
        : (airportMap[arrivalAirport]?.city || arrivalAirport);

  const tripTypeLabel = isRoundTrip ? "Round-trip" : "One-way";

  // Combined date label
  let combinedDateLabel = "";
  if (isRoundTrip && departureDate && arrivalDate) {
    combinedDateLabel = `${formatLocalDateNoYear(departureDate)} – ${formatLocalDateWithYear(arrivalDate)} • Round-trip`;
  } else if (departureDate) {
    combinedDateLabel = `${formatLocalDateWithYear(departureDate)} • One-way`;
  }

  // Build sections
  const sections: FlightShareSection[] = isRoundTrip
    ? [
        buildFlightShareSection("DEPARTING", departureDate, outboundFlights, airportMap),
        buildFlightShareSection("RETURN", arrivalDate, returnFlights, airportMap),
      ]
    : [buildFlightShareSection("ONE-WAY", departureDate, oneWayFlights, airportMap)];

  // Hero image: first actual origin airport from the first section
  let heroImageUrl = "/assets/locations/init_background.png";
  const firstGroup = sections[0]?.airportGroups[0];
  if (firstGroup) {
    const locationId = airportMap[firstGroup.iata]?.locationId;
    if (locationId) {
      heroImageUrl = `/assets/locations/${locationId}_background.png`;
    }
  }

  const totalOptionCount = sections.reduce((s, sec) => s + sec.totalCount, 0);
  const totalNonstopCount = sections.reduce((s, sec) => s + sec.nonstopCount, 0);
  const totalGoWildCount = sections.reduce((s, sec) => s + sec.goWildCount, 0);

  return {
    originLabel,
    destinationLabel,
    tripTypeLabel,
    combinedDateLabel,
    heroImageUrl,
    totalOptionCount,
    totalNonstopCount,
    totalGoWildCount,
    sections,
    hasResults: totalOptionCount > 0,
  };
}
