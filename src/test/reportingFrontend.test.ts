/**
 * Tests for the Admin Reporting frontend layer:
 *   - adminReporting service: response unwrapping, error classification
 *   - reportingFormatters: all column types, edge cases, null/invalid values
 *
 * The hooks are thin orchestration wrappers around the service and TanStack
 * Query; their behavior (caching, invalidation, race-condition guard) is
 * documented and integration-tested end-to-end rather than unit-tested here
 * to avoid duplicating TanStack Query's own test suite.
 *
 * Race-condition prevention:
 *   The sequence-counter approach in useRunReport is validated via a pure
 *   helper test that simulates two concurrent calls returning out of order.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Supabase client (mirrors pattern in flightSearchShares.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────
// Imports under test
// ─────────────────────────────────────────────────────────────────────────────

import {
  listReports,
  runReport,
  listReportRuns,
  logReportExport,
} from "@/services/adminReporting";

import { AdminReportingError } from "@/components/admin/reporting/reportingTypes";

import {
  formatNumber,
  formatPercent,
  formatCurrency,
  formatDate,
  formatDatetime,
  formatDuration,
  formatBoolean,
  formatText,
  formatCell,
  NULL_DISPLAY,
} from "@/components/admin/reporting/reportingFormatters";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

function successEnvelope<T>(data: T) {
  return { data: { success: true, data }, error: null };
}

function errorEnvelope(code: string, message: string) {
  return { data: { success: false, error: { code, message } }, error: null };
}

function invokeError(msg: string) {
  return { data: null, error: new Error(msg) };
}

const sampleReportDefinition = {
  id:                 "def-uuid-1",
  slug:               "users.top-search-active",
  category:           "Users",
  name:               "Top Search-Active Users",
  description:        null,
  parameter_schema:   { fields: [] },
  default_parameters: {},
  output_config:      null,
  contains_pii:       false,
  version:            1,
};

const sampleReportResult = {
  report:       { slug: "users.top-search-active", name: "Top Search-Active Users", category: "Users", version: 1 },
  run_id:       "run-uuid-abc",
  generated_at: "2026-06-22T16:00:00Z",
  parameters:   { date_from: "2026-06-01", date_to: "2026-06-22" },
  summary:      [{ key: "total", label: "Total", value: 42, type: "number" }],
  columns:      [{ key: "user_id", label: "User", type: "text" }],
  rows:         [{ user_id: "uuid-1" }],
  pagination:   { page: 0, page_size: 100, total_rows: 1, truncated: false },
  duration_ms:  1234,
};

const sampleRun = {
  id:               "run-uuid-abc",
  report_slug:      "users.top-search-active",
  report_version:   1,
  report_name:      "Top Search-Active Users",
  report_category:  "Users",
  requested_by:     "admin-uuid",
  parameters:       {},
  status:           "completed",
  started_at:       "2026-06-22T16:00:00Z",
  completed_at:     "2026-06-22T16:00:01.234Z",
  duration_ms:      1234,
  row_count:        1,
  truncated:        false,
  error_code:       null,
  error_message:    null,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. adminReporting.listReports
// ─────────────────────────────────────────────────────────────────────────────

describe("adminReporting.listReports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unwraps the inner data on success", async () => {
    mockInvoke.mockResolvedValue(
      successEnvelope({ reports: [sampleReportDefinition], warnings: [], total: 1, excluded: 0 }),
    );
    const result = await listReports();
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].slug).toBe("users.top-search-active");
    expect(result.total).toBe(1);
    expect(result.excluded).toBe(0);
  });

  it("calls the correct Edge Function name", async () => {
    mockInvoke.mockResolvedValue(
      successEnvelope({ reports: [], warnings: [], total: 0, excluded: 0 }),
    );
    await listReports();
    expect(mockInvoke).toHaveBeenCalledWith("admin-list-reports", expect.any(Object));
  });

  it("throws UNAUTHENTICATED for 401-style invocation error", async () => {
    mockInvoke.mockResolvedValue(invokeError("Unauthorized"));
    const err = await listReports().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
    expect((err as AdminReportingError).kind).toBe("UNAUTHENTICATED");
  });

  it("throws FORBIDDEN when the Edge Function returns FORBIDDEN code", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("FORBIDDEN", "Forbidden"));
    const err = await listReports().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
    expect((err as AdminReportingError).kind).toBe("FORBIDDEN");
  });

  it("throws NETWORK for network/connection errors", async () => {
    mockInvoke.mockResolvedValue(invokeError("Failed to fetch"));
    const err = await listReports().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
    expect((err as AdminReportingError).kind).toBe("NETWORK");
  });

  it("throws SERVER_ERROR for generic Edge Function errors", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("DB_ERROR", "Database unavailable"));
    const err = await listReports().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
    expect((err as AdminReportingError).kind).toBe("SERVER_ERROR");
  });

  it("throws INVALID_RESPONSE when the response shape is not a success envelope", async () => {
    mockInvoke.mockResolvedValue({ data: { completely: "unexpected" }, error: null });
    const err = await listReports().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
    expect((err as AdminReportingError).kind).toBe("INVALID_RESPONSE");
  });

  it("throws INVALID_RESPONSE when data is null and error is null", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const err = await listReports().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
    expect((err as AdminReportingError).kind).toBe("INVALID_RESPONSE");
  });

  it("never exposes raw Supabase invoke errors directly (always AdminReportingError)", async () => {
    const rawError = new Error("supabase internal error");
    mockInvoke.mockResolvedValue({ data: null, error: rawError });
    const err = await listReports().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
    expect(err).not.toBe(rawError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. adminReporting.runReport
// ─────────────────────────────────────────────────────────────────────────────

describe("adminReporting.runReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unwraps the execution result on success", async () => {
    mockInvoke.mockResolvedValue(successEnvelope(sampleReportResult));
    const result = await runReport("users.top-search-active", { date_from: "2026-06-01", date_to: "2026-06-22" });
    expect(result.run_id).toBe("run-uuid-abc");
    expect(result.rows).toHaveLength(1);
    expect(result.duration_ms).toBe(1234);
  });

  it("sends the correct slug, parameters, and pagination to the Edge Function", async () => {
    mockInvoke.mockResolvedValue(successEnvelope(sampleReportResult));
    await runReport("my.report", { start: "2026-01-01" }, { page: 1, page_size: 50 });
    expect(mockInvoke).toHaveBeenCalledWith(
      "admin-run-report",
      expect.objectContaining({
        body: expect.objectContaining({
          report:    "my.report",
          parameters: { start: "2026-01-01" },
          page:       1,
          page_size:  50,
        }),
      }),
    );
  });

  it("defaults to page 0 and page_size 100 when not specified", async () => {
    mockInvoke.mockResolvedValue(successEnvelope(sampleReportResult));
    await runReport("my.report", {});
    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.page).toBe(0);
    expect(opts.body.page_size).toBe(100);
  });

  it("throws REPORT_NOT_FOUND when slug is not registered", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("REPORT_NOT_FOUND", "No registered handler"));
    const err = await runReport("unknown.slug", {}).catch((e) => e);
    expect((err as AdminReportingError).kind).toBe("REPORT_NOT_FOUND");
  });

  it("throws VALIDATION for parameter validation errors", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("PARAMETER_VALIDATION_ERROR", "date_from is required"));
    const err = await runReport("users.top-search-active", {}).catch((e) => e);
    expect((err as AdminReportingError).kind).toBe("VALIDATION");
  });

  it("throws REPORT_TIMEOUT when the handler times out", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("HANDLER_TIMEOUT", "Report exceeded 14s limit"));
    const err = await runReport("searches.volume-over-time", { date_from: "2020-01-01", date_to: "2026-01-01" }).catch((e) => e);
    expect((err as AdminReportingError).kind).toBe("REPORT_TIMEOUT");
  });

  it("throws VERSION_MISMATCH when registry and database versions differ", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("VERSION_MISMATCH", "version mismatch"));
    const err = await runReport("users.top-search-active", {}).catch((e) => e);
    expect((err as AdminReportingError).kind).toBe("VERSION_MISMATCH");
  });

  it("throws UNAUTHENTICATED on 401-style application error", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("HTTP_401", "Unauthorized"));
    const err = await runReport("users.top-search-active", {}).catch((e) => e);
    expect((err as AdminReportingError).kind).toBe("UNAUTHENTICATED");
  });

  it("preserves error code on AdminReportingError", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("HANDLER_TIMEOUT", "timed out"));
    const err = await runReport("users.top-search-active", {}).catch((e) => e);
    expect((err as AdminReportingError).code).toBe("HANDLER_TIMEOUT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. adminReporting.listReportRuns
// ─────────────────────────────────────────────────────────────────────────────

describe("adminReporting.listReportRuns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unwraps the runs list on success", async () => {
    mockInvoke.mockResolvedValue(
      successEnvelope({ runs: [sampleRun], total: 1, page: 0, page_size: 25 }),
    );
    const result = await listReportRuns();
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].id).toBe("run-uuid-abc");
    expect(result.total).toBe(1);
  });

  it("passes slug and status filters through to the Edge Function", async () => {
    mockInvoke.mockResolvedValue(
      successEnvelope({ runs: [], total: 0, page: 0, page_size: 25 }),
    );
    await listReportRuns({ slug: "users.top-search-active", status: "completed" });
    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.slug).toBe("users.top-search-active");
    expect(opts.body.status).toBe("completed");
  });

  it("sends an empty body when no filters are provided", async () => {
    mockInvoke.mockResolvedValue(
      successEnvelope({ runs: [], total: 0, page: 0, page_size: 25 }),
    );
    await listReportRuns();
    expect(mockInvoke).toHaveBeenCalledWith(
      "admin-list-report-runs",
      expect.objectContaining({ body: {} }),
    );
  });

  it("throws AdminReportingError on error — not a raw error", async () => {
    mockInvoke.mockResolvedValue(invokeError("network failure"));
    const err = await listReportRuns().catch((e) => e);
    expect(err).toBeInstanceOf(AdminReportingError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. adminReporting.logReportExport
// ─────────────────────────────────────────────────────────────────────────────

describe("adminReporting.logReportExport", () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleExport = {
    id:            "export-uuid-1",
    report_run_id: "run-uuid-abc",
    report_slug:   "users.top-search-active",
    requested_by:  "admin-uuid",
    format:        "csv",
    row_count:     42,
    created_at:    "2026-06-22T16:05:00Z",
  };

  it("returns the export record on success", async () => {
    mockInvoke.mockResolvedValue(successEnvelope({ export: sampleExport }));
    const result = await logReportExport({
      run_id:    "run-uuid-abc",
      format:    "csv",
      row_count: 42,
    });
    expect(result.id).toBe("export-uuid-1");
    expect(result.format).toBe("csv");
    expect(result.row_count).toBe(42);
  });

  it("sends run_id, format, and row_count to the Edge Function", async () => {
    mockInvoke.mockResolvedValue(successEnvelope({ export: sampleExport }));
    await logReportExport({ run_id: "run-uuid-abc", format: "xlsx", row_count: 100 });
    const [fnName, opts] = mockInvoke.mock.calls[0];
    expect(fnName).toBe("admin-log-report-export");
    expect(opts.body.run_id).toBe("run-uuid-abc");
    expect(opts.body.format).toBe("xlsx");
    expect(opts.body.row_count).toBe(100);
  });

  it("throws REPORT_NOT_FOUND when run_id is not found", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("REPORT_NOT_FOUND", "run not found"));
    const err = await logReportExport({ run_id: "bad-id", format: "csv", row_count: 0 }).catch((e) => e);
    expect((err as AdminReportingError).kind).toBe("REPORT_NOT_FOUND");
  });

  it("throws VALIDATION when format is invalid", async () => {
    mockInvoke.mockResolvedValue(errorEnvelope("INVALID_REQUEST", "format must be one of: csv, xlsx, json"));
    const err = await logReportExport({ run_id: "run-uuid-abc", format: "csv", row_count: 0 }).catch((e) => e);
    expect((err as AdminReportingError).kind).toBe("VALIDATION");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. formatNumber
// ─────────────────────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("formats an integer with no decimal", () =>
    expect(formatNumber(1000)).toBe("1,000"));

  it("formats a decimal number with up to 2 places", () =>
    expect(formatNumber(1234.5)).toBe("1,234.5"));

  it("formats a decimal rounding to 2 places", () =>
    expect(formatNumber(1234.567)).toBe("1,234.57"));

  it("formats 0", () => expect(formatNumber(0)).toBe("0"));

  it("formats negative numbers", () =>
    expect(formatNumber(-42)).toBe("-42"));

  it("formats a number passed as a string", () =>
    expect(formatNumber("999")).toBe("999"));

  it("returns NULL_DISPLAY for null", () =>
    expect(formatNumber(null)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for undefined", () =>
    expect(formatNumber(undefined)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for NaN", () =>
    expect(formatNumber(NaN)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for Infinity", () =>
    expect(formatNumber(Infinity)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for a non-numeric string", () =>
    expect(formatNumber("not a number")).toBe(NULL_DISPLAY));

  it("formats large numbers with thousands separators", () =>
    expect(formatNumber(1_000_000)).toBe("1,000,000"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. formatPercent
// ─────────────────────────────────────────────────────────────────────────────

describe("formatPercent", () => {
  it("formats 87.5 as 87.5%", () =>
    expect(formatPercent(87.5)).toBe("87.5%"));

  it("formats 100 as 100%", () =>
    expect(formatPercent(100)).toBe("100%"));

  it("formats 0 as 0%", () =>
    expect(formatPercent(0)).toBe("0%"));

  it("does not multiply by 100 (input is already a 0–100 value)", () => {
    const result = formatPercent(50);
    expect(result).toBe("50%");
    expect(result).not.toBe("5,000%");
  });

  it("rounds to 1 decimal place", () =>
    expect(formatPercent(87.456)).toBe("87.5%"));

  it("returns NULL_DISPLAY for null", () =>
    expect(formatPercent(null)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for undefined", () =>
    expect(formatPercent(undefined)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for NaN", () =>
    expect(formatPercent(NaN)).toBe(NULL_DISPLAY));

  it("formats values passed as numeric strings", () =>
    expect(formatPercent("42.7")).toBe("42.7%"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. formatCurrency
// ─────────────────────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats a USD value with dollar sign and 2 decimals", () =>
    expect(formatCurrency(199.5)).toBe("$199.50"));

  it("formats a whole number with .00", () =>
    expect(formatCurrency(200)).toBe("$200.00"));

  it("formats 0 as $0.00", () =>
    expect(formatCurrency(0)).toBe("$0.00"));

  it("formats negative values", () =>
    expect(formatCurrency(-50)).toBe("-$50.00"));

  it("defaults to USD when no currency is provided", () => {
    expect(formatCurrency(10)).toContain("$");
  });

  it("returns NULL_DISPLAY for null", () =>
    expect(formatCurrency(null)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for undefined", () =>
    expect(formatCurrency(undefined)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for NaN", () =>
    expect(formatCurrency(NaN)).toBe(NULL_DISPLAY));

  it("formats a string number as currency", () =>
    expect(formatCurrency("99.99")).toBe("$99.99"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. formatDate
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a YYYY-MM-DD string", () => {
    const result = formatDate("2026-06-22");
    expect(result).toContain("2026");
    expect(result).toContain("Jun");
    expect(result).toContain("22");
  });

  it("returns NULL_DISPLAY for null", () =>
    expect(formatDate(null)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for undefined", () =>
    expect(formatDate(undefined)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for empty string", () =>
    expect(formatDate("")).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for a non-date string", () =>
    expect(formatDate("not a date")).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for a garbage numeric string", () =>
    expect(formatDate("99999-99-99")).toBe(NULL_DISPLAY));

  it("handles ISO datetime strings by rendering the date portion", () => {
    const result = formatDate("2026-06-22T14:30:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("Jun");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. formatDatetime
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDatetime", () => {
  it("formats a UTC ISO string and includes year, month, day, hour, minute", () => {
    const result = formatDatetime("2026-06-22T14:30:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("Jun");
    expect(result).toContain("22");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("returns NULL_DISPLAY for null", () =>
    expect(formatDatetime(null)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for undefined", () =>
    expect(formatDatetime(undefined)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for empty string", () =>
    expect(formatDatetime("")).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for an invalid date string", () =>
    expect(formatDatetime("not-a-date")).toBe(NULL_DISPLAY));

  it("accepts a numeric timestamp (milliseconds since epoch)", () => {
    const ts     = Date.UTC(2026, 5, 22, 14, 30, 0); // June 22, 2026 14:30 UTC
    const result = formatDatetime(ts);
    expect(result).toContain("2026");
    expect(result).toContain("Jun");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. formatDuration
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats sub-second duration as Xms", () =>
    expect(formatDuration(250)).toBe("250ms"));

  it("rounds sub-second values to nearest ms", () =>
    expect(formatDuration(0)).toBe("0ms"));

  it("formats 1000ms as 1.0s", () =>
    expect(formatDuration(1000)).toBe("1.0s"));

  it("formats 3500ms as 3.5s", () =>
    expect(formatDuration(3500)).toBe("3.5s"));

  it("formats 59999ms as 60.0s", () =>
    expect(formatDuration(59_999)).toBe("60.0s"));

  it("formats 60000ms as 1m", () =>
    expect(formatDuration(60_000)).toBe("1m"));

  it("formats 90000ms as 1m 30s", () =>
    expect(formatDuration(90_000)).toBe("1m 30s"));

  it("formats 120000ms as 2m (no trailing 0s)", () =>
    expect(formatDuration(120_000)).toBe("2m"));

  it("formats 14000ms as 14.0s (default report timeout boundary)", () =>
    expect(formatDuration(14_000)).toBe("14.0s"));

  it("returns NULL_DISPLAY for null", () =>
    expect(formatDuration(null)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for undefined", () =>
    expect(formatDuration(undefined)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for negative values", () =>
    expect(formatDuration(-1)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for NaN", () =>
    expect(formatDuration(NaN)).toBe(NULL_DISPLAY));

  it("formats a string number", () =>
    expect(formatDuration("2000")).toBe("2.0s"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. formatBoolean
// ─────────────────────────────────────────────────────────────────────────────

describe("formatBoolean", () => {
  it("formats true as Yes", () => expect(formatBoolean(true)).toBe("Yes"));
  it("formats false as No",  () => expect(formatBoolean(false)).toBe("No"));
  it("formats string 'true' as Yes",  () => expect(formatBoolean("true")).toBe("Yes"));
  it("formats string 'false' as No",  () => expect(formatBoolean("false")).toBe("No"));
  it("returns NULL_DISPLAY for null",      () => expect(formatBoolean(null)).toBe(NULL_DISPLAY));
  it("returns NULL_DISPLAY for undefined", () => expect(formatBoolean(undefined)).toBe(NULL_DISPLAY));
  it("returns NULL_DISPLAY for 1 (not boolean)", () => expect(formatBoolean(1)).toBe(NULL_DISPLAY));
  it("returns NULL_DISPLAY for 0 (not boolean)", () => expect(formatBoolean(0)).toBe(NULL_DISPLAY));
  it("returns NULL_DISPLAY for arbitrary string", () => expect(formatBoolean("yes")).toBe(NULL_DISPLAY));
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. formatText
// ─────────────────────────────────────────────────────────────────────────────

describe("formatText", () => {
  it("returns the string unchanged", () =>
    expect(formatText("hello")).toBe("hello"));

  it("returns NULL_DISPLAY for null", () =>
    expect(formatText(null)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for undefined", () =>
    expect(formatText(undefined)).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for an empty string", () =>
    expect(formatText("")).toBe(NULL_DISPLAY));

  it("returns NULL_DISPLAY for a whitespace-only string", () =>
    expect(formatText("   ")).toBe(NULL_DISPLAY));

  it("coerces numbers to strings", () =>
    expect(formatText(42)).toBe("42"));

  it("preserves leading/trailing spaces that are not all-whitespace", () =>
    expect(formatText(" hello ")).toBe(" hello "));
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. formatCell — dispatch correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("formatCell", () => {
  it("dispatches 'number' type", () =>
    expect(formatCell(1234, "number")).toBe("1,234"));

  it("dispatches 'percent' type", () =>
    expect(formatCell(75.5, "percent")).toBe("75.5%"));

  it("dispatches 'currency' type", () =>
    expect(formatCell(99.99, "currency")).toBe("$99.99"));

  it("dispatches 'date' type", () => {
    const result = formatCell("2026-06-22", "date");
    expect(result).toContain("2026");
  });

  it("dispatches 'datetime' type", () => {
    const result = formatCell("2026-06-22T14:30:00Z", "datetime");
    expect(result).toContain("2026");
  });

  it("dispatches 'duration' type", () =>
    expect(formatCell(3500, "duration")).toBe("3.5s"));

  it("dispatches 'boolean' type — true", () =>
    expect(formatCell(true, "boolean")).toBe("Yes"));

  it("dispatches 'boolean' type — false", () =>
    expect(formatCell(false, "boolean")).toBe("No"));

  it("dispatches 'text' type", () =>
    expect(formatCell("hello", "text")).toBe("hello"));

  it("defaults to text formatting for undefined type", () =>
    expect(formatCell("foo", undefined)).toBe("foo"));

  it("returns NULL_DISPLAY for null regardless of type", () => {
    for (const type of ["number", "percent", "currency", "date", "datetime", "duration", "boolean", "text"] as const) {
      expect(formatCell(null, type)).toBe(NULL_DISPLAY);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Race-condition prevention (pure logic test)
//
// The useRunReport hook uses a sequence counter to discard results from
// superseded runs. This test validates the pattern in isolation without a
// React context.
// ─────────────────────────────────────────────────────────────────────────────

describe("race-condition prevention — sequence counter pattern", () => {
  function makeSequencedRunner<T>(
    fn: (seq: number) => Promise<T>,
  ): {
    run: (delay: number) => Promise<T | null>;
    getLastAccepted: () => T | null;
  } {
    let counter = 0;
    let lastAccepted: T | null = null;

    return {
      run: async (delay: number): Promise<T | null> => {
        const mySeq = ++counter;
        await new Promise<void>((r) => setTimeout(r, delay));
        const result = await fn(mySeq);
        if (mySeq !== counter) return null; // superseded
        lastAccepted = result;
        return result;
      },
      getLastAccepted: () => lastAccepted,
    };
  }

  it("accepts only the most recently dispatched result when two runs overlap", async () => {
    const runner = makeSequencedRunner(async (seq) => `result-${seq}`);

    // Dispatch run 1 (slow), then run 2 (fast)
    const [r1, r2] = await Promise.all([
      runner.run(50),  // run 1: slow, dispatched first
      runner.run(10),  // run 2: fast, dispatched second
    ]);

    // run 2 finishes first and is accepted
    expect(r2).toBe("result-2");
    // run 1 finishes second and is discarded (superseded)
    expect(r1).toBeNull();
    // The accepted result is run 2's
    expect(runner.getLastAccepted()).toBe("result-2");
  });

  it("accepts a single run when there is no race", async () => {
    const runner = makeSequencedRunner(async (seq) => `solo-${seq}`);
    const result = await runner.run(0);
    expect(result).toBe("solo-1");
    expect(runner.getLastAccepted()).toBe("solo-1");
  });

  it("accepts the last of three concurrent runs", async () => {
    const runner = makeSequencedRunner(async (seq) => `result-${seq}`);

    const [r1, r2, r3] = await Promise.all([
      runner.run(60),  // slow
      runner.run(40),  // medium
      runner.run(10),  // fast — dispatched last
    ]);

    // Only run 3 (fastest dispatched, latest seq) is accepted
    expect(r3).toBe("result-3");
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(runner.getLastAccepted()).toBe("result-3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Run history invalidation (structural / documentation test)
//
// The invalidation behavior is TanStack Query's concern; here we verify that
// the service layer correctly translates the admin-log-report-export response
// so the hook has accurate data to work with.
// ─────────────────────────────────────────────────────────────────────────────

describe("run history invalidation — service contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logReportExport returns an export record with the run_id", async () => {
    mockInvoke.mockResolvedValue(
      successEnvelope({
        export: {
          id:            "exp-1",
          report_run_id: "run-abc",
          report_slug:   "users.top-search-active",
          requested_by:  "admin-uuid",
          format:        "csv",
          row_count:     5,
          created_at:    "2026-06-22T17:00:00Z",
        },
      }),
    );
    const record = await logReportExport({ run_id: "run-abc", format: "csv", row_count: 5 });
    // The hook uses this record's run_id to confirm the export was recorded
    // before triggering invalidation.
    expect(record.report_run_id).toBe("run-abc");
    expect(record.format).toBe("csv");
  });
});
