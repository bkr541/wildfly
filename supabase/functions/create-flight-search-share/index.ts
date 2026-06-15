import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Token helpers ──────────────────────────────────────────────────────────────

function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Credential sanitizer ───────────────────────────────────────────────────────
// Recursively removes any JSONB key whose name matches a credential pattern.
// This is a defensive measure in case an API response accidentally leaks
// an auth header, cookie, or token into the raw payload.

const CREDENTIAL_KEY_RE =
  /(?:authorization|bearer|cookie|csrf|jwt|api[_-]?key|secret|password|credential|x-api)/i;

function sanitizeCredentials(value: unknown, depth = 0): unknown {
  if (depth > 25) return null; // hard recursion limit
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeCredentials(v, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (CREDENTIAL_KEY_RE.test(k)) continue;
      result[k] = sanitizeCredentials(v, depth + 1);
    }
    return result;
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
  options:     z.array(FlightShareOptionSchema).max(500),
});

const SectionSchema = z.object({
  sectionType:        z.enum(["ONE-WAY", "DEPARTING", "RETURN"]),
  label:              z.string().max(50),
  dateValue:          z.string().max(20).nullable(),
  formattedDateLabel: z.string().max(60),
  airportGroups:      z.array(AirportGroupSchema).max(50),
  totalCount:         z.number().int().min(0),
  nonstopCount:       z.number().int().min(0),
  goWildCount:        z.number().int().min(0),
});

const FlightShareModelSchema = z.object({
  originLabel:       z.string().min(1).max(200),
  destinationLabel:  z.string().min(1).max(200),
  tripTypeLabel:     z.enum(["One-way", "Round-trip"]),
  combinedDateLabel: z.string().max(200),
  heroImageUrl:      z
    .string()
    .regex(LOCAL_ASSET_RE, "heroImageUrl must be a local /assets/ path"),
  arrivalImageUrl:   z
    .string()
    .regex(LOCAL_ASSET_RE, "arrivalImageUrl must be a local /assets/ path"),
  totalOptionCount:  z.number().int().min(0),
  totalNonstopCount: z.number().int().min(0),
  totalGoWildCount:  z.number().int().min(0),
  sections:          z.array(SectionSchema).min(1).max(4),
  hasResults:        z.boolean(),
});

const RequestSchema = z.object({
  // Display model version tag (currently always 1).
  modelVersion:           z.literal(1),

  // Validated presentation model — stored as display_model in shared_flight_results.
  // Used by the public share page renderer for visual stability.
  shareModel:             FlightShareModelSchema,

  // Complete parsed API response — stored as raw_search_payload.
  // Preserved at full fidelity for future page versions; never returned publicly.
  // Credential-named keys are stripped server-side before storage.
  rawSearchPayload:       z.unknown(),

  // Optional back-reference to the originating search row.
  sourceFlightSearchId:   z.string().uuid().nullable().optional(),

  // Denormalized search context. Set by the server from verified search state;
  // the values provided here are stored as-is and used only for metadata queries.
  departureAirport:       z.string().max(10).nullable().optional(),
  arrivalAirport:         z.string().max(10).nullable().optional(),
  allDestinations:        z.boolean().optional(),

  departureDate:          z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  returnDate:             z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  expiresInDays:          z.number().int().positive().max(365).nullable().optional(),
});

// 2 MB total to accommodate both the display model and the raw search payload.
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Require authentication ────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's JWT by resolving the user via the anon client.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    // ── Parse body ────────────────────────────────────────────
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return json({ ok: false, error: "Payload too large" }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    // ── Validate payload ──────────────────────────────────────
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { ok: false, error: "Validation failed", details: parsed.error.flatten() },
        422,
      );
    }

    const {
      shareModel,
      rawSearchPayload,
      sourceFlightSearchId,
      departureAirport,
      arrivalAirport,
      allDestinations,
      departureDate,
      returnDate,
      expiresInDays,
    } = parsed.data;

    // ── Derive stored columns server-side ─────────────────────
    const tripType: "one-way" | "round-trip" =
      shareModel.tripTypeLabel === "Round-trip" ? "round-trip" : "one-way";

    const flightCount = shareModel.totalOptionCount;

    // ── Sanitize raw payload ──────────────────────────────────
    // Strip any credential-named keys that may have leaked from the API response.
    const sanitizedPayload = sanitizeCredentials(rawSearchPayload);

    // ── Expiration timestamp ──────────────────────────────────
    let expiresAt: string | null = null;
    if (expiresInDays != null) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays);
      expiresAt = d.toISOString();
    }

    // ── Token: generate → hash → insert (retry on collision) ─
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let shareId:   string | null = null;
    let createdAt: string | null = null;
    let rawToken:  string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate     = generateRawToken();
      const candidateHash = await hashToken(candidate);

      const { data: insertData, error: insertError } = await adminClient
        .from("shared_flight_results")
        .insert({
          owner_user_id:           user.id,
          public_token_hash:       candidateHash,
          payload_version:         1,
          display_model_version:   1,
          raw_search_payload:      sanitizedPayload,
          display_model:           shareModel,
          departure_airport:       departureAirport ?? null,
          arrival_airport:         arrivalAirport ?? null,
          departure_date:          departureDate ?? null,
          return_date:             returnDate ?? null,
          trip_type:               tripType,
          all_destinations:        allDestinations ?? false,
          flight_count:            flightCount,
          source_flight_search_id: sourceFlightSearchId ?? null,
          expires_at:              expiresAt,
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        // Unique-constraint violation on public_token_hash — retry silently.
        if (insertError.code === "23505") continue;
        console.error("[create-flight-search-share] DB insert error:", insertError.code);
        return json({ ok: false, error: "Failed to create share" }, 500);
      }

      shareId   = (insertData as { id: string; created_at: string }).id;
      createdAt = (insertData as { id: string; created_at: string }).created_at;
      rawToken  = candidate;
      break;
    }

    if (!shareId || !rawToken || !createdAt) {
      return json({ ok: false, error: "Failed to generate unique token after retries" }, 500);
    }

    // ── Build public URL ──────────────────────────────────────
    const baseUrl   = (Deno.env.get("PUBLIC_APP_URL") ?? "").replace(/\/+$/, "");
    const publicUrl = `${baseUrl}/share/flights/${rawToken}`;

    // rawToken is returned exactly once here and is never logged or stored.
    return json({
      ok:        true,
      shareId,
      publicUrl,
      createdAt,
      expiresAt,
    });
  } catch (err) {
    console.error("[create-flight-search-share] Unexpected error:", err);
    return json({ ok: false, error: "Internal server error" }, 500);
  }
});
