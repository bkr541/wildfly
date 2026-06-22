// ─────────────────────────────────────────────────────────────────────────────
// Pure engine helpers used by admin-run-report.
// No Deno globals, no external imports — only reportFormatting.ts dep.
// Extracted so logic can be unit-tested without running an Edge Function.
// ─────────────────────────────────────────────────────────────────────────────
import { maskEmail } from "./reportFormatting.ts";
import { LIMITS } from "./reportValidation.ts";

// ── Stable error codes ────────────────────────────────────────────────────────

export const ERROR_CODES = {
  REPORT_NOT_FOUND:        "REPORT_NOT_FOUND",
  REPORT_INACTIVE:         "REPORT_INACTIVE",
  REPORT_VERSION_MISMATCH: "REPORT_VERSION_MISMATCH",
  INVALID_PARAMETERS:      "INVALID_PARAMETERS",
  REPORT_NOT_IMPLEMENTED:  "REPORT_NOT_IMPLEMENTED",
  REPORT_TIMEOUT:          "REPORT_TIMEOUT",
  REPORT_EXECUTION_FAILED: "REPORT_EXECUTION_FAILED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ── Handler timeout ───────────────────────────────────────────────────────────

export const HANDLER_TIMEOUT_MS = 15_000;

/**
 * Races `promise` against a timeout. Throws `new Error("REPORT_TIMEOUT")`
 * when the timeout fires so `mapErrorCode` maps it correctly.
 */
export async function withTimeout<T>(promise: Promise<T>, ms = HANDLER_TIMEOUT_MS): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error("REPORT_TIMEOUT")), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timerId!);
  }
}

// ── Error code mapping ────────────────────────────────────────────────────────

/**
 * Maps a thrown error to a stable, client-safe error code.
 * Does NOT include raw stack traces or SQL text in the returned code.
 */
export function mapErrorCode(err: Error): ErrorCode {
  const msg = (err.message ?? "").trim();
  if (msg === "REPORT_NOT_IMPLEMENTED") return ERROR_CODES.REPORT_NOT_IMPLEMENTED;
  if (msg === "REPORT_TIMEOUT")         return ERROR_CODES.REPORT_TIMEOUT;
  return ERROR_CODES.REPORT_EXECUTION_FAILED;
}

/**
 * Returns a sanitized, safe-to-expose error message.
 * Strips potential credentials, SQL fragments, and long stack traces.
 */
export function sanitizeErrorMessage(err: Error): string {
  const msg = (err.message ?? "Unknown error").slice(0, 500);
  if (msg === "REPORT_NOT_IMPLEMENTED") return "This report has not been implemented yet.";
  if (msg === "REPORT_TIMEOUT") return "The report timed out. Try a shorter date range or add filters.";
  return "Report execution failed. Check server logs for details.";
}

// ── Parameter merging ─────────────────────────────────────────────────────────

/**
 * Merges database default_parameters with caller-submitted parameters.
 * Caller values override defaults. Neither side is mutated.
 */
export function mergeParameters(
  defaults: Record<string, unknown>,
  submitted: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaults, ...submitted };
}

// ── Pagination clamping ───────────────────────────────────────────────────────

export function clampPage(raw: unknown): number {
  const n = Number(raw);
  return isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function clampPageSize(raw: unknown): number {
  const n = Number(raw);
  if (!isFinite(n) || n < 1) return LIMITS.DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), LIMITS.MAX_PAGE_SIZE);
}

// ── Row limit enforcement ─────────────────────────────────────────────────────

/**
 * Hard-caps returned rows at `cap`. Returns truncated=true when rows were cut.
 * Acts as a safety net when a handler accidentally returns too many rows.
 */
export function enforceRowLimit(
  rows: Record<string, unknown>[],
  cap: number,
): { rows: Record<string, unknown>[]; truncated: boolean } {
  if (rows.length <= cap) return { rows, truncated: false };
  return { rows: rows.slice(0, cap), truncated: true };
}

// ── PII masking ───────────────────────────────────────────────────────────────

/**
 * Determines whether full PII should be returned.
 *
 * Rules:
 * - If the report definition does not contain PII, PII mode is always false.
 * - Otherwise, returns the caller's explicit include_pii flag.
 */
export function shouldIncludePii(
  registryContainsPii: boolean,
  requestedPii: boolean,
): boolean {
  if (!registryContainsPii) return false;
  return requestedPii === true;
}

/**
 * Masks PII columns in every row when `includePii` is false.
 * Email-named columns use the masked email format; all others are redacted.
 */
export function applyPiiMask(
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
