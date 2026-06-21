/**
 * useRadarRouteMetrics
 *
 * Loads historical GoWild route/airport metrics from Supabase once and returns
 * them indexed by route key ("ORIGIN-DEST") and airport IATA code.
 *
 * Used by Routes.tsx and FlightMultiDestResults.tsx to augment map rendering
 * with availability colors — without the Radar admin chrome.
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";
import type { FlightSnapshot } from "@/components/insights/airportHelpers";
import { isGoWild } from "@/components/insights/airportHelpers";
import { getFreshnessStatus } from "@/components/admin/FlightSearchDetailDrawer";
import type { RadarStyledRoute, RadarStyledAirport } from "@/components/maps/radar/radarMapTypes";

export type { RadarStyledRoute, RadarStyledAirport };

interface UseRadarRouteMetricsResult {
  routeMetrics: Map<string, RadarStyledRoute>;
  airportMetrics: Map<string, RadarStyledAirport>;
  loading: boolean;
  error: string | null;
}

export function useRadarRouteMetrics(): UseRadarRouteMetricsResult {
  const [snapshots, setSnapshots] = useState<FlightSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dict, loading: dictLoading } = useAirportDictionary();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await supabase.rpc("get_global_gowild_insight_snapshots", { p_limit: 2000 });
        if (cancelled) return;
        if (res.error) {
          setError(res.error.message);
          return;
        }
        setSnapshots((res.data ?? []) as FlightSnapshot[]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { routeMetrics, airportMetrics } = useMemo<{
    routeMetrics: Map<string, RadarStyledRoute>;
    airportMetrics: Map<string, RadarStyledAirport>;
  }>(() => {
    if (dictLoading || snapshots.length === 0) {
      return { routeMetrics: new Map(), airportMetrics: new Map() };
    }

    // Per-route accumulators
    const routeAcc = new Map<string, {
      origin: string;
      destination: string;
      originLat: number;
      originLng: number;
      destinationLat: number;
      destinationLng: number;
      snapshotCount: number;
      goWildCount: number;
      seatSum: number; seatN: number;
      savingsSum: number; savingsN: number;
      gwFareSum: number; gwFareN: number;
      latestAt: string | null;
    }>();

    // Per-airport accumulators
    const airportAcc = new Map<string, {
      routeKeys: Set<string>;
      seatSum: number; seatN: number;
      savingsSum: number; savingsN: number;
      latestAt: string | null;
    }>();

    for (const snap of snapshots) {
      const org = snap.leg_origin_iata ?? snap.origin_iata;
      const dst = snap.leg_destination_iata ?? snap.destination_iata;
      if (!org || !dst) continue;

      const orgInfo = dict[org];
      const dstInfo = dict[dst];
      if (!orgInfo?.latitude || !orgInfo?.longitude || !dstInfo?.latitude || !dstInfo?.longitude) continue;

      const gw = isGoWild(snap.has_go_wild);
      const seats = snap.go_wild_available_seats ?? null;
      const savings = snap.standard_total != null && snap.go_wild_total != null && snap.standard_total > snap.go_wild_total
        ? snap.standard_total - snap.go_wild_total
        : null;

      const routeKey = `${org}-${dst}`;
      let r = routeAcc.get(routeKey);
      if (!r) {
        r = {
          origin: org, destination: dst,
          originLat: orgInfo.latitude, originLng: orgInfo.longitude,
          destinationLat: dstInfo.latitude, destinationLng: dstInfo.longitude,
          snapshotCount: 0, goWildCount: 0,
          seatSum: 0, seatN: 0,
          savingsSum: 0, savingsN: 0,
          gwFareSum: 0, gwFareN: 0,
          latestAt: null,
        };
        routeAcc.set(routeKey, r);
      }
      r.snapshotCount++;
      if (gw) {
        r.goWildCount++;
        if (seats != null) { r.seatSum += seats; r.seatN++; }
        if (snap.go_wild_total != null) { r.gwFareSum += snap.go_wild_total; r.gwFareN++; }
      }
      if (savings != null) { r.savingsSum += savings; r.savingsN++; }
      if (!r.latestAt || snap.snapshot_at > r.latestAt) r.latestAt = snap.snapshot_at;

      // Airport accumulators
      for (const code of [org, dst]) {
        let a = airportAcc.get(code);
        if (!a) {
          a = { routeKeys: new Set(), seatSum: 0, seatN: 0, savingsSum: 0, savingsN: 0, latestAt: null };
          airportAcc.set(code, a);
        }
        a.routeKeys.add(routeKey);
        if (gw && seats != null) { a.seatSum += seats; a.seatN++; }
        if (savings != null) { a.savingsSum += savings; a.savingsN++; }
        if (!a.latestAt || snap.snapshot_at > a.latestAt) a.latestAt = snap.snapshot_at;
      }
    }

    // Build route metrics
    const routeMetrics = new Map<string, RadarStyledRoute>();
    for (const [routeKey, acc] of routeAcc) {
      const availabilityRate = acc.snapshotCount > 0 ? acc.goWildCount / acc.snapshotCount : 0;
      const avgGoWildSeats = acc.seatN > 0 ? acc.seatSum / acc.seatN : null;
      const avgSavings = acc.savingsN > 0 ? acc.savingsSum / acc.savingsN : null;
      const avgGoWildFare = acc.gwFareN > 0 ? acc.gwFareSum / acc.gwFareN : null;
      const freshnessStatus = acc.latestAt ? getFreshnessStatus(acc.latestAt) : "unknown";
      const isStale = freshnessStatus === "stale" || freshnessStatus === "unknown";

      routeMetrics.set(routeKey, {
        routeKey,
        origin: acc.origin,
        destination: acc.destination,
        originLat: acc.originLat,
        originLng: acc.originLng,
        destinationLat: acc.destinationLat,
        destinationLng: acc.destinationLng,
        snapshotCount: acc.snapshotCount,
        goWildCount: acc.goWildCount,
        availabilityRate,
        avgGoWildSeats,
        avgGoWildFare,
        avgSavings,
        searchCount: 0,
        volatilityScore: null,
        freshnessStatus,
        isStale,
      });
    }

    // Build airport metrics
    const airportMetrics = new Map<string, RadarStyledAirport>();
    for (const [iata, acc] of airportAcc) {
      const info = dict[iata];
      if (!info?.latitude || !info?.longitude) continue;

      // avg availability rate across routes through this airport
      let rateSum = 0, rateN = 0;
      for (const rk of acc.routeKeys) {
        const rm = routeAcc.get(rk);
        if (rm) {
          rateSum += rm.snapshotCount > 0 ? rm.goWildCount / rm.snapshotCount : 0;
          rateN++;
        }
      }
      const avgAvailabilityRate = rateN > 0 ? rateSum / rateN : null;
      const avgSeats = acc.seatN > 0 ? acc.seatSum / acc.seatN : null;
      const avgSavings = acc.savingsN > 0 ? acc.savingsSum / acc.savingsN : null;
      const freshnessStatus = acc.latestAt ? getFreshnessStatus(acc.latestAt) : "unknown";

      const rate = avgAvailabilityRate ?? 0;
      const opportunityStrength: RadarStyledAirport["opportunityStrength"] =
        rate >= 0.5  ? "strong"
        : rate >= 0.35 ? "good"
        : rate >= 0.15 ? "weak"
        : rate > 0    ? "poor"
        : "unknown";

      airportMetrics.set(iata, {
        iata,
        lat: info.latitude,
        lng: info.longitude,
        name: info.name ?? iata,
        city: info.city ?? iata,
        routeCount: acc.routeKeys.size,
        searchVolume: 0,
        avgAvailabilityRate,
        avgSeats,
        avgSavings,
        freshnessStatus,
        opportunityStrength,
      });
    }

    return { routeMetrics, airportMetrics };
  }, [snapshots, dict, dictLoading]);

  return {
    routeMetrics,
    airportMetrics,
    loading: loading || dictLoading,
    error,
  };
}
