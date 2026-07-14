// ─────────────────────────────────────────────────────────────────────────────
// multiDestShareModel.ts — compact, framework-independent all-destinations model
//
// The builder accepts the already filtered and sorted destination cards shown by
// FlightMultiDestResults. It deliberately snapshots only display fields, never
// the card flight arrays or the original search response.
// ─────────────────────────────────────────────────────────────────────────────

export const MULTI_DEST_SHARE_HERO_FALLBACK = "/assets/locations/init_background.png";

export type MultiDestShareSortBy = "city" | "fare" | "flights" | "duration";
export type MultiDestShareDestinationType = "all" | "domestic" | "international";

export interface MultiDestShareDestination {
  destination: string;
  city: string;
  stateCode: string;
  country: string;
  airportName: string;
  locationId: number | null;

  flightCount: number;
  minFare: number | null;
  maxFare: number | null;
  isMinFareGoWild: boolean;

  hasGoWild: boolean;
  hasNonstop: boolean;
  nonstopCount: number;

  avgDurationMin: number;
  minDurationMin: number;
  departureWindow: string | null;
  earliestDeparture: string | null;
}

export interface MultiDestShareModelV2 {
  kind: "multi-destination";

  originCode: string;
  originLabel: string;
  destinationLabel: string;

  tripTypeLabel: string;
  departureDate: string | null;
  returnDate: string | null;
  combinedDateLabel: string;

  heroImageUrl: string;

  totals: {
    destinationCount: number;
    flightCount: number;
    nonstopDestinationCount: number;
    goWildDestinationCount: number;
  };

  appliedView: {
    sortBy: MultiDestShareSortBy;
    nonstopOnly: boolean;
    goWildOnly: boolean;
    destinationType: MultiDestShareDestinationType;
  };

  destinations: MultiDestShareDestination[];
  hasResults: boolean;
}

/**
 * Structural input accepted from the destination-card layer.
 * Extra properties such as `flights`, `rawPayload`, animation state, and event
 * handlers are intentionally absent and therefore cannot leak into the model.
 */
export interface MultiDestShareCardInput {
  destination: string;
  city: string;
  stateCode: string;
  country: string;
  airportName: string;
  locationId: number | null;
  flightCount: number;
  minFare: number | null;
  maxFare: number | null;
  isMinFareGoWild: boolean;
  hasGoWild: boolean;
  hasNonstop: boolean;
  nonstopCount: number;
  avgDurationMin: number;
  minDurationMin: number;
  departureWindow: string | null;
  earliestDeparture: string | null;
}

export interface MultiDestShareAirportMetadata {
  city: string;
  stateCode: string;
  country: string;
  name: string;
  locationId: number | null;
}

export interface BuildMultiDestShareModelArgs {
  destinationCards: readonly MultiDestShareCardInput[];
  originCode: string;
  destinationCode: string;
  departureDate: string | null;
  returnDate: string | null;
  tripType: string;
  sortBy: MultiDestShareSortBy;
  nonstopOnly: boolean;
  goWildOnly: boolean;
  destinationType: MultiDestShareDestinationType;
  airportMap: Readonly<Record<string, MultiDestShareAirportMetadata | undefined>>;
}

function prettifyCityCode(raw: string): string {
  if (!raw) return "";
  if (!raw.startsWith("CITY:")) return raw;
  return raw
    .slice(5)
    .toLowerCase()
    .split(/[\s+]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseShareDate(dateValue: string): Date | null {
  const date = dateValue.length === 10
    ? new Date(`${dateValue}T00:00:00.000Z`)
    : new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShareDate(dateValue: string, includeYear: boolean): string {
  const date = parseShareDate(dateValue);
  if (!date) return dateValue;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(date);
}

function buildTripLabels(
  tripType: string,
  departureDate: string | null,
  returnDate: string | null,
): { tripTypeLabel: string; combinedDateLabel: string } {
  const isRoundTrip = /round/i.test(tripType) || returnDate !== null;
  const tripTypeLabel = isRoundTrip ? "Round-trip" : "One-way";

  if (isRoundTrip && departureDate && returnDate) {
    return {
      tripTypeLabel,
      combinedDateLabel: `${formatShareDate(departureDate, false)} – ${formatShareDate(returnDate, true)} • ${tripTypeLabel}`,
    };
  }

  if (departureDate) {
    return {
      tripTypeLabel,
      combinedDateLabel: `${formatShareDate(departureDate, true)} • ${tripTypeLabel}`,
    };
  }

  return { tripTypeLabel, combinedDateLabel: tripTypeLabel };
}

function buildDestinationLabel(destinationCode: string): string {
  if (!destinationCode || destinationCode === "All") return "All Destinations";
  if (destinationCode.startsWith("CITY:")) return prettifyCityCode(destinationCode);
  return destinationCode;
}

function toLocalHeroPath(locationId: number | null | undefined): string {
  if (typeof locationId !== "number" || !Number.isFinite(locationId) || locationId <= 0) {
    return MULTI_DEST_SHARE_HERO_FALLBACK;
  }
  return `/assets/locations/${locationId}_background.png`;
}

/**
 * Build a compact version-2 all-destinations display snapshot.
 *
 * The destination order is copied exactly as received. The function performs no
 * filtering, sorting, I/O, browser access, or mutation of the caller's cards.
 */
export function buildMultiDestShareModel(
  args: BuildMultiDestShareModelArgs,
): MultiDestShareModelV2 {
  const originMetadata = args.airportMap[args.originCode];
  const originLabel = args.originCode.startsWith("CITY:")
    ? prettifyCityCode(args.originCode)
    : (originMetadata?.city || args.originCode);

  const { tripTypeLabel, combinedDateLabel } = buildTripLabels(
    args.tripType,
    args.departureDate,
    args.returnDate,
  );

  const destinations: MultiDestShareDestination[] = args.destinationCards.map((card) => ({
    destination: card.destination,
    city: card.city,
    stateCode: card.stateCode,
    country: card.country,
    airportName: card.airportName,
    locationId: card.locationId,
    flightCount: card.flightCount,
    minFare: card.minFare,
    maxFare: card.maxFare,
    isMinFareGoWild: card.isMinFareGoWild,
    hasGoWild: card.hasGoWild,
    hasNonstop: card.hasNonstop,
    nonstopCount: card.nonstopCount,
    avgDurationMin: card.avgDurationMin,
    minDurationMin: card.minDurationMin,
    departureWindow: card.departureWindow,
    earliestDeparture: card.earliestDeparture,
  }));

  const totals = destinations.reduce(
    (summary, destination) => {
      summary.flightCount += destination.flightCount;
      if (destination.hasNonstop) summary.nonstopDestinationCount += 1;
      if (destination.hasGoWild) summary.goWildDestinationCount += 1;
      return summary;
    },
    {
      destinationCount: destinations.length,
      flightCount: 0,
      nonstopDestinationCount: 0,
      goWildDestinationCount: 0,
    },
  );

  return {
    kind: "multi-destination",
    originCode: args.originCode,
    originLabel,
    destinationLabel: buildDestinationLabel(args.destinationCode),
    tripTypeLabel,
    departureDate: args.departureDate,
    returnDate: args.returnDate,
    combinedDateLabel,
    heroImageUrl: toLocalHeroPath(originMetadata?.locationId),
    totals,
    appliedView: {
      sortBy: args.sortBy,
      nonstopOnly: args.nonstopOnly,
      goWildOnly: args.goWildOnly,
      destinationType: args.destinationType,
    },
    destinations,
    hasResults: destinations.length > 0,
  };
}
