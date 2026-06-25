import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_ATTR, TOOLTIP_FONT, COLOR_GREEN } from "@/components/maps/radar/radarMapStyles";
import { arcPoints } from "@/components/maps/radar/radarMapGeometry";

export interface MultiDestMapDestination {
  iata: string;
  latLng: [number, number];
  city: string;
  stateCode?: string;
  country?: string;
  hasGoWild: boolean;
  hasNonstop: boolean;
  flightCount: number;
  minFare: number | null;
}

interface MultiDestMapProps {
  depIata: string;
  depLatLng: [number, number];
  destinations: MultiDestMapDestination[];
  /** Changing this value calls map.invalidateSize() (e.g. when a bottom sheet opens). */
  invalidateKey?: string | number;
  /** Called when the user clicks "View Flights" for a destination. */
  onViewDest?: (iata: string) => void;
}

function FitAndInvalidate({
  positions,
  invalidateKey,
}: {
  positions: [number, number][];
  invalidateKey?: string | number;
}) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (invalidateKey === undefined) return;
    const t = setTimeout(() => {
      map.invalidateSize();
      if (positions.length > 0 && !fittedRef.current) {
        fitToPositions();
      }
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidateKey]);

  function fitToPositions() {
    if (positions.length === 0) return;
    const lats = positions.map((p) => p[0]);
    const lngs = positions.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lats) - 2, Math.min(...lngs) - 3],
        [Math.max(...lats) + 2, Math.max(...lngs) + 3],
      ],
      { animate: true, duration: 0.7 },
    );
    fittedRef.current = true;
  }

  useEffect(() => {
    if (positions.length === 0) return;
    fitToPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length]);

  return null;
}

export default function MultiDestMap({ depIata, depLatLng, destinations, invalidateKey, onViewDest }: MultiDestMapProps) {
  const allPositions: [number, number][] = [depLatLng, ...destinations.map((d) => d.latLng)];

  return (
    <div className="relative" style={{ height: "100%", width: "100%" }}>
      <MapContainer
        style={{ height: "100%", width: "100%" }}
        center={depLatLng}
        zoom={4}
        zoomControl={false}
        scrollWheelZoom={true}
        attributionControl={true}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <FitAndInvalidate positions={allPositions} invalidateKey={invalidateKey} />

        {/* Route arcs from departure to each destination */}
        {destinations.map((dest) => {
          const pts = arcPoints(depLatLng[0], depLatLng[1], dest.latLng[0], dest.latLng[1]);
          return (
            <Polyline
              key={dest.iata}
              positions={pts}
              pathOptions={{ color: COLOR_GREEN, weight: 1.8, opacity: 0.55 }}
            />
          );
        })}

        {/* Destination markers — dot + badge label + hover tooltip */}
        {destinations.map((dest) => {
          const label = dest.minFare != null
            ? `${dest.iata} · $${Math.round(dest.minFare)}`
            : dest.iata;
          const badgeIcon = L.divIcon({
            html: `<span style="
              display:inline-block;
              transform:translateX(-50%);
              background:${COLOR_GREEN};
              color:white;
              font-family:Quicksand,sans-serif;
              font-size:9px;
              font-weight:800;
              border-radius:3px;
              padding:2px 5px;
              white-space:nowrap;
              box-shadow:0 1px 3px rgba(0,0,0,0.3);
              letter-spacing:0.04em;
              pointer-events:none;
            ">${label}</span>`,
            className: "",
            iconSize: [0, 0],
            iconAnchor: [0, 22],
          });
          return [
            <Marker key={`${dest.iata}-label`} position={dest.latLng} icon={badgeIcon} interactive={false} zIndexOffset={500} />,
            <CircleMarker
              key={dest.iata}
              center={dest.latLng}
              radius={6}
              pathOptions={{
                color: "rgba(255,255,255,0.7)",
                fillColor: COLOR_GREEN,
                fillOpacity: 0.9,
                weight: 1,
              }}
            >
              {/* Hover preview */}
              <Tooltip sticky direction="top" offset={[0, -8]}>
                <div style={{ fontFamily: TOOLTIP_FONT, minWidth: 110 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 2 }}>{depIata} → {dest.iata}</div>
                  {dest.city && (
                    <div style={{ fontSize: 11, color: "#6B7B7B" }}>{dest.city}{dest.stateCode ? `, ${dest.stateCode}` : ""}</div>
                  )}
                  <div style={{ fontSize: 11, color: "#6B7B7B" }}>
                    {dest.flightCount} flight{dest.flightCount === 1 ? "" : "s"}
                    {dest.hasNonstop ? " · nonstop" : ""}
                  </div>
                  {dest.minFare != null && (
                    <div style={{ fontSize: 11, color: "#6B7B7B" }}>From ${Math.round(dest.minFare)}</div>
                  )}
                  {dest.hasGoWild && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLOR_GREEN }}>GoWild available</div>
                  )}
                </div>
              </Tooltip>
              {/* Click popup with View Flights button */}
              {onViewDest && (
                <Popup closeButton={false} offset={[0, -6]}>
                  <div style={{ fontFamily: TOOLTIP_FONT, minWidth: 140 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3 }}>{depIata} → {dest.iata}</div>
                    {dest.city && (
                      <div style={{ fontSize: 11, color: "#6B7B7B", marginBottom: 2 }}>
                        {dest.city}{dest.stateCode ? `, ${dest.stateCode}` : ""}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#6B7B7B", marginBottom: 2 }}>
                      {dest.flightCount} flight{dest.flightCount === 1 ? "" : "s"}
                      {dest.hasNonstop ? " · nonstop" : ""}
                    </div>
                    {dest.minFare != null && (
                      <div style={{ fontSize: 11, color: "#6B7B7B", marginBottom: 2 }}>From ${Math.round(dest.minFare)}</div>
                    )}
                    {dest.hasGoWild && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLOR_GREEN, marginBottom: 6 }}>GoWild available</div>
                    )}
                    <button
                      onClick={() => onViewDest(dest.iata)}
                      style={{
                        marginTop: 6,
                        width: "100%",
                        padding: "6px 0",
                        background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                        color: "white",
                        fontFamily: TOOLTIP_FONT,
                        fontSize: 11,
                        fontWeight: 800,
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        letterSpacing: "0.03em",
                      }}
                    >
                      View Flights
                    </button>
                  </div>
                </Popup>
              )}
            </CircleMarker>,
          ];
        })}

        {/* Origin marker (rendered last so it's on top) */}
        <CircleMarker
          center={depLatLng}
          radius={9}
          pathOptions={{
            color: "white",
            fillColor: "#345C5A",
            fillOpacity: 1,
            weight: 2.5,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -11]}>
            <div style={{ fontFamily: TOOLTIP_FONT, fontWeight: 800, fontSize: 12 }}>{depIata}</div>
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
