import { isGoWild, normalizeAirport, type FlightSnapshot } from "./airportHelpers";

export type SeatRating = "high" | "medium" | "low";

export type SeatRouteRow = {
  label: string;
  rating: SeatRating;
  averageSeats: number;
  totalAvailableSeats: number;
  goWildLegCount: number;
  maxSeatsSeen: number;
  limitedData: boolean;
};

export type SeatAirportRow = {
  label: string;
  rating: SeatRating;
  averageSeats: number;
  totalAvailableSeats: number;
  goWildLegCount: number;
  routeCount: number;
};

export type SeatAnalytics = {
  routesWithMostSeats: SeatRouteRow[];
  routesWithLowestSeats: SeatRouteRow[];
  airportAverages: SeatAirportRow[];
};

export function getSeatRating(avg: number): SeatRating {
  if (avg >= 5) return "high";
  if (avg >= 2.5) return "medium";
  return "low";
}

export function computeSeatAnalytics(snapshots: FlightSnapshot[]): SeatAnalytics {
  type RouteEntry = { total: number; count: number; max: number };
  type AirportEntry = { total: number; count: number; routes: Set<string> };

  const routeMap = new Map<string, RouteEntry>();
  const airportMap = new Map<string, AirportEntry>();

  for (const s of snapshots) {
    if (!isGoWild(s.has_go_wild)) continue;
    if (s.go_wild_available_seats == null || s.go_wild_available_seats <= 0) continue;

    const origin = normalizeAirport(s.leg_origin_iata);
    const dest = normalizeAirport(s.leg_destination_iata);
    if (!origin || !dest) continue;

    const routeKey = `${origin} → ${dest}`;
    const seats = s.go_wild_available_seats;

    if (!routeMap.has(routeKey)) routeMap.set(routeKey, { total: 0, count: 0, max: 0 });
    const re = routeMap.get(routeKey)!;
    re.total += seats;
    re.count++;
    re.max = Math.max(re.max, seats);

    if (!airportMap.has(origin)) airportMap.set(origin, { total: 0, count: 0, routes: new Set() });
    const ae = airportMap.get(origin)!;
    ae.total += seats;
    ae.count++;
    ae.routes.add(routeKey);
  }

  const toRouteRow = (key: string, e: RouteEntry): SeatRouteRow => {
    const avg = e.total / e.count;
    return {
      label: key,
      rating: getSeatRating(avg),
      averageSeats: avg,
      totalAvailableSeats: e.total,
      goWildLegCount: e.count,
      maxSeatsSeen: e.max,
      limitedData: e.count < 2,
    };
  };

  const allRoutes = Array.from(routeMap.entries()).map(([k, v]) => toRouteRow(k, v));

  const routesWithMostSeats = [...allRoutes]
    .sort((a, b) => b.averageSeats - a.averageSeats || b.totalAvailableSeats - a.totalAvailableSeats)
    .slice(0, 5);

  const routesWithLowestSeats = [...allRoutes]
    .sort((a, b) => a.averageSeats - b.averageSeats || b.goWildLegCount - a.goWildLegCount)
    .slice(0, 5);

  const airportAverages = Array.from(airportMap.entries())
    .map(([airport, e]): SeatAirportRow => {
      const avg = e.total / e.count;
      return {
        label: airport,
        rating: getSeatRating(avg),
        averageSeats: avg,
        totalAvailableSeats: e.total,
        goWildLegCount: e.count,
        routeCount: e.routes.size,
      };
    })
    .sort((a, b) => b.averageSeats - a.averageSeats || b.goWildLegCount - a.goWildLegCount)
    .slice(0, 5);

  return { routesWithMostSeats, routesWithLowestSeats, airportAverages };
}
