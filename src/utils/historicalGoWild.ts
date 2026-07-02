export interface HistoricalGoWildSearchResult {
  origin: string;
  travelDate: string;
  observedAt: string | null;
  flights: unknown[];
  source: "stored_search" | "flight_snapshots";
}

export interface HistoricalGoWildRpcClient {
  rpc(
    functionName: "get_public_historical_gowild_search",
    args: { p_origin_iata: string; p_travel_date: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getYesterdayLocalIso(now = new Date()): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return toLocalIsoDate(yesterday);
}

export function isStrictlyPastLocalDate(value: string, now = new Date()): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  return value < toLocalIsoDate(now);
}

export function parseHistoricalGoWildSearchResult(
  value: unknown,
): HistoricalGoWildSearchResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const origin = typeof record.origin === "string" ? record.origin.toUpperCase() : "";
  const travelDate = typeof record.travelDate === "string" ? record.travelDate : "";
  const observedAt = typeof record.observedAt === "string" ? record.observedAt : null;
  const flights = Array.isArray(record.flights) ? record.flights : [];
  const source = record.source === "flight_snapshots" ? "flight_snapshots" : "stored_search";

  if (!/^[A-Z]{3}$/.test(origin) || !ISO_DATE_PATTERN.test(travelDate)) return null;

  return { origin, travelDate, observedAt, flights, source };
}

export async function fetchHistoricalGoWildSearch(
  client: HistoricalGoWildRpcClient,
  origin: string,
  travelDate: string,
): Promise<HistoricalGoWildSearchResult | null> {
  // Deliberately invoke rpc as an object method. Supabase's implementation
  // reads internal state from `this`, so assigning client.rpc to a standalone
  // variable causes the "reading 'rest'" runtime failure.
  const { data, error } = await client.rpc("get_public_historical_gowild_search", {
    p_origin_iata: origin,
    p_travel_date: travelDate,
  });

  if (error) throw error;
  return parseHistoricalGoWildSearchResult(data);
}

export function buildHistoricalMultiDestinationPayload(
  result: HistoricalGoWildSearchResult,
): string {
  return JSON.stringify({
    response: { flights: result.flights },
    departureDate: result.travelDate,
    arrivalDate: null,
    tripType: "One Way",
    departureAirport: result.origin,
    arrivalAirport: "All",
    fromCache: true,
    historical: true,
    historicalObservedAt: result.observedAt,
    historicalSource: result.source,
  });
}
