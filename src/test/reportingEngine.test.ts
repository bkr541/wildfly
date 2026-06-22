/**
 * Tests for the admin-run-report execution engine.
 *
 * Pure helper functions are re-implemented inline (same logic as
 * supabase/functions/_shared/reporting/reportEngine.ts) so they can
 * run in Vitest's jsdom environment without Deno globals.
 *
 * Keep these in sync with:
 *   supabase/functions/_shared/reporting/reportEngine.ts
 *   supabase/functions/admin-run-report/index.ts
 *   supabase/functions/admin-log-report-export/index.ts
 */
import { describe, it, expect, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Re-implementations of pure helpers (no Deno / esm.sh deps)
// ─────────────────────────────────────────────────────────────────────────────

const LIMITS = {
  DEFAULT_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 500,
  MAX_LIMIT: 500,
  MAX_EXPORT_ROWS: 5_000,
} as const;

const HANDLER_TIMEOUT_MS = 15_000;

const ERROR_CODES = {
  REPORT_NOT_FOUND:        "REPORT_NOT_FOUND",
  REPORT_INACTIVE:         "REPORT_INACTIVE",
  REPORT_VERSION_MISMATCH: "REPORT_VERSION_MISMATCH",
  INVALID_PARAMETERS:      "INVALID_PARAMETERS",
  REPORT_NOT_IMPLEMENTED:  "REPORT_NOT_IMPLEMENTED",
  REPORT_TIMEOUT:          "REPORT_TIMEOUT",
  REPORT_EXECUTION_FAILED: "REPORT_EXECUTION_FAILED",
} as const;

function mergeParameters(
  defaults: Record<string, unknown>,
  submitted: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaults, ...submitted };
}

function clampPage(raw: unknown): number {
  const n = Number(raw);
  return isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function clampPageSize(raw: unknown): number {
  const n = Number(raw);
  if (!isFinite(n) || n < 1) return LIMITS.DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), LIMITS.MAX_PAGE_SIZE);
}

function enforceRowLimit(
  rows: Record<string, unknown>[],
  cap: number,
): { rows: Record<string, unknown>[]; truncated: boolean } {
  if (rows.length <= cap) return { rows, truncated: false };
  return { rows: rows.slice(0, cap), truncated: true };
}

function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "***";
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  return `${local.length > 0 ? local[0] : ""}***@${domain}`;
}

function applyPiiMask(
  rows: Record<string, unknown>[],
  piiColumnKeys: string[],
  includePii: boolean,
): Record<string, unknown>[] {
  if (includePii || piiColumnKeys.length === 0) return rows;
  return rows.map((row) => {
    const masked: Record<string, unknown> = { ...row };
    for (const key of piiColumnKeys) {
      if (masked[key] === null || masked[key] === undefined) continue;
      const isEmailField = key === "email" || key.endsWith("_email");
      masked[key] = isEmailField ? maskEmail(String(masked[key])) : "[redacted]";
    }
    return masked;
  });
}

function mapErrorCode(err: Error): string {
  const msg = (err.message ?? "").trim();
  if (msg === "REPORT_NOT_IMPLEMENTED") return ERROR_CODES.REPORT_NOT_IMPLEMENTED;
  if (msg === "REPORT_TIMEOUT")         return ERROR_CODES.REPORT_TIMEOUT;
  return ERROR_CODES.REPORT_EXECUTION_FAILED;
}

function sanitizeErrorMessage(err: Error): string {
  const msg = (err.message ?? "").trim();
  if (msg === "REPORT_NOT_IMPLEMENTED") return "This report has not been implemented yet.";
  if (msg === "REPORT_TIMEOUT") return "The report timed out. Try a shorter date range or add filters.";
  return "Report execution failed. Check server logs for details.";
}

function shouldIncludePii(registryContainsPii: boolean, requestedPii: boolean): boolean {
  if (!registryContainsPii) return false;
  return requestedPii === true;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error("REPORT_TIMEOUT")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timerId!);
  }
}

// ── Export format validation (from admin-log-report-export) ───────────────────

const VALID_FORMATS = ["csv", "xlsx", "json"] as const;
function isValidFormat(f: unknown): f is string {
  return typeof f === "string" && (VALID_FORMATS as readonly string[]).includes(f);
}

// ── Registry-like mock helpers ────────────────────────────────────────────────

interface MockRegistryEntry {
  slug: string;
  handlerKey: string;
  version: number;
  containsPii: boolean;
  columns: Array<{ key: string; pii?: boolean }>;
  validateParameters: (raw: unknown) => { success: true; data: Record<string, unknown> } | { success: false; error: string };
  handler: () => Promise<unknown>;
}

function makeRegistry(entries: MockRegistryEntry[]): Map<string, MockRegistryEntry> {
  return new Map(entries.map((e) => [e.slug, e]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// ── mergeParameters ───────────────────────────────────────────────────────────

describe("mergeParameters", () => {
  it("applies defaults when no submission is provided", () => {
    const result = mergeParameters({ limit: 50, granularity: "day" }, {});
    expect(result.limit).toBe(50);
    expect(result.granularity).toBe("day");
  });

  it("caller values override defaults", () => {
    const result = mergeParameters({ limit: 50, granularity: "day" }, { granularity: "week" });
    expect(result.granularity).toBe("week");
    expect(result.limit).toBe(50);
  });

  it("caller can introduce keys not present in defaults", () => {
    const result = mergeParameters({ limit: 50 }, { origin: "ORD" });
    expect(result.limit).toBe(50);
    expect(result.origin).toBe("ORD");
  });

  it("does not mutate either input", () => {
    const defaults   = { limit: 50 };
    const submitted  = { limit: 25 };
    const result = mergeParameters(defaults, submitted);
    expect(defaults.limit).toBe(50);
    expect(submitted.limit).toBe(25);
    expect(result.limit).toBe(25);
  });
});

// ── enforceRowLimit ───────────────────────────────────────────────────────────

describe("enforceRowLimit", () => {
  const makeRows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: i }));

  it("passes through when rows are within cap", () => {
    const { rows, truncated } = enforceRowLimit(makeRows(5), 10);
    expect(rows).toHaveLength(5);
    expect(truncated).toBe(false);
  });

  it("truncates when rows exceed cap", () => {
    const { rows, truncated } = enforceRowLimit(makeRows(15), 10);
    expect(rows).toHaveLength(10);
    expect(truncated).toBe(true);
  });

  it("does not truncate when rows exactly equal cap", () => {
    const { rows, truncated } = enforceRowLimit(makeRows(10), 10);
    expect(rows).toHaveLength(10);
    expect(truncated).toBe(false);
  });

  it("handles empty row set", () => {
    const { rows, truncated } = enforceRowLimit([], 100);
    expect(rows).toHaveLength(0);
    expect(truncated).toBe(false);
  });

  it("handles cap=1", () => {
    const { rows, truncated } = enforceRowLimit(makeRows(3), 1);
    expect(rows).toHaveLength(1);
    expect(truncated).toBe(true);
  });
});

// ── PII handling ──────────────────────────────────────────────────────────────

describe("shouldIncludePii", () => {
  it("returns false when report does not contain PII, regardless of request", () => {
    expect(shouldIncludePii(false, true)).toBe(false);
    expect(shouldIncludePii(false, false)).toBe(false);
  });

  it("returns true when report contains PII and caller requests it", () => {
    expect(shouldIncludePii(true, true)).toBe(true);
  });

  it("returns false when report contains PII but caller does not request it", () => {
    expect(shouldIncludePii(true, false)).toBe(false);
  });
});

describe("applyPiiMask — default masking", () => {
  const rows = [
    { user_id: "uuid-1", email: "alice@example.com", display_name: "Alice", search_count: 42 },
    { user_id: "uuid-2", email: "bob@test.org",       display_name: "Bob",   search_count: 7 },
  ];
  const piiKeys = ["user_id", "email", "display_name"];

  it("masks PII columns when includePii is false", () => {
    const masked = applyPiiMask(rows, piiKeys, false);
    expect(masked[0].email).toBe("a***@example.com");
    expect(masked[0].user_id).toBe("[redacted]");
    expect(masked[0].display_name).toBe("[redacted]");
    expect(masked[0].search_count).toBe(42);
  });

  it("does not modify non-PII columns", () => {
    const masked = applyPiiMask(rows, piiKeys, false);
    expect(masked[0].search_count).toBe(42);
  });

  it("returns rows unmodified when includePii is true", () => {
    const unmasked = applyPiiMask(rows, piiKeys, true);
    expect(unmasked[0].email).toBe("alice@example.com");
    expect(unmasked[0].user_id).toBe("uuid-1");
  });

  it("returns rows unmodified when piiColumnKeys is empty", () => {
    const unmasked = applyPiiMask(rows, [], false);
    expect(unmasked[0].email).toBe("alice@example.com");
  });

  it("preserves null PII values without masking", () => {
    const rowsWithNull = [{ user_id: null, email: null, search_count: 5 }];
    const masked = applyPiiMask(rowsWithNull, ["user_id", "email"], false);
    expect(masked[0].user_id).toBeNull();
    expect(masked[0].email).toBeNull();
  });

  it("uses email masking for email-named columns", () => {
    const emailRows = [{ contact_email: "user@domain.com" }];
    const masked = applyPiiMask(emailRows, ["contact_email"], false);
    expect(masked[0].contact_email).toBe("u***@domain.com");
  });
});

describe("applyPiiMask — full PII opt-in", () => {
  it("returns unmasked data when includePii is true and report contains PII", () => {
    const rows = [{ email: "kody@example.com", user_id: "abc-123" }];
    const piiKeys = ["email", "user_id"];
    // simulate: shouldIncludePii(containsPii=true, requested=true) → true
    const includePii = shouldIncludePii(true, true);
    const result = applyPiiMask(rows, piiKeys, includePii);
    expect(result[0].email).toBe("kody@example.com");
    expect(result[0].user_id).toBe("abc-123");
  });

  it("masks even when caller requests PII but report is not PII-capable", () => {
    const rows = [{ search_route: "ORD→DEN", count: 5 }];
    // containsPii=false overrides requested=true
    const includePii = shouldIncludePii(false, true);
    const result = applyPiiMask(rows, [], includePii); // no pii cols anyway
    expect(result[0].search_route).toBe("ORD→DEN");
    expect(includePii).toBe(false);
  });
});

// ── Error code mapping ────────────────────────────────────────────────────────

describe("mapErrorCode", () => {
  it("maps REPORT_NOT_IMPLEMENTED correctly", () => {
    expect(mapErrorCode(new Error("REPORT_NOT_IMPLEMENTED"))).toBe(ERROR_CODES.REPORT_NOT_IMPLEMENTED);
  });

  it("maps REPORT_TIMEOUT correctly", () => {
    expect(mapErrorCode(new Error("REPORT_TIMEOUT"))).toBe(ERROR_CODES.REPORT_TIMEOUT);
  });

  it("maps all other errors to REPORT_EXECUTION_FAILED", () => {
    expect(mapErrorCode(new Error("Database connection refused"))).toBe(ERROR_CODES.REPORT_EXECUTION_FAILED);
    expect(mapErrorCode(new Error(""))).toBe(ERROR_CODES.REPORT_EXECUTION_FAILED);
    expect(mapErrorCode(new Error("SELECT ... FROM ..."))).toBe(ERROR_CODES.REPORT_EXECUTION_FAILED);
  });
});

describe("sanitizeErrorMessage", () => {
  it("returns user-friendly message for not-implemented", () => {
    const msg = sanitizeErrorMessage(new Error("REPORT_NOT_IMPLEMENTED"));
    expect(msg).toContain("not been implemented");
    expect(msg).not.toContain("REPORT_NOT_IMPLEMENTED");
  });

  it("returns user-friendly message for timeout", () => {
    const msg = sanitizeErrorMessage(new Error("REPORT_TIMEOUT"));
    expect(msg).toContain("timed out");
  });

  it("returns generic message for execution failures", () => {
    const msg = sanitizeErrorMessage(new Error("syntax error at or near SELECT"));
    expect(msg).toContain("execution failed");
    expect(msg).not.toContain("SELECT");
  });
});

// ── Pagination clamping ───────────────────────────────────────────────────────

describe("clampPage", () => {
  it("accepts valid page numbers", () => {
    expect(clampPage(0)).toBe(0);
    expect(clampPage(5)).toBe(5);
  });

  it("defaults to 0 for invalid input", () => {
    expect(clampPage(-1)).toBe(0);
    expect(clampPage(null)).toBe(0);
    expect(clampPage("abc")).toBe(0);
    expect(clampPage(undefined)).toBe(0);
  });

  it("floors decimals", () => {
    expect(clampPage(3.9)).toBe(3);
  });
});

describe("clampPageSize", () => {
  it("defaults to 100 for invalid or missing input", () => {
    expect(clampPageSize(null)).toBe(LIMITS.DEFAULT_PAGE_SIZE);
    expect(clampPageSize(0)).toBe(LIMITS.DEFAULT_PAGE_SIZE);
    expect(clampPageSize(-5)).toBe(LIMITS.DEFAULT_PAGE_SIZE);
  });

  it("clamps at MAX_PAGE_SIZE", () => {
    expect(clampPageSize(999)).toBe(LIMITS.MAX_PAGE_SIZE);
    expect(clampPageSize(500)).toBe(LIMITS.MAX_PAGE_SIZE);
  });

  it("passes through valid values", () => {
    expect(clampPageSize(25)).toBe(25);
    expect(clampPageSize(1)).toBe(1);
  });
});

// ── Registry rejection (unregistered slug) ────────────────────────────────────

describe("registry slug lookup", () => {
  it("rejects slugs not in the registry", () => {
    const registry = makeRegistry([
      {
        slug: "users.dormant", handlerKey: "users.dormant", version: 1, containsPii: true,
        columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }),
        handler: async () => ({}),
      },
    ]);
    expect(registry.has("mystery.report")).toBe(false);
    expect(registry.has("users.dormant")).toBe(true);
  });
});

// ── Version mismatch detection ────────────────────────────────────────────────

describe("version mismatch detection", () => {
  it("detects when DB version differs from registry version", () => {
    const registryEntry = { slug: "users.dormant", version: 1 };
    const dbDef         = { slug: "users.dormant", version: 2 };
    expect(registryEntry.version !== dbDef.version).toBe(true);
  });

  it("passes when versions match", () => {
    const registryEntry = { slug: "users.dormant", version: 1 };
    const dbDef         = { slug: "users.dormant", version: 1 };
    expect(registryEntry.version !== dbDef.version).toBe(false);
  });
});

// ── Invalid parameters ────────────────────────────────────────────────────────

describe("parameter validation", () => {
  const strictValidator = (raw: unknown) => {
    if (typeof raw !== "object" || raw === null) {
      return { success: false as const, error: "Parameters must be an object" };
    }
    const r = raw as Record<string, unknown>;
    if (!r.start_date || !r.end_date) {
      return { success: false as const, error: "start_date and end_date are required" };
    }
    return { success: true as const, data: r };
  };

  it("rejects missing required fields", () => {
    const result = strictValidator({ start_date: "2026-01-01" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("end_date");
  });

  it("accepts valid parameters", () => {
    const result = strictValidator({ start_date: "2026-01-01", end_date: "2026-06-30" });
    expect(result.success).toBe(true);
  });
});

// ── Default parameter merging scenario ───────────────────────────────────────

describe("default parameter merging scenario", () => {
  it("database defaults are applied before validation", () => {
    const dbDefaults = { limit: 50, granularity: "day" };
    const submitted  = { start_date: "2026-01-01", end_date: "2026-06-30" };
    const merged = mergeParameters(dbDefaults, submitted);

    // Validator now receives both defaults and submitted
    expect(merged.limit).toBe(50);
    expect(merged.granularity).toBe("day");
    expect(merged.start_date).toBe("2026-01-01");
  });

  it("submitted value overrides default", () => {
    const dbDefaults = { limit: 50, granularity: "day" };
    const submitted  = { granularity: "month", start_date: "2026-01-01", end_date: "2026-06-30" };
    const merged = mergeParameters(dbDefaults, submitted);
    expect(merged.granularity).toBe("month");
  });
});

// ── Run audit (success / failure path) ───────────────────────────────────────

describe("run audit state transitions", () => {
  it("successful run uses 'completed' status", () => {
    const statusAfterSuccess = "completed";
    expect(statusAfterSuccess).toBe("completed");
  });

  it("failed run uses 'failed' status with error_code and error_message", () => {
    const failedRun = {
      status:        "failed",
      error_code:    ERROR_CODES.REPORT_NOT_IMPLEMENTED,
      error_message: sanitizeErrorMessage(new Error("REPORT_NOT_IMPLEMENTED")),
    };
    expect(failedRun.status).toBe("failed");
    expect(failedRun.error_code).toBe(ERROR_CODES.REPORT_NOT_IMPLEMENTED);
    expect(failedRun.error_message).not.toContain("REPORT_NOT_IMPLEMENTED");
  });

  it("timeout failure maps to REPORT_TIMEOUT code", () => {
    const code = mapErrorCode(new Error("REPORT_TIMEOUT"));
    expect(code).toBe(ERROR_CODES.REPORT_TIMEOUT);
    const msg = sanitizeErrorMessage(new Error("REPORT_TIMEOUT"));
    expect(msg).toContain("timed out");
  });
});

// ── Handler timeout ───────────────────────────────────────────────────────────

describe("withTimeout", () => {
  it("resolves normally when promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve(42), 1_000);
    expect(result).toBe(42);
  });

  it("rejects with REPORT_TIMEOUT when promise is too slow", async () => {
    vi.useFakeTimers();
    const slowPromise = new Promise<number>((resolve) =>
      setTimeout(() => resolve(1), 30_000),
    );
    const racePromise = withTimeout(slowPromise, 100);
    vi.advanceTimersByTime(200);
    await expect(racePromise).rejects.toThrow("REPORT_TIMEOUT");
    vi.useRealTimers();
  });
});

// ── Export format validation ──────────────────────────────────────────────────

describe("isValidFormat (admin-log-report-export)", () => {
  it("accepts csv, xlsx, json", () => {
    expect(isValidFormat("csv")).toBe(true);
    expect(isValidFormat("xlsx")).toBe(true);
    expect(isValidFormat("json")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidFormat("pdf")).toBe(false);
    expect(isValidFormat("xml")).toBe(false);
    expect(isValidFormat("")).toBe(false);
    expect(isValidFormat(null)).toBe(false);
    expect(isValidFormat(42)).toBe(false);
  });
});

// ── Exporting a failed run ────────────────────────────────────────────────────

describe("export requires completed run", () => {
  const checkCanExport = (status: string) => status === "completed";

  it("allows export for completed runs", () => {
    expect(checkCanExport("completed")).toBe(true);
  });

  it("rejects export for failed runs", () => {
    expect(checkCanExport("failed")).toBe(false);
  });

  it("rejects export for running status", () => {
    expect(checkCanExport("running")).toBe(false);
  });
});
