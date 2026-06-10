import { describe, it, expect } from "vitest";
import { buildRouteMap } from "@/lib/buildRouteMap";

describe("buildRouteMap", () => {
  it("produces Record<string, string[]> shape", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "ATL", toStations: ["MCO", "DEN"] },
    ]);
    expect(typeof routeMap).toBe("object");
    expect(Array.isArray(routeMap["ATL"])).toBe(true);
    for (const dests of Object.values(routeMap)) {
      expect(Array.isArray(dests)).toBe(true);
      for (const d of dests) {
        expect(typeof d).toBe("string");
      }
    }
  });

  it("deduplicates destinations", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "ATL", toStations: ["MCO", "MCO", "DEN", "MCO"] },
    ]);
    expect(routeMap["ATL"]).toEqual(["DEN", "MCO"]);
  });

  it("deduplicates case-insensitively", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "ATL", toStations: ["mco", "MCO", "DEN"] },
    ]);
    expect(routeMap["ATL"]).toEqual(["DEN", "MCO"]);
  });

  it("sorts origins alphabetically", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "MCO", toStations: ["ATL"] },
      { fromStation: "ATL", toStations: ["MCO"] },
      { fromStation: "DEN", toStations: ["LAS"] },
    ]);
    expect(Object.keys(routeMap)).toEqual(["ATL", "DEN", "MCO"]);
  });

  it("sorts each destination array alphabetically", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "ATL", toStations: ["PHX", "DEN", "MCO", "BOS"] },
    ]);
    expect(routeMap["ATL"]).toEqual(["BOS", "DEN", "MCO", "PHX"]);
  });

  it("normalizes IATA codes to uppercase", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "atl", toStations: ["mco", "DEN"] },
    ]);
    expect(routeMap["ATL"]).toBeDefined();
    expect(routeMap["atl"]).toBeUndefined();
    expect(routeMap["ATL"]).toContain("MCO");
    expect(routeMap["ATL"]).toContain("DEN");
  });

  it("skips malformed entries and counts them", () => {
    const skippedEntries: unknown[] = [];
    const { routeMap, skipped } = buildRouteMap(
      [
        { fromStation: "ATL", toStations: ["MCO"] },
        { fromStation: 123, toStations: ["MCO"] },
        null,
        { fromStation: "DEN" },
        { fromStation: "", toStations: ["MCO"] },
      ],
      (e) => skippedEntries.push(e),
    );
    expect(skipped).toBe(4);
    expect(skippedEntries).toHaveLength(4);
    expect(Object.keys(routeMap)).toEqual(["ATL"]);
  });

  it("ignores non-string destinations within a valid entry", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "ATL", toStations: ["MCO", null, 123, "", "DEN"] },
    ]);
    expect(routeMap["ATL"]).toEqual(["DEN", "MCO"]);
  });

  it("merges routes from multiple entries with the same origin", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "ATL", toStations: ["MCO"] },
      { fromStation: "ATL", toStations: ["DEN", "MCO"] },
    ]);
    expect(routeMap["ATL"]).toEqual(["DEN", "MCO"]);
  });

  it("origins with empty toStations produce an empty array", () => {
    const { routeMap } = buildRouteMap([
      { fromStation: "PLS", toStations: [] },
    ]);
    expect(routeMap["PLS"]).toEqual([]);
  });

  it("returns skipped=0 and empty map for empty input", () => {
    const { routeMap, skipped } = buildRouteMap([]);
    expect(skipped).toBe(0);
    expect(routeMap).toEqual({});
  });
});
