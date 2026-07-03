export const FLIGHT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_FLIGHT_CACHE_PAYLOAD_BYTES = 4_000_000;
export const MAX_PROVIDER_RESPONSE_BYTES = MAX_FLIGHT_CACHE_PAYLOAD_BYTES - 128;
export const FLIGHT_CACHE_PAYLOAD_VERSION = 1;

export type CacheableFlightPath = "/search" | "/dayTrips" | "/roundTrip";
export type CacheableFlightMethod = "GET" | "POST";

export interface CanonicalFlightCacheRequest {
  version: 1;
  path: CacheableFlightPath;
  method: CacheableFlightMethod;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  nonstop?: string;
  layovertime?: string;
}

export interface FlightCacheEnvelope {
  version: 1;
  response: Record<string, unknown> | unknown[];
}

export interface FlightCacheHit {
  response: Record<string, unknown> | unknown[];
  observedAt: string;
  expiresAt: string;
}

interface CacheRow {
  cache_key: string;
  reset_bucket: string;
  canonical_request: unknown;
  status: string;
  payload: unknown;
  updated_at: string;
  expires_at: string | null;
  payload_version: number | null;
  payload_size_bytes: number | null;
  payload_sha256: string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IATA_PATTERN = /^[A-Z0-9]{3}$/;
const CITY_PATTERN = /^CITY:[A-Z0-9 .'-]{2,80}$/;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_CACHE_REQUEST");
  }
  return value as Record<string, unknown>;
}

function normalizeCode(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`INVALID_${field.toUpperCase()}`);
  const normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (!IATA_PATTERN.test(normalized) && !CITY_PATTERN.test(normalized)) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return normalized;
}

function normalizeDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function normalizeBooleanString(value: unknown, fallback: string): string {
  if (value == null || value === "") return fallback;
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  throw new Error("INVALID_NONSTOP");
}

function normalizeLayover(value: unknown): string {
  const normalized = value == null || value === "" ? "6" : String(value).trim();
  if (!/^\d{1,2}$/.test(normalized)) throw new Error("INVALID_LAYOVERTIME");
  const hours = Number(normalized);
  if (hours < 1 || hours > 24) throw new Error("INVALID_LAYOVERTIME");
  return String(hours);
}

export function normalizeFlightCacheRequest(input: {
  path: unknown;
  method: unknown;
  params?: unknown;
  payload?: unknown;
}): CanonicalFlightCacheRequest {
  const path = input.path;
  const method = input.method;

  if (path === "/search" && method === "POST") {
    const payload = asRecord(input.payload);
    return {
      version: 1,
      path,
      method,
      origin: normalizeCode(payload.origin, "origin"),
      destination: payload.destination == null || payload.destination === ""
        ? "__ALL__"
        : normalizeCode(payload.destination, "destination"),
      departureDate: normalizeDate(payload.departureDate, "departure_date"),
    };
  }

  if (path === "/dayTrips" && method === "GET") {
    const params = asRecord(input.params);
    return {
      version: 1,
      path,
      method,
      origin: normalizeCode(params.origin, "origin"),
      destination: "__DAYTRIPS__",
      departureDate: normalizeDate(params.date, "departure_date"),
      nonstop: normalizeBooleanString(params.nonstop, "true"),
      layovertime: normalizeLayover(params.layovertime),
    };
  }

  if (path === "/roundTrip" && method === "POST") {
    const payload = asRecord(input.payload);
    const departureDate = normalizeDate(payload.departureDate, "departure_date");
    const returnDate = normalizeDate(payload.returnDate, "return_date");
    if (returnDate < departureDate) throw new Error("INVALID_RETURN_DATE");
    return {
      version: 1,
      path,
      method,
      origin: normalizeCode(payload.origin, "origin"),
      destination: normalizeCode(payload.destination, "destination"),
      departureDate,
      returnDate,
    };
  }

  throw new Error("UNCACHEABLE_FLIGHT_REQUEST");
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildFlightCacheIdentity(canonical: CanonicalFlightCacheRequest) {
  const cacheKey = await sha256Hex(stableJson(canonical));
  const [year, month, day] = canonical.departureDate.split("-").map(Number);
  const resetBucket = new Date(Date.UTC(year, month - 1, day, 0, 1, 0)).toISOString();
  return { cacheKey, resetBucket };
}

export function validateProviderResponse(value: unknown): asserts value is Record<string, unknown> | unknown[] {
  if (!value || typeof value !== "object") throw new Error("MALFORMED_PROVIDER_RESPONSE");
  const serialized = JSON.stringify(value);
  const size = new TextEncoder().encode(serialized).byteLength;
  if (size > MAX_PROVIDER_RESPONSE_BYTES) throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
}

export function validateProviderResponseForRequest(
  canonical: CanonicalFlightCacheRequest,
  value: unknown,
): asserts value is Record<string, unknown> | unknown[] {
  validateProviderResponse(value);
  if (Array.isArray(value)) throw new Error("MALFORMED_PROVIDER_RESPONSE");

  const record = value as Record<string, unknown>;
  const nestedData = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : null;
  const nestedJson = nestedData?.json && typeof nestedData.json === "object" && !Array.isArray(nestedData.json)
    ? nestedData.json as Record<string, unknown>
    : null;

  if (canonical.path === "/dayTrips") {
    const dayTrips = record.dayTrips ?? nestedJson?.dayTrips;
    if (!Array.isArray(dayTrips)) throw new Error("MALFORMED_PROVIDER_RESPONSE");
    return;
  }

  const flights = record.flights ?? nestedJson?.flights;
  const roundTripShape = canonical.path === "/roundTrip"
    && record.outbound != null
    && (record.inbound != null || record.return != null);
  if (!Array.isArray(flights) && !roundTripShape) {
    throw new Error("MALFORMED_PROVIDER_RESPONSE");
  }
}

async function serializeEnvelope(canonical: CanonicalFlightCacheRequest, response: unknown) {
  validateProviderResponseForRequest(canonical, response);
  const envelope: FlightCacheEnvelope = {
    version: FLIGHT_CACHE_PAYLOAD_VERSION,
    response,
  };
  const serialized = stableJson(envelope);
  const sizeBytes = new TextEncoder().encode(serialized).byteLength;
  if (sizeBytes > MAX_FLIGHT_CACHE_PAYLOAD_BYTES) throw new Error("CACHE_PAYLOAD_TOO_LARGE");
  return {
    envelope,
    sizeBytes,
    sha256: await sha256Hex(serialized),
  };
}

function isEnvelope(value: unknown): value is FlightCacheEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.version === FLIGHT_CACHE_PAYLOAD_VERSION && !!record.response && typeof record.response === "object";
}

async function invalidateRow(admin: any, row: CacheRow, reason: string) {
  await admin
    .from("flight_search_cache")
    .update({ status: "error", payload: null, error: reason.slice(0, 120) })
    .eq("cache_key", row.cache_key)
    .eq("reset_bucket", row.reset_bucket);
}

export async function readFlightCache(
  admin: any,
  canonical: CanonicalFlightCacheRequest,
  now = new Date(),
): Promise<FlightCacheHit | null> {
  const { cacheKey, resetBucket } = await buildFlightCacheIdentity(canonical);
  const { data, error } = await admin
    .from("flight_search_cache")
    .select("cache_key, reset_bucket, canonical_request, status, payload, updated_at, expires_at, payload_version, payload_size_bytes, payload_sha256")
    .eq("cache_key", cacheKey)
    .eq("reset_bucket", resetBucket)
    .eq("status", "ready")
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (error) throw new Error(`CACHE_READ_FAILED:${error.message}`);
  if (!data) return null;

  const row = data as CacheRow;
  const canonicalMatches = stableJson(row.canonical_request) === stableJson(canonical);
  const expiry = row.expires_at ? new Date(row.expires_at) : null;
  if (
    !canonicalMatches ||
    !expiry ||
    expiry.getTime() <= now.getTime() ||
    row.payload_version !== FLIGHT_CACHE_PAYLOAD_VERSION ||
    !isEnvelope(row.payload)
  ) {
    await invalidateRow(admin, row, "CACHE_VALIDATION_FAILED");
    return null;
  }

  const serialized = stableJson(row.payload);
  const actualSize = new TextEncoder().encode(serialized).byteLength;
  const actualHash = await sha256Hex(serialized);
  if (
    actualSize > MAX_FLIGHT_CACHE_PAYLOAD_BYTES ||
    row.payload_size_bytes !== actualSize ||
    row.payload_sha256 !== actualHash
  ) {
    await invalidateRow(admin, row, "CACHE_INTEGRITY_FAILED");
    return null;
  }

  try {
    validateProviderResponseForRequest(canonical, row.payload.response);
  } catch {
    await invalidateRow(admin, row, "CACHE_RESPONSE_SHAPE_INVALID");
    return null;
  }
  return {
    response: row.payload.response,
    observedAt: row.updated_at,
    expiresAt: row.expires_at!,
  };
}

export async function writeFlightCache(
  admin: any,
  canonical: CanonicalFlightCacheRequest,
  providerResponse: unknown,
  now = new Date(),
): Promise<{ cacheKey: string; expiresAt: string }> {
  const { cacheKey, resetBucket } = await buildFlightCacheIdentity(canonical);
  const { envelope, sizeBytes, sha256 } = await serializeEnvelope(canonical, providerResponse);
  const expiresAt = new Date(now.getTime() + FLIGHT_CACHE_TTL_MS).toISOString();

  const { error } = await admin.from("flight_search_cache").upsert(
    {
      cache_key: cacheKey,
      reset_bucket: resetBucket,
      canonical_request: canonical,
      provider: "frontier",
      status: "ready",
      payload: envelope,
      error: null,
      dep_iata: canonical.origin,
      arr_iata: canonical.destination,
      expires_at: expiresAt,
      payload_version: FLIGHT_CACHE_PAYLOAD_VERSION,
      payload_size_bytes: sizeBytes,
      payload_sha256: sha256,
    },
    { onConflict: "cache_key,reset_bucket" },
  );

  if (error) throw new Error(`CACHE_WRITE_FAILED:${error.message}`);
  return { cacheKey, expiresAt };
}
