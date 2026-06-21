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
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="font-size:9px;font-weight:800;color:white;background:#059669;border-radius:3px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.25);letter-spacing:0.05em;">${iata}</div>
        <div style="width:14px;height:14px;background:#345C5A;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      </div>`,
    className: "",
    iconSize: [40, 34],
    iconAnchor: [20, 34],
  });
}

function createDestIcon(iata: string) {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="font-size:9px;font-weight:800;color:white;background:#345C5A;border-radius:3px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.25);letter-spacing:0.05em;">${iata}</div>
        <div style="width:8px;height:8px;background:#345C5A;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
      </div>`,
    className: "",
    iconSize: [32, 30],
    iconAnchor: [16, 30],
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
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <FitBounds positions={allPositions} />

      {/* Route lines from departure to each destination */}
      {destinations.map((dest) => (
        <Polyline
          key={dest.iata}
          positions={[depLatLng, dest.latLng]}
          pathOptions={{ color: "#10B981", weight: 2, opacity: 0.55 }}
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
