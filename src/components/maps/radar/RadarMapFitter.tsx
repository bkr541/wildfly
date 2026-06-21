import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { RadarStyledAirport } from "./radarMapTypes";

/**
 * Fits the map to the supplied airports' bounds, with the same padding/animation
 * used by GoWildRadarMap. Re-runs whenever the airport count or `fitKey` changes.
 * If `invalidateKey` changes it also calls map.invalidateSize() before fitting,
 * which is needed when the map is mounted inside a sheet that animates open.
 */
export default function RadarMapFitter({
  airports,
  fitKey,
  invalidateKey,
}: {
  airports: RadarStyledAirport[];
  fitKey?: string | number;
  invalidateKey?: string | number;
}) {
  const map = useMap();
  const count = airports.length;

  // Invalidate size when the container may have resized (e.g. sheet opened).
  useEffect(() => {
    if (invalidateKey === undefined) return;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidateKey]);

  useEffect(() => {
    if (count === 0) return;
    if (count === 1) {
      map.setView([airports[0].lat, airports[0].lng], 8, { animate: true });
      return;
    }
    const lats = airports.map((a) => a.lat);
    const lngs = airports.map((a) => a.lng);
    map.fitBounds(
      [
        [Math.min(...lats) - 2, Math.min(...lngs) - 3],
        [Math.max(...lats) + 2, Math.max(...lngs) + 3],
      ],
      { animate: true, duration: 0.7 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, fitKey]);

  return null;
}
