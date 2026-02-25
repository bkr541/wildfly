import { useMemo } from "react";
import routesData from "@/data/routes.json";

const routes: Record<string, string[]> = routesData;

export interface RouteStats {
  numAirports: number;
  numRoutes: number;
  avgDestinations: number;
  minDest: { iata: string; count: number };
  maxDest: { iata: string; count: number };
  hubRank: number;
  destinations: string[];
  reciprocalCount: number;
  reciprocalPercent: number;
  anomalies: string[];
  hubsSorted: { iata: string; count: number }[];
}

export function useRouteStats(origin: string | null): RouteStats {
  return useMemo(() => {
    const entries = Object.entries(routes);
    const numAirports = entries.length;
    const numRoutes = entries.reduce((s, [, v]) => s + v.length, 0);
    const avgDestinations = numAirports > 0 ? Math.round(numRoutes / numAirports) : 0;

    const hubsSorted = entries
      .map(([iata, dests]) => ({ iata, count: dests.length }))
      .sort((a, b) => b.count - a.count);

    const minDest = hubsSorted[hubsSorted.length - 1] ?? { iata: "-", count: 0 };
    const maxDest = hubsSorted[0] ?? { iata: "-", count: 0 };

    const destinations = origin && routes[origin] ? routes[origin] : [];
    const hubRank = origin ? hubsSorted.findIndex(h => h.iata === origin) + 1 : 0;

    let reciprocalCount = 0;
    const anomalies: string[] = [];
    for (const dest of destinations) {
      if (routes[dest]?.includes(origin!)) {
        reciprocalCount++;
      } else {
        anomalies.push(dest);
      }
    }

    const reciprocalPercent = destinations.length > 0
      ? Math.round((reciprocalCount / destinations.length) * 100)
      : 0;

    return {
      numAirports, numRoutes, avgDestinations,
      minDest, maxDest, hubRank, destinations,
      reciprocalCount, reciprocalPercent, anomalies,
      hubsSorted,
    };
  }, [origin]);
}
