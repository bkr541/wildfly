import marketOfferingsRaw from "@/data/market_offerings.json";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketOfferingStation {
  stationCode: string;
  stationName: string;
  cityAndCode: string;
  countryCode: string;
  countryHeader: string;
  state?: string;
  stateCode?: string;
  imageURL?: string;
}

export interface MarketOfferingRoute {
  fromStation: string;
  toStations: string[];
}

export interface MarketOfferings {
  marketDetails: MarketOfferingStation[];
  markets: MarketOfferingRoute[];
}

// ── Parsed data ───────────────────────────────────────────────────────────────

const data = marketOfferingsRaw as MarketOfferings;

// ── Active station codes (from marketDetails) ─────────────────────────────────

/** Set of every IATA code Frontier currently operates, normalised to uppercase. */
export const activeFrontierStationCodes: Set<string> = new Set(
  data.marketDetails
    .map((s) => s.stationCode.trim().toUpperCase())
    .filter(Boolean),
);

// ── Route map (from markets) ──────────────────────────────────────────────────

/** origin IATA → sorted, deduplicated destination IATA codes. */
export const frontierRouteMap: Record<string, string[]> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const market of data.markets) {
    const origin = market.fromStation?.trim().toUpperCase();
    if (!origin) continue;
    if (!map[origin]) map[origin] = new Set();
    for (const dest of market.toStations ?? []) {
      const d = dest?.trim().toUpperCase();
      if (d) map[origin].add(d);
    }
  }
  const result: Record<string, string[]> = {};
  for (const key of Object.keys(map).sort()) {
    result[key] = [...map[key]].sort();
  }
  return result;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns all destination IATA codes offered from `originIata`.
 * Returns an empty array for null / undefined / unknown origins.
 */
export function getDestinationCodesForOrigin(
  originIata: string | null | undefined,
): string[] {
  if (!originIata) return [];
  return frontierRouteMap[originIata.trim().toUpperCase()] ?? [];
}

/**
 * Returns true only when Frontier currently offers a nonstop or connecting
 * route from `originIata` to `destinationIata`.
 */
export function isFrontierRouteOffered(
  originIata: string,
  destinationIata: string,
): boolean {
  const dest = destinationIata.trim().toUpperCase();
  return getDestinationCodesForOrigin(originIata).includes(dest);
}

/**
 * Filters an airport array to only airports whose iata_code appears in `codes`.
 * `codes` may be any iterable (array, Set, etc.) of IATA strings; matching is
 * case-insensitive.
 */
export function filterAirportsToCodes<T extends { iata_code: string }>(
  airports: T[],
  codes: Iterable<string>,
): T[] {
  const codeSet = new Set(
    Array.from(codes).map((c) => c.trim().toUpperCase()),
  );
  return airports.filter((a) => codeSet.has(a.iata_code.trim().toUpperCase()));
}
