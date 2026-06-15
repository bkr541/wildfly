// create-shared-flight-result
//
// Creates an immutable public snapshot of a flight-search result.
// Only callable by authenticated users (verify_jwt = true in config.toml).
// Inserts into public.shared_flight_results via service-role client.
// The raw public token is returned exactly once in publicUrl and never stored.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3";

// ── CORS ──────────────────────────────────────────────────────────────────────

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

// ── Token helpers ──────────────────────────────────────────────────────────────

function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Credential sanitizer ───────────────────────────────────────────────────────
// Strips specific credential-bearing key names from any depth in the payload.
// Only exact key matches (case-insensitive) are removed; no broad patterns that
// could accidentally strip valid flight-result fields.

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
    return value.map((v) => sanitizeCredentials(v, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (CREDENTIAL_KEYS.has(k.toLowerCase())) continue;
      out[k] = sanitizeCredentials(v, depth + 1);
    }
    return out;
  }
  return value;
}

// ── Validation schemas ─────────────────────────────────────────────────────────

const LOCAL_ASSET_RE =
  /^\/assets\/(locations\/(\d+|init)_background|logo\/logo_horizontal)\.png$/;

const FlightShareOptionSchema = z.object({
  canonicalKey:       z.string().max(300),
  airline:            z.string().max(100),
  carrierCode:        z.string().max(10),
  departureTimeLabel: z.string().max(20),
  arrivalTimeLabel:   z.string().max(20),
  departureRaw:       z.string().max(60),
  arrivalRaw:         z.string().max(60),
  timeOfDay:          z.enum(["MORNING", "MIDDAY", "AFTERNOON", "EVENING"]),
  route:              z.string().max(200),
  routeAirports:      z.array(z.string().max(10)).max(20),
  stopCount:          z.number().int().min(0).max(20),
  isNonstop:          z.boolean(),
  isPlusOneDay:       z.boolean(),
  formattedDuration:  z.string().max(30),
  flightNumbers:      z.array(z.string().max(20)).max(20),
  lowestPublicFare:   z.number().positive().nullable(),
  goWildFare:         z.number().positive().nullable(),
  isGoWild:           z.boolean(),
  goWildSeats:        z.number().int().min(0).nullable(),
  emphasizedFare:     z.number().positive().nullable(),
});

const AirportGroupSchema = z.object({
  iata:        z.string().max(10),
  name:        z.string().max(200),
  city:        z.string().max(200),
  stateCode:   z.string().max(10),
  country:     z.string().max(100),
  locationId:  z.number().int().positive().nullable(),
  optionCount: z.number().int().min(0),
  options:     z.array(FlightShareOptionSchema).max(1000),
});

const SectionSchema = z.object({
  sectionType:        z.enum(["ONE-WAY", "DEPARTING", "RETURN"]),
  label:              z.string().max(50),
  dateValue:          z.string().max(20).nullable(),
  formattedDateLabel: z.string().max(60),
  airportGroups:      z.array(AirportGroupSchema).max(100),
  totalCount:         z.number().int().min(0),
  nonstopCount:       z.number().int().min(0),
  goWildCount:        z.number().int().min(0),
});

const DisplayModelSchema = z.object({
  originLabel:       z.string().min(1).max(200),
  destinationLabel:  z.string().min(1).max(200),
  tripTypeLabel:     z.enum(["One-way", "Round-trip"]),
  combinedDateLabel: z.string().max(200),
  heroImageUrl:      z.string().regex(LOCAL_ASSET_RE, "heroImageUrl must be a local /assets/ path"),
  arrivalImageUrl:   z.string().regex(LOCAL_ASSET_RE, "arrivalImageUrl must be a local /assets/ path"),
  totalOptionCount:  z.number().int().min(0),
  totalNonstopCount: z.number().int().min(0),
  totalGoWildCount:  z.number().int().min(0),
  sections:          z.array(SectionSchema).min(1).max(4),
  hasResults:        z.boolean(),
});

const RequestSchema = z.object({
  payloadVersion:       z.literal(1),
  displayModelVersion:  z.literal(1),
  rawSearchPayload:     z.unknown(),
  displayModel:         DisplayModelSchema,
  sourceFlightSearchId: z.string().uuid().nullable().optional(),
  expiresInDays:        z.number().int().positive().max(365).nullable().optional(),
});

// 3 MB: covers all-destinations responses (500+ flights × ~2KB each) plus display model.
const MAX_BODY_BYTES = 3 * 1024 * 1024;

// ── Metadata derivation ────────────────────────────────────────────────────────
// Summary columns are always derived server-side from the validated display model
// and raw payload. The client is never trusted to supply them.

interface DerivedMeta {
  departureAirport: string | null;
  arrivalAirport:   string | null;
  departureDate:    string | null;
  returnDate:       string | null;
  tripType:         "one-way" | "round-trip";
  allDestinations:  boolean;
  flightCount:      number;
}

function deriveMeta(
  displayModel: z.infer<typeof DisplayModelSchema>,
  sanitizedRaw: unknown,
): DerivedMeta {
  const tripType: "one-way" | "round-trip" =
    displayModel.tripTypeLabel === "Round-trip" ? "round-trip" : "one-way";

  const allDestinations =
    displayModel.destinationLabel === "All Destinations";

  const flightCount = displayModel.totalOptionCount;

  // Departure date from first section's dateValue.
  const departureDate =
    displayModel.sections[0]?.dateValue ?? null;

  // Return date from the RETURN section, only for round-trips.
  const returnDate =
    tripType === "round-trip"
      ? (displayModel.sections.find((s) => s.sectionType === "RETURN")?.dateValue ?? null)
      : null;

  // Airport codes: try raw payload flights[0].origin/destination first (most reliable).
  // Fall back to display labels, which may be city names rather than IATA codes.
  let departureAirport: string | null = null;
  let arrivalAirport:   string | null = null;

  const rawFlights =
    (sanitizedRaw as Record<string, unknown> | null)?.flights ??
    (sanitizedRaw as Record<string, unknown> | null)?.data?.json?.flights;

  if (Array.isArray(rawFlights) && rawFlights.length > 0) {
    const first = rawFlights[0] as Record<string, unknown>;
    if (typeof first?.origin === "string") {
      departureAirport = first.origin.trim().slice(0, 10) || null;
    }
    if (!allDestinations && typeof first?.destination === "string") {
      arrivalAirport = first.destination.trim().slice(0, 10) || null;
    }
  }

  if (!departureAirport) {
    departureAirport = displayModel.originLabel.slice(0, 200);
  }
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
    flightCount,
  };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    // ── Body size limit ───────────────────────────────────────
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return json({ ok: false, error: "Payload too large" }, 413);
    }

    // ── JSON parse ────────────────────────────────────────────
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    // ── Outer schema validation ───────────────────────────────
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { ok: false, error: "Validation failed", details: parsed.error.flatten() },
        422,
      );
    }

    const {
      displayModel,
      rawSearchPayload,
      sourceFlightSearchId,
      expiresInDays,
    } = parsed.data;

    // ── Sanitize raw payload ──────────────────────────────────
    const sanitizedPayload = sanitizeCredentials(rawSearchPayload);

    // ── Derive server-side metadata ───────────────────────────
    const meta = deriveMeta(displayModel, sanitizedPayload);

    // ── Expiration ────────────────────────────────────────────
    let expiresAt: string | null = null;
    if (expiresInDays != null) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays);
      expiresAt = d.toISOString();
    }

    // ── Public URL base ───────────────────────────────────────
    const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");
    if (!publicAppUrl) {
      console.error("[create-shared-flight-result] PUBLIC_APP_URL is not configured");
      return json({ ok: false, error: "Server configuration error" }, 500);
    }
    const baseUrl = publicAppUrl.replace(/\/+$/, "");

    // ── Token loop: generate → hash → insert (retry on collision) ─
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let shareId:   string | null = null;
    let createdAt: string | null = null;
    let rawToken:  string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate     = generateRawToken();
      const candidateHash = await hashToken(candidate);

      const { data: row, error: insertErr } = await adminClient
        .from("shared_flight_results")
        .insert({
          owner_user_id:           user.id,
          public_token_hash:       candidateHash,
          payload_version:         1,
          display_model_version:   1,
          raw_search_payload:      sanitizedPayload,
          display_model:           displayModel,
          departure_airport:       meta.departureAirport,
          arrival_airport:         meta.arrivalAirport,
          departure_date:          meta.departureDate,
          return_date:             meta.returnDate,
          trip_type:               meta.tripType,
          all_destinations:        meta.allDestinations,
          flight_count:            meta.flightCount,
          source_flight_search_id: sourceFlightSearchId ?? null,
          expires_at:              expiresAt,
        })
        .select("id, created_at")
        .single();

      if (insertErr) {
        // 23505 = unique_violation on public_token_hash — retry
        if (insertErr.code === "23505") continue;
        console.error("[create-shared-flight-result] insert error:", insertErr.code);
        return json({ ok: false, error: "Failed to create share" }, 500);
      }

      shareId   = (row as { id: string; created_at: string }).id;
      createdAt = (row as { id: string; created_at: string }).created_at;
      rawToken  = candidate;
      break;
    }

    if (!shareId || !rawToken || !createdAt) {
      return json({ ok: false, error: "Failed to generate unique token" }, 500);
    }

    // rawToken is embedded in publicUrl and returned exactly once.
    // It is never logged or stored anywhere.
    const publicUrl = `${baseUrl}/share/flights/${rawToken}`;

    return json({ ok: true, shareId, publicUrl, createdAt, expiresAt });
  } catch (err) {
    console.error("[create-shared-flight-result] unexpected error:", err);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
