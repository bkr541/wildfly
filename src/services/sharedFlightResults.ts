// ─────────────────────────────────────────────────────────────────────────────
// sharedFlightResults.ts
//
// Client-facing service for the create-shared-flight-result and
// get-public-shared-flight-result Edge Functions.
//
// All Supabase / Edge Function errors are normalized into SharedFlightResultError
// with a typed .kind so UI components never receive raw SDK error objects.
//
// HTTP error bodies are parsed from the FunctionsHttpError context when available
// so server messages (e.g. "Payload too large") surface instead of the generic
// "Edge Function returned a non-2xx status code" wrapper.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { FlightShareModel } from "@/utils/flightShareModel";
import { normalizeStoredFlightShare } from "@/utils/flightShareNormalize";

// ── Request / response contracts ───────────────────────────────────────────────

export interface CreateSharedFlightResultRequest {
  payloadVersion:       1;
  displayModelVersion:  1;
  rawSearchPayload:     unknown;
  displayModel:         FlightShareModel;
  sourceFlightSearchId?: string | null;
  expiresInDays?:       number | null;
}

export interface CreateSharedFlightResultResponse {
  shareId:   string;
  publicUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface PublicSharedFlightResultResponse {
  displayModelVersion: number;
  displayModel:        FlightShareModel;
  createdAt:           string;
  expiresAt:           string | null;
}

// ── Typed error ────────────────────────────────────────────────────────────────

export type SharedFlightResultErrorKind =
  | "UNAUTHENTICATED"
  | "VALIDATION"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "UNSUPPORTED_VERSION"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

export class SharedFlightResultError extends Error {
  public readonly kind: SharedFlightResultErrorKind;

  constructor(kind: SharedFlightResultErrorKind, message: string) {
    super(message);
    this.name  = "SharedFlightResultError";
    this.kind  = kind;
  }
}

// ── Internal Edge Function response shapes ─────────────────────────────────────

interface CreateEdgeFnResponse {
  ok:        boolean;
  shareId?:  string;
  publicUrl?: string;
  createdAt?: string;
  expiresAt?: string | null;
  error?:    string;
}

interface GetEdgeFnResponse {
  ok:                   boolean;
  displayModelVersion?: number;
  displayModel?:        unknown;
  createdAt?:           string;
  expiresAt?:           string | null;
  error?:               string;
}

// ── Error classification ───────────────────────────────────────────────────────

// Map HTTP status codes to error kinds. Used when the Supabase SDK surfaces a
// FunctionsHttpError (non-2xx response) and we can read the response body.
const STATUS_KIND: Partial<Record<number, SharedFlightResultErrorKind>> = {
  401: "UNAUTHENTICATED",
  403: "UNAUTHENTICATED",
  413: "PAYLOAD_TOO_LARGE",
  422: "VALIDATION",
  404: "NOT_FOUND",
};

/**
 * Classify an error from supabase.functions.invoke().
 *
 * Supabase wraps non-2xx Edge Function responses as FunctionsHttpError objects
 * that have a `.context` Response. We parse the response body to get the
 * server's descriptive message rather than the generic SDK wrapper text.
 *
 * Network failures (DNS, TCP timeout, relay down) arrive without a `.context`
 * and are classified as NETWORK_ERROR.
 */
async function classifyInvocationError(
  error: unknown,
): Promise<SharedFlightResultError> {
  // FunctionsHttpError duck-type check: has a `.context` that is a Response.
  if (
    error != null &&
    typeof error === "object" &&
    "context" in (error as object)
  ) {
    const ctx = (error as Record<string, unknown>).context;
    if (ctx instanceof Response) {
      const status = ctx.status;
      let serverMessage: string | null = null;
      try {
        const body = await ctx.clone().json() as { error?: string };
        serverMessage = body?.error ?? null;
      } catch {
        /* ignore parse failure — fall back to status mapping */
      }

      const kind: SharedFlightResultErrorKind =
        STATUS_KIND[status] ?? "SERVER_ERROR";
      return new SharedFlightResultError(
        kind,
        serverMessage ?? `HTTP ${status}`,
      );
    }
  }

  // Network/relay error (no HTTP context available).
  const msg =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  if (/network|fetch|connection|timeout/i.test(msg)) {
    return new SharedFlightResultError("NETWORK_ERROR", msg);
  }

  // Text-based fallback for when the SDK wraps the error without a context.
  if (/unauthorized|401/i.test(msg)) {
    return new SharedFlightResultError("UNAUTHENTICATED", msg);
  }
  if (/payload.too.large|413/i.test(msg)) {
    return new SharedFlightResultError("PAYLOAD_TOO_LARGE", msg);
  }
  if (/validation|422/i.test(msg)) {
    return new SharedFlightResultError("VALIDATION", msg);
  }

  return new SharedFlightResultError("SERVER_ERROR", msg);
}

/** Classify a server error string returned in the Edge Function's JSON body. */
function classifyBodyError(errorText: string): SharedFlightResultError {
  const lower = errorText.toLowerCase();
  if (lower.includes("unauthorized")) {
    return new SharedFlightResultError("UNAUTHENTICATED", errorText);
  }
  if (lower.includes("payload too large") || lower.includes("too large")) {
    return new SharedFlightResultError("PAYLOAD_TOO_LARGE", errorText);
  }
  if (lower.includes("validation")) {
    return new SharedFlightResultError("VALIDATION", errorText);
  }
  if (lower.includes("not found") || lower.includes("no longer available")) {
    return new SharedFlightResultError("NOT_FOUND", errorText);
  }
  if (lower.includes("unsupported") || lower.includes("version")) {
    return new SharedFlightResultError("UNSUPPORTED_VERSION", errorText);
  }
  return new SharedFlightResultError("SERVER_ERROR", errorText);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create an immutable public flight-result snapshot.
 *
 * The authenticated user's JWT is forwarded automatically by the Supabase
 * client. The Edge Function generates the raw token server-side and embeds
 * it in publicUrl exactly once — the client never receives the raw token as
 * a standalone value and therefore cannot accidentally persist or log it.
 *
 * owner_user_id is never part of the request body; the Edge Function derives
 * it from the verified JWT.
 *
 * Throws SharedFlightResultError — never throws raw Supabase errors.
 */
export async function createSharedFlightResult(
  request: CreateSharedFlightResultRequest,
): Promise<CreateSharedFlightResultResponse> {
  const { data, error } = await supabase.functions.invoke<CreateEdgeFnResponse>(
    "create-shared-flight-result",
    { body: request },
  );

  if (error) {
    throw await classifyInvocationError(error);
  }

  if (!data?.ok) {
    throw classifyBodyError(
      data?.error ?? "Unknown error from create-shared-flight-result",
    );
  }

  return {
    shareId:   data.shareId!,
    publicUrl: data.publicUrl!,
    createdAt: data.createdAt!,
    expiresAt: data.expiresAt ?? null,
  };
}

/**
 * Fetch a public flight-result snapshot by raw token (no authentication required).
 *
 * rawToken comes from the URL path segment /share/flights/<rawToken>.
 * The Edge Function hashes the token, increments view_count atomically via
 * a SECURITY DEFINER RPC, and returns only the sanitized display model.
 * raw_search_payload, owner_user_id, and public_token_hash are never returned.
 *
 * Throws SharedFlightResultError — never throws raw Supabase errors.
 */
export async function getPublicSharedFlightResult(
  rawToken: string,
): Promise<PublicSharedFlightResultResponse> {
  const { data, error } = await supabase.functions.invoke<GetEdgeFnResponse>(
    "get-public-shared-flight-result",
    { body: { token: rawToken } },
  );

  if (error) {
    throw await classifyInvocationError(error);
  }

  if (!data?.ok) {
    throw classifyBodyError(
      data?.error ?? "Unknown error from get-public-shared-flight-result",
    );
  }

  const displayModelVersion = data.displayModelVersion!;

  // Normalize the stored display model through the versioned deserializer.
  // Unknown versions or malformed payloads throw here so callers surface a
  // typed error rather than rendering a broken page.
  let displayModel: FlightShareModel;
  try {
    displayModel = normalizeStoredFlightShare(displayModelVersion, data.displayModel);
  } catch (normErr) {
    const msg = normErr instanceof Error ? normErr.message : String(normErr);
    if (msg.startsWith("UNSUPPORTED_VERSION")) {
      throw new SharedFlightResultError("UNSUPPORTED_VERSION", msg);
    }
    throw new SharedFlightResultError(
      "SERVER_ERROR",
      `Failed to normalize display model: ${msg}`,
    );
  }

  // Explicitly select only the public fields — owner, token hash, and raw
  // payload are not present in the Edge Function response (the RPC excludes
  // them at the SQL level), but we project here to make that contract explicit.
  return {
    displayModelVersion,
    displayModel,
    createdAt:  data.createdAt!,
    expiresAt:  data.expiresAt ?? null,
  };
}
