// ─────────────────────────────────────────────────────────────────────────────
// Reusable Zod schemas and validation helpers for report parameters.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "https://esm.sh/zod@3";

// ── Hard limits ───────────────────────────────────────────────────────────────

export const LIMITS = {
  DEFAULT_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 500,
  MAX_LIMIT: 500,
  MAX_EXPORT_ROWS: 5_000,
} as const;

// ── Supported timezones ───────────────────────────────────────────────────────

export const SUPPORTED_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
] as const;

export type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];

export const DEFAULT_TIMEZONE: SupportedTimezone = "America/New_York";

// ── Primitive schemas ─────────────────────────────────────────────────────────

export const uuidSchema = z
  .string()
  .uuid("Must be a valid UUID");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((v) => !isNaN(Date.parse(v)), "Date must be a valid calendar date");

export const positiveIntSchema = z
  .number()
  .int("Must be a whole number")
  .positive("Must be greater than zero");

export const pageSchema = z
  .number()
  .int("Must be a whole number")
  .min(0, "Page must be 0 or greater")
  .default(0);

export const pageSizeSchema = z
  .number()
  .int("Must be a whole number")
  .min(1, "Page size must be at least 1")
  .max(LIMITS.MAX_PAGE_SIZE, `Page size cannot exceed ${LIMITS.MAX_PAGE_SIZE}`)
  .default(LIMITS.DEFAULT_PAGE_SIZE);

export const limitSchema = z
  .number()
  .int("Must be a whole number")
  .min(1, "Limit must be at least 1")
  .max(LIMITS.MAX_LIMIT, `Limit cannot exceed ${LIMITS.MAX_LIMIT}`)
  .optional();

export const iataSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "IATA code must be exactly 3 letters");

export const timezoneSchema = z
  .enum(SUPPORTED_TIMEZONES)
  .default(DEFAULT_TIMEZONE);

export const booleanParamSchema = z.boolean().optional();

export const includePiiSchema = z.boolean().optional().default(false);

export const includeSystemActivitySchema = z.boolean().optional().default(false);

/** Filters by user_info.status. 'all' skips the filter. */
export const userStatusSchema = z
  .enum(["all", "current", "pending"])
  .optional()
  .default("all");

// ── Shared flight-search filter schemas ───────────────────────────────────────

/**
 * Filter by result_source.  'unknown' matches rows where result_source is NULL
 * or blank (i.e. count was not recorded).  Null → no filter.
 */
export const resultSourceFilterSchema = z
  .enum(["live_api", "scheduled_bulk_search", "admin_bulk_search", "cache_hit", "unknown"])
  .optional();

/**
 * Filter by triggered_by.  'user' maps to rows where triggered_by IS NULL
 * (normal user-initiated searches).  Null → no filter.
 */
export const triggeredByFilterSchema = z
  .enum(["user", "scheduled_bulk_search", "admin_bulk_search"])
  .optional();

/** Whether to include all-destination searches (arrival_airport IS NULL). */
export const includeAllDestinationsSchema = z.boolean().optional().default(false);

export const granularitySchema = z
  .enum(["day", "week", "month"])
  .optional()
  .default("day");

// ── Date range schema ─────────────────────────────────────────────────────────

export const dateRangeSchema = z
  .object({
    start_date: dateSchema,
    end_date: dateSchema,
  })
  .refine(
    (v) => new Date(v.end_date) >= new Date(v.start_date),
    {
      message: "end_date must not be before start_date",
      path: ["end_date"],
    },
  );

// ── Shared optional airport filter ───────────────────────────────────────────

export const optionalIataSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "IATA code must be exactly 3 letters")
  .optional();

// ── Composable validators ─────────────────────────────────────────────────────

/**
 * Validates start_date and end_date fields from an unknown object.
 * Returns a standard result used by the registry.
 */
export function validateDateRange(raw: unknown): {
  success: true;
  start_date: string;
  end_date: string;
} | { success: false; error: string } {
  const result = dateRangeSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid date range" };
  }
  return { success: true, ...result.data };
}

/**
 * Normalises a raw IATA value to uppercase, or returns null if absent.
 */
export function normalizeIata(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const r = iataSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Clamps a limit value to [1, MAX_LIMIT] and returns the default when absent.
 */
export function clampLimit(raw: unknown, defaultValue: number): number {
  if (raw == null) return defaultValue;
  const n = Number(raw);
  if (!isFinite(n) || n < 1) return defaultValue;
  return Math.min(Math.floor(n), LIMITS.MAX_LIMIT);
}

/**
 * Produces an inclusive-end ISO timestamp for the given YYYY-MM-DD end date
 * by advancing one day and returning the exclusive boundary.
 * Suitable for `WHERE timestamp < exclusiveEndTimestamp(end_date)`.
 */
export function exclusiveEndTimestamp(endDate: string, tz = DEFAULT_TIMEZONE): string {
  const d = new Date(`${endDate}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/**
 * Validates a timezone string against the supported allowlist.
 */
export function validateTimezone(raw: unknown): SupportedTimezone | null {
  const r = timezoneSchema.safeParse(raw);
  return r.success ? r.data : null;
}

// ── Common parameter schemas (composites) ─────────────────────────────────────

/** start_date + end_date required, plus optional limit and granularity. */
export const rangeWithLimitAndGranularity = z.object({
  start_date: dateSchema,
  end_date: dateSchema,
  limit: limitSchema,
  granularity: granularitySchema,
  timezone: timezoneSchema.optional(),
  include_pii: includePiiSchema,
  include_system_activity: includeSystemActivitySchema,
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

/** start_date + end_date required, plus optional limit (no granularity). */
export const rangeWithLimit = z.object({
  start_date: dateSchema,
  end_date: dateSchema,
  limit: limitSchema,
  timezone: timezoneSchema.optional(),
  include_pii: includePiiSchema,
  include_system_activity: includeSystemActivitySchema,
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

/** start_date + end_date only. */
export const rangeOnly = z.object({
  start_date: dateSchema,
  end_date: dateSchema,
  timezone: timezoneSchema.optional(),
  include_pii: includePiiSchema,
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

/**
 * Turns a Zod schema's safeParse into the standard ParameterValidationResult shape.
 */
// deno-lint-ignore no-explicit-any
export function makeValidator(schema: z.ZodTypeAny) {
  return (raw: unknown): { success: true; data: Record<string, unknown> } | { success: false; error: string } => {
    const r = schema.safeParse(raw);
    if (!r.success) {
      return { success: false, error: r.error.issues[0]?.message ?? "Invalid parameters" };
    }
    return { success: true, data: r.data as Record<string, unknown> };
  };
}
