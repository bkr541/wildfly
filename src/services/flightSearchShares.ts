// ─────────────────────────────────────────────────────────────────────────────
// flightSearchShares.ts — client-facing service for immutable public shares
//
// Wraps the create-flight-search-share and get-public-flight-search-share
// Edge Functions. Provides typed return values and normalizes all Supabase /
// Edge Function errors into FlightShareError so UI components never receive
// raw Supabase error objects.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { FlightShareModel } from "@/utils/flightShareModel";
import { normalizeStoredFlightShare } from "@/utils/flightShareNormalize";

// ── Request / response types ───────────────────────────────────────────────────

export interface CreateFlightSearchShareRequest {
  modelVersion:  1;
  shareModel:    FlightShareModel;
  departureDate?: string | null;
  returnDate?:    string | null;
  expiresInDays?: number | null;
}

export interface CreateFlightSearchShareResponse {
  shareId:   string;
  publicUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface PublicFlightSearchShareResponse {
  modelVersion: number;
  shareModel:   FlightShareModel;
  createdAt:    string;
  expiresAt:    string | null;
}

// ── Typed error ───────────────────────────────────────────────────────────────

export type FlightShareErrorKind =
  | "NOT_FOUND"
  | "EXPIRED"
  | "REVOKED"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "UNSUPPORTED_VERSION"
  | "SERVER_ERROR";

export class FlightShareError extends Error {
  public readonly kind: FlightShareErrorKind;

  constructor(kind: FlightShareErrorKind, message: string) {
    super(message);
    this.name = "FlightShareError";
    this.kind = kind;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Map a raw function invocation error into a FlightShareError. */
function classifyFunctionError(error: unknown): FlightShareError {
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  if (/unauthorized|401/i.test(msg)) {
    return new FlightShareError("UNAUTHENTICATED", msg);
  }
  if (/validation|422/i.test(msg)) {
    return new FlightShareError("VALIDATION", msg);
  }
  return new FlightShareError("SERVER_ERROR", msg);
}

/** Map an error string returned in the function's JSON body into a FlightShareError. */
function classifyBodyError(errorText: string): FlightShareError {
  const lower = errorText.toLowerCase();
  if (lower.includes("unauthorized")) {
    return new FlightShareError("UNAUTHENTICATED", errorText);
  }
  if (lower.includes("validation")) {
    return new FlightShareError("VALIDATION", errorText);
  }
  if (lower.includes("not found") || lower.includes("no longer available")) {
    return new FlightShareError("NOT_FOUND", errorText);
  }
  if (lower.includes("unsupported") || lower.includes("version")) {
    return new FlightShareError("UNSUPPORTED_VERSION", errorText);
  }
  return new FlightShareError("SERVER_ERROR", errorText);
}

// ── Edge Function response shapes (internal) ──────────────────────────────────

interface CreateEdgeFnResponse {
  ok:        boolean;
  shareId?:  string;
  publicUrl?: string;
  createdAt?: string;
  expiresAt?: string | null;
  error?:    string;
}

interface GetEdgeFnResponse {
  ok:            boolean;
  modelVersion?: number;
  shareModel?:   unknown;
  createdAt?:    string;
  expiresAt?:    string | null;
  error?:        string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create an immutable public flight-share snapshot.
 *
 * The authenticated user's session JWT is forwarded automatically by the
 * Supabase client. The Edge Function generates the token server-side and
 * returns the raw token embedded in publicUrl exactly once.
 *
 * Throws FlightShareError — never throws raw Supabase errors.
 */
export async function createFlightSearchShare(
  request: CreateFlightSearchShareRequest,
): Promise<CreateFlightSearchShareResponse> {
  const { data, error } = await supabase.functions.invoke<CreateEdgeFnResponse>(
    "create-flight-search-share",
    { body: request },
  );

  if (error) {
    throw classifyFunctionError(error);
  }

  if (!data?.ok) {
    throw classifyBodyError(data?.error ?? "Unknown error from create-flight-search-share");
  }

  return {
    shareId:   data.shareId!,
    publicUrl: data.publicUrl!,
    createdAt: data.createdAt!,
    expiresAt: data.expiresAt ?? null,
  };
}

/**
 * Fetch a public flight-share snapshot by raw token (no authentication required).
 *
 * `rawToken` comes from the URL path segment `/share/flights/<rawToken>`.
 * The Edge Function hashes the token, increments the view count atomically,
 * and returns only the sanitized public payload.
 *
 * Throws FlightShareError — never throws raw Supabase errors.
 */
export async function getPublicFlightSearchShare(
  rawToken: string,
): Promise<PublicFlightSearchShareResponse> {
  const { data, error } = await supabase.functions.invoke<GetEdgeFnResponse>(
    "get-public-flight-search-share",
    { body: { token: rawToken } },
  );

  if (error) {
    throw classifyFunctionError(error);
  }

  if (!data?.ok) {
    throw classifyBodyError(data?.error ?? "Unknown error from get-public-flight-search-share");
  }

  const modelVersion = data.modelVersion!;
  let shareModel: FlightShareModel;

  try {
    shareModel = normalizeStoredFlightShare(modelVersion, data.shareModel);
  } catch (normErr) {
    const msg = normErr instanceof Error ? normErr.message : String(normErr);
    if (msg.startsWith("UNSUPPORTED_VERSION")) {
      throw new FlightShareError("UNSUPPORTED_VERSION", msg);
    }
    throw new FlightShareError("SERVER_ERROR", `Failed to normalize share payload: ${msg}`);
  }

  return {
    modelVersion,
    shareModel,
    createdAt: data.createdAt!,
    expiresAt: data.expiresAt ?? null,
  };
}
