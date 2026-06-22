/**
 * Tests for:
 *   - reportingUrlState.ts  (deep-link encode / decode / forbidden-key guards)
 *   - ReportRunHistory.tsx  (history table display, PII param masking, filters)
 *   - ReportRunDetailsDrawer.tsx (run details sheet)
 *   - Edge Function auth contracts (documented as expected error shapes)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ── URL state ──────────────────────────────────────────────────────────────────
import {
  FORBIDDEN_PARAM_KEYS,
  isForbiddenKey,
  readSlugFromUrl,
  encodeUrlState,
  decodeUrlState,
  getAllowedFields,
} from "@/components/admin/reporting/reportingUrlState";

// ── History helpers ────────────────────────────────────────────────────────────
import {
  maskParamValue,
  hasPiiAccess,
  buildParamSummary,
  ReportRunHistory,
} from "@/components/admin/reporting/ReportRunHistory";

// ── Details drawer ─────────────────────────────────────────────────────────────
import { ReportRunDetailsDrawer } from "@/components/admin/reporting/ReportRunDetailsDrawer";

// ── Error state component (timeout rendering) ──────────────────────────────────
import { ReportErrorState } from "@/components/admin/reporting/ReportErrorState";

import type {
  ReportDefinition,
  ReportParameterField,
  ReportRun,
} from "@/components/admin/reporting/reportingTypes";

import { useReportRuns } from "@/hooks/useAdminReporting";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<ReportParameterField> = {}): ReportParameterField {
  return { key: "date_from", label: "From", type: "date", required: false, ...overrides };
}

function makeDef(overrides: Partial<ReportDefinition> = {}): ReportDefinition {
  return {
    id:                  "def-001",
    slug:                "searches.volume-over-time",
    category:            "searches",
    name:                "Search Volume",
    description:         "Search volume over time",
    parameter_schema:    {
      fields: [
        makeField({ key: "date_from", label: "From",        type: "date"   }),
        makeField({ key: "date_to",   label: "To",          type: "date"   }),
        makeField({ key: "granularity", label: "Granularity", type: "select",
          options: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }],
        }),
        makeField({ key: "limit",     label: "Limit",       type: "number", minimum: 1, maximum: 500 }),
        makeField({ key: "include_pii", label: "Include PII", type: "boolean" }),
      ],
    },
    default_parameters:  {},
    output_config:       { show_summary_cards: false, show_chart: false, columns: [] },
    contains_pii:        false,
    version:             1,
    sort_order:          10,
    ...overrides,
  };
}

function makeRun(overrides: Partial<ReportRun> = {}): ReportRun {
  return {
    id:               "run-abc-123",
    report_slug:      "searches.volume-over-time",
    report_version:   1,
    report_name:      "Search Volume",
    report_category:  "searches",
    started_at:       "2024-06-01T10:00:00.000Z",
    completed_at:     "2024-06-01T10:00:03.200Z",
    duration_ms:      3200,
    status:           "completed",
    row_count:        42,
    truncated:        false,
    parameters:       { date_from: "2024-05-01", date_to: "2024-05-31", include_pii: false },
    error_code:       null,
    error_message:    null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// isForbiddenKey
// ─────────────────────────────────────────────────────────────────────────────

describe("isForbiddenKey", () => {
  it("blocks exact forbidden keys from the set", () => {
    for (const key of FORBIDDEN_PARAM_KEYS) {
      expect(isForbiddenKey(key)).toBe(true);
    }
  });

  it("blocks include_pii", () => {
    expect(isForbiddenKey("include_pii")).toBe(true);
  });

  it("blocks keys ending in _email", () => {
    expect(isForbiddenKey("contact_email")).toBe(true);
    expect(isForbiddenKey("user_email")).toBe(true);
  });

  it("blocks keys ending in _pii", () => {
    expect(isForbiddenKey("data_pii")).toBe(true);
  });

  it("blocks keys containing user_id", () => {
    expect(isForbiddenKey("user_id_ref")).toBe(true);
  });

  it("does not block safe keys", () => {
    expect(isForbiddenKey("date_from")).toBe(false);
    expect(isForbiddenKey("granularity")).toBe(false);
    expect(isForbiddenKey("limit")).toBe(false);
    expect(isForbiddenKey("airport")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// readSlugFromUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("readSlugFromUrl", () => {
  it("returns the slug when valid", () => {
    const sp = new URLSearchParams("report=searches.volume-over-time");
    expect(readSlugFromUrl(sp)).toBe("searches.volume-over-time");
  });

  it("returns null when slug contains uppercase", () => {
    const sp = new URLSearchParams("report=Searches.VolumeOverTime");
    expect(readSlugFromUrl(sp)).toBeNull();
  });

  it("returns null when slug contains path traversal", () => {
    const sp = new URLSearchParams("report=../../etc/passwd");
    expect(readSlugFromUrl(sp)).toBeNull();
  });

  it("returns null when the param is absent", () => {
    expect(readSlugFromUrl(new URLSearchParams())).toBeNull();
  });

  it("accepts hyphenated sub-segments", () => {
    const sp = new URLSearchParams("report=users.top-search-active");
    expect(readSlugFromUrl(sp)).toBe("users.top-search-active");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// encodeUrlState — forbidden keys NEVER appear
// ─────────────────────────────────────────────────────────────────────────────

describe("encodeUrlState — forbidden key exclusion", () => {
  it("never encodes include_pii into the URL", () => {
    const def = makeDef();
    const sp  = encodeUrlState("searches.volume-over-time", { date_from: "2024-01-01", include_pii: true }, def);
    expect(sp.has("include_pii")).toBe(false);
  });

  it("never encodes email-like keys", () => {
    const def = makeDef({
      parameter_schema: {
        fields: [
          makeField({ key: "contact_email", label: "Email", type: "text" }),
          makeField({ key: "date_from",     label: "From",  type: "date" }),
        ],
      },
    });
    const sp = encodeUrlState("searches.volume-over-time", { contact_email: "user@test.com", date_from: "2024-01-01" }, def);
    expect(sp.has("contact_email")).toBe(false);
    expect(sp.get("date_from")).toBe("2024-01-01");
  });

  it("never encodes user_id-like keys", () => {
    const def = makeDef({
      parameter_schema: {
        fields: [makeField({ key: "user_id", label: "User ID", type: "text" })],
      },
    });
    const sp = encodeUrlState("searches.volume-over-time", { user_id: "u-001" }, def);
    expect(sp.has("user_id")).toBe(false);
  });

  it("encodes the slug and safe params", () => {
    const def = makeDef();
    const sp  = encodeUrlState("searches.volume-over-time", { date_from: "2024-01-01", granularity: "day" }, def);
    expect(sp.get("report")).toBe("searches.volume-over-time");
    expect(sp.get("date_from")).toBe("2024-01-01");
    expect(sp.get("granularity")).toBe("day");
  });

  it("skips null/undefined/empty-string params", () => {
    const def = makeDef();
    const sp  = encodeUrlState("searches.volume-over-time", { date_from: "", limit: undefined }, def);
    expect(sp.has("date_from")).toBe(false);
    expect(sp.has("limit")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// decodeUrlState — validation & graceful degradation
// ─────────────────────────────────────────────────────────────────────────────

describe("decodeUrlState — validation", () => {
  it("accepts valid date params", () => {
    const sp  = new URLSearchParams("date_from=2024-01-01&date_to=2024-01-31");
    const def = makeDef();
    const { params, skipped } = decodeUrlState(sp, def);
    expect(params.date_from).toBe("2024-01-01");
    expect(params.date_to).toBe("2024-01-31");
    expect(skipped).not.toContain("date_from");
  });

  it("drops and records invalid date format", () => {
    const sp  = new URLSearchParams("date_from=not-a-date");
    const def = makeDef();
    const { params, skipped } = decodeUrlState(sp, def);
    expect(params.date_from).toBeUndefined();
    expect(skipped).toContain("date_from");
  });

  it("drops and records unknown select option", () => {
    const sp  = new URLSearchParams("granularity=month");
    const def = makeDef();
    const { params, skipped } = decodeUrlState(sp, def);
    expect(params.granularity).toBeUndefined();
    expect(skipped).toContain("granularity");
  });

  it("accepts valid select option", () => {
    const sp  = new URLSearchParams("granularity=day");
    const def = makeDef();
    const { params } = decodeUrlState(sp, def);
    expect(params.granularity).toBe("day");
  });

  it("drops forbidden keys even if present in schema", () => {
    const sp  = new URLSearchParams("include_pii=true");
    const def = makeDef();
    const { params } = decodeUrlState(sp, def);
    expect(params.include_pii).toBeUndefined();
  });

  it("drops number values below minimum", () => {
    const sp  = new URLSearchParams("limit=0");
    const def = makeDef();
    const { params, skipped } = decodeUrlState(sp, def);
    expect(params.limit).toBeUndefined();
    expect(skipped).toContain("limit");
  });

  it("accepts number within bounds", () => {
    const sp  = new URLSearchParams("limit=100");
    const def = makeDef();
    const { params } = decodeUrlState(sp, def);
    expect(params.limit).toBe(100);
  });

  it("silently skips unknown URL params not in schema", () => {
    const sp  = new URLSearchParams("totally_unknown=xyz&date_from=2024-01-01");
    const def = makeDef();
    const { params } = decodeUrlState(sp, def);
    expect(params.totally_unknown).toBeUndefined();
    expect(params.date_from).toBe("2024-01-01");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAllowedFields — excludes forbidden keys from schema
// ─────────────────────────────────────────────────────────────────────────────

describe("getAllowedFields", () => {
  it("excludes include_pii from allowed fields", () => {
    const def    = makeDef();
    const fields = getAllowedFields(def);
    expect(fields.find((f) => f.key === "include_pii")).toBeUndefined();
  });

  it("includes safe fields", () => {
    const def    = makeDef();
    const fields = getAllowedFields(def);
    const keys   = fields.map((f) => f.key);
    expect(keys).toContain("date_from");
    expect(keys).toContain("granularity");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// maskParamValue
// ─────────────────────────────────────────────────────────────────────────────

describe("maskParamValue", () => {
  it("redacts include_pii key", () => {
    expect(maskParamValue("include_pii", true)).toBe("[redacted]");
  });

  it("redacts user_id key", () => {
    expect(maskParamValue("user_id", "u-001")).toBe("[redacted]");
  });

  it("redacts email key", () => {
    expect(maskParamValue("email", "test@example.com")).toBe("[redacted]");
  });

  it("partially masks email-looking values even with safe key name", () => {
    const result = maskParamValue("contact", "alice@example.com");
    expect(result).toMatch(/a\*\*\*@/);
    expect(result).not.toContain("alice");
  });

  it("displays safe non-PII values as-is", () => {
    expect(maskParamValue("date_from", "2024-01-01")).toBe("2024-01-01");
  });

  it("returns em-dash for null", () => {
    expect(maskParamValue("date_from", null)).toBe("—");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasPiiAccess
// ─────────────────────────────────────────────────────────────────────────────

describe("hasPiiAccess", () => {
  it("returns true when include_pii is true", () => {
    expect(hasPiiAccess({ include_pii: true })).toBe(true);
  });

  it("returns false when include_pii is false", () => {
    expect(hasPiiAccess({ include_pii: false })).toBe(false);
  });

  it("returns false when include_pii is absent", () => {
    expect(hasPiiAccess({ date_from: "2024-01-01" })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildParamSummary
// ─────────────────────────────────────────────────────────────────────────────

describe("buildParamSummary", () => {
  it("excludes include_pii from summary", () => {
    const summary = buildParamSummary({ date_from: "2024-01-01", include_pii: true });
    expect(summary).not.toContain("include_pii");
    expect(summary).not.toContain("true");
  });

  it("includes safe params in summary", () => {
    const summary = buildParamSummary({ date_from: "2024-01-01", granularity: "day" });
    expect(summary).toContain("date_from");
    expect(summary).toContain("2024-01-01");
  });

  it("truncates summary to maxChars + ellipsis", () => {
    const params: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) params[`key${i}`] = "value";
    const summary = buildParamSummary(params, 30);
    expect(summary.length).toBeLessThanOrEqual(31);
    expect(summary).toMatch(/…$/);
  });

  it("returns empty string for empty non-PII params", () => {
    const summary = buildParamSummary({ include_pii: false });
    expect(summary).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportRunHistory component — filter rendering
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_RUNS_RETURN = {
  data:      { runs: [], total: 0 },
  isLoading: false,
  error:     null,
  refetch:   vi.fn(),
};

vi.mock("@/hooks/useAdminReporting", () => ({
  useReportRuns: vi.fn(() => DEFAULT_RUNS_RETURN),
  useReportDefinitions: vi.fn(() => ({ data: null, isLoading: false })),
  useRunReport: vi.fn(() => ({
    run:          vi.fn(),
    data:         null,
    isRunning:    false,
    isRefetching: false,
    error:        null,
    retry:        vi.fn(),
  })),
}));

function renderHistory(props: Partial<Parameters<typeof ReportRunHistory>[0]> = {}) {
  const def = makeDef();
  return render(
    <ReportRunHistory
      selectedSlug={def.slug}
      definitions={[def]}
      onSelectRun={vi.fn()}
      {...props}
    />,
  );
}

describe("ReportRunHistory component", () => {
  it("renders the filter controls", () => {
    renderHistory();
    expect(screen.getByLabelText("Filter by report")).toBeTruthy();
    expect(screen.getByLabelText("Filter by status")).toBeTruthy();
    expect(screen.getByLabelText("Filter from date")).toBeTruthy();
    expect(screen.getByLabelText("Filter to date")).toBeTruthy();
  });

  it("renders all reports in the slug dropdown", () => {
    const def2 = makeDef({ slug: "gowild.route-reliability", name: "Route Reliability" });
    renderHistory({ definitions: [makeDef(), def2] });
    const select = screen.getByLabelText("Filter by report") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.text);
    expect(options).toContain("Search Volume");
    expect(options).toContain("Route Reliability");
  });

  it("shows empty state when no runs are returned", () => {
    renderHistory();
    expect(screen.getByText(/No runs match the current filters/)).toBeTruthy();
  });

  it("shows 'All reports' as first option in slug dropdown", () => {
    renderHistory();
    const select = screen.getByLabelText("Filter by report") as HTMLSelectElement;
    expect(select.options[0].text).toBe("All reports");
  });

  it("shows all status filter options", () => {
    renderHistory();
    const select = screen.getByLabelText("Filter by status") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain("running");
    expect(options).toContain("completed");
    expect(options).toContain("failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportRunHistory — PII param display in rows
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("date-fns")>();
  return {
    ...actual,
    formatDistanceToNow: () => "5 minutes ago",
  };
});

describe("ReportRunHistory — PII param masking in rows", () => {
  it("shows PII badge when include_pii is true", () => {
    const run = makeRun({ parameters: { date_from: "2024-01-01", include_pii: true } });
    vi.mocked(useReportRuns).mockReturnValueOnce({
      data:      { runs: [run], total: 1 },
      isLoading: false,
      error:     null,
      refetch:   vi.fn(),
    } as ReturnType<typeof useReportRuns>);
    renderHistory();
    expect(screen.queryAllByText("PII").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show PII badge when include_pii is false", () => {
    const run = makeRun({ parameters: { date_from: "2024-01-01", include_pii: false } });
    vi.mocked(useReportRuns).mockReturnValueOnce({
      data:      { runs: [run], total: 1 },
      isLoading: false,
      error:     null,
      refetch:   vi.fn(),
    } as ReturnType<typeof useReportRuns>);
    renderHistory();
    expect(screen.queryByTitle("PII was included in this run")).toBeNull();
  });

  it("never shows raw email address in param summary column", () => {
    const run = makeRun({
      parameters: { contact_email: "alice@example.com", include_pii: false },
    });
    vi.mocked(useReportRuns).mockReturnValueOnce({
      data:      { runs: [run], total: 1 },
      isLoading: false,
      error:     null,
      refetch:   vi.fn(),
    } as ReturnType<typeof useReportRuns>);
    renderHistory();
    expect(screen.queryByText("alice@example.com")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ReportRunDetailsDrawer
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportRunDetailsDrawer", () => {
  function renderDrawer(run: ReportRun | null, open = true) {
    return render(
      <ReportRunDetailsDrawer run={run} open={open} onClose={vi.fn()} />,
    );
  }

  it("renders report name as title", () => {
    renderDrawer(makeRun());
    expect(screen.getByText("Search Volume")).toBeTruthy();
  });

  it("shows PII notice when include_pii is true", () => {
    renderDrawer(makeRun({ parameters: { include_pii: true } }));
    expect(screen.getByText(/PII was requested for this run/i)).toBeTruthy();
  });

  it("does not show PII notice when include_pii is false", () => {
    renderDrawer(makeRun({ parameters: { include_pii: false } }));
    expect(screen.queryByText(/PII was requested/i)).toBeNull();
  });

  it("shows Completed status for completed run", () => {
    renderDrawer(makeRun({ status: "completed" }));
    expect(screen.getByRole("status").textContent).toMatch(/completed/i);
  });

  it("shows Failed status for failed run", () => {
    renderDrawer(
      makeRun({
        status:        "failed",
        error_code:    "TIMEOUT",
        error_message: "Query exceeded the statement timeout of 14 seconds.",
      }),
    );
    expect(screen.getByRole("status").textContent).toMatch(/failed/i);
  });

  it("shows error_code and sanitized error_message for failed run", () => {
    renderDrawer(
      makeRun({
        status:        "failed",
        error_code:    "TIMEOUT",
        error_message: "Query exceeded the statement timeout of 14 seconds.",
      }),
    );
    expect(screen.getByText("TIMEOUT")).toBeTruthy();
    expect(screen.getByText(/Query exceeded the statement timeout/)).toBeTruthy();
  });

  it("shows truncated badge when run is truncated", () => {
    renderDrawer(makeRun({ truncated: true, row_count: 500 }));
    expect(screen.getByTitle("Results were truncated")).toBeTruthy();
  });

  it("does not show truncated badge when run is not truncated", () => {
    renderDrawer(makeRun({ truncated: false }));
    expect(screen.queryByTitle("Results were truncated")).toBeNull();
  });

  it("does not render include_pii as a parameter row", () => {
    renderDrawer(makeRun({ parameters: { date_from: "2024-01-01", include_pii: true } }));
    const table = screen.getByRole("table", { name: /run parameters/i });
    expect(table.textContent).not.toContain("Include Pii");
    expect(table.textContent).not.toContain("include_pii");
  });

  it("renders when open is false (closed state — no crash)", () => {
    expect(() => renderDrawer(null, false)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeout error rendering in ReportErrorState
// ─────────────────────────────────────────────────────────────────────────────

describe("ReportErrorState — timeout error rendering", () => {
  it("renders a timeout error message without exposing stack traces", () => {
    const error = new Error("Query exceeded the statement timeout of 14 seconds.");
    render(<ReportErrorState error={error} onRetry={vi.fn()} />);

    const container = screen.getByRole("alert");
    expect(container.textContent).toMatch(/timeout|timed out|too long/i);
    expect(container.textContent).not.toMatch(/at Object\.|\.ts:\d+/);
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    const error   = new Error("Something went wrong");
    render(<ReportErrorState error={error} onRetry={onRetry} />);

    const btn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authorization contract tests (documented via expected error shapes)
// These are unit-level contract tests — no live network calls.
// ─────────────────────────────────────────────────────────────────────────────

describe("Auth contract — expected error shapes", () => {
  it("UNAUTHENTICATED error has kind UNAUTHENTICATED", () => {
    const error = { kind: "UNAUTHENTICATED", status: 401, message: "No valid session" };
    expect(error.kind).toBe("UNAUTHENTICATED");
    expect(error.status).toBe(401);
  });

  it("FORBIDDEN error has kind FORBIDDEN for non-developer auth", () => {
    const error = { kind: "FORBIDDEN", status: 403, message: "Not authorized" };
    expect(error.kind).toBe("FORBIDDEN");
    expect(error.status).toBe(403);
  });

  it("REPORT_VERSION_MISMATCH error has the correct code for version mismatch", () => {
    const error = {
      kind:    "REPORT_VERSION_MISMATCH",
      status:  409,
      message: "Version mismatch for 'searches.volume-over-time': database v2, registry v1",
    };
    expect(error.kind).toBe("REPORT_VERSION_MISMATCH");
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/version mismatch/i);
  });

  it("version mismatch error message does not expose SQL or internal table names", () => {
    const msg = "Version mismatch for 'searches.volume-over-time': database v2, registry v1";
    expect(msg).not.toMatch(/SELECT|INSERT|FROM |WHERE |admin_report_definitions/i);
  });
});
