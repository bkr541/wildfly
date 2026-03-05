import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LeafletMapProps {
  depLatLng: [number, number];
  arrLatLng: [number, number];
  arcPoints: [number, number][];
  mid: [number, number] | undefined;
  bounds: L.LatLngBoundsExpression;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [map, bounds]);
  return null;
}

function createAirplaneIcon() {
  return L.divIcon({
    html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">✈️</div>`,
    className: "",
    iconAnchor: [11, 11],
  });
}

function createDotIcon() {
  return L.divIcon({
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#059669;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    className: "",
    iconAnchor: [6, 6],
  });
}

export default function LeafletMap({ depLatLng, arrLatLng, arcPoints, mid, bounds }: LeafletMapProps) {
  const center: [number, number] = [
    (depLatLng[0] + arrLatLng[0]) / 2,
    (depLatLng[1] + arrLatLng[1]) / 2,
  ];

  return (
    <MapContainer
      style={{ height: "100%", width: "100%" }}
      center={center}
      zoom={4}
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <FitBounds bounds={bounds} />
      <Polyline
        positions={arcPoints}
        pathOptions={{ color: "#059669", weight: 2.5, dashArray: "6 5", opacity: 0.85 }}
      />
      <Marker position={depLatLng} icon={createDotIcon()} />
      <Marker position={arrLatLng} icon={createDotIcon()} />
      {mid && <Marker position={mid} icon={createAirplaneIcon()} />}
    </MapContainer>
  );
}
