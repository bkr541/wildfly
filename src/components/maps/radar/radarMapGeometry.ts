// Quadratic-bezier arc between two coordinates, used for all radar route polylines.
export function arcPoints(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  steps = 24,
): [number, number][] {
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  const dist = Math.sqrt(dlat * dlat + dlng * dlng);
  if (dist < 0.001) return [[lat1, lng1], [lat2, lng2]];
  const lift = dist * 0.18;
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const cpLat = midLat - (dlng / dist) * lift;
  const cpLng = midLng + (dlat / dist) * lift;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const mt = 1 - t;
    return [
      mt * mt * lat1 + 2 * mt * t * cpLat + t * t * lat2,
      mt * mt * lng1 + 2 * mt * t * cpLng + t * t * lng2,
    ] as [number, number];
  });
}
