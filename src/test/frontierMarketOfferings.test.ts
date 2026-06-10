import { describe, it, expect } from "vitest";
import {
  activeFrontierStationCodes,
  frontierRouteMap,
  getDestinationCodesForOrigin,
  isFrontierRouteOffered,
  filterAirportsToCodes,
} from "@/lib/frontierMarketOfferings";

// ── activeFrontierStationCodes ────────────────────────────────────────────────

describe("activeFrontierStationCodes", () => {
  it("is a non-empty Set", () => {
    expect(activeFrontierStationCodes.size).toBeGreaterThan(0);
  });

  it("every code is a 3-character uppercase string", () => {
    for (const code of activeFrontierStationCodes) {
      expect(code).toBe(code.toUpperCase());
      expect(code.length).toBe(3);
    }
  });

  it("contains ATL", () => {
    expect(activeFrontierStationCodes.has("ATL")).toBe(true);
  });
});

// ── frontierRouteMap ──────────────────────────────────────────────────────────

describe("frontierRouteMap", () => {
  it("ATL has destinations", () => {
    expect(Array.isArray(frontierRouteMap["ATL"])).toBe(true);
    expect(frontierRouteMap["ATL"].length).toBeGreaterThan(0);
  });

  it("all destination arrays are sorted alphabetically", () => {
    for (const [origin, dests] of Object.entries(frontierRouteMap)) {
      expect(dests).toEqual([...dests].sort(), `${origin} destinations not sorted`);
    }
  });

  it("no duplicate destinations within an origin", () => {
    for (const [origin, dests] of Object.entries(frontierRouteMap)) {
      expect(new Set(dests).size).toBe(dests.length, `${origin} has duplicate destinations`);
    }
  });

  it("all codes are uppercase 3-char strings", () => {
    for (const dests of Object.values(frontierRouteMap)) {
      for (const d of dests) {
        expect(d).toBe(d.toUpperCase());
        expect(d.length).toBe(3);
      }
    }
  });
});

// ── getDestinationCodesForOrigin ──────────────────────────────────────────────

describe("getDestinationCodesForOrigin", () => {
  it("returns non-empty sorted array for ATL", () => {
    const dests = getDestinationCodesForOrigin("ATL");
    expect(dests.length).toBeGreaterThan(0);
    expect(dests).toEqual([...dests].sort());
  });

  it("is case-insensitive", () => {
    expect(getDestinationCodesForOrigin("atl")).toEqual(
      getDestinationCodesForOrigin("ATL"),
    );
  });

  it("returns [] for null", () => {
    expect(getDestinationCodesForOrigin(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(getDestinationCodesForOrigin(undefined)).toEqual([]);
  });

  it("returns [] for empty string", () => {
    expect(getDestinationCodesForOrigin("")).toEqual([]);
  });

  it("returns [] for unknown origin", () => {
    expect(getDestinationCodesForOrigin("ZZZ")).toEqual([]);
  });

  it("trims whitespace from input", () => {
    expect(getDestinationCodesForOrigin(" ATL ")).toEqual(
      getDestinationCodesForOrigin("ATL"),
    );
  });
});

// ── isFrontierRouteOffered ────────────────────────────────────────────────────

describe("isFrontierRouteOffered", () => {
  it("returns true for a known ATL destination", () => {
    const [firstDest] = getDestinationCodesForOrigin("ATL");
    expect(firstDest).toBeDefined();
    expect(isFrontierRouteOffered("ATL", firstDest)).toBe(true);
  });

  it("returns false for an unknown destination", () => {
    expect(isFrontierRouteOffered("ATL", "ZZZ")).toBe(false);
  });

  it("returns false for an unknown origin", () => {
    expect(isFrontierRouteOffered("ZZZ", "ATL")).toBe(false);
  });

  it("is case-insensitive", () => {
    const [firstDest] = getDestinationCodesForOrigin("ATL");
    expect(isFrontierRouteOffered("atl", firstDest.toLowerCase())).toBe(true);
  });
});

// ── filterAirportsToCodes ─────────────────────────────────────────────────────

describe("filterAirportsToCodes", () => {
  const airports = [
    { id: 1, iata_code: "ATL", name: "Atlanta" },
    { id: 2, iata_code: "MCO", name: "Orlando" },
    { id: 3, iata_code: "DEN", name: "Denver" },
    { id: 4, iata_code: "LAS", name: "Las Vegas" },
  ];

  it("keeps only airports in the code set", () => {
    const result = filterAirportsToCodes(airports, ["ATL", "DEN"]);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.iata_code)).toContain("ATL");
    expect(result.map((a) => a.iata_code)).toContain("DEN");
    expect(result.map((a) => a.iata_code)).not.toContain("MCO");
  });

  it("handles lowercase codes in the filter set", () => {
    const result = filterAirportsToCodes(airports, ["atl", "las"]);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when codes is empty", () => {
    expect(filterAirportsToCodes(airports, [])).toEqual([]);
  });

  it("returns empty array when airports is empty", () => {
    expect(filterAirportsToCodes([], ["ATL"])).toEqual([]);
  });

  it("accepts a Set", () => {
    const result = filterAirportsToCodes(airports, new Set(["MCO", "LAS"]));
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.iata_code)).toContain("MCO");
    expect(result.map((a) => a.iata_code)).toContain("LAS");
  });

  it("preserves airport object shape", () => {
    const result = filterAirportsToCodes(airports, ["ATL"]);
    expect(result[0]).toEqual({ id: 1, iata_code: "ATL", name: "Atlanta" });
  });
});
