// ─────────────────────────────────────────────────────────────────────────────
// Server-side formatting helpers for report output.
// All functions are pure (no external imports) for predictability.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Masks an email address for safe display in report output.
 * Keeps the first character of the local part, masks the rest with *,
 * and preserves the domain. Non-reversible.
 *
 * Examples:
 *   kody@example.com  → k***@example.com
 *   ab@x.co           → a***@x.co
 *   @nolocalpart      → ***@nolocalpart (defensive)
 *   notanemail        → ***
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "***";
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const visible = local.length > 0 ? local[0] : "";
  return `${visible}***@${domain}`;
}

/**
 * Strips control characters and leading/trailing whitespace from a string.
 * Returns an empty string for non-string inputs.
 */
export function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "").trim();
}

/**
 * Normalises database nulls, undefined, and empty strings to null.
 * Returns the value unchanged for all other types.
 */
export function normalizeNull(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  return value;
}

/**
 * Safely converts an unknown database value to a number.
 * Returns null for non-finite values (NaN, Infinity, undefined, null, '').
 */
export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isFinite(n) ? n : null;
}

/**
 * Calculates `(numerator / denominator) * 100`, rounded to one decimal place.
 * Returns null if the denominator is zero or either argument is null.
 */
export function percentage(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Clamps `value` to [1, max].  Falls back to `defaultValue` when `value`
 * is null, undefined, non-finite, or below 1.
 */
export function clampLimit(
  value: unknown,
  max: number,
  defaultValue: number,
): number {
  const n = Number(value);
  if (!isFinite(n) || n < 1) return defaultValue;
  return Math.min(Math.floor(n), max);
}

/**
 * Returns an exclusive upper-bound ISO timestamp for a `YYYY-MM-DD` end date.
 * Advances the date by one calendar day so it can be used in
 * `WHERE ts < exclusiveEndTimestamp(end_date)` filters.
 */
export function exclusiveEndTimestamp(endDate: string): string {
  const d = new Date(`${endDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/**
 * Returns the email value when `includePii` is true, otherwise a masked version.
 */
export function maybeEmail(email: string | null, includePii: boolean): string | null {
  if (email === null || email === undefined) return null;
  return includePii ? email : maskEmail(email);
}

/**
 * Returns a dash placeholder string for values that are null or undefined.
 * Intended for display-layer null handling, not DB storage.
 */
export function displayNull(value: unknown, placeholder = "—"): unknown {
  return value === null || value === undefined ? placeholder : value;
}
