import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TodaysGoWildFlight {
  id: string;
  itineraryKey: string;
  airline: string | null;
  flightNumber: string;
  originIata: string;
  destinationIata: string;
  destinationCity: string | null;
  destinationState: string | null;
  destinationTimezone: string | null;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  flightType: string | null;
  stops: number | null;
  duration: string | null;
  cabin: string | null;
  goWildPrice: number | null;
  standardPrice: number | null;
  availableSeats: number | null;
  currency: string;
}

export type TodaysGoWildStatus =
  | "ready"
  | "no_available_flights"
  | "processing"
  | "not_ready"
  | "job_failed"
  | "home_airport_missing"
  | "timezone_missing";

export interface TodaysGoWildFeed {
  status: TodaysGoWildStatus;
  homeAirport?: string;
  airportName?: string | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeAirportTimezone?: string;
  localDate?: string;
  observedAt?: string | null;
  jobStatus?: string | null;
  flights: TodaysGoWildFlight[];
}

const EMPTY_FEED: TodaysGoWildFeed = {
  status: "not_ready",
  flights: [],
};

export function useTodaysGoWildFlights() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<TodaysGoWildFeed>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!user) {
      setFeed(EMPTY_FEED);
      setLoading(false);
      return;
    }

    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "get_todays_home_gowild_flights",
    );

    if (!mountedRef.current) return;

    if (rpcError) {
      setError(rpcError.message || "Unable to load today's GoWild flights.");
    } else {
      const next = (data ?? EMPTY_FEED) as TodaysGoWildFeed;
      setFeed({ ...next, flights: Array.isArray(next.flights) ? next.flights : [] });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!user || !["processing", "not_ready"].includes(feed.status)) return;
    const timer = window.setTimeout(() => void load(), 60_000);
    return () => window.clearTimeout(timer);
  }, [feed.status, load, user]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  return { feed, loading, error, refetch: load };
}
