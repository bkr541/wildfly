import { CircleMarker, Tooltip } from "react-leaflet";
import { getAirportColor, getAirportRadius, getMaxAirportMetric } from "./radarMapMetrics";
import { SELECTED_RING_COLOR, TOOLTIP_FONT } from "./radarMapStyles";
import type { RadarMode, RadarStyledAirport } from "./radarMapTypes";

export default function RadarAirportLayer({
  airports,
  mode,
  selectedAirport,
  onSelectAirport,
}: {
  airports: RadarStyledAirport[];
  mode: RadarMode;
  selectedAirport: string | null;
  onSelectAirport: (iata: string) => void;
}) {
  const maxMetric = getMaxAirportMetric(airports);

  return (
    <>
      {airports.map((airport) => {
        const isSelected = selectedAirport === airport.iata;
        const radius = getAirportRadius(airport, maxMetric);
        const color = getAirportColor(airport, mode);
        return (
          <CircleMarker
            key={airport.iata}
            center={[airport.lat, airport.lng]}
            radius={isSelected ? radius + 3 : radius}
            pathOptions={{
              color: isSelected ? SELECTED_RING_COLOR : "rgba(255,255,255,0.6)",
              fillColor: color,
              fillOpacity: 0.9,
              weight: isSelected ? 2.5 : 1,
            }}
            eventHandlers={{ click: () => onSelectAirport(airport.iata) }}
          >
            <Tooltip permanent={isSelected} direction="top" offset={[0, -(radius + 2)]}>
              <div style={{ fontFamily: TOOLTIP_FONT }}>
                <div style={{ fontWeight: 800, fontSize: 12 }}>{airport.iata}</div>
                {isSelected && (
                  <>
                    {airport.city && (
                      <div style={{ fontSize: 11, color: "#6B7B7B" }}>{airport.city}</div>
                    )}
                    {airport.avgAvailabilityRate != null && (
                      <div style={{ fontSize: 11, fontWeight: 700, color }}>
                        {Math.round(airport.avgAvailabilityRate * 100)}% GoWild
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                      {airport.routeCount} routes · {airport.searchVolume} searches
                    </div>
                  </>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
