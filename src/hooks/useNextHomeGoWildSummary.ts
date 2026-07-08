import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type NextHomeGoWildSummaryStatus =
  | "ready"
  | "no_available_flights"
  | "processing"
  | "not_ready"
  | "job_failed"
  | "home_airport_missing"
  | "timezone_missing";

export interface NextHomeGoWildSummaryFeed {
  status: NextHomeGoWildSummaryStatus;
  homeAirport?: string;
  airportName?: string | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeAirportTimezone?: string;
  localDate?: string;
  targetDate?: string;
  observedAt?: string | null;
  jobStatus?: string | null;
  allFlightsCount: number;
  goWildFlightsCount: number;
  destinationCount: number;
  nonstopGoWildCount: number;
  totalGoWildSeats: number;
  lowestGoWildPrice?: number | null;
  currency?: string;
}

const EMPTY_FEED: NextHomeGoWildSummaryFeed = {
  status: "not_ready",
  allFlightsCount: 0,
  goWildFlightsCount: 0,
  destinationCount: 0,
  nonstopGoWildCount: 0,
  totalGoWildSeats: 0,
  currency: "USD",
};

export function useNextHomeGoWildSummary() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<NextHomeGoWildSummaryFeed>(EMPTY_FEED);
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
      "get_next_home_gowild_summary",
    );

    if (!mountedRef.current) return;

    if (rpcError) {
      setError(rpcError.message || "Unable to load your home airport GoWild summary.");
    } else {
      const next = (data ?? EMPTY_FEED) as NextHomeGoWildSummaryFeed;
      setFeed({
        ...EMPTY_FEED,
        ...next,
        allFlightsCount: Number(next.allFlightsCount ?? 0),
        goWildFlightsCount: Number(next.goWildFlightsCount ?? 0),
        destinationCount: Number(next.destinationCount ?? 0),
        nonstopGoWildCount: Number(next.nonstopGoWildCount ?? 0),
        totalGoWildSeats: Number(next.totalGoWildSeats ?? 0),
      });
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
