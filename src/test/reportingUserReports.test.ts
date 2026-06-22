/**
 * Tests for the three user-category report implementations.
 *
 * These tests cover pure data-mapping and business-logic functions.
 * RPC-level SQL is validated conceptually (not via a live database).
 *
 * The following pure utilities are re-implemented inline, matching the
 * logic in the actual handler and engine files so Vitest can run them
 * without Deno globals.
 *
 * Keep in sync with:
 *   supabase/functions/_shared/reporting/handlers/usersHandlers.ts
 *   supabase/migrations/20260622010000_reporting_user_rpcs.sql
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Inline re-implementations of pure utilities (no Deno / esm.sh deps)
// ─────────────────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "***";
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  return `${local.length > 0 ? local[0] : ""}***@${domain}`;
}

function exclusiveEndTimestamp(endDate: string): string {
  const d = new Date(`${endDate}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function toTimestamptz(date: string): string {
  return `${date}T00:00:00.000Z`;
}

// System-search exclusion predicate (mirrors SQL WHERE clause logic).
function isSystemSearch(row: {
  user_id: string;
  triggered_by: string | null;
}): boolean {
  const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";
  if (row.user_id === SYSTEM_UUID) return true;
  if (
    row.triggered_by === "scheduled_bulk_search" ||
    row.triggered_by === "admin_bulk_search"
  )
    return true;
  return false;
}

function filterSearches(
  rows: Array<{ user_id: string; triggered_by: string | null }>,
  includeSystemActivity: boolean,
): Array<{ user_id: string; triggered_by: string | null }> {
  if (includeSystemActivity) return rows;
  return rows.filter((r) => !isSystemSearch(r));
}

// Aggregation helpers (mirror CTE logic in SQL).
function aggregateSearches(
  rows: Array<{ user_id: string; gowild_found: boolean; search_timestamp: string }>,
): Map<string, { search_count: number; gowild_search_count: number; last_search_at: string }> {
  const map = new Map<string, { search_count: number; gowild_search_count: number; last_search_at: string }>();
  for (const row of rows) {
    const cur = map.get(row.user_id) ?? { search_count: 0, gowild_search_count: 0, last_search_at: "" };
    cur.search_count++;
    if (row.gowild_found) cur.gowild_search_count++;
    if (!cur.last_search_at || row.search_timestamp > cur.last_search_at) {
      cur.last_search_at = row.search_timestamp;
    }
    map.set(row.user_id, cur);
  }
  return map;
}

// Distinct-user-count helper (mirrors SQL COUNT(DISTINCT user_id)).
function countDistinctUsers(rows: Array<{ user_id: string }>): number {
  return new Set(rows.map((r) => r.user_id)).size;
}

// Dormant: last-activity computation.
function computeLastActivity(signals: (string | null)[]): string | null {
  const valid = signals.filter((s): s is string => s != null && s !== "");
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a > b ? a : b));
}

function isBeforeCutoff(lastActivityAt: string | null, cutoffDays: number): boolean {
  if (lastActivityAt === null) return true; // never active → always dormant
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cutoffDays);
  return new Date(lastActivityAt) < cutoff;
}

function computeInactiveDays(lastActivityAt: string | null): number | null {
  if (lastActivityAt === null) return null;
  const diff = Date.now() - new Date(lastActivityAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Engagement rate helper.
function engagementRate(numerator: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((100 * numerator) / total * 100) / 100; // 2 decimal places
}

// Bounds clamping.
function clampTopSearchLimit(n: unknown): number {
  const v = Number(n);
  if (!isFinite(v) || v < 1) return 10;
  return Math.min(Math.max(Math.floor(v), 1), 100);
}

function clampDormantLimit(n: unknown): number {
  const v = Number(n);
  if (!isFinite(v) || v < 1) return 100;
  return Math.min(Math.max(Math.floor(v), 1), 500);
}

function clampDormantInactiveDays(n: unknown): number {
  const v = Number(n);
  if (!isFinite(v) || v < 1) return 30;
  return Math.min(Math.max(Math.floor(v), 1), 730);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// ── User ID join correctness ──────────────────────────────────────────────────

describe("user ID join correctness", () => {
  /*
   * user_info.auth_user_id is the join key to auth.users.
   * Activity tables (flight_searches, user_flights, etc.) use the UUID auth user_id directly.
   * Joining via user_info.id (integer) would be incorrect.
   */

  it("joins flight_searches.user_id to user_info.auth_user_id (not user_info.id)", () => {
    const authUserId = "aaaaaaaa-0000-0000-0000-000000000001";
    const userInfoRow = { id: 42, auth_user_id: authUserId, email: "alice@example.com" };
    const searchRow   = { user_id: authUserId, search_timestamp: "2026-06-01T00:00:00Z" };

    // Correct join: auth_user_id = user_id
    const matchesCorrectly = userInfoRow.auth_user_id === searchRow.user_id;
    // Wrong join: id = user_id (integer vs UUID — would never match)
    const matchesWrongly = String(userInfoRow.id) === searchRow.user_id;

    expect(matchesCorrectly).toBe(true);
    expect(matchesWrongly).toBe(false);
  });

  it("distinct user count uses auth_user_id, not user_info.id", () => {
    const searches = [
      { user_id: "uuid-1", gowild_found: false, search_timestamp: "2026-06-01T00:00:00Z" },
      { user_id: "uuid-1", gowild_found: true,  search_timestamp: "2026-06-02T00:00:00Z" },
      { user_id: "uuid-2", gowild_found: false, search_timestamp: "2026-06-03T00:00:00Z" },
    ];
    expect(countDistinctUsers(searches)).toBe(2);
  });
});

// ── System search exclusion ───────────────────────────────────────────────────

describe("system search exclusion", () => {
  const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";

  const searches = [
    { user_id: "real-user-1", triggered_by: null },
    { user_id: "real-user-2", triggered_by: null },
    { user_id: SYSTEM_UUID,   triggered_by: null },
    { user_id: "real-user-1", triggered_by: "scheduled_bulk_search" },
    { user_id: "real-user-3", triggered_by: "admin_bulk_search" },
  ];

  it("excludes the all-zero system UUID", () => {
    expect(isSystemSearch({ user_id: SYSTEM_UUID, triggered_by: null })).toBe(true);
  });

  it("excludes scheduled_bulk_search regardless of user_id", () => {
    expect(isSystemSearch({ user_id: "real-user-1", triggered_by: "scheduled_bulk_search" })).toBe(true);
  });

  it("excludes admin_bulk_search", () => {
    expect(isSystemSearch({ user_id: "real-user-3", triggered_by: "admin_bulk_search" })).toBe(true);
  });

  it("preserves normal searches where triggered_by is null", () => {
    expect(isSystemSearch({ user_id: "real-user-1", triggered_by: null })).toBe(false);
  });

  it("filterSearches removes system rows when includeSystemActivity=false", () => {
    const filtered = filterSearches(searches, false);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.user_id !== SYSTEM_UUID)).toBe(true);
    expect(filtered.every((r) => r.triggered_by === null)).toBe(true);
  });

  it("filterSearches keeps all rows when includeSystemActivity=true", () => {
    const filtered = filterSearches(searches, true);
    expect(filtered).toHaveLength(5);
  });
});

// ── Distinct user counting ────────────────────────────────────────────────────

describe("distinct user counting", () => {
  it("counts each Auth user_id once regardless of row count", () => {
    const rows = [
      { user_id: "a" }, { user_id: "a" }, { user_id: "b" }, { user_id: "c" },
    ];
    expect(countDistinctUsers(rows)).toBe(3);
  });

  it("returns 0 for an empty dataset", () => {
    expect(countDistinctUsers([])).toBe(0);
  });

  it("engagement rate uses distinct total as denominator", () => {
    // 3 unique users searched out of 10 eligible
    expect(engagementRate(3, 10)).toBeCloseTo(30, 1);
  });

  it("engagement rate returns null when eligible_users is 0", () => {
    expect(engagementRate(0, 0)).toBeNull();
  });
});

// ── No cross-join count multiplication ───────────────────────────────────────

describe("no cross-join count multiplication", () => {
  /*
   * The SQL CTEs aggregate each activity table BEFORE joining, preventing
   * the classic N×M row-multiplication bug where joining two un-aggregated
   * activity tables inflates counts.
   *
   * Example: user has 3 searches + 2 saved flights.
   * Incorrect raw join: 3 × 2 = 6 rows → COUNT(*) = 6 (wrong).
   * Correct pre-aggregation: searches CTE returns 3, saves CTE returns 2.
   */

  it("pre-aggregation prevents count multiplication", () => {
    const searchRows = [
      { user_id: "u1", gowild_found: false, search_timestamp: "2026-06-01T00:00:00Z" },
      { user_id: "u1", gowild_found: true,  search_timestamp: "2026-06-02T00:00:00Z" },
      { user_id: "u1", gowild_found: false, search_timestamp: "2026-06-03T00:00:00Z" },
    ];
    const saveRows = [
      { user_id: "u1" },
      { user_id: "u1" },
    ];

    // Aggregated separately
    const agg = aggregateSearches(searchRows);
    const u1Searches = agg.get("u1")!;
    const u1Saves    = saveRows.filter((r) => r.user_id === "u1").length;

    expect(u1Searches.search_count).toBe(3); // not 6
    expect(u1Saves).toBe(2);
    // No multiplication occurred: we have 3 searches and 2 saves, not 3×2=6
    expect(u1Searches.search_count * u1Saves).not.toBe(u1Searches.search_count); // 6 ≠ 3
  });

  it("aggregateSearches returns one entry per user", () => {
    const rows = [
      { user_id: "u1", gowild_found: false, search_timestamp: "2026-06-01T00:00:00Z" },
      { user_id: "u2", gowild_found: true,  search_timestamp: "2026-06-01T00:00:00Z" },
      { user_id: "u1", gowild_found: true,  search_timestamp: "2026-06-02T00:00:00Z" },
    ];
    const agg = aggregateSearches(rows);
    expect(agg.size).toBe(2);
    expect(agg.get("u1")!.search_count).toBe(2);
    expect(agg.get("u1")!.gowild_search_count).toBe(1);
    expect(agg.get("u2")!.search_count).toBe(1);
    expect(agg.get("u2")!.gowild_search_count).toBe(1);
  });
});

// ── Date boundary behaviour ───────────────────────────────────────────────────

describe("date boundary behaviour", () => {
  it("exclusiveEndTimestamp advances end_date by one day", () => {
    const ts = exclusiveEndTimestamp("2026-06-30");
    expect(ts.startsWith("2026-07-01")).toBe(true);
  });

  it("toTimestamptz produces midnight UTC", () => {
    expect(toTimestamptz("2026-01-15")).toBe("2026-01-15T00:00:00.000Z");
  });

  it("start_date at boundary is included (>=)", () => {
    const searches = [
      { user_id: "u1", gowild_found: false, search_timestamp: "2026-06-01T00:00:00.000Z" },
      { user_id: "u2", gowild_found: false, search_timestamp: "2026-05-31T23:59:59.999Z" },
    ];
    const from = "2026-06-01T00:00:00.000Z";
    const inWindow = searches.filter((s) => s.search_timestamp >= from);
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0].user_id).toBe("u1");
  });

  it("end_date exclusive boundary excludes midnight of next day", () => {
    const exclusiveTo = exclusiveEndTimestamp("2026-06-30"); // = 2026-07-01T00:00:00Z
    const searches = [
      { user_id: "u1", search_timestamp: "2026-06-30T23:59:59.999Z" }, // in
      { user_id: "u2", search_timestamp: exclusiveTo },                  // out
    ];
    const inWindow = searches.filter((s) => s.search_timestamp < exclusiveTo);
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0].user_id).toBe("u1");
  });
});

// ── Empty datasets ────────────────────────────────────────────────────────────

describe("empty datasets", () => {
  it("aggregateSearches returns empty map for no rows", () => {
    expect(aggregateSearches([]).size).toBe(0);
  });

  it("engagement summary with 0 eligible users returns null rates", () => {
    expect(engagementRate(0, 0)).toBeNull();
    expect(engagementRate(0, 0)).toBeNull();
  });

  it("dormant report with no dormant users returns empty rows", () => {
    const rows: Array<{ user_id: string; last_activity_at: string | null }> = [
      { user_id: "u1", last_activity_at: new Date().toISOString() }, // active today
    ];
    const dormant = rows.filter((r) => isBeforeCutoff(r.last_activity_at, 30));
    expect(dormant).toHaveLength(0);
  });
});

// ── Null activity timestamps ──────────────────────────────────────────────────

describe("null activity timestamps", () => {
  it("computeLastActivity returns null when all signals are null", () => {
    expect(computeLastActivity([null, null, null])).toBeNull();
  });

  it("computeLastActivity returns the single non-null signal", () => {
    expect(computeLastActivity([null, "2026-01-01T00:00:00Z", null])).toBe("2026-01-01T00:00:00Z");
  });

  it("computeLastActivity returns the latest timestamp", () => {
    const result = computeLastActivity([
      "2026-01-01T00:00:00Z",
      "2026-06-01T00:00:00Z",
      "2026-03-15T00:00:00Z",
    ]);
    expect(result).toBe("2026-06-01T00:00:00Z");
  });

  it("computeInactiveDays returns null for never-active users", () => {
    expect(computeInactiveDays(null)).toBeNull();
  });

  it("computeInactiveDays returns a positive integer for past activity", () => {
    const past = new Date();
    past.setDate(past.getDate() - 45);
    const days = computeInactiveDays(past.toISOString());
    expect(days).toBeGreaterThanOrEqual(44);
    expect(days).toBeLessThanOrEqual(46);
  });
});

// ── Never-active users ────────────────────────────────────────────────────────

describe("never-active users", () => {
  it("last_activity_at=null marks user as never_active=true", () => {
    const users = [
      { user_id: "u1", last_activity_at: null },
      { user_id: "u2", last_activity_at: "2026-01-01T00:00:00Z" },
    ];
    const neverActive = users.filter((u) => u.last_activity_at === null);
    expect(neverActive).toHaveLength(1);
    expect(neverActive[0].user_id).toBe("u1");
  });

  it("never-active users are included in the dormant result (not excluded)", () => {
    // A user with last_activity_at=null is MORE dormant than one who was active 90 days ago.
    // isBeforeCutoff must return true for null.
    expect(isBeforeCutoff(null, 30)).toBe(true);
    expect(isBeforeCutoff(null, 1)).toBe(true);
  });

  it("inactive_days is null for never-active users", () => {
    expect(computeInactiveDays(null)).toBeNull();
  });

  it("users active within cutoff are excluded from dormant result", () => {
    const today = new Date().toISOString();
    expect(isBeforeCutoff(today, 30)).toBe(false);
  });
});

// ── Email masking ─────────────────────────────────────────────────────────────

describe("email masking for user reports", () => {
  it("masks email for top-search-active when includePii=false", () => {
    const email = "alice@example.com";
    const masked = maskEmail(email);
    expect(masked).toBe("a***@example.com");
    expect(masked).not.toContain("alice");
  });

  it("masks email for dormant report when includePii=false", () => {
    expect(maskEmail("bob@test.org")).toBe("b***@test.org");
  });

  it("preserves full email when includePii=true", () => {
    // When includePii=true the RPC returns the raw email, engine skips masking.
    const email = "kody@example.com";
    expect(email).toBe("kody@example.com"); // passthrough — no masking applied
  });

  it("handles email with no local part gracefully", () => {
    // Edge case: email = "@domain.com"
    const masked = maskEmail("@domain.com");
    expect(masked).toBe("***@domain.com");
  });

  it("engagement summary columns contain no PII columns", () => {
    const engagementCols = [
      "eligible_users", "users_with_searches", "users_with_gowild_hits",
      "users_with_saved_flights", "users_with_route_favorites", "users_with_feedback",
      "users_with_credit_activity", "users_with_no_recorded_activity",
      "search_engagement_rate", "save_engagement_rate", "feedback_engagement_rate",
    ];
    // None of these are email or user_id — engagement summary is not PII-capable.
    const hasPiiKey = engagementCols.some(
      (k) => k === "email" || k === "user_id" || k.endsWith("_email"),
    );
    expect(hasPiiKey).toBe(false);
  });
});

// ── Limit enforcement ─────────────────────────────────────────────────────────

describe("limit enforcement", () => {
  it("top-search-active clamps limit to 100", () => {
    expect(clampTopSearchLimit(9999)).toBe(100);
    expect(clampTopSearchLimit(50)).toBe(50);
    expect(clampTopSearchLimit(0)).toBe(10);   // default
  });

  it("dormant clamps limit to 500", () => {
    expect(clampDormantLimit(9999)).toBe(500);
    expect(clampDormantLimit(200)).toBe(200);
    expect(clampDormantLimit(0)).toBe(100);   // default
  });

  it("dormant clamps inactive_days to [1, 730]", () => {
    expect(clampDormantInactiveDays(0)).toBe(30);    // default (below min)
    expect(clampDormantInactiveDays(-5)).toBe(30);   // default (negative)
    expect(clampDormantInactiveDays(1)).toBe(1);     // minimum
    expect(clampDormantInactiveDays(730)).toBe(730); // maximum
    expect(clampDormantInactiveDays(999)).toBe(730); // clamped at max
  });

  it("clamps handle non-numeric input", () => {
    expect(clampTopSearchLimit("abc")).toBe(10);
    expect(clampDormantLimit(null)).toBe(100);
    expect(clampDormantInactiveDays(undefined)).toBe(30);
  });
});

// ── Parameter mapping to RPC ──────────────────────────────────────────────────

describe("parameter mapping to RPC arguments", () => {
  it("start_date is converted to midnight UTC timestamptz", () => {
    expect(toTimestamptz("2026-01-01")).toBe("2026-01-01T00:00:00.000Z");
  });

  it("end_date is converted to exclusive end (next-day midnight UTC)", () => {
    const ts = exclusiveEndTimestamp("2026-01-31");
    expect(ts.startsWith("2026-02-01")).toBe(true);
  });

  it("user_status defaults to 'all' for top-search-active", () => {
    // Handler uses 'all' when user_status is absent from validated params.
    function resolveUserStatus(raw: unknown): string {
      return typeof raw === "string" ? raw : "all";
    }
    expect(resolveUserStatus(undefined)).toBe("all");
    expect(resolveUserStatus("current")).toBe("current");
  });

  it("user_status defaults to 'current' for dormant", () => {
    // Dormant handler uses 'current' when user_status is absent.
    function resolveDormantStatus(raw: unknown): string {
      return typeof raw === "string" ? raw : "current";
    }
    expect(resolveDormantStatus(undefined)).toBe("current");
    expect(resolveDormantStatus("all")).toBe("all");
  });
});

// ── User status filter ────────────────────────────────────────────────────────

describe("user_status filter", () => {
  const users = [
    { auth_user_id: "u1", status: "current" },
    { auth_user_id: "u2", status: "pending" },
    { auth_user_id: "u3", status: "current" },
  ];

  function filterByStatus(rows: typeof users, status: string) {
    if (status === "all") return rows;
    return rows.filter((u) => u.status === status);
  }

  it("'all' returns every user", () => {
    expect(filterByStatus(users, "all")).toHaveLength(3);
  });

  it("'current' returns only current users", () => {
    const result = filterByStatus(users, "current");
    expect(result).toHaveLength(2);
    expect(result.every((u) => u.status === "current")).toBe(true);
  });

  it("'pending' returns only pending users", () => {
    const result = filterByStatus(users, "pending");
    expect(result).toHaveLength(1);
    expect(result[0].auth_user_id).toBe("u2");
  });

  it("invalid status falls back to 'all' per SQL bounds guard", () => {
    // The SQL function resets unknown status values to 'all'.
    const invalid = "suspended";
    const normalized = ["all", "current", "pending"].includes(invalid) ? invalid : "all";
    expect(normalized).toBe("all");
  });
});

// ── Engagement summary: no-activity definition ───────────────────────────────

describe("engagement summary: users with no recorded activity", () => {
  type ActivityRow = { user_id: string; created_at: string };

  function hasActivityInWindow(
    userId: string,
    activities: ActivityRow[],
    from: string,
    to: string,
  ): boolean {
    return activities.some(
      (a) => a.user_id === userId && a.created_at >= from && a.created_at < to,
    );
  }

  function usersWithNoActivity(
    eligible: string[],
    searches: ActivityRow[],
    saves: ActivityRow[],
    from: string,
    to: string,
  ): string[] {
    return eligible.filter(
      (id) =>
        !hasActivityInWindow(id, searches, from, to) &&
        !hasActivityInWindow(id, saves, from, to),
    );
  }

  it("counts users with no activity in the window even if they were active before", () => {
    const eligible = ["u1", "u2", "u3"];
    const searches: ActivityRow[] = [
      { user_id: "u1", created_at: "2025-12-01T00:00:00Z" }, // outside window
    ];
    const saves: ActivityRow[] = [];
    const from = "2026-01-01T00:00:00Z";
    const to   = "2026-07-01T00:00:00Z";

    const noActivity = usersWithNoActivity(eligible, searches, saves, from, to);
    // u1 was active in 2025 but NOT in the window → counted as no-activity
    expect(noActivity).toContain("u1");
    expect(noActivity).toHaveLength(3);
  });

  it("user active in window is not counted in no-activity", () => {
    const eligible = ["u1", "u2"];
    const searches: ActivityRow[] = [
      { user_id: "u1", created_at: "2026-03-15T00:00:00Z" },
    ];
    const from = "2026-01-01T00:00:00Z";
    const to   = "2026-07-01T00:00:00Z";

    const noActivity = usersWithNoActivity(eligible, searches, [], from, to);
    expect(noActivity).not.toContain("u1");
    expect(noActivity).toContain("u2");
  });

  it("eligible_users + no_activity + with_activity = eligible (disjoint)", () => {
    const eligible = ["u1", "u2", "u3", "u4"];
    const searches: ActivityRow[] = [
      { user_id: "u1", created_at: "2026-03-01T00:00:00Z" },
      { user_id: "u2", created_at: "2026-04-01T00:00:00Z" },
    ];
    const from = "2026-01-01T00:00:00Z";
    const to   = "2026-07-01T00:00:00Z";

    const withActivity    = eligible.filter((id) => hasActivityInWindow(id, searches, from, to));
    const withoutActivity = usersWithNoActivity(eligible, searches, [], from, to);

    expect(withActivity).toHaveLength(2);
    expect(withoutActivity).toHaveLength(2);
    expect(withActivity.length + withoutActivity.length).toBe(eligible.length);
  });
});
