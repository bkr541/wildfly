import { Polyline, Tooltip } from "react-leaflet";
import { arcPoints } from "./radarMapGeometry";
import {
  getRouteColor,
  getRouteWeight,
  getRouteOpacity,
  getRouteDashArray,
} from "./radarMapMetrics";
import { TOOLTIP_FONT } from "./radarMapStyles";
import type { RadarMode, RadarStyledRoute } from "./radarMapTypes";

function RouteTooltip({ route }: { route: RadarStyledRoute }) {
  const cs = route.currentSearch;
  const hasHistory = route.snapshotCount > 0;
  return (
    <Tooltip sticky>
      <div style={{ fontFamily: TOOLTIP_FONT, minWidth: 150 }}>
        <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 3 }}>
          {route.origin} → {route.destination}
        </div>

        {/* Current search data (differentiated from history) */}
        {cs && (
          <>
            {typeof cs.flightCount === "number" && (
              <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                Now: {cs.flightCount} flight{cs.flightCount === 1 ? "" : "s"}
                {cs.hasNonstop ? " · nonstop" : ""}
              </div>
            )}
            {cs.minFare != null && (
              <div style={{ fontSize: 11, color: "#6B7B7B" }}>From ${Math.round(cs.minFare)}</div>
            )}
            {cs.hasGoWild && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>GoWild available now</div>
            )}
          </>
        )}

        {/* Historical metrics */}
        {hasHistory ? (
          <>
            {cs && <div style={{ height: 4 }} />}
            {route.availabilityRate != null && (
              <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                Historical GoWild: {Math.round(route.availabilityRate * 100)}%
              </div>
            )}
            {route.avgGoWildSeats != null && (
              <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                Avg seats: {route.avgGoWildSeats.toFixed(1)}
              </div>
            )}
            {route.avgSavings != null && (
              <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                Avg savings: ${Math.round(route.avgSavings)}
              </div>
            )}
            {route.avgGoWildFare != null && (
              <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                GoWild fare: ${Math.round(route.avgGoWildFare)}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>No historical data</div>
        )}

        {route.isStale && hasHistory && (
          <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>⚠ Stale data</div>
        )}
      </div>
    </Tooltip>
  );
}

export default function RadarRouteLayer({
  routes,
  mode,
  selectedRoute,
  selectedAirport,
  onSelectRoute,
}: {
  routes: RadarStyledRoute[];
  mode: RadarMode;
  selectedRoute: string | null;
  selectedAirport: string | null;
  onSelectRoute: (routeKey: string) => void;
}) {
  return (
    <>
      {routes.map((route) => {
        const pts = arcPoints(
          route.originLat,
          route.originLng,
          route.destinationLat,
          route.destinationLng,
        );
        const isHighlighted =
          selectedRoute === route.routeKey ||
          (selectedAirport != null &&
            (route.origin === selectedAirport || route.destination === selectedAirport));
        const color = getRouteColor(route, mode);
        const weight = getRouteWeight(route, isHighlighted);
        const opacity = getRouteOpacity(route, isHighlighted);
        const dashArray = getRouteDashArray(route);

        return (
          <Polyline
            key={route.routeKey}
            positions={pts}
            pathOptions={{ color, weight, opacity, dashArray }}
            eventHandlers={{ click: () => onSelectRoute(route.routeKey) }}
          >
            <RouteTooltip route={route} />
          </Polyline>
        );
      })}
    </>
  );
}
