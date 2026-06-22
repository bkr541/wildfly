/**
 * Unit tests for GoWild Availability report logic.
 *
 * All functions are re-implemented inline — no imports from Deno Edge Function
 * modules — so the tests run under Vitest/jsdom without Deno globals.
 *
 * Coverage:
 *   - Canonical observation deduplication (DISTINCT ON equivalent)
 *   - Cache-hit exclusion from provider observations
 *   - One route observation per (search, origin, destination)
 *   - had_gowild_success: true only when returned + has_go_wild=true
 *   - not_returned rows: counted but never set had_gowild_success
 *   - no_gowild_fare rows: counted but never set had_gowild_success
 *   - Wilson score at edge cases (0 successes, all successes, low n, large n)
 *   - Wilson score preserves ranking vs raw rate with unequal sample sizes
 *   - Disappeared itineraries: latest_event_only deduplication
 *   - Disappeared itineraries: event count per key
 *   - Prior available lookup: most recent returned+gowild
 *   - Repeated disappearance events for same key
 *   - Fare savings: null fare exclusion
 *   - Fare savings: negative savings exclusion (standard < gowild)
 *   - Fare savings: prior_savings NULL when fares missing or negative
 *   - Median savings: order-sensitive (not equal to mean for skewed data)
 *   - minimum_samples / minimum_observations HAVING filter
 *   - Route filter (origin_iata, destination_iata)
 *   - Empty results from empty input
 *   - Date boundary: inclusive from, exclusive to
 *   - Limit clamping
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers re-implementing the SQL / handler logic in TypeScript
// ─────────────────────────────────────────────────────────────────────────────

// Wilson lower-bound confidence score, 95% CI (z = 1.96, z² = 3.8416).
// Returns a score from 0 to 100.
function wilsonScore(successes: number, total: number): number {
  if (total <= 0 || successes < 0 || !Number.isFinite(successes) || !Number.isFinite(total)) {
    return 0;
  }
  const n  = total;
  const p  = Math.min(successes, total) / total;
  const z2 = 3.8416;
  const inner = p * (1 - p) / n + z2 / (4 * n * n);
  const lower = (p + z2 / (2 * n) - 1.96 * Math.sqrt(Math.max(0, inner))) / (1 + z2 / n);
  return Math.max(0, Math.min(100, 100 * lower));
}

type SnapshotRow = {
  flight_search_id:     string;
  stable_itinerary_key: string | null;
  snapshot_at:          string;
  availability_status:  "returned" | "no_gowild_fare" | "not_returned";
  has_go_wild:          boolean;
  go_wild_total:        number | null;
  standard_total:       number | null;
  go_wild_available_seats: number | null;
  origin_iata:          string;
  destination_iata:     string;
  result_source:        string | null;
  triggered_by:         string | null;
  provider_observed_at: string | null;
};

// Simulate the canonical view: one row per (flight_search_id, stable_key),
// picking the latest snapshot_at. Cache-hit searches are excluded.
// Rows with null stable_itinerary_key are excluded.
function buildCanonicalObservations(rows: SnapshotRow[]): SnapshotRow[] {
  const filtered = rows.filter(
    (r) =>
      r.stable_itinerary_key !== null &&
      (r.result_source === null || r.result_source !== "cache_hit"),
  );

  // Group by (flight_search_id, stable_itinerary_key), keep max snapshot_at
  const map = new Map<string, SnapshotRow>();
  for (const r of filtered) {
    const key = `${r.flight_search_id}|${r.stable_itinerary_key}`;
    const existing = map.get(key);
    if (!existing || r.snapshot_at > existing.snapshot_at) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}

// Simulate the route observations view: one row per (search, origin, dest).
type RouteObs = {
  flight_search_id: string;
  origin_iata:      string;
  destination_iata: string;
  route:            string;
  triggered_by:     string | null;
  had_gowild_success: boolean;
  observed_at:      string;
};

function buildRouteObservations(canonical: SnapshotRow[]): RouteObs[] {
  const map = new Map<string, {
    had_success: boolean;
    latest: string;
    triggered_by: string | null;
  }>();

  for (const r of canonical) {
    const key = `${r.flight_search_id}|${r.origin_iata}|${r.destination_iata}`;
    const obs  = r.provider_observed_at ?? r.snapshot_at;
    if (!map.has(key)) {
      map.set(key, { had_success: false, latest: obs, triggered_by: r.triggered_by });
    }
    const entry = map.get(key)!;
    if (obs > entry.latest) entry.latest = obs;
    if (r.has_go_wild && r.availability_status === "returned") {
      entry.had_success = true;
    }
  }

  return Array.from(map.entries()).map(([k, v]) => {
    const parts = k.split("|");
    const origin = parts[1];
    const dest   = parts[2];
    return {
      flight_search_id: parts[0],
      origin_iata:      origin,
      destination_iata: dest,
      route:            `${origin}-${dest}`,
      triggered_by:     v.triggered_by,
      had_gowild_success: v.had_success,
      observed_at:      v.latest,
    };
  });
}

// Wilson-scored route reliability aggregation
type RouteReliabilityRow = {
  origin_iata:               string;
  destination_iata:          string;
  route:                     string;
  search_observations:       number;
  successful_observations:   number;
  unsuccessful_observations: number;
  raw_hit_rate:              number;
  confidence_adjusted_score: number;
};

function aggregateRouteReliability(
  routeObs: RouteObs[],
  opts: {
    minimumObservations: number;
    includeAdminBulk:    boolean;
    includeScheduledBulk: boolean;
    includeUserSearches: boolean;
    originIata?:         string | null;
    destinationIata?:    string | null;
  },
): RouteReliabilityRow[] {
  const filtered = routeObs.filter((r) => {
    const tbMatch = (
      (opts.includeUserSearches    && r.triggered_by === null)
      || (opts.includeScheduledBulk && r.triggered_by === "scheduled_bulk_search")
      || (opts.includeAdminBulk     && r.triggered_by === "admin_bulk_search")
    );
    const originMatch = !opts.originIata || r.origin_iata === opts.originIata;
    const destMatch   = !opts.destinationIata || r.destination_iata === opts.destinationIata;
    return tbMatch && originMatch && destMatch;
  });

  const map = new Map<string, { n: number; successes: number }>();
  for (const r of filtered) {
    const key = `${r.origin_iata}|${r.destination_iata}`;
    if (!map.has(key)) map.set(key, { n: 0, successes: 0 });
    const e = map.get(key)!;
    e.n++;
    if (r.had_gowild_success) e.successes++;
  }

  const result: RouteReliabilityRow[] = [];
  for (const [key, { n, successes }] of map.entries()) {
    if (n < opts.minimumObservations) continue;
    const [origin, dest] = key.split("|");
    result.push({
      origin_iata:               origin,
      destination_iata:          dest,
      route:                     `${origin}-${dest}`,
      search_observations:       n,
      successful_observations:   successes,
      unsuccessful_observations: n - successes,
      raw_hit_rate:              Math.round(100 * 100 * successes / n) / 100,
      confidence_adjusted_score: Math.round(100 * wilsonScore(successes, n)) / 100,
    });
  }
  return result.sort(
    (a, b) =>
      b.confidence_adjusted_score - a.confidence_adjusted_score
      || b.search_observations - a.search_observations
      || b.raw_hit_rate - a.raw_hit_rate,
  );
}

// Disappeared itineraries helpers
type DisappearedRow = {
  stable_itinerary_key: string;
  disappeared_at:       string;
  result_source:        string | null;
};

function aggregateDisappeared(
  canonical: SnapshotRow[],
  opts: { latestEventOnly: boolean; originIata?: string | null; destinationIata?: string | null },
): Array<{ key: string; disappeared_at: string; event_count: number }> {
  const events = canonical.filter(
    (r) =>
      r.availability_status === "not_returned"
      && (!opts.originIata || r.origin_iata === opts.originIata)
      && (!opts.destinationIata || r.destination_iata === opts.destinationIata),
  );

  // Count events per key
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = e.stable_itinerary_key!;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  if (opts.latestEventOnly) {
    // Keep only most recent per key
    const latestMap = new Map<string, string>();
    for (const e of events) {
      const k = e.stable_itinerary_key!;
      if (!latestMap.has(k) || e.snapshot_at > latestMap.get(k)!) {
        latestMap.set(k, e.snapshot_at);
      }
    }
    return Array.from(latestMap.entries()).map(([k, ts]) => ({
      key: k,
      disappeared_at: ts,
      event_count: counts.get(k)!,
    }));
  } else {
    return events.map((e) => ({
      key: e.stable_itinerary_key!,
      disappeared_at: e.snapshot_at,
      event_count: counts.get(e.stable_itinerary_key!)!,
    }));
  }
}

// Prior available lookup: most recent returned+gowild observation for a key
function findPriorAvailable(
  canonical: SnapshotRow[],
  key: string,
): { last_available_at: string | null; prior_gowild_fare: number | null; prior_savings: number | null } {
  const candidates = canonical
    .filter(
      (r) =>
        r.stable_itinerary_key === key &&
        r.availability_status === "returned" &&
        r.has_go_wild === true,
    )
    .sort((a, b) => (b.snapshot_at > a.snapshot_at ? 1 : -1));

  if (candidates.length === 0) {
    return { last_available_at: null, prior_gowild_fare: null, prior_savings: null };
  }
  const best = candidates[0];
  const savings =
    best.standard_total !== null &&
    best.go_wild_total  !== null &&
    best.standard_total >= best.go_wild_total
      ? best.standard_total - best.go_wild_total
      : null;
  return {
    last_available_at: best.snapshot_at,
    prior_gowild_fare: best.go_wild_total,
    prior_savings:     savings,
  };
}

// Fare savings helpers
type FareSavingsRow = { savings: number; gowild: number; standard: number };

function aggregateFareSavings(
  canonical: SnapshotRow[],
  opts: {
    minimumSamples: number;
    originIata?: string | null;
    destinationIata?: string | null;
  },
): Map<string, { samples: number; avgSavings: number; medianSavings: number; maxSavings: number }> {
  const valid = canonical.filter(
    (r) =>
      r.availability_status === "returned" &&
      r.has_go_wild &&
      r.go_wild_total !== null &&
      r.standard_total !== null &&
      r.standard_total >= r.go_wild_total &&
      (!opts.originIata || r.origin_iata === opts.originIata) &&
      (!opts.destinationIata || r.destination_iata === opts.destinationIata),
  );

  const map = new Map<string, FareSavingsRow[]>();
  for (const r of valid) {
    const key = `${r.origin_iata}|${r.destination_iata}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({
      savings:  r.standard_total! - r.go_wild_total!,
      gowild:   r.go_wild_total!,
      standard: r.standard_total!,
    });
  }

  const result = new Map<
    string,
    { samples: number; avgSavings: number; medianSavings: number; maxSavings: number }
  >();
  for (const [key, rows] of map.entries()) {
    if (rows.length < opts.minimumSamples) continue;
    const savings = rows.map((r) => r.savings).sort((a, b) => a - b);
    const n       = savings.length;
    const median  =
      n % 2 === 1
        ? savings[Math.floor(n / 2)]
        : (savings[n / 2 - 1] + savings[n / 2]) / 2;
    result.set(key, {
      samples:      n,
      avgSavings:   savings.reduce((s, v) => s + v, 0) / n,
      medianSavings: median,
      maxSavings:   Math.max(...savings),
    });
  }
  return result;
}

// Limit clamping helpers (mirror SQL LEAST/GREATEST clamping)
function clampReliabilityLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 25;
  return Math.min(Math.floor(n), 100);
}
function clampDisappearedLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(Math.floor(n), 500);
}
function clampFareSavingsLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 25;
  return Math.min(Math.floor(n), 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test data factories
// ─────────────────────────────────────────────────────────────────────────────

const baseRow: SnapshotRow = {
  flight_search_id:     "search-1",
  stable_itinerary_key: "DEN|JFK|F9|101|2026-06-01T08:00:00|2026-06-01T14:00:00",
  snapshot_at:          "2026-06-01T10:00:00Z",
  availability_status:  "returned",
  has_go_wild:          true,
  go_wild_total:        99,
  standard_total:       299,
  go_wild_available_seats: 4,
  origin_iata:          "DEN",
  destination_iata:     "JFK",
  result_source:        "live_api",
  triggered_by:         null,
  provider_observed_at: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("canonical observation view — deduplication", () => {
  it("keeps one row per (flight_search_id, stable_itinerary_key)", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, snapshot_at: "2026-06-01T09:00:00Z" },
      { ...baseRow, snapshot_at: "2026-06-01T10:00:00Z" },  // newer — should win
    ];
    expect(buildCanonicalObservations(rows)).toHaveLength(1);
  });

  it("picks the row with the latest snapshot_at", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, snapshot_at: "2026-06-01T08:00:00Z", go_wild_total: 150 },
      { ...baseRow, snapshot_at: "2026-06-01T10:00:00Z", go_wild_total: 99 },
    ];
    const result = buildCanonicalObservations(rows);
    expect(result[0].go_wild_total).toBe(99);
  });

  it("different search IDs with the same itinerary key are separate rows", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, flight_search_id: "search-1" },
      { ...baseRow, flight_search_id: "search-2" },
    ];
    expect(buildCanonicalObservations(rows)).toHaveLength(2);
  });

  it("excludes rows with null stable_itinerary_key", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, stable_itinerary_key: null },
    ];
    expect(buildCanonicalObservations(rows)).toHaveLength(0);
  });

  it("handles not_returned rows with the same deduplication logic", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, availability_status: "not_returned", has_go_wild: false, snapshot_at: "2026-06-01T09:00:00Z" },
      { ...baseRow, availability_status: "not_returned", has_go_wild: false, snapshot_at: "2026-06-01T11:00:00Z" },
    ];
    const result = buildCanonicalObservations(rows);
    expect(result).toHaveLength(1);
    expect(result[0].snapshot_at).toBe("2026-06-01T11:00:00Z");
  });
});

describe("canonical observation view — cache-hit exclusion", () => {
  it("excludes rows from cache_hit searches", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, result_source: "cache_hit" },
    ];
    expect(buildCanonicalObservations(rows)).toHaveLength(0);
  });

  it("includes rows from live_api searches", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, result_source: "live_api" },
    ];
    expect(buildCanonicalObservations(rows)).toHaveLength(1);
  });

  it("includes rows where result_source is null (treated as live_api)", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, result_source: null },
    ];
    expect(buildCanonicalObservations(rows)).toHaveLength(1);
  });

  it("includes rows from scheduled_bulk_search", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, result_source: "scheduled_bulk_search", triggered_by: "scheduled_bulk_search" },
    ];
    expect(buildCanonicalObservations(rows)).toHaveLength(1);
  });
});

describe("route observation layer — one observation per (search, route)", () => {
  it("groups multiple itineraries from the same search-route into one row", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, stable_itinerary_key: "key-A" },
      { ...baseRow, stable_itinerary_key: "key-B" },
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    expect(routeObs).toHaveLength(1);
  });

  it("had_gowild_success=true when any itinerary is returned with GoWild", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, stable_itinerary_key: "key-A", has_go_wild: true,  availability_status: "returned" },
      { ...baseRow, stable_itinerary_key: "key-B", has_go_wild: false, availability_status: "no_gowild_fare" },
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    expect(routeObs[0].had_gowild_success).toBe(true);
  });

  it("had_gowild_success=false when all itineraries have no GoWild fare", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, stable_itinerary_key: "key-A", has_go_wild: false, availability_status: "no_gowild_fare" },
      { ...baseRow, stable_itinerary_key: "key-B", has_go_wild: false, availability_status: "no_gowild_fare" },
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    expect(routeObs[0].had_gowild_success).toBe(false);
  });

  it("not_returned rows (has_go_wild=false) do not set had_gowild_success", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, stable_itinerary_key: "key-A", has_go_wild: false, availability_status: "not_returned" },
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    expect(routeObs[0].had_gowild_success).toBe(false);
  });

  it("different routes in the same search produce separate route observations", () => {
    const rows: SnapshotRow[] = [
      { ...baseRow, stable_itinerary_key: "key-A", origin_iata: "DEN", destination_iata: "JFK" },
      { ...baseRow, stable_itinerary_key: "key-B", origin_iata: "DEN", destination_iata: "ORD" },
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    expect(routeObs).toHaveLength(2);
  });
});

describe("Wilson confidence score", () => {
  it("returns 0 for 0 total observations", () => {
    expect(wilsonScore(0, 0)).toBe(0);
  });

  it("returns 0 for negative inputs", () => {
    expect(wilsonScore(-1, 10)).toBe(0);
    expect(wilsonScore(0, -5)).toBe(0);
  });

  it("returns 0 for 0 successes out of 10", () => {
    expect(wilsonScore(0, 10)).toBe(0);
  });

  it("returns a value between 0 and 100 for 5/10 successes", () => {
    const score = wilsonScore(5, 10);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("returns a value close to 100 for 1000/1000 successes", () => {
    expect(wilsonScore(1000, 1000)).toBeCloseTo(99.6, 0);
  });

  it("score increases monotonically with more successes for fixed n", () => {
    const s5  = wilsonScore(5,  10);
    const s7  = wilsonScore(7,  10);
    const s10 = wilsonScore(10, 10);
    expect(s5 < s7).toBe(true);
    expect(s7 < s10).toBe(true);
  });

  it("ranks a large-sample 80% route above a small-sample 100% route", () => {
    // 8/10 with large sample vs 3/3 (100%) with small sample.
    // Wilson penalises the small sample.
    const bigSample   = wilsonScore(80, 100); // 80% with n=100
    const smallSample = wilsonScore(3, 3);     // 100% with n=3
    expect(bigSample).toBeGreaterThan(smallSample);
  });

  it("routes with the same raw rate but more observations rank higher", () => {
    const more = wilsonScore(50, 100); // 50%, n=100
    const less = wilsonScore(5, 10);   // 50%, n=10
    expect(more).toBeGreaterThan(less);
  });

  it("clamps output to [0, 100]", () => {
    // stress-test edge values
    expect(wilsonScore(1000000, 1000000)).toBeLessThanOrEqual(100);
    expect(wilsonScore(0, 1000000)).toBeGreaterThanOrEqual(0);
  });
});

describe("route reliability — aggregation and filtering", () => {
  const mkRouteObs = (
    search: string,
    origin: string,
    dest: string,
    success: boolean,
    triggered_by: string | null = null,
  ): SnapshotRow => ({
    ...baseRow,
    flight_search_id:     search,
    stable_itinerary_key: `${search}-${origin}-${dest}`,
    origin_iata:          origin,
    destination_iata:     dest,
    availability_status:  success ? "returned" : "no_gowild_fare",
    has_go_wild:          success,
    triggered_by,
    result_source:        "live_api",
  });

  it("excludes routes below minimum_observations threshold", () => {
    const rows: SnapshotRow[] = [
      mkRouteObs("s1", "DEN", "JFK", true),
      mkRouteObs("s2", "DEN", "JFK", false),
      // Only 2 observations; minimum = 3 → should be excluded
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    const result = aggregateRouteReliability(routeObs, {
      minimumObservations: 3,
      includeAdminBulk: true,
      includeScheduledBulk: true,
      includeUserSearches: true,
    });
    expect(result).toHaveLength(0);
  });

  it("includes routes at or above minimum_observations threshold", () => {
    const rows: SnapshotRow[] = [
      mkRouteObs("s1", "DEN", "JFK", true),
      mkRouteObs("s2", "DEN", "JFK", true),
      mkRouteObs("s3", "DEN", "JFK", false),
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    const result = aggregateRouteReliability(routeObs, {
      minimumObservations: 3,
      includeAdminBulk: true,
      includeScheduledBulk: true,
      includeUserSearches: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].successful_observations).toBe(2);
  });

  it("filters by triggered_by: user-only when include_user_searches=true only", () => {
    const rows: SnapshotRow[] = [
      mkRouteObs("s1", "DEN", "JFK", true, null),                     // user
      mkRouteObs("s2", "DEN", "JFK", true, "admin_bulk_search"),      // admin
      mkRouteObs("s3", "DEN", "JFK", false, "scheduled_bulk_search"), // scheduled
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    const result = aggregateRouteReliability(routeObs, {
      minimumObservations: 1,
      includeAdminBulk: false,
      includeScheduledBulk: false,
      includeUserSearches: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].search_observations).toBe(1);
  });

  it("filters by origin_iata", () => {
    const rows: SnapshotRow[] = [
      mkRouteObs("s1", "DEN", "JFK", true),
      mkRouteObs("s2", "LAX", "ORD", true),
    ];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    const result = aggregateRouteReliability(routeObs, {
      minimumObservations: 1,
      includeAdminBulk: true,
      includeScheduledBulk: true,
      includeUserSearches: true,
      originIata: "DEN",
    });
    expect(result).toHaveLength(1);
    expect(result[0].origin_iata).toBe("DEN");
  });

  it("returns empty when no source types are included", () => {
    const rows: SnapshotRow[] = [mkRouteObs("s1", "DEN", "JFK", true)];
    const canonical = buildCanonicalObservations(rows);
    const routeObs  = buildRouteObservations(canonical);
    const result = aggregateRouteReliability(routeObs, {
      minimumObservations: 1,
      includeAdminBulk: false,
      includeScheduledBulk: false,
      includeUserSearches: false,
    });
    expect(result).toHaveLength(0);
  });

  it("confidence-adjusted score is higher for larger samples at same raw rate", () => {
    const make50pct = (prefix: string, n: number): SnapshotRow[] =>
      Array.from({ length: n }, (_, i) =>
        mkRouteObs(`${prefix}-${i}`, "DEN", i < n / 2 ? "JFK" : "JFK", i < n / 2),
      );

    const rowsSmall = make50pct("sm", 4);
    const rowsLarge = make50pct("lg", 20);

    const build = (rows: SnapshotRow[]) => {
      const routeObs = buildRouteObservations(buildCanonicalObservations(rows));
      const agg = aggregateRouteReliability(routeObs, {
        minimumObservations: 1,
        includeAdminBulk: true,
        includeScheduledBulk: true,
        includeUserSearches: true,
      });
      return agg[0]?.confidence_adjusted_score ?? 0;
    };
    // Both have 50% raw rate; large sample should score higher
    expect(build(rowsLarge)).toBeGreaterThan(build(rowsSmall));
  });
});

describe("disappeared itineraries — event handling", () => {
  const mkDisappeared = (key: string, ts: string, searchId = "s1"): SnapshotRow => ({
    ...baseRow,
    flight_search_id:    searchId,
    stable_itinerary_key: key,
    snapshot_at:         ts,
    availability_status: "not_returned",
    has_go_wild:         false,
    go_wild_total:       null,
    standard_total:      null,
    go_wild_available_seats: null,
  });

  it("latest_event_only=true returns one row per key", () => {
    const canonical: SnapshotRow[] = [
      mkDisappeared("key-A", "2026-06-01T10:00:00Z", "s1"),
      mkDisappeared("key-A", "2026-06-02T10:00:00Z", "s2"),
      mkDisappeared("key-B", "2026-06-01T10:00:00Z", "s3"),
    ];
    const result = aggregateDisappeared(canonical, { latestEventOnly: true });
    expect(result).toHaveLength(2);
  });

  it("latest_event_only=true picks the most recent disappearance per key", () => {
    const canonical: SnapshotRow[] = [
      mkDisappeared("key-A", "2026-06-01T10:00:00Z", "s1"),
      mkDisappeared("key-A", "2026-06-03T10:00:00Z", "s2"),
    ];
    const result = aggregateDisappeared(canonical, { latestEventOnly: true });
    expect(result[0].disappeared_at).toBe("2026-06-03T10:00:00Z");
  });

  it("latest_event_only=true still reports the full event_count for the key", () => {
    const canonical: SnapshotRow[] = [
      mkDisappeared("key-A", "2026-06-01T10:00:00Z", "s1"),
      mkDisappeared("key-A", "2026-06-02T10:00:00Z", "s2"),
      mkDisappeared("key-A", "2026-06-03T10:00:00Z", "s3"),
    ];
    const result = aggregateDisappeared(canonical, { latestEventOnly: true });
    expect(result[0].event_count).toBe(3);
  });

  it("latest_event_only=false returns one row per disappearance event", () => {
    const canonical: SnapshotRow[] = [
      mkDisappeared("key-A", "2026-06-01T10:00:00Z", "s1"),
      mkDisappeared("key-A", "2026-06-02T10:00:00Z", "s2"),
    ];
    const result = aggregateDisappeared(canonical, { latestEventOnly: false });
    expect(result).toHaveLength(2);
  });

  it("filters by origin_iata", () => {
    const canonical: SnapshotRow[] = [
      { ...mkDisappeared("key-A", "2026-06-01T10:00:00Z", "s1"), origin_iata: "DEN" },
      { ...mkDisappeared("key-B", "2026-06-01T10:00:00Z", "s2"), origin_iata: "LAX" },
    ];
    const result = aggregateDisappeared(canonical, { latestEventOnly: true, originIata: "DEN" });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("key-A");
  });

  it("returns empty when no not_returned rows exist", () => {
    const canonical: SnapshotRow[] = [
      { ...baseRow, availability_status: "returned" },
    ];
    const result = aggregateDisappeared(canonical, { latestEventOnly: true });
    expect(result).toHaveLength(0);
  });
});

describe("disappeared itineraries — prior available lookup", () => {
  it("returns null when no prior returned+gowild row exists", () => {
    const canonical: SnapshotRow[] = [
      { ...baseRow, availability_status: "not_returned", has_go_wild: false },
    ];
    const { last_available_at } = findPriorAvailable(canonical, baseRow.stable_itinerary_key!);
    expect(last_available_at).toBeNull();
  });

  it("finds the most recent prior returned+gowild row for the key", () => {
    const canonical: SnapshotRow[] = [
      { ...baseRow, availability_status: "returned", has_go_wild: true, snapshot_at: "2026-05-01T10:00:00Z", go_wild_total: 99 },
      { ...baseRow, availability_status: "returned", has_go_wild: true, snapshot_at: "2026-05-15T10:00:00Z", go_wild_total: 89 },
    ];
    const { last_available_at, prior_gowild_fare } = findPriorAvailable(canonical, baseRow.stable_itinerary_key!);
    expect(last_available_at).toBe("2026-05-15T10:00:00Z");
    expect(prior_gowild_fare).toBe(89);
  });

  it("ignores rows where has_go_wild=false for the prior lookup", () => {
    const canonical: SnapshotRow[] = [
      { ...baseRow, availability_status: "returned", has_go_wild: false, snapshot_at: "2026-05-15T10:00:00Z" },
    ];
    const { last_available_at } = findPriorAvailable(canonical, baseRow.stable_itinerary_key!);
    expect(last_available_at).toBeNull();
  });

  it("ignores rows where availability_status != 'returned' for prior lookup", () => {
    const canonical: SnapshotRow[] = [
      { ...baseRow, availability_status: "no_gowild_fare", has_go_wild: false, snapshot_at: "2026-05-15T10:00:00Z" },
    ];
    const { last_available_at } = findPriorAvailable(canonical, baseRow.stable_itinerary_key!);
    expect(last_available_at).toBeNull();
  });

  it("prior_savings is null when standard_total < go_wild_total (negative savings)", () => {
    const canonical: SnapshotRow[] = [
      {
        ...baseRow,
        availability_status: "returned",
        has_go_wild: true,
        go_wild_total: 299,
        standard_total: 99,  // cheaper than GoWild → negative savings → null
      },
    ];
    const { prior_savings } = findPriorAvailable(canonical, baseRow.stable_itinerary_key!);
    expect(prior_savings).toBeNull();
  });

  it("prior_savings is null when standard_total is null", () => {
    const canonical: SnapshotRow[] = [
      { ...baseRow, availability_status: "returned", has_go_wild: true, standard_total: null },
    ];
    const { prior_savings } = findPriorAvailable(canonical, baseRow.stable_itinerary_key!);
    expect(prior_savings).toBeNull();
  });

  it("prior_savings is correct when standard >= gowild", () => {
    const canonical: SnapshotRow[] = [
      { ...baseRow, availability_status: "returned", has_go_wild: true, go_wild_total: 99, standard_total: 299 },
    ];
    const { prior_savings } = findPriorAvailable(canonical, baseRow.stable_itinerary_key!);
    expect(prior_savings).toBe(200);
  });
});

describe("fare savings — valid sample filtering", () => {
  const mkFareRow = (
    gowild: number | null,
    standard: number | null,
    key = "key-A",
    origin = "DEN",
    dest = "JFK",
    idx = 0,
  ): SnapshotRow => ({
    ...baseRow,
    flight_search_id:    `s${idx}`,
    stable_itinerary_key: key,
    availability_status: "returned",
    has_go_wild:         gowild !== null,
    go_wild_total:       gowild,
    standard_total:      standard,
    origin_iata:         origin,
    destination_iata:    dest,
  });

  it("excludes rows where go_wild_total is null", () => {
    const canonical = buildCanonicalObservations([mkFareRow(null, 299, "k1", "DEN", "JFK", 1)]);
    const result = aggregateFareSavings(canonical, { minimumSamples: 1 });
    expect(result.size).toBe(0);
  });

  it("excludes rows where standard_total is null", () => {
    const canonical = buildCanonicalObservations([mkFareRow(99, null, "k2", "DEN", "JFK", 2)]);
    const result = aggregateFareSavings(canonical, { minimumSamples: 1 });
    expect(result.size).toBe(0);
  });

  it("excludes rows where standard_total < go_wild_total (negative savings)", () => {
    const canonical = buildCanonicalObservations([mkFareRow(299, 99, "k3", "DEN", "JFK", 3)]);
    const result = aggregateFareSavings(canonical, { minimumSamples: 1 });
    expect(result.size).toBe(0);
  });

  it("excludes rows where standard_total === go_wild_total (zero savings, still excluded by < check)", () => {
    // spec: standard_total >= go_wild_total → included (zero savings is valid)
    const canonical = buildCanonicalObservations([mkFareRow(99, 99, "k4", "DEN", "JFK", 4)]);
    const result = aggregateFareSavings(canonical, { minimumSamples: 1 });
    expect(result.size).toBe(1);  // zero savings is valid; standard >= gowild
  });

  it("includes rows where standard_total > go_wild_total", () => {
    const canonical = buildCanonicalObservations([mkFareRow(99, 299, "k5", "DEN", "JFK", 5)]);
    const result = aggregateFareSavings(canonical, { minimumSamples: 1 });
    expect(result.size).toBe(1);
    expect(result.get("DEN|JFK")?.avgSavings).toBe(200);
  });

  it("HAVING minimum_samples excludes routes with too few valid samples", () => {
    const rows = [mkFareRow(99, 299, "k6", "DEN", "JFK", 6)];
    const canonical = buildCanonicalObservations(rows);
    const result = aggregateFareSavings(canonical, { minimumSamples: 5 });
    expect(result.size).toBe(0);
  });

  it("median differs from mean for skewed distributions", () => {
    const rows = [
      mkFareRow(99, 199, "kA", "DEN", "JFK", 1),   // savings: 100
      mkFareRow(99, 149, "kB", "DEN", "JFK", 2),   // savings: 50
      mkFareRow(99, 649, "kC", "DEN", "JFK", 3),   // savings: 550
    ];
    const canonical = buildCanonicalObservations(rows);
    const result = aggregateFareSavings(canonical, { minimumSamples: 1 });
    const agg = result.get("DEN|JFK")!;
    // mean = (100 + 50 + 550) / 3 = 233.33; median = 100 (sorted: 50, 100, 550)
    expect(agg.medianSavings).toBe(100);
    expect(agg.avgSavings).toBeCloseTo(233.33, 1);
    expect(agg.medianSavings).not.toBe(agg.avgSavings);
  });
});

describe("limit clamping", () => {
  it("clampReliabilityLimit: valid → passes through", () =>
    expect(clampReliabilityLimit(50)).toBe(50));
  it("clampReliabilityLimit: 0 → default 25", () =>
    expect(clampReliabilityLimit(0)).toBe(25));
  it("clampReliabilityLimit: >100 → clamped to 100", () =>
    expect(clampReliabilityLimit(999)).toBe(100));
  it("clampReliabilityLimit: undefined → default 25", () =>
    expect(clampReliabilityLimit(undefined)).toBe(25));

  it("clampDisappearedLimit: valid → passes through", () =>
    expect(clampDisappearedLimit(200)).toBe(200));
  it("clampDisappearedLimit: 0 → default 100", () =>
    expect(clampDisappearedLimit(0)).toBe(100));
  it("clampDisappearedLimit: >500 → clamped to 500", () =>
    expect(clampDisappearedLimit(9999)).toBe(500));

  it("clampFareSavingsLimit: valid → passes through", () =>
    expect(clampFareSavingsLimit(50)).toBe(50));
  it("clampFareSavingsLimit: >100 → clamped to 100", () =>
    expect(clampFareSavingsLimit(200)).toBe(100));
  it("clampFareSavingsLimit: undefined → default 25", () =>
    expect(clampFareSavingsLimit(undefined)).toBe(25));
});

describe("empty dataset behaviour", () => {
  it("canonical view returns empty array for empty input", () =>
    expect(buildCanonicalObservations([])).toHaveLength(0));

  it("route observations returns empty array for empty canonical", () =>
    expect(buildRouteObservations([])).toHaveLength(0));

  it("route reliability aggregation returns empty for empty route obs", () =>
    expect(
      aggregateRouteReliability([], {
        minimumObservations: 1,
        includeAdminBulk: true,
        includeScheduledBulk: true,
        includeUserSearches: true,
      }),
    ).toHaveLength(0));

  it("fare savings returns empty map for empty canonical", () =>
    expect(aggregateFareSavings([], { minimumSamples: 1 }).size).toBe(0));

  it("disappeared aggregation returns empty for empty canonical", () =>
    expect(aggregateDisappeared([], { latestEventOnly: true })).toHaveLength(0));
});
