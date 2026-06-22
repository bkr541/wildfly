/**
 * Tests for ReportResultView components and export utilities.
 *
 * Pure-logic functions are tested directly. Components that depend on hooks
 * are tested with controlled props.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Recharts uses ResizeObserver which is not available in jsdom.
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe()    {}
    unobserve()  {}
    disconnect() {}
  };
});

// ── Pure-logic imports ──────────────────────────────────────────────────────────

import {
  sanitizeFormulaInjection,
  buildFilename,
  escapeCSVCell,
  buildFormattedRows,
  buildXLSXMetadata,
  buildJSONRows,
  performExport,
  getExportColumns,
} from "@/utils/adminReportExport";
import type { ExportOptions } from "@/utils/adminReportExport";

import {
  sortRows,
  buildDefaultVisibility,
  type SortConfig,
} from "@/components/admin/reporting/ReportResultTable";

import {
  isChartRenderable,
  toChartNumber,
} from "@/components/admin/reporting/ReportChart";

// ── Component imports ───────────────────────────────────────────────────────────

import { ReportResultTable }  from "@/components/admin/reporting/ReportResultTable";
import { ReportSummaryCards } from "@/components/admin/reporting/ReportSummaryCards";
import { ReportChart }        from "@/components/admin/reporting/ReportChart";
import { ReportPagination }   from "@/components/admin/reporting/ReportPagination";
import { ReportFilterSummary } from "@/components/admin/reporting/ReportFilterSummary";

import type {
  ReportColumn,
  ReportRow,
  ReportChart as ReportChartConfig,
  ReportPagination as PaginationMeta,
  ReportResult,
  ReportDefinition,
  ReportSummaryMetric,
} from "@/components/admin/reporting/reportingTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeColumn(overrides: Partial<ReportColumn> = {}): ReportColumn {
  return { key: "col", label: "Column", type: "text", ...overrides };
}

function makePagination(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return {
    page:       1,
    page_size:  100,
    total_rows: 250,
    truncated:  false,
    ...overrides,
  };
}

function makeResult(overrides: Partial<ReportResult> = {}): ReportResult {
  return {
    report:       { slug: "test.report", name: "Test Report", category: "Operations", version: 1 },
    run_id:       "run-123",
    generated_at: "2026-06-22T10:00:00Z",
    parameters:   { date_from: "2026-01-01" },
    summary:      [],
    columns:      [makeColumn({ key: "name", label: "Name", type: "text" })],
    rows:         [{ name: "Alice" }, { name: "Bob" }],
    pagination:   makePagination(),
    duration_ms:  1234,
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<ReportDefinition> = {}): ReportDefinition {
  return {
    id:                 "abc",
    slug:               "test.report",
    category:           "Operations",
    name:               "Test Report",
    description:        null,
    parameter_schema:   { fields: [] },
    default_parameters: {},
    output_config:      {},
    contains_pii:       false,
    version:            1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeFormulaInjection
// ─────────────────────────────────────────────────────────────────────────────

describe("sanitizeFormulaInjection", () => {
  it("prefixes = with single quote", () => {
    expect(sanitizeFormulaInjection("=SUM(A1)")).toBe("'=SUM(A1)");
  });

  it("prefixes + with single quote", () => {
    expect(sanitizeFormulaInjection("+1-2")).toBe("'+1-2");
  });

  it("prefixes - with single quote", () => {
    expect(sanitizeFormulaInjection("-123")).toBe("'-123");
  });

  it("prefixes @ with single quote", () => {
    expect(sanitizeFormulaInjection("@user")).toBe("'@user");
  });

  it("does not alter safe strings", () => {
    expect(sanitizeFormulaInjection("hello")).toBe("hello");
    expect(sanitizeFormulaInjection("SUM(A1)")).toBe("SUM(A1)");
    expect(sanitizeFormulaInjection("100")).toBe("100");
  });

  it("does not alter empty string", () => {
    expect(sanitizeFormulaInjection("")).toBe("");
  });

  it("only checks the first character", () => {
    // An = in the middle is not dangerous
    expect(sanitizeFormulaInjection("a=b")).toBe("a=b");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFilename
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFilename", () => {
  it("replaces dots with hyphens in the slug", () => {
    const name = buildFilename("gowild.route-reliability", "csv");
    expect(name).toContain("gowild-route-reliability");
  });

  it("uses the correct extension", () => {
    expect(buildFilename("test.report", "xlsx")).toMatch(/\.xlsx$/);
    expect(buildFilename("test.report", "csv")).toMatch(/\.csv$/);
    expect(buildFilename("test.report", "json")).toMatch(/\.json$/);
  });

  it("matches expected pattern", () => {
    const name = buildFilename("ops.summary", "csv");
    expect(name).toMatch(/^wildfly-report_ops-summary_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// escapeCSVCell
// ─────────────────────────────────────────────────────────────────────────────

describe("escapeCSVCell", () => {
  it("wraps values with commas in double quotes", () => {
    expect(escapeCSVCell("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes by doubling them", () => {
    expect(escapeCSVCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps newlines in double quotes", () => {
    expect(escapeCSVCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves safe values unchanged", () => {
    expect(escapeCSVCell("hello")).toBe("hello");
    expect(escapeCSVCell("12345")).toBe("12345");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getExportColumns
// ─────────────────────────────────────────────────────────────────────────────

describe("getExportColumns", () => {
  const cols: ReportColumn[] = [
    makeColumn({ key: "a", label: "A" }),
    makeColumn({ key: "b", label: "B", hiddenByDefault: true }),
    makeColumn({ key: "c", label: "C" }),
  ];

  it("excludes hidden columns by default", () => {
    const visible = getExportColumns(cols, {});
    expect(visible.map((c) => c.key)).toEqual(["a", "c"]);
  });

  it("includes hidden columns when includeHiddenColumns=true", () => {
    const all = getExportColumns(cols, { includeHiddenColumns: true });
    expect(all.map((c) => c.key)).toEqual(["a", "b", "c"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFormattedRows
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFormattedRows", () => {
  const columns: ReportColumn[] = [
    makeColumn({ key: "name",   label: "Name",   type: "text" }),
    makeColumn({ key: "score",  label: "Score",  type: "percent" }),
    makeColumn({ key: "debug",  label: "Debug",  type: "text", hiddenByDefault: true }),
  ];

  const rows: ReportRow[] = [
    { name: "Alice",  score: 87.5, debug: "internal" },
    { name: null,     score: 0,    debug: "x" },
    { name: "=HACK", score: 50,   debug: "y" },
  ];

  it("includes visible columns with formatted values", () => {
    const { headers, rows: out } = buildFormattedRows(
      makeResult({ columns, rows }),
      {},
    );
    expect(headers).toEqual(["Name", "Score"]);
    expect(out[0]["Score"]).toContain("%");
  });

  it("excludes hidden columns by default", () => {
    const { headers } = buildFormattedRows(makeResult({ columns, rows }), {});
    expect(headers).not.toContain("Debug");
  });

  it("includes hidden columns when requested", () => {
    const { headers } = buildFormattedRows(
      makeResult({ columns, rows }),
      { includeHiddenColumns: true },
    );
    expect(headers).toContain("Debug");
  });

  it("applies formula injection protection", () => {
    const { rows: out } = buildFormattedRows(makeResult({ columns, rows }), {});
    expect(out[2]["Name"]).toMatch(/^'=HACK/);
  });

  it("converts null cells to empty string (not NULL_DISPLAY sentinel)", () => {
    const { rows: out } = buildFormattedRows(makeResult({ columns, rows }), {});
    expect(out[1]["Name"]).toBe("");
  });

  it("preserves deterministic column order", () => {
    const { headers } = buildFormattedRows(makeResult({ columns, rows }), {});
    expect(headers[0]).toBe("Name");
    expect(headers[1]).toBe("Score");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildXLSXMetadata
// ─────────────────────────────────────────────────────────────────────────────

describe("buildXLSXMetadata", () => {
  it("includes required metadata fields", () => {
    const result = makeResult();
    const meta   = buildXLSXMetadata(result);
    expect(meta["Report Name"]).toBe("Test Report");
    expect(meta["Report Slug"]).toBe("test.report");
    expect(meta["Run ID"]).toBe("run-123");
    expect(meta["Row Count"]).toBe("2");
  });

  it("marks PII as No when include_pii is not set", () => {
    const result = makeResult({ parameters: {} });
    const meta   = buildXLSXMetadata(result);
    expect(meta["PII Included"]).toBe("No");
  });

  it("marks PII as Yes when include_pii=true", () => {
    const result = makeResult({ parameters: { include_pii: true } });
    const meta   = buildXLSXMetadata(result);
    expect(meta["PII Included"]).toBe("Yes");
  });

  it("marks PII as No when include_pii=false", () => {
    const result = makeResult({ parameters: { include_pii: false } });
    const meta   = buildXLSXMetadata(result);
    expect(meta["PII Included"]).toBe("No");
  });

  it("includes exported-at timestamp", () => {
    const meta = buildXLSXMetadata(makeResult());
    expect(meta["Exported At"]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("serialises parameters as JSON string", () => {
    const result = makeResult({ parameters: { date_from: "2026-01-01", limit: 100 } });
    const meta   = buildXLSXMetadata(result);
    const parsed = JSON.parse(meta["Parameters"]);
    expect(parsed.date_from).toBe("2026-01-01");
    expect(parsed.limit).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// performExport (audit integration)
// ─────────────────────────────────────────────────────────────────────────────

describe("performExport", () => {
  let blobArgs: unknown[];
  let originalCreateElement: typeof document.createElement;
  let mockClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    blobArgs = [];
    global.URL.createObjectURL = vi.fn(() => "blob://test");
    global.URL.revokeObjectURL = vi.fn();
    mockClick = vi.fn();
    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const a = originalCreateElement("a") as HTMLAnchorElement;
        a.click = mockClick;
        return a;
      }
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success: true when audit succeeds", async () => {
    const logAudit = vi.fn().mockResolvedValue({ id: "audit-1" });
    const result   = await performExport(makeResult(), "csv", {}, logAudit);
    expect(result).toEqual({ success: true });
    expect(logAudit).toHaveBeenCalledWith({
      run_id:    "run-123",
      format:    "csv",
      row_count: 2,
    });
  });

  it("returns auditFailed: true when audit throws", async () => {
    const logAudit = vi.fn().mockRejectedValue(new Error("network fail"));
    const result   = await performExport(makeResult(), "json", {}, logAudit);
    expect(result).toEqual({ success: false, auditFailed: true });
  });

  it("still calls logAudit with correct format and row_count for xlsx", async () => {
    // Mock XLSX.writeFile to avoid file-system write
    vi.stubGlobal(
      "XLSX",
      { utils: { json_to_sheet: vi.fn(() => ({})), book_new: vi.fn(() => ({})), book_append_sheet: vi.fn() }, writeFile: vi.fn() },
    );
    const logAudit = vi.fn().mockResolvedValue({});
    await performExport(makeResult(), "xlsx", {}, logAudit);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ format: "xlsx", row_count: 2 }),
    );
    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildJSONRows — raw values, no formula injection
// ─────────────────────────────────────────────────────────────────────────────

describe("buildJSONRows", () => {
  it("uses raw values (not formatted strings)", () => {
    const rows: ReportRow[] = [{ score: 87.5 }];
    const cols: ReportColumn[] = [makeColumn({ key: "score", label: "Score", type: "percent" })];
    const out = buildJSONRows(makeResult({ columns: cols, rows }), {});
    // Raw value should be 87.5 (not "87.5%")
    expect(out[0]["Score"]).toBe(87.5);
  });

  it("exports null as null (not empty string)", () => {
    const rows: ReportRow[] = [{ val: null }];
    const cols: ReportColumn[] = [makeColumn({ key: "val", label: "Value" })];
    const out = buildJSONRows(makeResult({ columns: cols, rows }), {});
    expect(out[0]["Value"]).toBeNull();
  });

  it("exports undefined as null", () => {
    const rows: ReportRow[] = [{ val: undefined }];
    const cols: ReportColumn[] = [makeColumn({ key: "val", label: "Value" })];
    const out = buildJSONRows(makeResult({ columns: cols, rows }), {});
    expect(out[0]["Value"]).toBeNull();
  });

  it("excludes hidden columns by default", () => {
    const cols: ReportColumn[] = [
      makeColumn({ key: "pub", label: "Public" }),
      makeColumn({ key: "prv", label: "Private", hiddenByDefault: true }),
    ];
    const rows: ReportRow[] = [{ pub: "a", prv: "b" }];
    const out = buildJSONRows(makeResult({ columns: cols, rows }), {});
    expect(Object.keys(out[0])).toContain("Public");
    expect(Object.keys(out[0])).not.toContain("Private");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CSV formula injection — verified through buildFormattedRows
// ─────────────────────────────────────────────────────────────────────────────

describe("exportToCSV formula injection (via buildFormattedRows)", () => {
  it("sanitizes formula-injection prefixes in CSV rows", () => {
    const cols: ReportColumn[] = [makeColumn({ key: "name", label: "Name" })];
    const rows: ReportRow[]    = [{ name: "=HYPERLINK(\"evil.com\")" }];
    const { rows: out } = buildFormattedRows(makeResult({ columns: cols, rows }), {});
    expect(out[0]["Name"]).toMatch(/^'=HYPERLINK/);
  });

  it("sanitizes + prefixes without breaking CSV escaping", () => {
    const cols: ReportColumn[] = [makeColumn({ key: "val", label: "Val" })];
    const rows: ReportRow[]    = [{ val: "=A,B" }];
    // After sanitization: "'=A,B". escapeCSVCell wraps it because it has a comma.
    const { rows: out } = buildFormattedRows(makeResult({ columns: cols, rows }), {});
    const rawCell = String(out[0]["Val"]);
    // The value passed to escapeCSVCell would be "'=A,B" — which contains a comma
    expect(escapeCSVCell(rawCell)).toMatch(/^"'=A,B"$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PII export behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("PII export behaviour", () => {
  const piicol = makeColumn({ key: "email", label: "Email", type: "text", pii: true });
  const safecol = makeColumn({ key: "name", label: "Name", type: "text" });

  it("exports masked value for PII column when include_pii was false in the run", () => {
    // The server returns masked value (e.g. "u***@example.com") when include_pii is false.
    // The export layer just exports whatever the server returned — no additional masking.
    const rows: ReportRow[] = [{ email: "u***@example.com", name: "Alice" }];
    const result = makeResult({
      columns:    [safecol, piicol],
      rows,
      parameters: { include_pii: false },
    });
    const { rows: out } = buildFormattedRows(result, {});
    expect(out[0]["Email"]).toBe("u***@example.com");
  });

  it("exports full PII when include_pii was true in the run", () => {
    const rows: ReportRow[] = [{ email: "alice@example.com", name: "Alice" }];
    const result = makeResult({
      columns:    [safecol, piicol],
      rows,
      parameters: { include_pii: true },
    });
    const { rows: out } = buildFormattedRows(result, {});
    expect(out[0]["Email"]).toBe("alice@example.com");
  });

  it("metadata notes PII=Yes when include_pii=true", () => {
    const result = makeResult({ parameters: { include_pii: true } });
    const meta   = buildXLSXMetadata(result);
    expect(meta["PII Included"]).toBe("Yes");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sortRows
// ─────────────────────────────────────────────────────────────────────────────

describe("sortRows", () => {
  const numCol = makeColumn({ key: "score", label: "Score", type: "number" });
  const txtCol = makeColumn({ key: "name",  label: "Name",  type: "text" });
  const pctCol = makeColumn({ key: "pct",   label: "Pct",   type: "percent" });

  it("sorts numbers ascending", () => {
    const rows: ReportRow[] = [{ score: 30 }, { score: 10 }, { score: 20 }];
    const sorted = sortRows(rows, numCol, { key: "score", direction: "asc" });
    expect(sorted.map((r) => r.score)).toEqual([10, 20, 30]);
  });

  it("sorts numbers descending", () => {
    const rows: ReportRow[] = [{ score: 30 }, { score: 10 }, { score: 20 }];
    const sorted = sortRows(rows, numCol, { key: "score", direction: "desc" });
    expect(sorted.map((r) => r.score)).toEqual([30, 20, 10]);
  });

  it("sorts strings ascending (case-sensitive localeCompare)", () => {
    const rows: ReportRow[] = [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }];
    const sorted = sortRows(rows, txtCol, { key: "name", direction: "asc" });
    expect(sorted.map((r) => r.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts strings descending", () => {
    const rows: ReportRow[] = [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }];
    const sorted = sortRows(rows, txtCol, { key: "name", direction: "desc" });
    expect(sorted.map((r) => r.name)).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("places nulls last regardless of direction (ascending)", () => {
    const rows: ReportRow[] = [{ score: null }, { score: 10 }, { score: null }];
    const sorted = sortRows(rows, numCol, { key: "score", direction: "asc" });
    const scores = sorted.map((r) => r.score);
    expect(scores[0]).toBe(10);
    expect(scores[1]).toBeNull();
    expect(scores[2]).toBeNull();
  });

  it("places nulls last in descending sort too", () => {
    const rows: ReportRow[] = [{ score: null }, { score: 50 }, { score: 5 }];
    const sorted = sortRows(rows, numCol, { key: "score", direction: "desc" });
    const scores = sorted.map((r) => r.score);
    expect(scores[0]).toBe(50);
    expect(scores[1]).toBe(5);
    expect(scores[2]).toBeNull();
  });

  it("places undefined last (same as null)", () => {
    const rows: ReportRow[] = [{ score: undefined }, { score: 99 }];
    const sorted = sortRows(rows, numCol, { key: "score", direction: "asc" });
    expect(sorted[0].score).toBe(99);
  });

  it("sorts percent column numerically", () => {
    const rows: ReportRow[] = [{ pct: 90 }, { pct: 10 }, { pct: 50 }];
    const sorted = sortRows(rows, pctCol, { key: "pct", direction: "asc" });
    expect(sorted.map((r) => r.pct)).toEqual([10, 50, 90]);
  });

  it("does not mutate the original array", () => {
    const rows: ReportRow[] = [{ score: 3 }, { score: 1 }];
    const orig = [...rows];
    sortRows(rows, numCol, { key: "score", direction: "asc" });
    expect(rows[0].score).toBe(orig[0].score);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildDefaultVisibility
// ─────────────────────────────────────────────────────────────────────────────

describe("buildDefaultVisibility", () => {
  it("includes non-hidden columns", () => {
    const cols = [makeColumn({ key: "a" }), makeColumn({ key: "b" })];
    const vis  = buildDefaultVisibility(cols);
    expect(vis.has("a")).toBe(true);
    expect(vis.has("b")).toBe(true);
  });

  it("excludes hidden-by-default columns", () => {
    const cols = [
      makeColumn({ key: "pub" }),
      makeColumn({ key: "dbg", hiddenByDefault: true }),
    ];
    const vis = buildDefaultVisibility(cols);
    expect(vis.has("pub")).toBe(true);
    expect(vis.has("dbg")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isChartRenderable
// ─────────────────────────────────────────────────────────────────────────────

describe("isChartRenderable", () => {
  const rows = [{ x: "a", y: 1 }];

  it("returns false when chart is undefined", () => {
    expect(isChartRenderable(undefined, rows)).toBe(false);
  });

  it("returns false when type is none", () => {
    expect(isChartRenderable({ type: "none" }, rows)).toBe(false);
  });

  it("returns false when rows are empty", () => {
    const chart: ReportChartConfig = {
      type: "line", xKey: "x", series: [{ key: "y", label: "Y" }],
    };
    expect(isChartRenderable(chart, [])).toBe(false);
  });

  it("returns false for line chart with no xKey", () => {
    const chart: ReportChartConfig = {
      type: "line", series: [{ key: "y", label: "Y" }],
    };
    expect(isChartRenderable(chart, rows)).toBe(false);
  });

  it("returns false for bar chart with no series", () => {
    const chart: ReportChartConfig = {
      type: "bar", xKey: "x", series: [],
    };
    expect(isChartRenderable(chart, rows)).toBe(false);
  });

  it("returns true for valid line chart", () => {
    const chart: ReportChartConfig = {
      type: "line", xKey: "x", series: [{ key: "y", label: "Y" }],
    };
    expect(isChartRenderable(chart, rows)).toBe(true);
  });

  it("returns true for valid bar chart", () => {
    const chart: ReportChartConfig = {
      type: "bar", xKey: "x", series: [{ key: "y", label: "Y" }],
    };
    expect(isChartRenderable(chart, rows)).toBe(true);
  });

  it("returns false for donut with no series", () => {
    expect(isChartRenderable({ type: "donut" }, rows)).toBe(false);
    expect(isChartRenderable({ type: "donut", series: [] }, rows)).toBe(false);
  });

  it("returns true for valid donut chart", () => {
    const chart: ReportChartConfig = {
      type: "donut", series: [{ key: "y", label: "Y" }],
    };
    expect(isChartRenderable(chart, rows)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toChartNumber
// ─────────────────────────────────────────────────────────────────────────────

describe("toChartNumber", () => {
  it("converts numeric strings", () => {
    expect(toChartNumber("42")).toBe(42);
    expect(toChartNumber("3.14")).toBe(3.14);
  });

  it("returns null for null/undefined", () => {
    expect(toChartNumber(null)).toBeNull();
    expect(toChartNumber(undefined)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(toChartNumber("abc")).toBeNull();
    expect(toChartNumber(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(toChartNumber(Infinity)).toBeNull();
    expect(toChartNumber(-Infinity)).toBeNull();
  });

  it("returns 0 for zero", () => {
    expect(toChartNumber(0)).toBe(0);
    expect(toChartNumber("0")).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportResultTable component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportResultTable component", () => {
  const cols: ReportColumn[] = [
    makeColumn({ key: "name",  label: "Name",  type: "text" }),
    makeColumn({ key: "score", label: "Score", type: "number" }),
    makeColumn({ key: "dbg",   label: "Debug", type: "text", hiddenByDefault: true }),
  ];

  const rows: ReportRow[] = [
    { name: "Alice", score: 90, dbg: "internal1" },
    { name: "Bob",   score: 70, dbg: "internal2" },
  ];

  it("renders visible column headers", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={false} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
  });

  it("hides debug columns by default", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={false} />);
    expect(screen.queryByText("Debug")).toBeNull();
  });

  it("shows row data", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows row count in toolbar", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={false} />);
    expect(screen.getByText(/2 rows/i)).toBeInTheDocument();
  });

  it("shows truncated badge when truncated=true", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={true} />);
    expect(screen.getByRole("alert", { name: "" })).toBeInTheDocument();
  });

  it("opens column menu when Columns button is clicked", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={false} />);
    fireEvent.click(screen.getByRole("button", { name: /show.hide columns/i }));
    expect(screen.getByRole("menu", { name: /column visibility/i })).toBeInTheDocument();
  });

  it("shows debug columns as unchecked in column menu", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={false} />);
    fireEvent.click(screen.getByRole("button", { name: /show.hide columns/i }));
    const debugItem = screen.getByRole("menuitemcheckbox", { name: /debug/i });
    expect(debugItem).toHaveAttribute("aria-checked", "false");
  });

  it("toggling a column shows/hides it", () => {
    render(<ReportResultTable columns={cols} rows={rows} truncated={false} />);
    fireEvent.click(screen.getByRole("button", { name: /show.hide columns/i }));
    const nameItem = screen.getByRole("menuitemcheckbox", { name: /^Name/i });
    fireEvent.click(nameItem);
    // Column menu closes; Name column should be hidden
    // (close menu to check main table)
    fireEvent.keyDown(document, { key: "Escape" });
    // Name header should be gone from the table
    expect(screen.queryByRole("columnheader", { name: /^Name$/i })).toBeNull();
  });

  it("renders empty-rows state when rows array is empty", () => {
    render(<ReportResultTable columns={cols} rows={[]} truncated={false} />);
    expect(screen.getByText(/no results matched/i)).toBeInTheDocument();
  });

  it("sorts by column on header click (asc then desc)", () => {
    const rows2: ReportRow[] = [
      { name: "Charlie", score: 30, dbg: "" },
      { name: "Alice",   score: 90, dbg: "" },
      { name: "Bob",     score: 70, dbg: "" },
    ];
    render(<ReportResultTable columns={cols} rows={rows2} truncated={false} />);
    // Click Name header to sort ascending
    fireEvent.click(screen.getByRole("button", { name: /^Name/i }));
    const cells = screen.getAllByRole("cell").filter((td) =>
      ["Alice", "Bob", "Charlie"].includes(td.textContent?.trim() ?? ""),
    );
    expect(cells[0].textContent?.trim()).toBe("Alice");
    expect(cells[1].textContent?.trim()).toBe("Bob");
    expect(cells[2].textContent?.trim()).toBe("Charlie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportSummaryCards component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportSummaryCards component", () => {
  const summary: ReportSummaryMetric[] = [
    { key: "count", label: "Total Searches",  value: 12345, type: "number" },
    { key: "rate",  label: "Success Rate",    value: 87.5,  type: "percent" },
    { key: "null",  label: "Null Metric",     value: null },
  ];

  it("renders all metric labels", () => {
    render(<ReportSummaryCards summary={summary} />);
    expect(screen.getByText("Total Searches")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("Null Metric")).toBeInTheDocument();
  });

  it("formats number values", () => {
    render(<ReportSummaryCards summary={summary} />);
    expect(screen.getByText("12,345")).toBeInTheDocument();
  });

  it("formats percent values", () => {
    render(<ReportSummaryCards summary={summary} />);
    expect(screen.getByText("87.5%")).toBeInTheDocument();
  });

  it("renders null display for missing values", () => {
    render(<ReportSummaryCards summary={summary} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders nothing when summary is empty", () => {
    const { container } = render(<ReportSummaryCards summary={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportChart component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportChart component", () => {
  const rows: ReportRow[] = [{ x: "Jan", y: 10 }, { x: "Feb", y: 20 }];
  const cols: ReportColumn[] = [
    makeColumn({ key: "x", label: "Month",  type: "text" }),
    makeColumn({ key: "y", label: "Value",  type: "number" }),
  ];

  it("renders nothing for type=none", () => {
    const { container } = render(
      <ReportChart
        chart={{ type: "none" }}
        columns={cols}
        rows={rows}
        reportName="Test"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing with empty rows", () => {
    const { container } = render(
      <ReportChart
        chart={{ type: "bar", xKey: "x", series: [{ key: "y", label: "Value" }] }}
        columns={cols}
        rows={[]}
        reportName="Test"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing with missing series", () => {
    const { container } = render(
      <ReportChart
        chart={{ type: "line", xKey: "x", series: [] }}
        columns={cols}
        rows={rows}
        reportName="Test"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders chart header when valid", () => {
    render(
      <ReportChart
        chart={{ type: "bar", xKey: "x", series: [{ key: "y", label: "Value" }] }}
        columns={cols}
        rows={rows}
        reportName="Monthly"
      />,
    );
    expect(screen.getByText(/bar chart/i)).toBeInTheDocument();
  });

  it("collapses chart on toggle click", () => {
    render(
      <ReportChart
        chart={{ type: "line", xKey: "x", series: [{ key: "y", label: "Value" }] }}
        columns={cols}
        rows={rows}
        reportName="Trend"
      />,
    );
    const toggleBtn = screen.getByRole("button", { name: /collapse chart/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole("button", { name: /expand chart/i })).toBeInTheDocument();
  });

  it("includes a screen-reader summary element", () => {
    render(
      <ReportChart
        chart={{ type: "bar", xKey: "x", series: [{ key: "y", label: "Value" }] }}
        columns={cols}
        rows={rows}
        reportName="Test"
      />,
    );
    const sr = document.querySelector(".sr-only");
    expect(sr).toBeInTheDocument();
    expect(sr!.textContent).toContain("Chart data");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportPagination component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportPagination component", () => {
  function renderPagination(pag: Partial<PaginationMeta>, isLoading = false) {
    const onPageChange = vi.fn();
    render(
      <ReportPagination
        pagination={makePagination(pag)}
        isLoading={isLoading}
        onPageChange={onPageChange}
      />,
    );
    return onPageChange;
  }

  it("shows row-count context when total_rows is known", () => {
    renderPagination({ page: 1, page_size: 100, total_rows: 250 });
    // "of 250 rows" may be split across elements; confirm the region contains the total.
    const nav = screen.getByRole("navigation", { name: /pagination/i });
    expect(nav.textContent).toMatch(/250/);
  });

  it("disables Prev on page 1", () => {
    renderPagination({ page: 1 });
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("enables Prev on page 2+", () => {
    renderPagination({ page: 2 });
    expect(screen.getByRole("button", { name: /previous/i })).not.toBeDisabled();
  });

  it("disables Next when on last page", () => {
    renderPagination({ page: 3, page_size: 100, total_rows: 250, truncated: false });
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("enables Next when truncated=true", () => {
    renderPagination({ page: 1, truncated: true });
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });

  it("calls onPageChange with page-1 on Prev click", () => {
    const onPageChange = renderPagination({ page: 3, page_size: 100, total_rows: 400 });
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(2, 100);
  });

  it("calls onPageChange with page+1 on Next click", () => {
    const onPageChange = renderPagination({ page: 1, page_size: 100, total_rows: 400 });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2, 100);
  });

  it("calls onPageChange with page 1 and new page_size on page-size change", () => {
    const onPageChange = renderPagination({ page: 3, page_size: 100, total_rows: 400 });
    fireEvent.change(screen.getByRole("combobox", { name: /rows per page/i }), {
      target: { value: "50" },
    });
    expect(onPageChange).toHaveBeenCalledWith(1, 50);
  });

  it("disables all controls when isLoading=true", () => {
    renderPagination({ page: 2, total_rows: 400 }, true);
    expect(screen.getByRole("combobox", { name: /rows per page/i })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportFilterSummary component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportFilterSummary component", () => {
  const def = makeDefinition({
    parameter_schema: {
      fields: [
        { key: "date_from", label: "Start Date", type: "date" },
        { key: "origin",    label: "Origin",     type: "airport" },
        { key: "limit",     label: "Limit",      type: "number" },
      ],
    },
  });

  it("renders active filter chips", () => {
    render(
      <ReportFilterSummary
        definition={def}
        parameters={{ date_from: "2026-01-01", origin: "DEN", limit: "" }}
      />,
    );
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();
    expect(screen.getByText("DEN")).toBeInTheDocument();
  });

  it("excludes empty/falsy parameter values", () => {
    render(
      <ReportFilterSummary
        definition={def}
        parameters={{ date_from: "", origin: "", limit: "" }}
      />,
    );
    expect(screen.queryByText("Start Date:")).toBeNull();
  });

  it("renders nothing when no active filters", () => {
    const { container } = render(
      <ReportFilterSummary definition={def} parameters={{}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("excludes boolean false values", () => {
    const def2 = makeDefinition({
      parameter_schema: {
        fields: [{ key: "active", label: "Active", type: "boolean" }],
      },
    });
    const { container } = render(
      <ReportFilterSummary definition={def2} parameters={{ active: false }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
