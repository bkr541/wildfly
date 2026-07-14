// ─────────────────────────────────────────────────────────────────────────────
// flightShareNormalize.ts — versioned public-share deserialization
//
// The current public route reads two immutable display-model versions:
//   1 — single-destination FlightShareModel
//   2 — multi-destination MultiDestShareModelV2
//
// The strict envelope normalizer validates every field before a public renderer
// receives it. The legacy model-only helper remains version-1-compatible for the
// older flightSearchShares service while that endpoint is still in the tree.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import type { FlightShareModel } from "./flightShareModel";
import type { MultiDestShareModelV2 } from "./multiDestShareModel";

const LOCAL_ASSET_RE =
  /^\/assets\/(locations\/(\d+|init)_background|logo\/logo_horizontal)\.png$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MULTI_DESTINATIONS = 750;

const nullablePositiveNumber = z.number().finite().positive().nullable();
const nullableNonNegativeInt = z.number().int().min(0).nullable();

const FlightShareOptionSchema = z.object({
  canonicalKey: z.string().max(300),
  airline: z.string().max(100),
  carrierCode: z.string().max(10),
  departureTimeLabel: z.string().max(20),
  arrivalTimeLabel: z.string().max(20),
  departureRaw: z.string().max(60),
  arrivalRaw: z.string().max(60),
  timeOfDay: z.enum(["MORNING", "MIDDAY", "AFTERNOON", "EVENING"]),
  route: z.string().max(200),
  routeAirports: z.array(z.string().max(10)).max(20),
  stopCount: z.number().int().min(0).max(20),
  isNonstop: z.boolean(),
  isPlusOneDay: z.boolean(),
  formattedDuration: z.string().max(30),
  flightNumbers: z.array(z.string().max(20)).max(20),
  lowestPublicFare: nullablePositiveNumber,
  goWildFare: nullablePositiveNumber,
  isGoWild: z.boolean(),
  goWildSeats: nullableNonNegativeInt,
  emphasizedFare: nullablePositiveNumber,
}).strict();

const AirportGroupSchema = z.object({
  iata: z.string().max(10),
  name: z.string().max(200),
  city: z.string().max(200),
  stateCode: z.string().max(10),
  country: z.string().max(100),
  locationId: z.number().int().positive().nullable(),
  optionCount: z.number().int().min(0),
  options: z.array(FlightShareOptionSchema).max(1000),
}).strict();

const SectionSchema = z.object({
  sectionType: z.enum(["ONE-WAY", "DEPARTING", "RETURN"]),
  label: z.string().max(50),
  dateValue: z.string().max(20).nullable(),
  formattedDateLabel: z.string().max(60),
  airportGroups: z.array(AirportGroupSchema).max(100),
  totalCount: z.number().int().min(0),
  nonstopCount: z.number().int().min(0),
  goWildCount: z.number().int().min(0),
}).strict();

const FlightShareModelV1Schema = z.object({
  originLabel: z.string().min(1).max(200),
  destinationLabel: z.string().min(1).max(200),
  tripTypeLabel: z.enum(["One-way", "Round-trip"]),
  combinedDateLabel: z.string().max(200),
  heroImageUrl: z.string().regex(LOCAL_ASSET_RE),
  arrivalImageUrl: z.string().regex(LOCAL_ASSET_RE),
  totalOptionCount: z.number().int().min(0),
  totalNonstopCount: z.number().int().min(0),
  totalGoWildCount: z.number().int().min(0),
  sections: z.array(SectionSchema).min(1).max(4),
  hasResults: z.boolean(),
}).strict();

const MultiDestDestinationSchema = z.object({
  destination: z.string().min(1).max(32),
  city: z.string().max(200),
  stateCode: z.string().max(20),
  country: z.string().max(100),
  airportName: z.string().max(240),
  locationId: z.number().int().positive().nullable(),
  flightCount: z.number().int().min(0).max(10_000),
  minFare: nullablePositiveNumber,
  maxFare: nullablePositiveNumber,
  isMinFareGoWild: z.boolean(),
  hasGoWild: z.boolean(),
  hasNonstop: z.boolean(),
  nonstopCount: z.number().int().min(0).max(10_000),
  avgDurationMin: z.number().int().min(0).max(10_080),
  minDurationMin: z.number().int().min(0).max(10_080),
  departureWindow: z.string().max(100).nullable(),
  earliestDeparture: z.string().max(60).nullable(),
}).strict().superRefine((destination, ctx) => {
  if (
    destination.minFare !== null &&
    destination.maxFare !== null &&
    destination.maxFare < destination.minFare
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxFare"],
      message: "maxFare must be greater than or equal to minFare",
    });
  }
  if (destination.nonstopCount > destination.flightCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nonstopCount"],
      message: "nonstopCount cannot exceed flightCount",
    });
  }
});

const MultiDestShareModelV2Schema = z.object({
  kind: z.literal("multi-destination"),
  originCode: z.string().min(1).max(80),
  originLabel: z.string().min(1).max(200),
  destinationLabel: z.string().min(1).max(200),
  tripTypeLabel: z.enum(["One-way", "Round-trip"]),
  departureDate: z.string().regex(ISO_DATE_RE).nullable(),
  returnDate: z.string().regex(ISO_DATE_RE).nullable(),
  combinedDateLabel: z.string().max(200),
  heroImageUrl: z.string().regex(LOCAL_ASSET_RE),
  totals: z.object({
    destinationCount: z.number().int().min(0).max(MAX_MULTI_DESTINATIONS),
    flightCount: z.number().int().min(0).max(1_000_000),
    nonstopDestinationCount: z.number().int().min(0).max(MAX_MULTI_DESTINATIONS),
    goWildDestinationCount: z.number().int().min(0).max(MAX_MULTI_DESTINATIONS),
  }).strict(),
  appliedView: z.object({
    sortBy: z.enum(["city", "fare", "flights", "duration"]),
    nonstopOnly: z.boolean(),
    goWildOnly: z.boolean(),
    destinationType: z.enum(["all", "domestic", "international"]),
  }).strict(),
  destinations: z.array(MultiDestDestinationSchema).max(MAX_MULTI_DESTINATIONS),
  hasResults: z.boolean(),
}).strict().superRefine((model, ctx) => {
  const flightCount = model.destinations.reduce((sum, item) => sum + item.flightCount, 0);
  const nonstopDestinationCount = model.destinations.filter((item) => item.hasNonstop).length;
  const goWildDestinationCount = model.destinations.filter((item) => item.hasGoWild).length;

  const checks: Array<[boolean, (string | number)[], string]> = [
    [model.totals.destinationCount === model.destinations.length, ["totals", "destinationCount"], "destinationCount does not match destinations"],
    [model.totals.flightCount === flightCount, ["totals", "flightCount"], "flightCount does not match destinations"],
    [model.totals.nonstopDestinationCount === nonstopDestinationCount, ["totals", "nonstopDestinationCount"], "nonstopDestinationCount does not match destinations"],
    [model.totals.goWildDestinationCount === goWildDestinationCount, ["totals", "goWildDestinationCount"], "goWildDestinationCount does not match destinations"],
    [model.hasResults === (model.destinations.length > 0), ["hasResults"], "hasResults does not match destinations"],
    [model.tripTypeLabel === "Round-trip" || model.returnDate === null, ["returnDate"], "one-way snapshots cannot have a returnDate"],
    [model.tripTypeLabel === "One-way" || model.returnDate !== null, ["returnDate"], "round-trip snapshots require a returnDate"],
  ];

  for (const [valid, path, message] of checks) {
    if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  }
});

export type FlightShareModelV1 = FlightShareModel;

export interface StoredFlightShareEnvelopeV1 {
  version: 1;
  model: FlightShareModelV1;
}

export type NormalizedStoredFlightShare =
  | {
      displayModelVersion: 1;
      displayModel: FlightShareModel;
    }
  | {
      displayModelVersion: 2;
      displayModel: MultiDestShareModelV2;
    };

function invalidPayload(version: number, error: z.ZodError): Error {
  const first = error.issues[0];
  const location = first?.path.length ? ` at ${first.path.join(".")}` : "";
  const detail = first?.message ? `: ${first.message}` : "";
  return new Error(`INVALID_PAYLOAD: version-${version} display model${location}${detail}`);
}

/** Strictly validate and normalize a public display-model response. */
export function normalizeStoredFlightShareEnvelope(
  modelVersion: number,
  payload: unknown,
): NormalizedStoredFlightShare {
  if (modelVersion === 1) {
    const parsed = FlightShareModelV1Schema.safeParse(payload);
    if (!parsed.success) throw invalidPayload(1, parsed.error);
    return { displayModelVersion: 1, displayModel: parsed.data as FlightShareModel };
  }

  if (modelVersion === 2) {
    const parsed = MultiDestShareModelV2Schema.safeParse(payload);
    if (!parsed.success) throw invalidPayload(2, parsed.error);
    return { displayModelVersion: 2, displayModel: parsed.data as MultiDestShareModelV2 };
  }

  throw new Error(
    `UNSUPPORTED_VERSION: model_version ${modelVersion} is not supported by this client`,
  );
}

/**
 * Legacy version-1 model-only normalizer retained for flightSearchShares.ts.
 * New public reads must use normalizeStoredFlightShareEnvelope so version 2 is
 * never silently interpreted as version 1.
 */
export function normalizeStoredFlightShare(
  modelVersion: number,
  payload: unknown,
): FlightShareModel {
  if (modelVersion === 1) {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new Error("INVALID_PAYLOAD: version-1 share_model must be a non-null object");
    }
    return payload as FlightShareModel;
  }

  throw new Error(
    `UNSUPPORTED_VERSION: model_version ${modelVersion} is not supported by the legacy client`,
  );
}
