// ─────────────────────────────────────────────────────────────────────────────
// Reporting formatters.
//
// Each formatter accepts `unknown` so callers can pass raw row cell values
// without first narrowing them. Every formatter returns a string and never
// throws — invalid or unrepresentable values render as the null sentinel "—"
// rather than crashing the Reporting view.
//
// Locale: "en-US" is used throughout. If the project ever needs locale-
// switching, replace the string literal with a context-driven locale value.
//
// Currency: defaults to USD. Pass `currency` to the currency formatter for
// other ISO 4217 codes.
//
// Duration: input is milliseconds (the unit used by the Edge Functions).
// ─────────────────────────────────────────────────────────────────────────────

import type { ReportColumnType, ReportMetricType } from "./reportingTypes";

/** Rendered when a value is null, undefined, empty, or unrepresentable. */
export const NULL_DISPLAY = "—";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** True only for null and undefined — not for 0, false, or empty string. */
function isAbsent(v: unknown): v is null | undefined {
  return v === null || v === undefined;
}

/** Safely coerce a value to a finite number, or return null. */
function toFiniteNumber(v: unknown): number | null {
  if (isAbsent(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Number
// ─────────────────────────────────────────────────────────────────────────────

const NUMBER_FMT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/**
 * Format a numeric value with up to 2 decimal places.
 * Integers render without a decimal point.
 *
 * @example formatNumber(1234567.5) → "1,234,567.5"
 */
export function formatNumber(value: unknown): string {
  const n = toFiniteNumber(value);
  return n !== null ? NUMBER_FMT.format(n) : NULL_DISPLAY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Percent
// ─────────────────────────────────────────────────────────────────────────────

const PERCENT_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/**
 * Format a value that is already in the 0–100 range (not 0–1).
 * The "%" suffix is appended without calling Intl's percent style
 * (which would multiply by 100 again).
 *
 * @example formatPercent(87.5) → "87.5%"
 */
export function formatPercent(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n === null) return NULL_DISPLAY;
  return `${PERCENT_FMT.format(n)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency
// ─────────────────────────────────────────────────────────────────────────────

const currencyFmtCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFmt(currency: string): Intl.NumberFormat {
  if (!currencyFmtCache.has(currency)) {
    currencyFmtCache.set(
      currency,
      new Intl.NumberFormat("en-US", {
        style:                "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }
  return currencyFmtCache.get(currency)!;
}

/**
 * Format a currency value. Defaults to USD.
 *
 * @example formatCurrency(199.5) → "$199.50"
 * @example formatCurrency(null)  → "—"
 */
export function formatCurrency(value: unknown, currency = "USD"): string {
  const n = toFiniteNumber(value);
  if (n === null) return NULL_DISPLAY;
  try {
    return getCurrencyFmt(currency).format(n);
  } catch {
    // Unknown currency code — fall back to raw number.
    return NUMBER_FMT.format(n);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date
// ─────────────────────────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day:   "numeric",
  year:  "numeric",
  // No timeZone specified — uses the runtime's local timezone.
  // Date-only values (YYYY-MM-DD) are parsed as UTC noon to avoid DST
  // ambiguity with the midnight UTC midnight-to-local-date shift.
});

/**
 * Format a date-only value (YYYY-MM-DD or ISO string).
 * Does not display time. Returns NULL_DISPLAY for unparseable values.
 *
 * @example formatDate("2026-06-22") → "Jun 22, 2026"
 */
export function formatDate(value: unknown): string {
  if (isAbsent(value) || value === "") return NULL_DISPLAY;
  const s = String(value);
  // For bare YYYY-MM-DD, parse as UTC noon to avoid date boundary issues.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00Z` : s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return NULL_DISPLAY;
  return DATE_FMT.format(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Datetime
// ─────────────────────────────────────────────────────────────────────────────

const DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
  month:   "short",
  day:     "numeric",
  year:    "numeric",
  hour:    "numeric",
  minute:  "2-digit",
  hour12:  true,
});

/**
 * Format a datetime value (ISO 8601 string or timestamp number).
 *
 * @example formatDatetime("2026-06-22T14:30:00Z") → "Jun 22, 2026, 2:30 PM"
 */
export function formatDatetime(value: unknown): string {
  if (isAbsent(value) || value === "") return NULL_DISPLAY;
  const d = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (isNaN(d.getTime())) return NULL_DISPLAY;
  return DATETIME_FMT.format(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Duration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a duration in milliseconds as a human-readable string.
 *
 * Ranges:
 *   < 1 s   → "Xms"
 *   < 60 s  → "X.Xs"
 *   ≥ 60 s  → "Xm Ys"  (or "Xm" when seconds are 0)
 *
 * @example formatDuration(250)    → "250ms"
 * @example formatDuration(3500)   → "3.5s"
 * @example formatDuration(90000)  → "1m 30s"
 * @example formatDuration(120000) → "2m"
 */
export function formatDuration(value: unknown): string {
  const ms = toFiniteNumber(value);
  if (ms === null || ms < 0) return NULL_DISPLAY;
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1_000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Boolean
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a boolean value as "Yes" or "No".
 * String "true"/"false" values are also handled (common in JSON rows).
 */
export function formatBoolean(value: unknown): string {
  if (isAbsent(value)) return NULL_DISPLAY;
  if (value === true  || value === "true")  return "Yes";
  if (value === false || value === "false") return "No";
  return NULL_DISPLAY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a text value. Empty string renders as NULL_DISPLAY.
 * Non-string types are coerced via String(). Objects render as "[object Object]"
 * which the caller should prevent upstream.
 */
export function formatText(value: unknown): string {
  if (isAbsent(value)) return NULL_DISPLAY;
  const s = String(value);
  return s.trim() === "" ? NULL_DISPLAY : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic cell formatter
//
// Dispatches to the right formatter based on a ReportColumnType or
// ReportMetricType. Used by the table and summary-metric renderers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a report cell value using the column type from the report definition.
 *
 * @param value - Raw cell value from the report row (unknown at network boundary)
 * @param type  - Column type as returned by the Edge Function
 */
export function formatCell(
  value: unknown,
  type: ReportColumnType | ReportMetricType | undefined,
): string {
  switch (type) {
    case "number":
      return formatNumber(value);
    case "percent":
      return formatPercent(value);
    case "currency":
      return formatCurrency(value);
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDatetime(value);
    case "duration":
      return formatDuration(value);
    case "boolean":
      return formatBoolean(value);
    case "text":
    default:
      return formatText(value);
  }
}
