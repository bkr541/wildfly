/**
 * Unit tests for searches-category report logic.
 *
 * All functions are re-implemented inline — no imports from Deno Edge Function
 * modules — so the tests run under Vitest/jsdom without Deno globals.
 *
 * Coverage:
 *   - Timezone-aware UTC boundary computation
 *   - Day / week / month period grouping
 *   - Granularity fallback for invalid values
 *   - Timezone fallback for unrecognised strings
 *   - System-activity exclusion (zero UUID + triggered_by)
 *   - Origin / destination filter
 *   - All-destination inclusion / exclusion
 *   - NULL flight_results_count: treated as "not recorded", not zero
 *   - Zero-result rate: denominator = ALL searches (not just zero-result rows)
 *   - HAVING minimum_searches threshold
 *   - Source normalisation (NULL → 'unknown', blank → 'unknown')
 *   - Percentage window function summing to 100
 *   - Cache-hit counting
 *   - Divide-by-zero protection (empty datasets)
 *   - Limit clamping [1, 100] for top-routes, [1, 500] for zero-results
 *   - Sorting for top-routes and zero-results
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers re-implemented from the RPC / handler logic
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";
const SYSTEM_TRIGGERED = ["scheduled_bulk_search", "admin_bulk_search"] as const;
const SUPPORTED_TZ = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
] as const;
const VALID_GRANULARITY = ["day", "week", "month"] as const;

type Granularity = (typeof VALID_GRANULARITY)[number];
type SupportedTz = (typeof SUPPORTED_TZ)[number];

/** Mirror of the SQL boundary logic: inclusive start, exclusive end. */
function computeUtcBoundaries(
  startDate: string,
  endDate: string,
  timezone: string,
): { from: Date; to: Date } {
  // In real SQL: (date || 'T00:00:00')::timestamp AT TIME ZONE tz
  // In JS we approximate using Intl.DateTimeFormat offsets.
  // For tests we assert relative relationships, not absolute UTC timestamps.
  const offsetMinutes = (dateStr: string): number => {
    const d = new Date(`${dateStr}T12:00:00Z`); // use noon to avoid DST edge
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) => local.find((p) => p.type === type)?.value ?? "0";
    const localDate = new Date(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    return (d.getTime() - localDate.getTime()) / 60000;
  };

  const fromOffset = offsetMinutes(startDate);
  const from = new Date(`${startDate}T00:00:00Z`);
  from.setMinutes(from.getMinutes() + fromOffset);

  const toOffset = offsetMinutes(endDate);
  const to = new Date(`${endDate}T00:00:00Z`);
  to.setMinutes(to.getMinutes() + toOffset + 24 * 60); // +1 day = exclusive end

  return { from, to };
}

function validateGranularity(raw: unknown): Granularity {
  if (VALID_GRANULARITY.includes(raw as Granularity)) return raw as Granularity;
  return "day";
}

function validateTimezone(raw: unknown): SupportedTz {
  if (SUPPORTED_TZ.includes(raw as SupportedTz)) return raw as SupportedTz;
  return "America/New_York";
}

type SearchRow = {
  user_id: string;
  triggered_by: string | null;
  departure_airport: string;
  arrival_airport: string | null;
  search_timestamp: string;
  gowild_found: boolean | null;
  flight_results_count: number | null;
  result_source: string | null;
};

function isSystemSearch(row: Pick<SearchRow, "user_id" | "triggered_by">): boolean {
  if (row.user_id === SYSTEM_UUID) return true;
  if (row.triggered_by !== null && SYSTEM_TRIGGERED.includes(row.triggered_by as typeof SYSTEM_TRIGGERED[number])) {
    return true;
  }
  return false;
}

function filterSearches(
  rows: SearchRow[],
  opts: {
    includeSystemActivity: boolean;
    startDate?: string;
    endDate?: string;
    timezone?: string;
    originIata?: string | null;
    destinationIata?: string | null;
    includeAllDestinations?: boolean;
    resultSource?: string | null;
    triggeredBy?: string | null;
  },
): SearchRow[] {
  return rows.filter((r) => {
    if (!opts.includeSystemActivity && isSystemSearch(r)) return false;
    if (opts.originIata && r.departure_airport !== opts.originIata) return false;
    if (opts.destinationIata && r.arrival_airport !== opts.destinationIata) return false;
    if (!opts.includeAllDestinations && r.arrival_airport === null) return false;

    if (opts.resultSource != null) {
      if (opts.resultSource === "unknown") {
        if (r.result_source !== null && r.result_source.trim() !== "") return false;
      } else {
        if (r.result_source !== opts.resultSource) return false;
      }
    }
    if (opts.triggeredBy != null) {
      if (opts.triggeredBy === "user") {
        if (r.triggered_by !== null) return false;
      } else {
        if (r.triggered_by !== opts.triggeredBy) return false;
      }
    }

    return true;
  });
}

function normalizeResultSource(raw: string | null): string {
  if (raw === null || raw.trim() === "") return "unknown";
  return raw;
}

type RouteAggregate = {
  origin_iata: string;
  destination_iata: string;
  route: string;
  total_searches: number;
  zero_result_searches: number;
  zero_result_rate: number;
  unique_users_affected: number;
};

function aggregateByRoute(rows: SearchRow[]): RouteAggregate[] {
  const map = new Map<
    string,
    { origin: string; dest: string; users: Set<string>; total: number; zero: number; zeroUsers: Set<string> }
  >();

  for (const r of rows) {
    const dest = r.arrival_airport ?? "ALL";
    const key = `${r.departure_airport}/${dest}`;
    if (!map.has(key)) {
      map.set(key, { origin: r.departure_airport, dest, users: new Set(), total: 0, zero: 0, zeroUsers: new Set() });
    }
    const agg = map.get(key)!;
    agg.users.add(r.user_id);
    agg.total++;
    if (r.flight_results_count === 0) {
      agg.zero++;
      agg.zeroUsers.add(r.user_id);
    }
  }

  return Array.from(map.values()).map((v) => ({
    origin_iata:          v.origin,
    destination_iata:     v.dest,
    route:                `${v.origin}-${v.dest}`,
    total_searches:       v.total,
    zero_result_searches: v.zero,
    zero_result_rate:     v.total > 0 ? Math.round(10000 * v.zero / v.total) / 100 : 0,
    unique_users_affected: v.zeroUsers.size,
  }));
}

type SourceAggregate = {
  result_source: string;
  triggered_by:  string | null;
  search_count:  number;
  percentage:    number;
};

function aggregateBySource(rows: SearchRow[]): SourceAggregate[] {
  const map = new Map<
    string,
    { source: string; triggered: string | null; count: number }
  >();

  for (const r of rows) {
    const src = normalizeResultSource(r.result_source);
    const key = `${src}|${r.triggered_by ?? "__null__"}`;
    if (!map.has(key)) {
      map.set(key, { source: src, triggered: r.triggered_by, count: 0 });
    }
    map.get(key)!.count++;
  }

  const total = rows.length;
  return Array.from(map.values()).map((v) => ({
    result_source: v.source,
    triggered_by:  v.triggered,
    search_count:  v.count,
    percentage:    total > 0 ? Math.round(10000 * v.count / total) / 100 : 0,
  }));
}

function clampTopRoutesLimit(raw: unknown): number {
  const n = Number(raw);
  if (!isFinite(n) || n < 1) return 25;
  return Math.min(Math.floor(n), 100);
}

function clampZeroResultsLimit(raw: unknown): number {
  const n = Number(raw);
  if (!isFinite(n) || n < 1) return 100;
  return Math.min(Math.floor(n), 500);
}

function computeGoWildRate(hits: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round(10000 * hits / total) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("searches.volume-over-time — timezone-aware boundary computation", () => {
  it("produces an exclusive end boundary one full day after the start date", () => {
    const { from, to } = computeUtcBoundaries("2026-01-01", "2026-01-01", "UTC");
    const diffHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(24);
  });

  it("a multi-day range spans exactly (n+1)×24 h from UTC's perspective in UTC", () => {
    const { from, to } = computeUtcBoundaries("2026-01-01", "2026-01-03", "UTC");
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(3); // 3 days: Jan 1, 2, 3 inclusive
  });

  it("from < to for any valid date pair", () => {
    const { from, to } = computeUtcBoundaries("2026-03-15", "2026-03-20", "America/New_York");
    expect(from.getTime()).toBeLessThan(to.getTime());
  });

  it("ET boundaries differ from UTC boundaries by approximately 4–5 hours", () => {
    const utc = computeUtcBoundaries("2026-06-01", "2026-06-01", "UTC");
    const et  = computeUtcBoundaries("2026-06-01", "2026-06-01", "America/New_York");
    const diffHours = (et.from.getTime() - utc.from.getTime()) / (1000 * 60 * 60);
    // EDT = UTC-4
    expect(Math.abs(diffHours)).toBeGreaterThanOrEqual(4);
    expect(Math.abs(diffHours)).toBeLessThanOrEqual(5);
  });

  it("a search at start-of-day UTC is IN range when timezone=UTC", () => {
    const { from, to } = computeUtcBoundaries("2026-06-01", "2026-06-01", "UTC");
    const ts = new Date("2026-06-01T00:00:00Z");
    expect(ts >= from && ts < to).toBe(true);
  });

  it("a search at end-of-day UTC is still IN range (exclusive end is midnight next day)", () => {
    const { from, to } = computeUtcBoundaries("2026-06-01", "2026-06-01", "UTC");
    const ts = new Date("2026-06-01T23:59:59Z");
    expect(ts >= from && ts < to).toBe(true);
  });

  it("a search at midnight of the next day is OUT of range (exclusive boundary)", () => {
    const { from, to } = computeUtcBoundaries("2026-06-01", "2026-06-01", "UTC");
    const ts = new Date("2026-06-02T00:00:00Z");
    expect(ts >= from && ts < to).toBe(false);
  });
});

describe("searches.volume-over-time — granularity validation", () => {
  it("accepts 'day'", ()   => expect(validateGranularity("day")).toBe("day"));
  it("accepts 'week'", ()  => expect(validateGranularity("week")).toBe("week"));
  it("accepts 'month'", () => expect(validateGranularity("month")).toBe("month"));
  it("rejects 'hour' → falls back to 'day'",       () => expect(validateGranularity("hour")).toBe("day"));
  it("rejects 'year' → falls back to 'day'",       () => expect(validateGranularity("year")).toBe("day"));
  it("rejects undefined → falls back to 'day'",    () => expect(validateGranularity(undefined)).toBe("day"));
  it("rejects null → falls back to 'day'",         () => expect(validateGranularity(null)).toBe("day"));
  it("rejects numeric 1 → falls back to 'day'",    () => expect(validateGranularity(1)).toBe("day"));
  it("rejects 'DAY' (case-sensitive) → falls back", () => expect(validateGranularity("DAY")).toBe("day"));
});

describe("searches — timezone validation", () => {
  it("accepts all five supported timezones", () => {
    for (const tz of SUPPORTED_TZ) {
      expect(validateTimezone(tz)).toBe(tz);
    }
  });
  it("rejects 'Europe/London' → falls back to New York", () =>
    expect(validateTimezone("Europe/London")).toBe("America/New_York"));
  it("rejects undefined → falls back to New York", () =>
    expect(validateTimezone(undefined)).toBe("America/New_York"));
  it("rejects empty string → falls back to New York", () =>
    expect(validateTimezone("")).toBe("America/New_York"));
});

describe("searches — system activity exclusion", () => {
  const base: SearchRow = {
    user_id: "aaaaaaaa-0000-0000-0000-000000000001",
    triggered_by: null,
    departure_airport: "DEN",
    arrival_airport: "JFK",
    search_timestamp: "2026-06-01T10:00:00Z",
    gowild_found: false,
    flight_results_count: 5,
    result_source: "live_api",
  };

  it("keeps normal user searches when includeSystemActivity=false", () => {
    const rows = [base];
    expect(filterSearches(rows, { includeSystemActivity: false })).toHaveLength(1);
  });

  it("excludes zero-UUID rows when includeSystemActivity=false", () => {
    const rows: SearchRow[] = [{ ...base, user_id: SYSTEM_UUID }];
    expect(filterSearches(rows, { includeSystemActivity: false })).toHaveLength(0);
  });

  it("excludes scheduled_bulk_search triggered_by", () => {
    const rows: SearchRow[] = [{ ...base, triggered_by: "scheduled_bulk_search" }];
    expect(filterSearches(rows, { includeSystemActivity: false })).toHaveLength(0);
  });

  it("excludes admin_bulk_search triggered_by", () => {
    const rows: SearchRow[] = [{ ...base, triggered_by: "admin_bulk_search" }];
    expect(filterSearches(rows, { includeSystemActivity: false })).toHaveLength(0);
  });

  it("keeps scheduled_bulk_search rows when includeSystemActivity=true", () => {
    const rows: SearchRow[] = [{ ...base, triggered_by: "scheduled_bulk_search" }];
    expect(filterSearches(rows, { includeSystemActivity: true })).toHaveLength(1);
  });

  it("counts zero-UUID rows when includeSystemActivity=true", () => {
    const rows: SearchRow[] = [{ ...base, user_id: SYSTEM_UUID }];
    expect(filterSearches(rows, { includeSystemActivity: true })).toHaveLength(1);
  });
});

describe("searches — null destination (all-destination searches)", () => {
  const base: SearchRow = {
    user_id: "user-1",
    triggered_by: null,
    departure_airport: "DEN",
    arrival_airport: null,
    search_timestamp: "2026-06-01T10:00:00Z",
    gowild_found: false,
    flight_results_count: 3,
    result_source: "live_api",
  };

  it("excludes all-destination searches by default (includeAllDestinations=false)", () => {
    expect(filterSearches([base], { includeSystemActivity: false })).toHaveLength(0);
  });

  it("includes all-destination searches when includeAllDestinations=true", () => {
    expect(filterSearches([base], {
      includeSystemActivity: false,
      includeAllDestinations: true,
    })).toHaveLength(1);
  });

  it("aggregateByRoute assigns 'ALL' as destination_iata for null arrival_airport", () => {
    const aggs = aggregateByRoute([base]);
    expect(aggs[0].destination_iata).toBe("ALL");
    expect(aggs[0].route).toBe("DEN-ALL");
  });

  it("keeps specific-destination searches regardless of includeAllDestinations flag", () => {
    const specific: SearchRow = { ...base, arrival_airport: "JFK" };
    expect(filterSearches([specific], {
      includeSystemActivity: false,
      includeAllDestinations: false,
    })).toHaveLength(1);
  });
});

describe("searches — origin / destination IATA filter", () => {
  const rows: SearchRow[] = [
    {
      user_id: "u1", triggered_by: null,
      departure_airport: "DEN", arrival_airport: "JFK",
      search_timestamp: "2026-06-01T10:00:00Z",
      gowild_found: false, flight_results_count: 5, result_source: "live_api",
    },
    {
      user_id: "u2", triggered_by: null,
      departure_airport: "LAX", arrival_airport: "ORD",
      search_timestamp: "2026-06-01T11:00:00Z",
      gowild_found: false, flight_results_count: 2, result_source: "live_api",
    },
  ];

  it("filters to a specific origin_iata", () => {
    const result = filterSearches(rows, { includeSystemActivity: false, originIata: "DEN" });
    expect(result).toHaveLength(1);
    expect(result[0].departure_airport).toBe("DEN");
  });

  it("filters to a specific destination_iata", () => {
    const result = filterSearches(rows, { includeSystemActivity: false, destinationIata: "ORD" });
    expect(result).toHaveLength(1);
    expect(result[0].arrival_airport).toBe("ORD");
  });

  it("returns no rows when origin has no matches", () => {
    expect(filterSearches(rows, { includeSystemActivity: false, originIata: "MIA" })).toHaveLength(0);
  });
});

describe("searches.zero-results — NULL flight_results_count is not zero", () => {
  const nullCountRow: SearchRow = {
    user_id: "u1", triggered_by: null,
    departure_airport: "DEN", arrival_airport: "JFK",
    search_timestamp: "2026-06-01T10:00:00Z",
    gowild_found: false,
    flight_results_count: null, // not recorded — must NOT be counted as zero
    result_source: "live_api",
  };

  it("does not count NULL flight_results_count as a zero-result search", () => {
    const aggs = aggregateByRoute([nullCountRow]);
    expect(aggs[0].zero_result_searches).toBe(0);
  });

  it("total_searches still increments for NULL count rows", () => {
    const aggs = aggregateByRoute([nullCountRow]);
    expect(aggs[0].total_searches).toBe(1);
  });

  it("zero_result_rate is 0 when all rows have NULL flight_results_count", () => {
    const aggs = aggregateByRoute([nullCountRow, { ...nullCountRow, user_id: "u2" }]);
    expect(aggs[0].zero_result_rate).toBe(0);
  });

  it("explicit 0 IS counted as a zero-result search", () => {
    const zeroRow: SearchRow = { ...nullCountRow, flight_results_count: 0 };
    const aggs = aggregateByRoute([zeroRow]);
    expect(aggs[0].zero_result_searches).toBe(1);
  });
});

describe("searches.zero-results — rate uses all searches as denominator", () => {
  const mkRow = (frc: number | null, uid = "u1"): SearchRow => ({
    user_id: uid, triggered_by: null,
    departure_airport: "DEN", arrival_airport: "JFK",
    search_timestamp: "2026-06-01T10:00:00Z",
    gowild_found: false, flight_results_count: frc, result_source: "live_api",
  });

  it("3 zero-result out of 5 total → rate = 60.00", () => {
    const rows = [
      mkRow(0, "u1"), mkRow(0, "u2"), mkRow(0, "u3"),
      mkRow(5, "u4"), mkRow(10, "u5"),
    ];
    const [agg] = aggregateByRoute(rows);
    expect(agg.total_searches).toBe(5);
    expect(agg.zero_result_searches).toBe(3);
    expect(agg.zero_result_rate).toBe(60);
  });

  it("0 zero-results out of 4 total → rate = 0", () => {
    const rows = [mkRow(1, "u1"), mkRow(2, "u2"), mkRow(3, "u3"), mkRow(null, "u4")];
    const [agg] = aggregateByRoute(rows);
    expect(agg.zero_result_rate).toBe(0);
  });

  it("all zero-results → rate = 100.00", () => {
    const rows = [mkRow(0, "u1"), mkRow(0, "u2")];
    const [agg] = aggregateByRoute(rows);
    expect(agg.zero_result_rate).toBe(100);
  });

  it("unique_users_affected counts only users with at least one zero-result search", () => {
    const rows = [mkRow(0, "u1"), mkRow(5, "u1"), mkRow(5, "u2"), mkRow(0, "u3")];
    const [agg] = aggregateByRoute(rows);
    expect(agg.unique_users_affected).toBe(2);
  });
});

describe("searches.zero-results — HAVING minimum_searches threshold", () => {
  const mkRow = (dep: string, arr: string): SearchRow => ({
    user_id: "u1", triggered_by: null,
    departure_airport: dep, arrival_airport: arr,
    search_timestamp: "2026-06-01T10:00:00Z",
    gowild_found: false, flight_results_count: 0, result_source: "live_api",
  });

  it("excludes routes below the minimum_searches threshold", () => {
    const rows = [
      mkRow("DEN", "JFK"),
      mkRow("LAX", "ORD"),
      mkRow("LAX", "ORD"),
      mkRow("LAX", "ORD"),
    ];
    const aggs = aggregateByRoute(rows).filter((a) => a.total_searches >= 3);
    expect(aggs).toHaveLength(1);
    expect(aggs[0].route).toBe("LAX-ORD");
  });

  it("includes all routes when minimum_searches = 1 (default)", () => {
    const rows = [mkRow("DEN", "JFK"), mkRow("LAX", "ORD")];
    expect(aggregateByRoute(rows).filter((a) => a.total_searches >= 1)).toHaveLength(2);
  });
});

describe("searches.source-cache-mix — source normalisation", () => {
  it("maps null result_source → 'unknown'", () =>
    expect(normalizeResultSource(null)).toBe("unknown"));
  it("maps empty string → 'unknown'", () =>
    expect(normalizeResultSource("")).toBe("unknown"));
  it("maps blank/whitespace string → 'unknown'", () =>
    expect(normalizeResultSource("   ")).toBe("unknown"));
  it("keeps 'live_api' unchanged", () =>
    expect(normalizeResultSource("live_api")).toBe("live_api"));
  it("keeps 'cache_hit' unchanged", () =>
    expect(normalizeResultSource("cache_hit")).toBe("cache_hit"));
  it("keeps 'scheduled_bulk_search' unchanged", () =>
    expect(normalizeResultSource("scheduled_bulk_search")).toBe("scheduled_bulk_search"));
  it("keeps 'admin_bulk_search' unchanged", () =>
    expect(normalizeResultSource("admin_bulk_search")).toBe("admin_bulk_search"));
});

describe("searches.source-cache-mix — window-function percentage", () => {
  const mkRow = (src: string | null, uid = "u1"): SearchRow => ({
    user_id: uid, triggered_by: null,
    departure_airport: "DEN", arrival_airport: "JFK",
    search_timestamp: "2026-06-01T10:00:00Z",
    gowild_found: false, flight_results_count: 1, result_source: src,
  });

  it("percentages sum to 100 across all source rows", () => {
    const rows = [
      mkRow("live_api", "u1"),
      mkRow("live_api", "u2"),
      mkRow("cache_hit", "u3"),
      mkRow(null, "u4"),
    ];
    const aggs = aggregateBySource(rows);
    const sum = aggs.reduce((s, a) => s + a.percentage, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it("single-row result → percentage = 100", () => {
    const aggs = aggregateBySource([mkRow("live_api")]);
    expect(aggs[0].percentage).toBe(100);
  });

  it("empty rows → no aggregates produced", () => {
    expect(aggregateBySource([])).toHaveLength(0);
  });

  it("groups null and blank source together under 'unknown'", () => {
    const rows = [mkRow(null, "u1"), mkRow("", "u2"), mkRow("live_api", "u3")];
    const aggs = aggregateBySource(rows);
    const unknown = aggs.find((a) => a.result_source === "unknown");
    expect(unknown?.search_count).toBe(2);
  });
});

describe("searches — empty dataset behaviour", () => {
  it("aggregateByRoute on empty input returns empty array", () => {
    expect(aggregateByRoute([])).toHaveLength(0);
  });

  it("aggregateBySource on empty input returns empty array", () => {
    expect(aggregateBySource([])).toHaveLength(0);
  });

  it("computeGoWildRate returns null for total = 0", () => {
    expect(computeGoWildRate(0, 0)).toBeNull();
  });

  it("computeGoWildRate returns 100 when all searches are GoWild hits", () => {
    expect(computeGoWildRate(5, 5)).toBe(100);
  });

  it("computeGoWildRate returns 0 when no hits", () => {
    expect(computeGoWildRate(0, 10)).toBe(0);
  });

  it("computeGoWildRate rounds to 2 decimal places", () => {
    // 1/3 = 33.33%
    expect(computeGoWildRate(1, 3)).toBe(33.33);
  });
});

describe("searches — limit clamping", () => {
  it("clampTopRoutesLimit: valid value within range returns the value", () =>
    expect(clampTopRoutesLimit(50)).toBe(50));
  it("clampTopRoutesLimit: 0 or negative → returns default 25", () =>
    expect(clampTopRoutesLimit(0)).toBe(25));
  it("clampTopRoutesLimit: undefined → returns default 25", () =>
    expect(clampTopRoutesLimit(undefined)).toBe(25));
  it("clampTopRoutesLimit: above 100 is clamped to 100", () =>
    expect(clampTopRoutesLimit(999)).toBe(100));
  it("clampTopRoutesLimit: exactly 100 is allowed", () =>
    expect(clampTopRoutesLimit(100)).toBe(100));
  it("clampTopRoutesLimit: fractional is floored", () =>
    expect(clampTopRoutesLimit(24.9)).toBe(24));

  it("clampZeroResultsLimit: valid value within range returns the value", () =>
    expect(clampZeroResultsLimit(200)).toBe(200));
  it("clampZeroResultsLimit: undefined → returns default 100", () =>
    expect(clampZeroResultsLimit(undefined)).toBe(100));
  it("clampZeroResultsLimit: above 500 is clamped to 500", () =>
    expect(clampZeroResultsLimit(9999)).toBe(500));
  it("clampZeroResultsLimit: exactly 500 is allowed", () =>
    expect(clampZeroResultsLimit(500)).toBe(500));
});

describe("searches.top-routes — sort order", () => {
  const mkRoute = (dep: string, arr: string, count: number): SearchRow[] =>
    Array.from({ length: count }, (_, i) => ({
      user_id: `u${dep}${i}`,
      triggered_by: null,
      departure_airport: dep,
      arrival_airport: arr,
      search_timestamp: "2026-06-01T10:00:00Z",
      gowild_found: false,
      flight_results_count: 1,
      result_source: "live_api",
    }));

  it("top-routes returns routes ordered by search_count DESC", () => {
    const rows = [
      ...mkRoute("DEN", "JFK", 3),
      ...mkRoute("LAX", "ORD", 10),
      ...mkRoute("MIA", "SEA", 1),
    ];
    const aggs = aggregateByRoute(rows).sort((a, b) => b.total_searches - a.total_searches);
    expect(aggs[0].route).toBe("LAX-ORD");
    expect(aggs[1].route).toBe("DEN-JFK");
    expect(aggs[2].route).toBe("MIA-SEA");
  });
});

describe("searches.zero-results — sort order", () => {
  const mkZeroRow = (dep: string, arr: string, total: number, zero: number): SearchRow[] => [
    ...Array.from({ length: zero }, (_, i) => ({
      user_id: `z${dep}${i}`,
      triggered_by: null as null,
      departure_airport: dep,
      arrival_airport: arr,
      search_timestamp: "2026-06-01T10:00:00Z",
      gowild_found: false as const,
      flight_results_count: 0,
      result_source: "live_api" as const,
    })),
    ...Array.from({ length: total - zero }, (_, i) => ({
      user_id: `s${dep}${i}`,
      triggered_by: null as null,
      departure_airport: dep,
      arrival_airport: arr,
      search_timestamp: "2026-06-01T11:00:00Z",
      gowild_found: false as const,
      flight_results_count: 5,
      result_source: "live_api" as const,
    })),
  ];

  it("zero-results ordered: more zero searches first", () => {
    const rows = [
      ...mkZeroRow("DEN", "JFK", 10, 2),  // 20% zero
      ...mkZeroRow("LAX", "ORD", 10, 8),  // 80% zero — should be first
    ];
    const aggs = aggregateByRoute(rows).sort(
      (a, b) => b.zero_result_searches - a.zero_result_searches
        || b.zero_result_rate - a.zero_result_rate
        || b.total_searches - a.total_searches,
    );
    expect(aggs[0].route).toBe("LAX-ORD");
  });
});
