import type { Itinerary, LimitedDataMeta } from "./insightTypes";

export type SeatRating = "high" | "medium" | "low";

export type SeatRouteRow = {
  label: string;
  rating: SeatRating;
  averageSeats: number;
  totalAvailableSeats: number;
  goWildItineraryCount: number;
  maxSeatsSeen: number;
  totalItineraries: number;
  goWildRate: number;
  // back-compat
  goWildLegCount: number;
  limitedData: boolean;
};

export type SeatAirportRow = {
  label: string;
  rating: SeatRating;
  averageSeats: number;
  totalAvailableSeats: number;
  goWildItineraryCount: number;
  routeCount: number;
  // back-compat
  goWildLegCount: number;
};

export type SeatAnalytics = {
  routesWithMostSeats: SeatRouteRow[];
  routesWithLowestSeats: SeatRouteRow[];
  airportAverages: SeatAirportRow[];
  meta: LimitedDataMeta;
};

const SEAT_THRESHOLD = 10; // GoWild itineraries per route
const TARGET_RESULTS = 5;

export function getSeatRating(avg: number): SeatRating {
  if (avg >= 5) return "high";
  if (avg >= 2.5) return "medium";
  return "low";
}

export function computeSeatAnalytics(itineraries: Itinerary[]): SeatAnalytics {
  type RouteEntry = {
    seats: number[];
    total: number;
    max: number;
    totalItineraries: number;
    goWild: number;
  };
  type AirportEntry = { seats: number[]; total: number; routes: Set<string>; goWild: number };

  const routeMap = new Map<string, RouteEntry>();
  const airportMap = new Map<string, AirportEntry>();

  for (const it of itineraries) {
    const routeKey = it.routeLabel;
    if (!routeMap.has(routeKey)) {
      routeMap.set(routeKey, { seats: [], total: 0, max: 0, totalItineraries: 0, goWild: 0 });
    }
    const re = routeMap.get(routeKey)!;
    re.totalItineraries++;
    if (it.isGoWildAvailable && it.availableSeats > 0) {
      re.seats.push(it.availableSeats);
      re.total += it.availableSeats;
      re.max = Math.max(re.max, it.availableSeats);
      re.goWild++;
    }

    if (!airportMap.has(it.origin))
      airportMap.set(it.origin, { seats: [], total: 0, routes: new Set(), goWild: 0 });
    const ae = airportMap.get(it.origin)!;
    if (it.isGoWildAvailable && it.availableSeats > 0) {
      ae.seats.push(it.availableSeats);
      ae.total += it.availableSeats;
      ae.routes.add(routeKey);
      ae.goWild++;
    }
  }

  const allRoutes: SeatRouteRow[] = Array.from(routeMap.entries()).map(([k, e]) => {
    const avg = e.seats.length > 0 ? e.total / e.seats.length : 0;
    return {
      label: k,
      rating: getSeatRating(avg),
      averageSeats: avg,
      totalAvailableSeats: e.total,
      goWildItineraryCount: e.goWild,
      maxSeatsSeen: e.max,
      totalItineraries: e.totalItineraries,
      goWildRate: e.totalItineraries > 0 ? (e.goWild / e.totalItineraries) * 100 : 0,
      goWildLegCount: e.goWild,
      limitedData: e.goWild < SEAT_THRESHOLD,
    };
  });

  const qualified = allRoutes.filter((r) => r.goWildItineraryCount >= SEAT_THRESHOLD);
  const limited = qualified.length < TARGET_RESULTS;
  const pool = limited
    ? allRoutes.filter((r) => r.goWildItineraryCount >= 1)
    : qualified;

  const sortMost = (a: SeatRouteRow, b: SeatRouteRow) =>
    b.averageSeats - a.averageSeats ||
    b.goWildItineraryCount - a.goWildItineraryCount ||
    b.goWildRate - a.goWildRate;

  const sortLowest = (a: SeatRouteRow, b: SeatRouteRow) =>
    a.averageSeats - b.averageSeats ||
    b.goWildItineraryCount - a.goWildItineraryCount;

  const routesWithMostSeats = pool.slice().sort(sortMost).slice(0, TARGET_RESULTS);
  const routesWithLowestSeats = pool.slice().sort(sortLowest).slice(0, TARGET_RESULTS);

  const airportAverages: SeatAirportRow[] = Array.from(airportMap.entries())
    .filter(([, e]) => e.seats.length > 0)
    .map(([airport, e]) => {
      const avg = e.total / e.seats.length;
      return {
        label: airport,
        rating: getSeatRating(avg),
        averageSeats: avg,
        totalAvailableSeats: e.total,
        goWildItineraryCount: e.goWild,
        routeCount: e.routes.size,
        goWildLegCount: e.goWild,
      };
    })
    .sort((a, b) => b.averageSeats - a.averageSeats || b.goWildItineraryCount - a.goWildItineraryCount)
    .slice(0, TARGET_RESULTS);

  return {
    routesWithMostSeats,
    routesWithLowestSeats,
    airportAverages,
    meta: {
      limitedData: limited,
      qualifiedCount: qualified.length,
      threshold: SEAT_THRESHOLD,
    },
  };
}
