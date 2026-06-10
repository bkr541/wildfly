export interface BuildRouteMapResult {
  routeMap: Record<string, string[]>;
  skipped: number;
}

export function buildRouteMap(
  markets: unknown[],
  onSkip?: (entry: unknown) => void,
): BuildRouteMapResult {
  const intermediate: Record<string, Set<string>> = {};
  let skipped = 0;

  for (const market of markets) {
    const m = market as Record<string, unknown> | null;
    if (
      !m ||
      typeof m.fromStation !== "string" ||
      !Array.isArray(m.toStations)
    ) {
      onSkip?.(market);
      skipped++;
      continue;
    }
    const origin = m.fromStation.trim().toUpperCase();
    if (!origin) {
      onSkip?.(market);
      skipped++;
      continue;
    }
    if (!intermediate[origin]) intermediate[origin] = new Set();
    for (const dest of m.toStations as unknown[]) {
      if (typeof dest === "string" && dest.trim()) {
        intermediate[origin].add(dest.trim().toUpperCase());
      }
    }
  }

  const routeMap: Record<string, string[]> = {};
  for (const key of Object.keys(intermediate).sort()) {
    routeMap[key] = [...intermediate[key]].sort();
  }

  return { routeMap, skipped };
}
