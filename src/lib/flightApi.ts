import { supabase } from "@/integrations/supabase/client";

/**
 * Proxy all provider requests through the flight-proxy edge function so the
 * GoWilder token stays server-side and deliberate searches share one atomic
 * Free/Paid entitlement path.
 */

export interface BillingMeta {
  /** Unique per deliberate search click. Reuse only when retrying that request. */
  requestId: string;
  /** Trusted server logging label. The server ignores client attempts to bypass billing. */
  searchSource?: "flight_proxy" | "user_search";
}

export interface ProxyBillingResponse {
  allowed: boolean;
  reason: string | null;
  charged: number;
  tier: "free" | "paid";
  limit: number | null;
  used: number;
  remaining: number | null;
  plan_id: string | null;
  plan_name: string | null;
  request_id: string | null;
  already_processed: boolean;
  period_start?: string | null;
  period_end?: string | null;
}

export interface SearchLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  planId: string | null;
  requestId: string;
}

export class SearchLimitReachedError extends Error {
  info: SearchLimitInfo;

  constructor(info: SearchLimitInfo) {
    super("MONTHLY_SEARCH_LIMIT_REACHED");
    this.name = "SearchLimitReachedError";
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

function toSearchLimitError(envelope: any, fallbackRequestId = "") {
  const billing = envelope?.billing ?? {};
  return new SearchLimitReachedError({
    limit: billing.limit ?? 5,
    used: billing.used ?? billing.limit ?? 5,
    remaining: billing.remaining ?? 0,
    planId: billing.plan_id ?? null,
    requestId: billing.request_id ?? fallbackRequestId,
  });
}

export async function flightApiFetch<T = any>(
  request: FlightProxyRequest,
): Promise<{ data: T; status: number; billing: ProxyBillingResponse | null }> {
  const { data, error } = await supabase.functions.invoke("flight-proxy", {
    body: request,
  });

  if (error) {
    const body: any = (data as any) ?? null;
    let contextBody: any = null;
    try {
      const response = (error as any).context?.response;
      if (response) contextBody = await response.clone().json();
    } catch {
      // The generic error below still carries the edge-function message.
    }
    const envelope = body ?? contextBody;
    if (envelope?.code === "MONTHLY_SEARCH_LIMIT_REACHED") {
      throw toSearchLimitError(envelope, request.billing?.requestId);
    }
    throw new Error(envelope?.error ?? error.message ?? "Flight proxy request failed");
  }

  const envelope = data as any;
  if (envelope?.ok === false) {
    if (envelope.code === "MONTHLY_SEARCH_LIMIT_REACHED") {
      throw toSearchLimitError(envelope, request.billing?.requestId);
    }
    throw new Error(envelope.error ?? "Flight proxy request failed");
  }

  return {
    data: (envelope?.data ?? envelope) as T,
    status: 200,
    billing: envelope?.billing ?? null,
  };
}

export function fetchDayTrips(params: Record<string, string>, billing?: BillingMeta) {
  return flightApiFetch({ path: "/dayTrips", method: "GET", params, billing });
}

export function fetchFlightSearch(payload: Record<string, unknown>, billing?: BillingMeta) {
  return flightApiFetch({ path: "/search", method: "POST", payload, billing });
}

export function fetchRoundTrip(payload: Record<string, unknown>, billing?: BillingMeta) {
  return flightApiFetch({ path: "/roundTrip", method: "POST", payload, billing });
}

/** Inbound lookups are supporting data for an already-authorized search. */
export function fetchInbound(params: Record<string, string>) {
  return flightApiFetch({ path: "/inbound", method: "GET", params });
}
