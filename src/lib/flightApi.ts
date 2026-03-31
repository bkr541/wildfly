import { supabase } from "@/integrations/supabase/client";

/**
 * Proxy all flight API requests through the flight-proxy edge function
 * so the GoWilder token is never exposed client-side.
 */

interface FlightProxyRequest {
  path: "/search" | "/inbound" | "/dayTrips" | "/roundTrip";
  method: "GET" | "POST";
  params?: Record<string, string>;
  payload?: Record<string, unknown>;
}

export async function flightApiFetch<T = any>(
  request: FlightProxyRequest
): Promise<{ data: T; status: number }> {
  const { data, error } = await supabase.functions.invoke("flight-proxy", {
    body: request,
  });

  if (error) {
    throw new Error(error.message ?? "Flight proxy request failed");
  }

  return { data: data as T, status: 200 };
}

/** Convenience: GET /api/flights/dayTrips */
export function fetchDayTrips(params: Record<string, string>) {
  return flightApiFetch({ path: "/dayTrips", method: "GET", params });
}

/** Convenience: POST /api/flights/search */
export function fetchFlightSearch(payload: Record<string, unknown>) {
  return flightApiFetch({ path: "/search", method: "POST", payload });
}

/** Convenience: POST /api/flights/roundTrip */
export function fetchRoundTrip(payload: Record<string, unknown>) {
  return flightApiFetch({ path: "/roundTrip", method: "POST", payload });
}

/** Convenience: GET /api/flights/inbound */
export function fetchInbound(params: Record<string, string>) {
  return flightApiFetch({ path: "/inbound", method: "GET", params });
}
