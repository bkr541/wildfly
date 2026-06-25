/**
 * Tests for the Wildfly admin reporting shared utilities.
 *
 * Pure utility functions are re-implemented inline (same logic as
 * supabase/functions/_shared/reporting/) so they can run in Vitest's
 * jsdom environment without Deno globals or esm.sh imports.
 *
 * Keep these implementations in sync with the originals in
 * supabase/functions/_shared/reporting/reportValidation.ts
 * supabase/functions/_shared/reporting/reportFormatting.ts
 * supabase/functions/_shared/reporting/reportRegistry.ts
 */
import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Re-implementations of pure utilities (no Deno / esm.sh deps)
// ─────────────────────────────────────────────────────────────────────────────

// ── reportFormatting.ts ───────────────────────────────────────────────────────

function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "***";
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const visible = local.length > 0 ? local[0] : "";
  return `${visible}***@${domain}`;
}

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "").trim();
}

function normalizeNull(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  return value;
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isFinite(n) ? n : null;
}

function percentage(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function clampLimit(value: unknown, max: number, defaultValue: number): number {
  const n = Number(value);
  if (!isFinite(n) || n < 1) return defaultValue;
  return Math.min(Math.floor(n), max);
}

function exclusiveEndTimestamp(endDate: string): string {
  const d = new Date(`${endDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

// ── reportValidation.ts ───────────────────────────────────────────────────────

const MAX_LIMIT = 500;
const DEFAULT_PAGE_SIZE = 100;

const SUPPORTED_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
] as const;

type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(v: string): boolean {
  return DATE_RE.test(v) && !isNaN(Date.parse(v));
}

function validateDateRange(raw: unknown): {
  success: true;
  start_date: string;
  end_date: string;
} | { success: false; error: string } {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("start_date" in raw) ||
    !("end_date" in raw)
  ) {
    return { success: false, error: "start_date and end_date are required" };
  }
  const { start_date, end_date } = raw as Record<string, unknown>;
  if (typeof start_date !== "string" || !isValidDate(start_date)) {
    return { success: false, error: "start_date must be a valid YYYY-MM-DD date" };
  }
  if (typeof end_date !== "string" || !isValidDate(end_date)) {
    return { success: false, error: "end_date must be a valid YYYY-MM-DD date" };
  }
  if (new Date(end_date) < new Date(start_date)) {
    return { success: false, error: "end_date must not be before start_date" };
  }
  return { success: true, start_date, end_date };
}

function normalizeIata(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : null;
}

function clampLimitV(raw: unknown, defaultValue: number): number {
  if (raw == null) return defaultValue;
  const n = Number(raw);
  if (!isFinite(n) || n < 1) return defaultValue;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function validateTimezone(raw: unknown): SupportedTimezone | null {
  if (typeof raw !== "string") return null;
  return (SUPPORTED_TIMEZONES as readonly string[]).includes(raw)
    ? (raw as SupportedTimezone)
    : null;
}

// ── reportRegistry.ts (structural validation logic) ───────────────────────────

interface RegistryLike {
  slug: string;
  handlerKey: string;
  version: number;
  columns: unknown[];
  validateParameters: unknown;
}

function validateRegistryEntries(entries: RegistryLike[]): string[] {
  const slugsSeen = new Set<string>();
  const handlerKeysSeen = new Set<string>();
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.version < 1) {
      errors.push(`${entry.slug}: version must be >= 1`);
    }
    if (typeof entry.validateParameters !== "function") {
      errors.push(`${entry.slug}: missing validateParameters`);
    }
    if (!entry.columns || entry.columns.length === 0) {
      errors.push(`${entry.slug}: columns must not be empty`);
    }
    if (slugsSeen.has(entry.slug)) {
      errors.push(`Duplicate slug: "${entry.slug}"`);
    } else {
      slugsSeen.add(entry.slug);
    }
    if (handlerKeysSeen.has(entry.handlerKey)) {
      errors.push(`Duplicate handlerKey: "${entry.handlerKey}"`);
    } else {
      handlerKeysSeen.add(entry.handlerKey);
    }
  }

  return errors;
}

// ── admin-list-reports (cross-check logic) ────────────────────────────────────

interface DbDefinition { slug: string; version: number }
interface RegistryEntry { slug: string; version: number }

function crossCheckDefinitions(
  definitions: DbDefinition[],
  registry: Map<string, RegistryEntry>,
): { included: DbDefinition[]; excluded: DbDefinition[]; warnings: string[] } {
  const included: DbDefinition[] = [];
  const excluded: DbDefinition[] = [];
  const warnings: string[] = [];

  for (const def of definitions) {
    const entry = registry.get(def.slug);
    if (!entry) {
      excluded.push(def);
      warnings.push(`"${def.slug}" has no registered handler — excluded`);
      continue;
    }
    if (entry.version !== def.version) {
      warnings.push(
        `"${def.slug}": registry version (${entry.version}) does not match database version (${def.version})`,
      );
    }
    included.push(def);
  }

  return { included, excluded, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// ── Email masking ─────────────────────────────────────────────────────────────

describe("maskEmail", () => {
  it("masks the local part preserving the first character", () => {
    expect(maskEmail("kody@example.com")).toBe("k***@example.com");
    expect(maskEmail("admin@wildfly.app")).toBe("a***@wildfly.app");
  });

  it("handles single-character local parts", () => {
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });

  it("returns *** for missing @ sign", () => {
    expect(maskEmail("notanemail")).toBe("***");
  });

  it("returns *** for empty string", () => {
    expect(maskEmail("")).toBe("***");
  });

  it("handles non-string input defensively", () => {
    expect(maskEmail(null as unknown as string)).toBe("***");
  });

  it("is non-reversible — the domain is preserved but local is obscured", () => {
    const masked = maskEmail("kodyrobinson02@gmail.com");
    expect(masked).not.toContain("kodyrobinson02");
    expect(masked).toContain("@gmail.com");
  });
});

// ── sanitizeText ──────────────────────────────────────────────────────────────

describe("sanitizeText", () => {
  it("strips control characters", () => {
    expect(sanitizeText("hello\x00world")).toBe("helloworld");
  });

  it("trims whitespace", () => {
    expect(sanitizeText("  spaced  ")).toBe("spaced");
  });

  it("returns empty string for non-strings", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(42)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });
});

// ── normalizeNull ─────────────────────────────────────────────────────────────

describe("normalizeNull", () => {
  it("converts null, undefined, and empty string to null", () => {
    expect(normalizeNull(null)).toBeNull();
    expect(normalizeNull(undefined)).toBeNull();
    expect(normalizeNull("")).toBeNull();
  });

  it("leaves meaningful values intact", () => {
    expect(normalizeNull(0)).toBe(0);
    expect(normalizeNull("text")).toBe("text");
    expect(normalizeNull(false)).toBe(false);
  });
});

// ── safeNumber ────────────────────────────────────────────────────────────────

describe("safeNumber", () => {
  it("converts numeric strings and numbers", () => {
    expect(safeNumber("42")).toBe(42);
    expect(safeNumber(3.14)).toBe(3.14);
  });

  it("returns null for non-finite values", () => {
    expect(safeNumber(NaN)).toBeNull();
    expect(safeNumber(Infinity)).toBeNull();
    expect(safeNumber("abc")).toBeNull();
  });

  it("returns null for null, undefined, empty string", () => {
    expect(safeNumber(null)).toBeNull();
    expect(safeNumber(undefined)).toBeNull();
    expect(safeNumber("")).toBeNull();
  });
});

// ── percentage ────────────────────────────────────────────────────────────────

describe("percentage", () => {
  it("calculates correct percentages", () => {
    expect(percentage(75, 100)).toBe(75);
    expect(percentage(1, 3)).toBe(33.3);
    expect(percentage(2, 3)).toBe(66.7);
  });

  it("returns null when denominator is zero", () => {
    expect(percentage(0, 0)).toBeNull();
    expect(percentage(5, 0)).toBeNull();
  });

  it("returns null when either argument is null", () => {
    expect(percentage(null, 100)).toBeNull();
    expect(percentage(50, null)).toBeNull();
  });
});

// ── clampLimit ────────────────────────────────────────────────────────────────

describe("clampLimit (formatting)", () => {
  it("clamps values above the maximum", () => {
    expect(clampLimit(1000, 500, 100)).toBe(500);
    expect(clampLimit(600, 500, 50)).toBe(500);
  });

  it("passes through values within range", () => {
    expect(clampLimit(25, 500, 100)).toBe(25);
    expect(clampLimit(1, 500, 100)).toBe(1);
  });

  it("returns defaultValue when input is invalid", () => {
    expect(clampLimit(null, 500, 100)).toBe(100);
    expect(clampLimit(undefined, 500, 100)).toBe(100);
    expect(clampLimit("abc", 500, 100)).toBe(100);
    expect(clampLimit(0, 500, 100)).toBe(100);
    expect(clampLimit(-5, 500, 100)).toBe(100);
  });

  it("floors non-integer values", () => {
    expect(clampLimit(25.9, 500, 100)).toBe(25);
  });
});

// ── exclusiveEndTimestamp ─────────────────────────────────────────────────────

describe("exclusiveEndTimestamp", () => {
  it("advances the date by exactly one day", () => {
    const result = exclusiveEndTimestamp("2026-06-22");
    expect(result).toBe("2026-06-23T00:00:00.000Z");
  });

  it("handles month boundaries", () => {
    const result = exclusiveEndTimestamp("2026-06-30");
    expect(result).toBe("2026-07-01T00:00:00.000Z");
  });

  it("handles year boundaries", () => {
    const result = exclusiveEndTimestamp("2026-12-31");
    expect(result).toBe("2027-01-01T00:00:00.000Z");
  });
});

// ── Date range validation ─────────────────────────────────────────────────────

describe("validateDateRange", () => {
  it("accepts valid date ranges", () => {
    const r = validateDateRange({ start_date: "2026-01-01", end_date: "2026-06-30" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.start_date).toBe("2026-01-01");
      expect(r.end_date).toBe("2026-06-30");
    }
  });

  it("accepts same-day ranges", () => {
    const r = validateDateRange({ start_date: "2026-06-22", end_date: "2026-06-22" });
    expect(r.success).toBe(true);
  });

  it("rejects end_date before start_date", () => {
    const r = validateDateRange({ start_date: "2026-06-22", end_date: "2026-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect((r as { success: false; error: string }).error).toContain("end_date");
  });

  it("rejects invalid date formats", () => {
    const r = validateDateRange({ start_date: "22-06-2026", end_date: "2026-06-30" });
    expect(r.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const r = validateDateRange({ start_date: "2026-01-01" });
    expect(r.success).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateDateRange(null).success).toBe(false);
    expect(validateDateRange("not-an-object").success).toBe(false);
  });
});

// ── IATA normalisation ────────────────────────────────────────────────────────

describe("normalizeIata", () => {
  it("normalises lowercase to uppercase", () => {
    expect(normalizeIata("ord")).toBe("ORD");
    expect(normalizeIata("den")).toBe("DEN");
  });

  it("passes through valid uppercase codes", () => {
    expect(normalizeIata("LAX")).toBe("LAX");
  });

  it("trims whitespace before normalising", () => {
    expect(normalizeIata("  mco  ")).toBe("MCO");
  });

  it("returns null for invalid codes", () => {
    expect(normalizeIata("AB")).toBeNull();
    expect(normalizeIata("ABCD")).toBeNull();
    expect(normalizeIata("12C")).toBeNull();
    expect(normalizeIata("")).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(normalizeIata(null)).toBeNull();
    expect(normalizeIata(undefined)).toBeNull();
  });
});

// ── Limit clamping (validation) ───────────────────────────────────────────────

describe("clampLimitV (validation)", () => {
  it("returns the default when limit is absent", () => {
    expect(clampLimitV(null, 50)).toBe(50);
    expect(clampLimitV(undefined, 50)).toBe(50);
  });

  it("respects the MAX_LIMIT ceiling", () => {
    expect(clampLimitV(10_000, 50)).toBe(MAX_LIMIT);
  });

  it("passes through valid values", () => {
    expect(clampLimitV(25, 50)).toBe(25);
  });
});

// ── Timezone validation ───────────────────────────────────────────────────────

describe("validateTimezone", () => {
  it("accepts all supported timezones", () => {
    for (const tz of SUPPORTED_TIMEZONES) {
      expect(validateTimezone(tz)).toBe(tz);
    }
  });

  it("rejects unsupported timezone strings", () => {
    expect(validateTimezone("Europe/London")).toBeNull();
    expect(validateTimezone("Pacific/Honolulu")).toBeNull();
    expect(validateTimezone("Asia/Tokyo")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(validateTimezone(null)).toBeNull();
    expect(validateTimezone(undefined)).toBeNull();
    expect(validateTimezone(42)).toBeNull();
  });
});

// ── Registry structural validation ───────────────────────────────────────────

describe("validateRegistryEntries — duplicate slug detection", () => {
  it("detects no errors in a valid registry", () => {
    const errors = validateRegistryEntries([
      { slug: "users.dormant", handlerKey: "users.dormant", version: 1, columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }) },
      { slug: "users.active", handlerKey: "users.active", version: 1, columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }) },
    ]);
    expect(errors).toHaveLength(0);
  });

  it("detects duplicate slugs", () => {
    const errors = validateRegistryEntries([
      { slug: "users.dormant", handlerKey: "users.dormant", version: 1, columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }) },
      { slug: "users.dormant", handlerKey: "users.dormant-2", version: 1, columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }) },
    ]);
    expect(errors.some((e) => e.includes("Duplicate slug"))).toBe(true);
  });

  it("detects duplicate handler keys", () => {
    const errors = validateRegistryEntries([
      { slug: "users.a", handlerKey: "shared.handler", version: 1, columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }) },
      { slug: "users.b", handlerKey: "shared.handler", version: 1, columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }) },
    ]);
    expect(errors.some((e) => e.includes("Duplicate handlerKey"))).toBe(true);
  });

  it("detects missing validateParameters", () => {
    const errors = validateRegistryEntries([
      { slug: "users.bad", handlerKey: "users.bad", version: 1, columns: [{ key: "id" }], validateParameters: undefined as unknown as (p: unknown) => { success: true; data: unknown } | { success: false; error: string } },
    ]);
    expect(errors.some((e) => e.includes("missing validateParameters"))).toBe(true);
  });

  it("detects empty columns array", () => {
    const errors = validateRegistryEntries([
      { slug: "users.empty", handlerKey: "users.empty", version: 1, columns: [], validateParameters: () => ({ success: true, data: {} }) },
    ]);
    expect(errors.some((e) => e.includes("columns must not be empty"))).toBe(true);
  });

  it("detects invalid version (< 1)", () => {
    const errors = validateRegistryEntries([
      { slug: "users.old", handlerKey: "users.old", version: 0, columns: [{ key: "id" }], validateParameters: () => ({ success: true, data: {} }) },
    ]);
    expect(errors.some((e) => e.includes("version must be >= 1"))).toBe(true);
  });
});

// ── admin-list-reports cross-check ────────────────────────────────────────────

describe("crossCheckDefinitions", () => {
  const registry = new Map<string, RegistryEntry>([
    ["users.dormant",  { slug: "users.dormant",  version: 1 }],
    ["searches.top-routes", { slug: "searches.top-routes", version: 2 }],
  ]);

  it("includes definitions that have a matching registry entry", () => {
    const defs: DbDefinition[] = [
      { slug: "users.dormant", version: 1 },
    ];
    const { included, excluded, warnings } = crossCheckDefinitions(defs, registry);
    expect(included).toHaveLength(1);
    expect(excluded).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("excludes definitions with no registry entry", () => {
    const defs: DbDefinition[] = [
      { slug: "users.dormant", version: 1 },
      { slug: "mystery.report", version: 1 },
    ];
    const { included, excluded, warnings } = crossCheckDefinitions(defs, registry);
    expect(included).toHaveLength(1);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].slug).toBe("mystery.report");
    expect(warnings.some((w) => w.includes("mystery.report"))).toBe(true);
  });

  it("emits a warning when DB version differs from registry version", () => {
    const defs: DbDefinition[] = [
      { slug: "searches.top-routes", version: 1 }, // DB says v1, registry says v2
    ];
    const { included, warnings } = crossCheckDefinitions(defs, registry);
    expect(included).toHaveLength(1);
    expect(warnings.some((w) => w.includes("searches.top-routes"))).toBe(true);
    expect(warnings.some((w) => w.includes("registry version (2)"))).toBe(true);
    expect(warnings.some((w) => w.includes("database version (1)"))).toBe(true);
  });

  it("emits no warning when versions match", () => {
    const defs: DbDefinition[] = [
      { slug: "users.dormant", version: 1 },
    ];
    const { warnings } = crossCheckDefinitions(defs, registry);
    expect(warnings).toHaveLength(0);
  });
});
