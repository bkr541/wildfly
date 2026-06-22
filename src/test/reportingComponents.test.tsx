/**
 * Tests for reporting UI component logic and render behaviour.
 *
 * Pure-logic helpers are tested directly; React components that take controlled
 * props are rendered to verify rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── Pure-logic imports ──────────────────────────────────────────────────────────

import {
  filterReports,
  groupReportsByCategory,
  CATEGORY_ORDER,
} from "@/components/admin/reporting/ReportCatalog";

import {
  initializeFromDefaults,
  validateParameters,
  normalizeAirportCode,
} from "@/components/admin/reporting/ReportParameterPanel";

// ── Component imports ───────────────────────────────────────────────────────────

import { ReportCatalog }      from "@/components/admin/reporting/ReportCatalog";
import { ReportParameterPanel } from "@/components/admin/reporting/ReportParameterPanel";
import { ReportEmptyState }   from "@/components/admin/reporting/ReportEmptyState";
import { ReportLoadingState } from "@/components/admin/reporting/ReportLoadingState";
import { ReportErrorState }   from "@/components/admin/reporting/ReportErrorState";
import { AdminReportingError } from "@/components/admin/reporting/reportingTypes";
import type {
  ReportDefinition,
  ReportParameterSchema,
} from "@/components/admin/reporting/reportingTypes";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeDefinition(overrides: Partial<ReportDefinition> = {}): ReportDefinition {
  return {
    id:                 "abc",
    slug:               "test.report",
    category:           "Operations",
    name:               "Test Report",
    description:        "A test report",
    parameter_schema:   { fields: [] },
    default_parameters: {},
    output_config:      {},
    contains_pii:       false,
    version:            1,
    ...overrides,
  };
}

function makeSchema(fields: ReportParameterSchema["fields"] = []): ReportParameterSchema {
  return { fields };
}

// ─────────────────────────────────────────────────────────────────────────────
// filterReports
// ─────────────────────────────────────────────────────────────────────────────

describe("filterReports", () => {
  const reports = [
    makeDefinition({ slug: "a.b", name: "Alpha Beta", category: "Users", description: "user report" }),
    makeDefinition({ slug: "c.d", name: "Gamma Delta", category: "Operations", description: "ops stuff" }),
    makeDefinition({ slug: "e.f", name: "Epsilon Zeta", category: "GoWild Availability", description: "" }),
  ];

  it("returns all reports when query is empty", () => {
    expect(filterReports(reports, "")).toHaveLength(3);
    expect(filterReports(reports, "  ")).toHaveLength(3);
  });

  it("filters by name (case-insensitive)", () => {
    expect(filterReports(reports, "alpha")).toHaveLength(1);
    expect(filterReports(reports, "GAMMA")).toHaveLength(1);
  });

  it("filters by category", () => {
    expect(filterReports(reports, "operations")).toHaveLength(1);
    expect(filterReports(reports, "gowild")).toHaveLength(1);
  });

  it("filters by description", () => {
    expect(filterReports(reports, "user report")).toHaveLength(1);
    expect(filterReports(reports, "ops")).toHaveLength(1);
  });

  it("returns empty array when nothing matches", () => {
    expect(filterReports(reports, "zzz")).toHaveLength(0);
  });

  it("partial match works", () => {
    expect(filterReports(reports, "psilon")).toHaveLength(1); // Epsilon
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groupReportsByCategory
// ─────────────────────────────────────────────────────────────────────────────

describe("groupReportsByCategory", () => {
  it("groups reports under their category", () => {
    const reports = [
      makeDefinition({ slug: "a", category: "Users" }),
      makeDefinition({ slug: "b", category: "Users" }),
      makeDefinition({ slug: "c", category: "Operations" }),
    ];
    const grouped = groupReportsByCategory(reports);
    expect(grouped.get("Users")).toHaveLength(2);
    expect(grouped.get("Operations")).toHaveLength(1);
  });

  it("respects CATEGORY_ORDER iteration order", () => {
    const reports = CATEGORY_ORDER.map((cat) =>
      makeDefinition({ slug: cat, category: cat }),
    );
    // Shuffle input
    const shuffled = [...reports].reverse();
    const grouped  = groupReportsByCategory(shuffled);
    const keys     = [...grouped.keys()];
    // All keys should appear in CATEGORY_ORDER sequence
    const orderedPresent = CATEGORY_ORDER.filter((c) => grouped.has(c));
    expect(keys.filter((k) => CATEGORY_ORDER.includes(k as (typeof CATEGORY_ORDER)[number]))).toEqual(
      orderedPresent,
    );
  });

  it("omits empty categories from the result", () => {
    const reports = [makeDefinition({ slug: "x", category: "Users" })];
    const grouped = groupReportsByCategory(reports);
    expect(grouped.has("Operations")).toBe(false);
    expect(grouped.has("Users")).toBe(true);
  });

  it("includes unknown categories after CATEGORY_ORDER ones", () => {
    const reports = [
      makeDefinition({ slug: "a", category: "Users" }),
      makeDefinition({ slug: "b", category: "Exotic Category" }),
    ];
    const grouped = groupReportsByCategory(reports);
    const keys    = [...grouped.keys()];
    expect(keys[0]).toBe("Users");
    expect(keys[keys.length - 1]).toBe("Exotic Category");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// initializeFromDefaults
// ─────────────────────────────────────────────────────────────────────────────

describe("initializeFromDefaults", () => {
  it("uses default_parameters value when present", () => {
    const schema = makeSchema([
      { key: "limit", type: "number", label: "Limit", required: false },
    ]);
    const result = initializeFromDefaults(schema, { limit: 100 });
    expect(result.limit).toBe(100);
  });

  it("zero-values text field to empty string", () => {
    const schema = makeSchema([
      { key: "origin", type: "text", label: "Origin", required: false },
    ]);
    const result = initializeFromDefaults(schema, {});
    expect(result.origin).toBe("");
  });

  it("zero-values boolean field to false", () => {
    const schema = makeSchema([
      { key: "active", type: "boolean", label: "Active", required: false },
    ]);
    const result = initializeFromDefaults(schema, {});
    expect(result.active).toBe(false);
  });

  it("zero-values number field to field.minimum when present", () => {
    const schema = makeSchema([
      { key: "count", type: "number", label: "Count", required: false, minimum: 5 },
    ]);
    const result = initializeFromDefaults(schema, {});
    expect(result.count).toBe(5);
  });

  it("zero-values number field to empty string when no minimum", () => {
    const schema = makeSchema([
      { key: "count", type: "number", label: "Count", required: false },
    ]);
    const result = initializeFromDefaults(schema, {});
    expect(result.count).toBe("");
  });

  it("handles airport type as empty string", () => {
    const schema = makeSchema([
      { key: "origin_iata", type: "airport", label: "Origin", required: false },
    ]);
    const result = initializeFromDefaults(schema, {});
    expect(result.origin_iata).toBe("");
  });

  it("initialises multiple fields correctly", () => {
    const schema = makeSchema([
      { key: "date_from", type: "date",    label: "From",  required: true },
      { key: "date_to",   type: "date",    label: "To",    required: true },
      { key: "limit",     type: "number",  label: "Limit", required: false },
    ]);
    const result = initializeFromDefaults(schema, {
      date_from: "2026-01-01",
      date_to:   "2026-06-01",
    });
    expect(result.date_from).toBe("2026-01-01");
    expect(result.date_to).toBe("2026-06-01");
    expect(result.limit).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateParameters
// ─────────────────────────────────────────────────────────────────────────────

describe("validateParameters", () => {
  it("returns empty errors when all required fields are filled", () => {
    const schema = makeSchema([
      { key: "date_from", type: "date", label: "From", required: true },
      { key: "date_to",   type: "date", label: "To",   required: true },
    ]);
    const errors = validateParameters(schema, { date_from: "2026-01-01", date_to: "2026-06-01" });
    expect(errors).toEqual({});
  });

  it("returns error for missing required field", () => {
    const schema = makeSchema([
      { key: "date_from", type: "date", label: "Start Date", required: true },
    ]);
    const errors = validateParameters(schema, { date_from: "" });
    expect(errors.date_from).toBeDefined();
    expect(errors.date_from).toContain("Start Date");
  });

  it("ignores optional fields that are empty", () => {
    const schema = makeSchema([
      { key: "origin", type: "airport", label: "Origin", required: false },
    ]);
    const errors = validateParameters(schema, { origin: "" });
    expect(errors).toEqual({});
  });

  it("treats null as missing", () => {
    const schema = makeSchema([
      { key: "limit", type: "number", label: "Limit", required: true },
    ]);
    const errors = validateParameters(schema, { limit: null });
    expect(errors.limit).toBeDefined();
  });

  it("treats whitespace-only as missing", () => {
    const schema = makeSchema([
      { key: "name", type: "text", label: "Name", required: true },
    ]);
    const errors = validateParameters(schema, { name: "   " });
    expect(errors.name).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeAirportCode
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeAirportCode", () => {
  it("uppercases and trims", () => {
    expect(normalizeAirportCode("  den  ")).toBe("DEN");
    expect(normalizeAirportCode("lax")).toBe("LAX");
  });

  it("handles already-uppercase input", () => {
    expect(normalizeAirportCode("ORD")).toBe("ORD");
  });

  it("handles empty string", () => {
    expect(normalizeAirportCode("")).toBe("");
  });

  it("handles non-string gracefully", () => {
    expect(normalizeAirportCode(null)).toBe("");
    expect(normalizeAirportCode(undefined)).toBe("");
    expect(normalizeAirportCode(123)).toBe("123");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportCatalog component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportCatalog component", () => {
  const reports = [
    makeDefinition({ slug: "a.b", name: "Alpha Beta",   category: "Users" }),
    makeDefinition({ slug: "c.d", name: "Gamma Delta",  category: "Operations" }),
    makeDefinition({ slug: "e.f", name: "Epsilon Zeta", category: "GoWild Availability",
      contains_pii: true }),
  ];

  it("renders search input", () => {
    render(
      <ReportCatalog
        reports={reports}
        isLoading={false}
        selectedSlug={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: /search reports/i })).toBeInTheDocument();
  });

  it("renders all report names", () => {
    render(
      <ReportCatalog
        reports={reports}
        isLoading={false}
        selectedSlug={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Alpha Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma Delta")).toBeInTheDocument();
    expect(screen.getByText("Epsilon Zeta")).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading=true", () => {
    const { container } = render(
      <ReportCatalog
        reports={[]}
        isLoading={true}
        selectedSlug={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows empty message when no reports match search", () => {
    render(
      <ReportCatalog
        reports={reports}
        isLoading={false}
        selectedSlug={null}
        onSelect={vi.fn()}
        searchQuery="zzzzz"
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/no reports match/i)).toBeInTheDocument();
  });

  it("calls onSelect with slug when a report is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ReportCatalog
        reports={reports}
        isLoading={false}
        selectedSlug={null}
        onSelect={onSelect}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Alpha Beta"));
    expect(onSelect).toHaveBeenCalledWith("a.b");
  });

  it("marks selected report with aria-selected=true", () => {
    render(
      <ReportCatalog
        reports={reports}
        isLoading={false}
        selectedSlug="c.d"
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );
    const btn = screen.getByRole("treeitem", { name: /Gamma Delta/i });
    expect(btn).toHaveAttribute("aria-selected", "true");
  });

  it("calls onSearchChange when user types", () => {
    const onSearchChange = vi.fn();
    render(
      <ReportCatalog
        reports={reports}
        isLoading={false}
        selectedSlug={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: /search reports/i }), {
      target: { value: "alpha" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("alpha");
  });

  it("collapses a category when its header is clicked", () => {
    render(
      <ReportCatalog
        reports={reports}
        isLoading={false}
        selectedSlug={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );
    // All categories start expanded — report names are visible
    expect(screen.getByText("Alpha Beta")).toBeInTheDocument();
    // Find all category-header buttons (those with aria-expanded attribute)
    const expandedBtns = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-expanded") === "true");
    expect(expandedBtns.length).toBeGreaterThan(0);
    // Collapse the first category
    fireEvent.click(expandedBtns[0]);
    const expanded2 = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-expanded") === "true");
    expect(expanded2.length).toBeLessThan(expandedBtns.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportParameterPanel component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportParameterPanel component", () => {
  const baseSchema = makeSchema([
    { key: "date_from", type: "date",   label: "Start Date", required: true },
    { key: "date_to",   type: "date",   label: "End Date",   required: true },
    { key: "limit",     type: "number", label: "Limit",      required: false, minimum: 1, maximum: 500 },
  ]);

  const baseDefinition = makeDefinition({
    parameter_schema:   baseSchema,
    default_parameters: { date_from: "2026-01-01", date_to: "2026-06-01", limit: 100 },
    contains_pii:       false,
  });

  it("renders all field labels", () => {
    render(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{ date_from: "2026-01-01", date_to: "2026-06-01", limit: 100 }}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Start Date")).toBeInTheDocument();
    expect(screen.getByText("End Date")).toBeInTheDocument();
    expect(screen.getByText("Limit")).toBeInTheDocument();
  });

  it("shows required asterisk on required fields", () => {
    render(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{ date_from: "", date_to: "", limit: "" }}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    const required = screen.getAllByLabelText("required");
    expect(required.length).toBe(2); // date_from, date_to
  });

  it("shows validation error message", () => {
    render(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{ date_from: "", date_to: "", limit: 100 }}
        onChange={vi.fn()}
        errors={{ date_from: "Start Date is required" }}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Start Date is required")).toBeInTheDocument();
  });

  it("shows PII toggle only when showPiiToggle=true", () => {
    const { rerender } = render(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{}}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.queryByRole("group", { name: /pii access/i })).toBeNull();

    rerender(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{}}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={true}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: /pii access/i })).toBeInTheDocument();
  });

  it("shows audit warning when PII toggle is enabled", () => {
    render(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{}}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={true}
        piiEnabled={true}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText(/audited/i)).toBeInTheDocument();
  });

  it("calls onPiiChange when PII toggle is clicked", () => {
    const onPiiChange = vi.fn();
    render(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{}}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={true}
        piiEnabled={false}
        onPiiChange={onPiiChange}
        onReset={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: /include full pii/i }));
    expect(onPiiChange).toHaveBeenCalledWith(true);
  });

  it("disables all inputs when disabled=true", () => {
    render(
      <ReportParameterPanel
        definition={baseDefinition}
        values={{ date_from: "2026-01-01", date_to: "2026-06-01", limit: 100 }}
        onChange={vi.fn()}
        errors={{}}
        disabled={true}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole("spinbutton").concat(screen.queryAllByRole("textbox") as HTMLElement[]);
    // At least number and date inputs should be disabled
    const allInputs = document.querySelectorAll("input:disabled");
    expect(allInputs.length).toBeGreaterThan(0);
  });

  it("calls onReset when reset button is clicked", () => {
    const onReset = vi.fn();
    render(
      <ReportParameterPanel
        definition={makeDefinition({
          parameter_schema:   makeSchema([{ key: "limit", type: "number", label: "Limit", required: false }]),
          default_parameters: { limit: 100 },
        })}
        values={{ limit: 200 }} // different from default → shows reset
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reset filters to default/i }));
    expect(onReset).toHaveBeenCalled();
  });

  it("renders message when no fields defined", () => {
    render(
      <ReportParameterPanel
        definition={makeDefinition({ parameter_schema: makeSchema([]) })}
        values={{}}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText(/no configurable parameters/i)).toBeInTheDocument();
  });

  it("renders airport field with uppercase class", () => {
    const def = makeDefinition({
      parameter_schema: makeSchema([
        { key: "origin", type: "airport", label: "Origin", required: false },
      ]),
    });
    render(
      <ReportParameterPanel
        definition={def}
        values={{ origin: "DEN" }}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    const input = document.querySelector("input[id='param-origin']") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.className).toContain("uppercase");
  });

  it("renders boolean field as switch", () => {
    const def = makeDefinition({
      parameter_schema: makeSchema([
        { key: "active", type: "boolean", label: "Include Active", required: false },
      ]),
    });
    render(
      <ReportParameterPanel
        definition={def}
        values={{ active: false }}
        onChange={vi.fn()}
        errors={{}}
        disabled={false}
        showPiiToggle={false}
        piiEnabled={false}
        onPiiChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    // active=false → button text is "No"
    expect(screen.getByRole("switch", { name: /no/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportEmptyState component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportEmptyState component", () => {
  it("renders 'Select a Report' for no-report type", () => {
    render(<ReportEmptyState type="no-report" />);
    expect(screen.getByText(/select a report/i)).toBeInTheDocument();
  });

  it("renders 'Ready to Run' for no-run type", () => {
    render(<ReportEmptyState type="no-run" reportName="My Report" />);
    expect(screen.getByText(/ready to run/i)).toBeInTheDocument();
    expect(screen.getByText(/My Report/)).toBeInTheDocument();
  });

  it("shows Browse Reports button for mobile when onBrowse provided", () => {
    const onBrowse = vi.fn();
    render(<ReportEmptyState type="no-report" onBrowse={onBrowse} />);
    const btn = screen.getByRole("button", { name: /browse reports/i });
    fireEvent.click(btn);
    expect(onBrowse).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportLoadingState component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportLoadingState component", () => {
  it("renders full state with spin indicator when full=true", () => {
    render(<ReportLoadingState full />);
    expect(screen.getByRole("status", { name: /running report/i })).toBeInTheDocument();
  });

  it("renders compact banner when full=false", () => {
    render(<ReportLoadingState full={false} />);
    expect(screen.getByRole("status", { name: /refreshing/i })).toBeInTheDocument();
  });

  it("defaults to compact banner", () => {
    render(<ReportLoadingState />);
    expect(screen.getByRole("status", { name: /refreshing/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportErrorState component
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportErrorState component", () => {
  it("renders full error state by default", () => {
    const error = new Error("oops");
    render(<ReportErrorState error={error} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Report Failed")).toBeInTheDocument();
    expect(screen.getByText("oops")).toBeInTheDocument();
  });

  it("renders compact banner when compact=true", () => {
    const error = new Error("network fail");
    render(<ReportErrorState error={error} compact onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Report Failed")).toBeNull();
  });

  it("shows retry button when onRetry provided and error is retryable", () => {
    const onRetry = vi.fn();
    render(<ReportErrorState error={new Error("oops")} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("hides retry button for UNAUTHENTICATED errors", () => {
    const error = new AdminReportingError("UNAUTHENTICATED", "Session expired");
    render(<ReportErrorState error={error} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("hides retry button for FORBIDDEN errors", () => {
    const error = new AdminReportingError("FORBIDDEN", "No access");
    render(<ReportErrorState error={error} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("hides retry button for VERSION_MISMATCH errors", () => {
    const error = new AdminReportingError("VERSION_MISMATCH", "Please reload");
    render(<ReportErrorState error={error} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("shows friendly message for REPORT_TIMEOUT", () => {
    const error = new AdminReportingError("REPORT_TIMEOUT", "timeout");
    render(<ReportErrorState error={error} onRetry={vi.fn()} />);
    expect(screen.getByText(/timed out/i)).toBeInTheDocument();
  });

  it("shows friendly message for VALIDATION errors", () => {
    const error = new AdminReportingError("VALIDATION", "bad param");
    render(<ReportErrorState error={error} />);
    expect(screen.getByText(/parameters are invalid/i)).toBeInTheDocument();
  });

  it("shows error code when present", () => {
    const error = new AdminReportingError("SERVER_ERROR", "fail", "ERR_12345");
    render(<ReportErrorState error={error} />);
    expect(screen.getByText(/ERR_12345/)).toBeInTheDocument();
  });
});
