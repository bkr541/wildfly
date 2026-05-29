import { supabase } from "@/integrations/supabase/client";

/**
 * Proxy all flight API requests through the flight-proxy edge function
 * so the GoWilder token is never exposed client-side AND so that paid
 * searches are billed server-side (the only authoritative billing path).
 *
 * For paid endpoints (/search, /roundTrip, /dayTrips) callers MUST include
 * a `billing` block with a stable per-search `requestId` so the server can:
 *   - charge credits atomically,
 *   - deduplicate retries via the request id,
 *   - refund automatically when the upstream provider fails.
 */

export interface BillingMeta {
  /** Stable per-search identifier. Use the same value for retries. */
  requestId: string;
  /** Normalized trip type, e.g. "one_way" | "round_trip" | "day_trip" | "trip_planner". */
  tripType: string;
  /** Number of arrival airports the user picked (0 when allDestinations). */
  arrivalAirportsCount: number;
  /** Whether the user is searching all destinations (costs more). */
  allDestinations: boolean;
  /** Developer/admin bypass — only honored for users in developer_allowlist. */
  skip?: boolean;
}

export interface ProxyBillingResponse {
  charged: number;
  used_from_monthly: number;
  used_from_purchased: number;
  remaining_monthly: number | null;
  purchased_balance: number | null;
  plan_id: string | null;
  request_id: string | null;
  already_processed: boolean;
}

export interface InsufficientCreditsInfo {
  cost: number;
  remaining_monthly: number;
  purchased_balance: number;
  plan_id: string | null;
  request_id: string;
}

export class InsufficientCreditsError extends Error {
  info: InsufficientCreditsInfo;
  constructor(info: InsufficientCreditsInfo) {
    super("INSUFFICIENT_CREDITS");
    this.info = info;
  }
}

interface FlightProxyRequest {
  path: "/search" | "/inbound" | "/dayTrips" | "/roundTrip";
  method: "GET" | "POST";
  params?: Record<string, string>;
  payload?: Record<string, unknown>;
  billing?: BillingMeta;
}

export async function flightApiFetch<T = any>(
  request: FlightProxyRequest,
): Promise<{ data: T; status: number; billing: ProxyBillingResponse | null }> {
  const { data, error } = await supabase.functions.invoke("flight-proxy", {
    body: request,
  });

  // supabase-js sets `error` for non-2xx responses, but the body is still
  // returned in `data` when the function emitted JSON. Read it for structured errors.
  if (error) {
    const body: any = (data as any) ?? null;
    // Try to extract JSON body from the FunctionsHttpError context if needed
    let ctxBody: any = null;
    try {
      const ctx = (error as any).context;
      if (ctx?.response) {
        ctxBody = await ctx.response.clone().json();
      }
    } catch { /* ignore */ }
    const merged = body ?? ctxBody;
    if (merged?.code === "INSUFFICIENT_CREDITS" && merged?.billing) {
      throw new InsufficientCreditsError({
        cost: merged.billing.cost ?? 0,
        remaining_monthly: merged.billing.remaining_monthly ?? 0,
        purchased_balance: merged.billing.purchased_balance ?? 0,
        plan_id: merged.billing.plan_id ?? null,
        request_id: merged.billing.request_id ?? request.billing?.requestId ?? "",
      });
    }
    throw new Error(merged?.error ?? error.message ?? "Flight proxy request failed");
  }

  const envelope = data as any;
  if (envelope && envelope.ok === false) {
    if (envelope.code === "INSUFFICIENT_CREDITS" && envelope.billing) {
      throw new InsufficientCreditsError({
        cost: envelope.billing.cost ?? 0,
        remaining_monthly: envelope.billing.remaining_monthly ?? 0,
        purchased_balance: envelope.billing.purchased_balance ?? 0,
        plan_id: envelope.billing.plan_id ?? null,
        request_id: envelope.billing.request_id ?? request.billing?.requestId ?? "",
      });
    }
    throw new Error(envelope.error ?? "Flight proxy request failed");
  }

  return {
    data: (envelope?.data ?? envelope) as T,
    status: 200,
    billing: envelope?.billing ?? null,
  };
}

/** Convenience: GET /api/flights/dayTrips */
export function fetchDayTrips(params: Record<string, string>, billing?: BillingMeta) {
  return flightApiFetch({ path: "/dayTrips", method: "GET", params, billing });
}

/** Convenience: POST /api/flights/search */
export function fetchFlightSearch(payload: Record<string, unknown>, billing?: BillingMeta) {
  return flightApiFetch({ path: "/search", method: "POST", payload, billing });
}

/** Convenience: POST /api/flights/roundTrip */
export function fetchRoundTrip(payload: Record<string, unknown>, billing?: BillingMeta) {
  return flightApiFetch({ path: "/roundTrip", method: "POST", payload, billing });
}

/** Convenience: GET /api/flights/inbound (not a paid endpoint). */
export function fetchInbound(params: Record<string, string>) {
  return flightApiFetch({ path: "/inbound", method: "GET", params });
}
