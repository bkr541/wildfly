import { useId } from "react";

interface FlightRouteMapProps {
  depLat: number;
  depLng: number;
  arrLat: number;
  arrLng: number;
  width?: number;
  height?: number;
  lineColor?: string;
  dashPattern?: string;
  markerRadius?: number;
  /** 0–1: how high the arc lifts relative to the chord length. Default 0.38. */
  curveLift?: number;
}

/**
 * Projects lat/lng into SVG x/y using a bounding-box-relative equirectangular
 * projection. Instead of mapping to the whole world (which makes domestic
 * routes appear as a tiny cluster), we map to a padded region around the two
 * airports so they always span the canvas meaningfully.
 *
 * Formula (standard equirectangular, scoped to [minLng..maxLng, minLat..maxLat]):
 *   x = ((lng - minLng) / (maxLng - minLng)) * width
 *   y = ((maxLat - lat)  / (maxLat - minLat)) * height   ← y is flipped: north = top
 */
function makeProjection(
  depLat: number, depLng: number,
  arrLat: number, arrLng: number,
  width: number, height: number,
) {
  // TODO: date-line crossing (|depLng - arrLng| > 180) is not handled; for
  // trans-date-line routes the bounding box will span most of the globe.
  const crossesDateLine = Math.abs(arrLng - depLng) > 180;

  const lngSpan = Math.abs(arrLng - depLng);
  const latSpan = Math.abs(arrLat - depLat);

  // Pad so airports aren't flush against the SVG edge. Minimum 5° each axis
  // prevents extreme zoom-in on very short routes.
  const lngPad = Math.max(lngSpan * 0.55, 5);
  const latPad = Math.max(latSpan * 0.55, 5);

  const minLng = Math.min(depLng, arrLng) - lngPad;
  const maxLng = Math.max(depLng, arrLng) + lngPad;
  const minLat = Math.min(depLat, arrLat) - latPad;
  const maxLat = Math.max(depLat, arrLat) + latPad;

  const project = (lat: number, lng: number) => ({
    x: ((lng - minLng) / (maxLng - minLng)) * width,
    y: ((maxLat - lat) / (maxLat - minLat)) * height,
  });

  return { project, crossesDateLine };
}

export default function FlightRouteMap({
  depLat,
  depLng,
  arrLat,
  arrLng,
  width = 360,
  height = 220,
  lineColor = "rgba(255,255,255,0.95)",
  dashPattern = "7 5",
  markerRadius = 4.5,
  curveLift = 0.38,
}: FlightRouteMapProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = `dots-${uid}`;

  const { project, crossesDateLine } = makeProjection(
    depLat, depLng, arrLat, arrLng, width, height,
  );

  const dep = project(depLat, depLng);
  const arr = project(arrLat, arrLng);

  // Quadratic Bézier control point — midpoint lifted upward (negative y = north in SVG).
  const mx = (dep.x + arr.x) / 2;
  const my = (dep.y + arr.y) / 2;
  const dist = Math.hypot(arr.x - dep.x, arr.y - dep.y);
  // Cap lift to 45% of canvas height so the arc never exits the top.
  const lift = Math.min(dist * curveLift, height * 0.45);

  const routePath = crossesDateLine
    ? `M ${dep.x} ${dep.y} L ${arr.x} ${arr.y}`           // straight-line fallback
    : `M ${dep.x} ${dep.y} Q ${mx} ${my - lift} ${arr.x} ${arr.y}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <defs>
        {/*
          Subtle dot grid. Replace the <rect> below with simplified continent
          SVG path data (e.g. Natural Earth) to get real world-map outlines.
        */}
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.8" fill="rgba(255,255,255,0.12)" />
        </pattern>
      </defs>

      {/* Background texture — toned down so route is the hero */}
      <rect width={width} height={height} fill={`url(#${patternId})`} />

      {/* Glow pass: blurred duplicate of the route for a soft halo */}
      <path
        d={routePath}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="6"
        strokeLinecap="round"
        style={{ filter: "blur(3px)" }}
      />

      {/* Dashed Bézier route — the hero element */}
      <path
        d={routePath}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeDasharray={dashPattern}
        strokeLinecap="round"
      />

      {/* Departure marker: outer glow ring + solid dot */}
      <circle cx={dep.x} cy={dep.y} r={markerRadius + 5} fill="rgba(255,255,255,0.18)" />
      <circle cx={dep.x} cy={dep.y} r={markerRadius} fill="white" />

      {/* Arrival marker */}
      <circle cx={arr.x} cy={arr.y} r={markerRadius + 5} fill="rgba(255,255,255,0.18)" />
      <circle cx={arr.x} cy={arr.y} r={markerRadius} fill="white" />
    </svg>
  );
}
