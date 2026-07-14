// create-shared-flight-result
//
// Creates immutable versioned public snapshots of flight-search results.
// Only callable by authenticated users (verify_jwt = true in config.toml).
// The raw public token is returned exactly once in publicUrl and never stored.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3";
import {
  deriveMultiDestinationMeta,
  deriveSingleDestinationMeta,
} from "../_shared/sharedFlightResultMeta.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const CREDENTIAL_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "access_token",
  "refresh_token",
  "apikey",
  "api_key",
  "jwt",
]);

function sanitizeCredentials(value: unknown, depth = 0): unknown {
  if (depth > 30) return null;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCredentials(item, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (CREDENTIAL_KEYS.has(key.toLowerCase())) continue;
      out[key] = sanitizeCredentials(nestedValue, depth + 1);
    }
    return out;
  }
  return value;
}

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

const DisplayModelV1Schema = z.object({
  originLabel: z.string().min(1).max(200),
  destinationLabel: z.string().min(1).max(200),
  tripTypeLabel: z.enum(["One-way", "Round-trip"]),
  combinedDateLabel: z.string().max(200),
  heroImageUrl: z.string().regex(LOCAL_ASSET_RE, "heroImageUrl must be a local /assets/ path"),
  arrivalImageUrl: z.string().regex(LOCAL_ASSET_RE, "arrivalImageUrl must be a local /assets/ path"),
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

const DisplayModelV2Schema = z.object({
  kind: z.literal("multi-destination"),
  originCode: z.string().min(1).max(80),
  originLabel: z.string().min(1).max(200),
  destinationLabel: z.string().min(1).max(200),
  tripTypeLabel: z.enum(["One-way", "Round-trip"]),
  departureDate: z.string().regex(ISO_DATE_RE).nullable(),
  returnDate: z.string().regex(ISO_DATE_RE).nullable(),
  combinedDateLabel: z.string().max(200),
  heroImageUrl: z.string().regex(LOCAL_ASSET_RE, "heroImageUrl must be a local /assets/ path"),
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

const SharedRequestFields = {
  payloadVersion: z.literal(1),
  rawSearchPayload: z.unknown(),
  sourceFlightSearchId: z.string().uuid().nullable().optional(),
  expiresInDays: z.number().int().positive().max(365).nullable().optional(),
};

const RequestV1Schema = z.object({
  ...SharedRequestFields,
  displayModelVersion: z.literal(1),
  displayModel: DisplayModelV1Schema,
}).strict();

const RequestV2Schema = z.object({
  ...SharedRequestFields,
  displayModelVersion: z.literal(2),
  displayModel: DisplayModelV2Schema,
}).strict();

const RequestSchema = z.discriminatedUnion("displayModelVersion", [
  RequestV1Schema,
  RequestV2Schema,
]);

// Must remain aligned with SHARED_FLIGHT_RESULT_MAX_BODY_BYTES in the client.
// UTF-8 bytes are measured, not JavaScript UTF-16 code units.
const MAX_BODY_BYTES = 3 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: "Payload too large" }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { ok: false, error: "Validation failed", details: parsed.error.flatten() },
        422,
      );
    }

    const {
      payloadVersion,
      displayModelVersion,
      displayModel,
      rawSearchPayload,
      sourceFlightSearchId,
      expiresInDays,
    } = parsed.data;

    const sanitizedPayload = sanitizeCredentials(rawSearchPayload);
    const meta = displayModelVersion === 1
      ? deriveSingleDestinationMeta(displayModel, sanitizedPayload)
      : deriveMultiDestinationMeta(displayModel);

    let expiresAt: string | null = null;
    if (expiresInDays != null) {
      const date = new Date();
      date.setDate(date.getDate() + expiresInDays);
      expiresAt = date.toISOString();
    }

    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");
    if (!publicAppUrl) {
      console.error("[create-shared-flight-result] PUBLIC_APP_URL is not configured");
      return json({ ok: false, error: "Server configuration error" }, 500);
    }
    const baseUrl = publicAppUrl.replace(/\/+$/, "");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let shareId: string | null = null;
    let createdAt: string | null = null;
    let rawToken: string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRawToken();
      const candidateHash = await hashToken(candidate);

      const { data: row, error: insertErr } = await adminClient
        .from("shared_flight_results")
        .insert({
          owner_user_id: user.id,
          public_token_hash: candidateHash,
          payload_version: payloadVersion,
          display_model_version: displayModelVersion,
          raw_search_payload: sanitizedPayload,
          display_model: displayModel,
          departure_airport: meta.departureAirport,
          arrival_airport: meta.arrivalAirport,
          departure_date: meta.departureDate,
          return_date: meta.returnDate,
          trip_type: meta.tripType,
          all_destinations: meta.allDestinations,
          flight_count: meta.flightCount,
          source_flight_search_id: sourceFlightSearchId ?? null,
          expires_at: expiresAt,
        })
        .select("id, created_at")
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") continue;
        console.error("[create-shared-flight-result] insert error:", insertErr.code);
        return json({ ok: false, error: "Failed to create share" }, 500);
      }

      shareId = (row as { id: string; created_at: string }).id;
      createdAt = (row as { id: string; created_at: string }).created_at;
      rawToken = candidate;
      break;
    }

    if (!shareId || !rawToken || !createdAt) {
      return json({ ok: false, error: "Failed to generate unique token" }, 500);
    }

    const publicUrl = `${baseUrl}/share/flights/${rawToken}`;
    return json({ ok: true, shareId, publicUrl, createdAt, expiresAt });
  } catch (err) {
    console.error("[create-shared-flight-result] unexpected error:", err);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
