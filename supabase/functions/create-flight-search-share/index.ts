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

/** Generate a 256-bit cryptographically secure random token as a 64-char hex string. */
function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hash of rawToken, returned as a 64-char hex string. */
async function hashToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Validation schema ──────────────────────────────────────────────────────────

// Only local asset paths produced by buildFlightShareModel are allowed.
// Pattern covers:
//   /assets/locations/{number}_background.png
//   /assets/locations/init_background.png
//   /assets/logo/logo_horizontal.png
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
  sectionType:       z.enum(["ONE-WAY", "DEPARTING", "RETURN"]),
  label:             z.string().max(50),
  dateValue:         z.string().max(20).nullable(),
  formattedDateLabel: z.string().max(60),
  airportGroups:     z.array(AirportGroupSchema).max(50),
  totalCount:        z.number().int().min(0),
  nonstopCount:      z.number().int().min(0),
  goWildCount:       z.number().int().min(0),
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
  modelVersion:  z.literal(1),
  shareModel:    FlightShareModelSchema,
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  returnDate:    z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  expiresInDays: z.number().int().positive().max(365).nullable().optional(),
});

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB hard cap

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

    // Verify the caller's JWT by resolving the user via the anon client
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

    // ── Validate payload with Zod ─────────────────────────────
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { ok: false, error: "Validation failed", details: parsed.error.flatten() },
        422,
      );
    }
    const { shareModel, departureDate, returnDate, expiresInDays } = parsed.data;

    // ── Derive DB summary columns server-side ─────────────────
    // Never trust client-supplied summary values for stored columns.
    const tripType: "one-way" | "round-trip" =
      shareModel.tripTypeLabel === "Round-trip" ? "round-trip" : "one-way";

    const flightCount = shareModel.totalOptionCount;

    // ── Expiration timestamp ──────────────────────────────────
    let expiresAt: string | null = null;
    if (expiresInDays != null) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays);
      expiresAt = d.toISOString();
    }

    // ── Token: generate → hash → insert (retry on collision) ─
    // A collision on a 256-bit token is astronomically unlikely;
    // the retry loop handles it safely without logging raw tokens.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let shareId:  string | null = null;
    let createdAt: string | null = null;
    let rawToken: string | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate     = generateRawToken();
      const candidateHash = await hashToken(candidate);

      const { data: insertData, error: insertError } = await adminClient
        .from("flight_search_shares")
        .insert({
          owner_user_id:     user.id,
          public_token_hash: candidateHash,
          model_version:     1,
          share_model:       shareModel,
          origin_label:      shareModel.originLabel,
          destination_label: shareModel.destinationLabel,
          departure_date:    departureDate ?? null,
          return_date:       returnDate ?? null,
          trip_type:         tripType,
          flight_count:      flightCount,
          expires_at:        expiresAt,
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        // Unique-constraint violation = token collision — retry silently
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
    // PUBLIC_APP_URL must be configured in Supabase Secrets.
    // Trailing slash is normalized before appending the path.
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
