import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  depLatLng: [number, number];
  arrLatLng: [number, number];
  depIata: string;
  arrIata: string;
  depCity?: string;
  arrCity?: string;
}

function MapController({
  depLatLng,
  arrLatLng,
  onProjected,
}: {
  depLatLng: [number, number];
  arrLatLng: [number, number];
  onProjected: (dep: { x: number; y: number }, arr: { x: number; y: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([depLatLng, arrLatLng]);
    map.fitBounds(bounds, { padding: [56, 56], animate: false });
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.keyboard.disable();

    requestAnimationFrame(() => {
      const dep = map.latLngToContainerPoint(L.latLng(depLatLng));
      const arr = map.latLngToContainerPoint(L.latLng(arrLatLng));
      onProjected({ x: dep.x, y: dep.y }, { x: arr.x, y: arr.y });
    });
  }, [map, depLatLng, arrLatLng, onProjected]);

  return null;
}

export default function RouteMapCard({
  depLatLng,
  arrLatLng,
  depIata,
  arrIata,
  depCity,
  arrCity,
}: Props) {
  const [depPx, setDepPx] = useState<{ x: number; y: number } | null>(null);
  const [arrPx, setArrPx] = useState<{ x: number; y: number } | null>(null);

  const center: [number, number] = [
    (depLatLng[0] + arrLatLng[0]) / 2,
    (depLatLng[1] + arrLatLng[1]) / 2,
  ];

  const arcSvg = (() => {
    if (!depPx || !arrPx) return null;
    const mx = (depPx.x + arrPx.x) / 2;
    const my = (depPx.y + arrPx.y) / 2;
    const dist = Math.hypot(arrPx.x - depPx.x, arrPx.y - depPx.y);
    const lift = Math.min(dist * 0.32, 70);
    const path = `M ${depPx.x} ${depPx.y} Q ${mx} ${my - lift} ${arrPx.x} ${arrPx.y}`;
    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
        width="100%"
        height="100%"
      >
        {/* Glow */}
        <path d={path} fill="none" stroke="rgba(5,150,105,0.35)" strokeWidth="8" strokeLinecap="round" style={{ filter: "blur(4px)" }} />
        {/* Dashed line */}
        <path d={path} fill="none" stroke="#059669" strokeWidth="2.5" strokeDasharray="8 5" strokeLinecap="round" />
        {/* Dots at endpoints */}
        <circle cx={depPx.x} cy={depPx.y} r={9} fill="rgba(5,150,105,0.18)" />
        <circle cx={depPx.x} cy={depPx.y} r={5} fill="#059669" />
        <circle cx={arrPx.x} cy={arrPx.y} r={9} fill="rgba(5,150,105,0.18)" />
        <circle cx={arrPx.x} cy={arrPx.y} r={5} fill="#059669" />
      </svg>
    );
  })();

  const AirportLabel = ({
    px,
    iata,
    city,
    align,
  }: {
    px: { x: number; y: number };
    iata: string;
    city?: string;
    align: "left" | "right" | "center";
  }) => {
    const translateX = align === "left" ? "0%" : align === "right" ? "-100%" : "-50%";
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: px.x,
          top: px.y + 12,
          transform: `translateX(${translateX})`,
          zIndex: 3,
        }}
      >
        <div
          className="bg-white rounded-xl px-2.5 py-1.5 text-center"
          style={{
            boxShadow: "0 2px 10px rgba(5,150,105,0.20)",
            border: "1.5px solid #059669",
            minWidth: 52,
          }}
        >
          <span className="text-[15px] font-black text-[#1A2E2E] leading-none block">{iata}</span>
          {city && (
            <span className="text-[10px] font-medium text-[#6B7B7B] leading-none block mt-0.5 whitespace-nowrap">
              {city}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Determine label alignment to avoid clipping at edges
  const depAlign = depPx && depPx.x < 80 ? "left" : depPx && depPx.x > 280 ? "right" : "center";
  const arrAlign = arrPx && arrPx.x < 80 ? "left" : arrPx && arrPx.x > 280 ? "right" : "center";

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height: 260 }}>
      {/* Leaflet map at z:0 to contain its own internal z-indices */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
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
          <MapController
            depLatLng={depLatLng}
            arrLatLng={arrLatLng}
            onProjected={(dep, arr) => { setDepPx(dep); setArrPx(arr); }}
          />
        </MapContainer>
      </div>

      {/* SVG arc overlay */}
      {arcSvg}

      {/* Airport label overlays */}
      {depPx && (
        <AirportLabel px={depPx} iata={depIata} city={depCity} align={depAlign as any} />
      )}
      {arrPx && (
        <AirportLabel px={arrPx} iata={arrIata} city={arrCity} align={arrAlign as any} />
      )}
    </div>
  );
}
