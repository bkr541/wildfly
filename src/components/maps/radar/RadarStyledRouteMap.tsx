import { MapContainer, TileLayer } from "react-leaflet";
import { TILE_URL, TILE_ATTR } from "./radarMapStyles";
import RadarMapFitter from "./RadarMapFitter";
import RadarRouteLayer from "./RadarRouteLayer";
import RadarAirportLayer from "./RadarAirportLayer";
import RadarMapLegend from "./RadarMapLegend";
import type { RadarMode, RadarStyledRoute, RadarStyledAirport } from "./radarMapTypes";

export interface RadarStyledRouteMapProps {
  routes: RadarStyledRoute[];
  airports: RadarStyledAirport[];
  mode?: RadarMode;
  selectedRoute: string | null;
  selectedAirport: string | null;
  onSelectRoute: (routeKey: string) => void;
  onSelectAirport: (iata: string) => void;
  /** Initial center before bounds fitting. */
  center?: [number, number];
  zoom?: number;
  /** When provided, the map fits its bounds to the airports. */
  fitBounds?: boolean;
  /** Changing this re-runs the bounds fit (e.g. when filters change). */
  fitKey?: string | number;
  /** Changing this calls map.invalidateSize() (e.g. when a sheet opens). */
  invalidateKey?: string | number;
  showLegend?: boolean;
  legendPosition?: "bottom-left" | "bottom-right";
  /** CSS height for the map container (default 100%). */
  height?: string | number;
  className?: string;
}

/**
 * Shared, declarative React-Leaflet map that renders curved availability-styled
 * routes + airport nodes exactly like GoWildRadarMap's map, without any of the
 * Radar admin chrome (mode selector, KPI strip, panels).
 */
export default function RadarStyledRouteMap({
  routes,
  airports,
  mode = "availability",
  selectedRoute,
  selectedAirport,
  onSelectRoute,
  onSelectAirport,
  center = [39.5, -98.35],
  zoom = 4,
  fitBounds = false,
  fitKey,
  invalidateKey,
  showLegend = true,
  legendPosition = "bottom-left",
  height = "100%",
  className,
}: RadarStyledRouteMapProps) {
  return (
    <div className={`relative ${className ?? ""}`} style={{ height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        {(fitBounds || invalidateKey !== undefined) && (
          <RadarMapFitter
            airports={fitBounds ? airports : []}
            fitKey={fitKey}
            invalidateKey={invalidateKey}
          />
        )}
        <RadarRouteLayer
          routes={routes}
          mode={mode}
          selectedRoute={selectedRoute}
          selectedAirport={selectedAirport}
          onSelectRoute={onSelectRoute}
        />
        <RadarAirportLayer
          airports={airports}
          mode={mode}
          selectedAirport={selectedAirport}
          onSelectAirport={onSelectAirport}
        />
      </MapContainer>
      {showLegend && <RadarMapLegend position={legendPosition} />}
    </div>
  );
}
