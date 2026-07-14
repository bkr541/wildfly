export interface SharedFlightResultMeta {
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureDate: string | null;
  returnDate: string | null;
  tripType: "one-way" | "round-trip";
  allDestinations: boolean;
  flightCount: number;
}

export interface SingleDestinationMetaModel {
  originLabel: string;
  destinationLabel: string;
  tripTypeLabel: "One-way" | "Round-trip";
  totalOptionCount: number;
  sections: Array<{
    sectionType: "ONE-WAY" | "DEPARTING" | "RETURN";
    dateValue: string | null;
  }>;
}

export interface MultiDestinationMetaModel {
  kind: "multi-destination";
  originCode: string;
  tripTypeLabel: "One-way" | "Round-trip";
  departureDate: string | null;
  returnDate: string | null;
  totals: {
    flightCount: number;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getNestedRecord(
  value: unknown,
  ...keys: string[]
): Record<string, unknown> | null {
  let current: unknown = value;
  for (const key of keys) {
    current = asRecord(current)?.[key];
  }
  return asRecord(current);
}

/** Locate the repository's supported raw flight-array response shapes. */
export function findRawFlights(rawPayload: unknown): unknown[] | null {
  const root = asRecord(rawPayload);
  const candidates = [
    root?.flights,
    getNestedRecord(rawPayload, "response")?.flights,
    getNestedRecord(rawPayload, "data", "json")?.flights,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

export function deriveSingleDestinationMeta(
  displayModel: SingleDestinationMetaModel,
  sanitizedRaw: unknown,
): SharedFlightResultMeta {
  const tripType = displayModel.tripTypeLabel === "Round-trip"
    ? "round-trip"
    : "one-way";
  const allDestinations = displayModel.destinationLabel === "All Destinations";
  const departureDate = displayModel.sections[0]?.dateValue ?? null;
  const returnDate = tripType === "round-trip"
    ? displayModel.sections.find((section) => section.sectionType === "RETURN")?.dateValue ?? null
    : null;

  let departureAirport: string | null = null;
  let arrivalAirport: string | null = null;
  const firstFlight = findRawFlights(sanitizedRaw)?.[0];
  const firstFlightRecord = asRecord(firstFlight);

  if (typeof firstFlightRecord?.origin === "string") {
    departureAirport = firstFlightRecord.origin.trim().slice(0, 10) || null;
  }
  if (!allDestinations && typeof firstFlightRecord?.destination === "string") {
    arrivalAirport = firstFlightRecord.destination.trim().slice(0, 10) || null;
  }

  if (!departureAirport) departureAirport = displayModel.originLabel.slice(0, 200);
  if (!allDestinations && !arrivalAirport) {
    arrivalAirport = displayModel.destinationLabel.slice(0, 200);
  }

  return {
    departureAirport,
    arrivalAirport,
    departureDate,
    returnDate,
    tripType,
    allDestinations,
    flightCount: displayModel.totalOptionCount,
  };
}

export function deriveMultiDestinationMeta(
  displayModel: MultiDestinationMetaModel,
): SharedFlightResultMeta {
  const tripType = displayModel.tripTypeLabel === "Round-trip"
    ? "round-trip"
    : "one-way";

  return {
    departureAirport: displayModel.originCode,
    arrivalAirport: null,
    departureDate: displayModel.departureDate,
    returnDate: tripType === "round-trip" ? displayModel.returnDate : null,
    tripType,
    allDestinations: true,
    flightCount: displayModel.totals.flightCount,
  };
}
