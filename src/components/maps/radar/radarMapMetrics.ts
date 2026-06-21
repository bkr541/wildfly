// Shared route/airport colour + sizing calculations for the radar map.
// These are the canonical implementations extracted from GoWildRadarMap.

import {
  COLOR_GREEN,
  COLOR_AMBER,
  COLOR_ROSE,
  COLOR_GRAY,
  COLOR_CYAN,
} from "./radarMapStyles";
import type { RadarMode, RadarStyledRoute, RadarStyledAirport } from "./radarMapTypes";

// ── Route colour by mode ──────────────────────────────────────────────────────
export function getRouteColor(route: RadarStyledRoute, mode: RadarMode): string {
  switch (mode) {
    case "availability": {
      const rate = route.availabilityRate;
      if (rate == null) return COLOR_GRAY;
      if (rate >= 0.5) return COLOR_GREEN;
      if (rate >= 0.25) return COLOR_AMBER;
      return COLOR_ROSE;
    }
    case "seats": {
      const s = route.avgGoWildSeats;
      if (s == null) return COLOR_GRAY;
      if (s >= 8) return COLOR_GREEN;
      if (s >= 4) return COLOR_CYAN;
      if (s >= 1) return COLOR_AMBER;
      return COLOR_ROSE;
    }
    case "savings": {
      const sv = route.avgSavings;
      if (sv == null) return COLOR_GRAY;
      if (sv >= 100) return COLOR_GREEN;
      if (sv >= 50) return COLOR_CYAN;
      if (sv >= 10) return COLOR_AMBER;
      return COLOR_GRAY;
    }
    case "freshness": {
      const f = route.freshnessStatus;
      if (f === "fresh") return COLOR_GREEN;
      if (f === "recent") return COLOR_CYAN;
      if (f === "aging") return COLOR_AMBER;
      if (f === "stale") return COLOR_ROSE;
      return COLOR_GRAY;
    }
    case "searchDemand": {
      const d = route.searchCount;
      if (d >= 50) return COLOR_GREEN;
      if (d >= 20) return COLOR_CYAN;
      if (d >= 5) return COLOR_AMBER;
      return COLOR_GRAY;
    }
    case "volatility": {
      const v = route.volatilityScore ?? 0;
      const rate = route.availabilityRate ?? 0;
      if (v < 20 && rate >= 0.4) return COLOR_GREEN;
      if (v < 30) return COLOR_AMBER;
      return COLOR_ROSE;
    }
  }
}

// ── Airport colour by mode ────────────────────────────────────────────────────
export function getAirportColor(airport: RadarStyledAirport, mode: RadarMode): string {
  switch (mode) {
    case "availability": {
      const r = airport.avgAvailabilityRate;
      if (r == null) return COLOR_GRAY;
      if (r >= 0.5) return COLOR_GREEN;
      if (r >= 0.25) return COLOR_AMBER;
      return COLOR_ROSE;
    }
    case "seats": {
      const s = airport.avgSeats;
      if (s == null) return COLOR_GRAY;
      if (s >= 8) return COLOR_GREEN;
      if (s >= 4) return COLOR_CYAN;
      if (s >= 1) return COLOR_AMBER;
      return COLOR_ROSE;
    }
    case "savings": {
      const sv = airport.avgSavings;
      if (sv == null) return COLOR_GRAY;
      if (sv >= 100) return COLOR_GREEN;
      if (sv >= 50) return COLOR_CYAN;
      if (sv >= 10) return COLOR_AMBER;
      return COLOR_GRAY;
    }
    case "freshness": {
      const f = airport.freshnessStatus;
      if (f === "fresh") return COLOR_GREEN;
      if (f === "recent") return COLOR_CYAN;
      if (f === "aging") return COLOR_AMBER;
      if (f === "stale") return COLOR_ROSE;
      return COLOR_GRAY;
    }
    case "searchDemand": {
      const v = airport.searchVolume;
      if (v >= 100) return COLOR_GREEN;
      if (v >= 30) return COLOR_CYAN;
      if (v >= 5) return COLOR_AMBER;
      return COLOR_GRAY;
    }
    case "volatility": {
      const str = airport.opportunityStrength;
      if (str === "strong") return COLOR_GREEN;
      if (str === "good") return COLOR_CYAN;
      if (str === "weak") return COLOR_AMBER;
      if (str === "poor") return COLOR_ROSE;
      return COLOR_GRAY;
    }
  }
}

// ── Route line weight / opacity / dash ────────────────────────────────────────
export function getRouteWeight(route: RadarStyledRoute, isHighlighted: boolean): number {
  const normalWeight = 1.5 + Math.min(route.snapshotCount / 20, 1) * 1.5;
  return isHighlighted ? 3.5 : normalWeight;
}

export function getRouteOpacity(route: RadarStyledRoute, isHighlighted: boolean): number {
  return route.isStale ? 0.25 : isHighlighted ? 1 : 0.5;
}

export function getRouteDashArray(route: RadarStyledRoute): string | undefined {
  return route.isStale ? "5 6" : undefined;
}

// ── Airport radius ────────────────────────────────────────────────────────────
function airportMetricValue(a: RadarStyledAirport): number {
  return a.routeCount + a.searchVolume / 2;
}

/** Maximum metric value across the visible airports (>= 1). */
export function getMaxAirportMetric(airports: RadarStyledAirport[]): number {
  return Math.max(...airports.map(airportMetricValue), 1);
}

export function getAirportRadius(a: RadarStyledAirport, maxMetric: number): number {
  const normalized = Math.log(airportMetricValue(a) + 1) / Math.log(maxMetric + 1);
  return 5 + normalized * 14;
}
