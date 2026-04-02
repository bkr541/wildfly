import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  depLatLng: [number, number];
  arrLatLng: [number, number];
  /** Called once after fitBounds with the airport pixel positions inside the container. */
  onProjected?: (dep: { x: number; y: number }, arr: { x: number; y: number }) => void;
}

function FitAndProject({ depLatLng, arrLatLng, onProjected }: Props) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([depLatLng, arrLatLng]);
    map.fitBounds(bounds, { padding: [55, 55], animate: false });

    // Disable all interactions.
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.keyboard.disable();

    // After fitBounds (synchronous with animate:false), project the two airports
    // back to container-relative pixel coordinates so the parent can draw the
    // SVG route overlay perfectly aligned with the map tiles.
    requestAnimationFrame(() => {
      const dep = map.latLngToContainerPoint(L.latLng(depLatLng));
      const arr = map.latLngToContainerPoint(L.latLng(arrLatLng));
      onProjected?.({ x: dep.x, y: dep.y }, { x: arr.x, y: arr.y });
    });
  }, [map, depLatLng, arrLatLng, onProjected]);
  return null;
}

export default function StaticRouteMapBase({ depLatLng, arrLatLng, onProjected }: Props) {
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
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      keyboard={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <FitAndProject depLatLng={depLatLng} arrLatLng={arrLatLng} onProjected={onProjected} />
    </MapContainer>
  );
}
