import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_URL, TILE_ATTR, TOOLTIP_FONT, COLOR_GREEN, COLOR_AMBER, COLOR_GRAY } from "@/components/maps/radar/radarMapStyles";
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

  // Invalidate size when the container may have resized (e.g. sheet opened).
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

// GoWild + Nonstop gets a lighter green to distinguish from GoWild-only
const COLOR_GOWILD_NONSTOP = "#34D399";

function destColor(dest: MultiDestMapDestination): string {
  if (dest.hasGoWild && dest.hasNonstop) return COLOR_GOWILD_NONSTOP;
  if (dest.hasGoWild) return COLOR_GREEN;
  if (dest.hasNonstop) return COLOR_AMBER;
  return COLOR_GRAY;
}

function AvailabilityLegend() {
  const items = [
    { color: COLOR_GOWILD_NONSTOP, label: "GoWild + Nonstop" },
    { color: COLOR_GREEN,          label: "GoWild" },
    { color: COLOR_AMBER,          label: "Nonstop" },
    { color: COLOR_GRAY,           label: "Connecting" },
  ] as const;
  return (
    <div
      className="absolute bottom-3 left-3 z-[1000] rounded-lg px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        fontSize: 10,
      }}
    >
      <div className="font-bold uppercase tracking-wider text-[#9CA3AF] mb-1" style={{ fontSize: 9 }}>
        Availability
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="rounded-full" style={{ width: 8, height: 8, background: color }} />
            <span className="font-semibold text-[#6B7B7B]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsRow({ destinations }: { destinations: MultiDestMapDestination[] }) {
  const totalFlights = destinations.reduce((sum, d) => sum + d.flightCount, 0);
  const nonstopCount = destinations.filter((d) => d.hasNonstop).length;
  const goWildCount  = destinations.filter((d) => d.hasGoWild).length;

  const stats = [
    { label: "Destinations", value: destinations.length },
    { label: "Total Flights", value: totalFlights },
    { label: "Nonstop",       value: nonstopCount },
    { label: "GoWild",        value: goWildCount },
  ];

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 rounded-xl px-4 py-2"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        fontFamily: TOOLTIP_FONT,
      }}
    >
      {stats.map(({ label, value }, i) => (
        <div key={label} className="flex items-center gap-3">
          {i > 0 && <span style={{ width: 1, height: 20, background: "#E5E7EB", flexShrink: 0 }} />}
          <div className="flex flex-col items-center" style={{ minWidth: 36 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#1A2E2E", lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2, whiteSpace: "nowrap" }}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MultiDestMap({ depIata, depLatLng, destinations, invalidateKey, onViewDest }: MultiDestMapProps) {
  const allPositions: [number, number][] = [depLatLng, ...destinations.map((d) => d.latLng)];

  return (
    <div className="relative" style={{ height: "100%", width: "100%" }}>
      <StatsRow destinations={destinations} />
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
          const color = destColor(dest);
          return (
            <Polyline
              key={dest.iata}
              positions={pts}
              pathOptions={{ color, weight: 1.8, opacity: 0.55 }}
            />
          );
        })}

        {/* Destination markers — dot + badge label + hover tooltip */}
        {destinations.map((dest) => {
          const color = destColor(dest);
          const label = dest.minFare != null
            ? `${dest.iata} · $${Math.round(dest.minFare)}`
            : dest.iata;
          // Light backgrounds (light-green, amber) need dark text for contrast
          const badgeText = (color === COLOR_GOWILD_NONSTOP || color === COLOR_AMBER) ? "#1A2E2E" : "white";
          const badgeIcon = L.divIcon({
            html: `<span style="
              display:inline-block;
              transform:translateX(-50%);
              background:${color};
              color:${badgeText};
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
                fillColor: color,
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
      <AvailabilityLegend />
    </div>
  );
}
