import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MultiDestMapProps {
  depIata: string;
  depLatLng: [number, number];
  destinations: { iata: string; latLng: [number, number] }[];
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [map, positions]);
  return null;
}

function createOriginIcon(iata: string) {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="background:linear-gradient(135deg,#059669,#10B981);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2.5px solid white;">
          <span style="font-size:16px;line-height:1">🏠</span>
        </div>
        <div style="background:rgba(6,78,59,0.92);color:white;font-size:10px;font-weight:800;padding:2px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${iata}</div>
      </div>`,
    className: "",
    iconAnchor: [16, 34],
  });
}

function createDestIcon(iata: string) {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="background:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.30);border:2px solid #10B981;">
          <span style="font-size:13px;line-height:1">✈️</span>
        </div>
        <div style="background:rgba(16,185,129,0.92);color:white;font-size:9px;font-weight:700;padding:1.5px 4px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.25)">${iata}</div>
      </div>`,
    className: "",
    iconAnchor: [13, 28],
  });
}

export default function MultiDestMap({ depIata, depLatLng, destinations }: MultiDestMapProps) {
  const allPositions: [number, number][] = [depLatLng, ...destinations.map((d) => d.latLng)];

  return (
    <MapContainer
      style={{ height: "100%", width: "100%" }}
      center={depLatLng}
      zoom={4}
      zoomControl={false}
      scrollWheelZoom={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <FitBounds positions={allPositions} />

      {/* Route lines from departure to each destination */}
      {destinations.map((dest) => (
        <Polyline
          key={dest.iata}
          positions={[depLatLng, dest.latLng]}
          pathOptions={{ color: "#10B981", weight: 2, dashArray: "5 5", opacity: 0.75 }}
        />
      ))}

      {/* Destination markers */}
      {destinations.map((dest) => (
        <Marker key={dest.iata} position={dest.latLng} icon={createDestIcon(dest.iata)} />
      ))}

      {/* Origin marker (rendered last so it's on top) */}
      <Marker position={depLatLng} icon={createOriginIcon(depIata)} />
    </MapContainer>
  );
}
