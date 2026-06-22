// ─────────────────────────────────────────────────────────────────────────────
// URL state management for the Admin Reporting view.
//
// Only non-sensitive parameters are ever written to URL search params.
// PII-adjacent keys are explicitly blocked at the encode stage.
// The decode stage validates each value against the report schema and drops
// invalid or unsupported values silently, so deep links degrade gracefully.
//
// Security contract:
//   - FORBIDDEN_PARAM_KEYS are NEVER written to or read from the URL.
//   - Values for email-like or user-id-like keys are always blocked.
//   - The slug is validated against a safe pattern before applying.
//   - All other values are validated against the report's parameter schema.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReportDefinition, ReportParameterField } from "./reportingTypes";

// ── Forbidden key list ────────────────────────────────────────────────────────

// These keys MUST NEVER appear in a URL regardless of the report schema.
export const FORBIDDEN_PARAM_KEYS: ReadonlySet<string> = new Set([
  "include_pii",
  "pii",
  "email",
  "user_email",
  "user_id",
  "userId",
  "uid",
]);

export function isForbiddenKey(key: string): boolean {
  if (FORBIDDEN_PARAM_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  if (lower.endsWith("_email")) return true;
  if (lower.endsWith("_pii"))   return true;
  if (lower.includes("user_id")) return true;
  return false;
}

// ── URL param name for the report slug ───────────────────────────────────────

export const SLUG_PARAM = "report";

// ── Slug validation ───────────────────────────────────────────────────────────

/** Slugs are dot-separated lowercase alphanumeric segments, e.g. "users.top-search-active". */
const SLUG_PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)*$/;

export function readSlugFromUrl(sp: URLSearchParams): string | null {
  const raw = sp.get(SLUG_PARAM);
  if (!raw) return null;
  return SLUG_PATTERN.test(raw) ? raw : null;
}

// ── Allowed fields for URL encoding ──────────────────────────────────────────

export function getAllowedFields(definition: ReportDefinition): ReportParameterField[] {
  return definition.parameter_schema.fields.filter((f) => !isForbiddenKey(f.key));
}

// ── Encode current params → URLSearchParams ───────────────────────────────────

export function encodeUrlState(
  slug:       string | null,
  params:     Record<string, unknown>,
  definition: ReportDefinition | null,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (slug) sp.set(SLUG_PARAM, slug);
  if (!definition) return sp;

  for (const field of getAllowedFields(definition)) {
    const value = params[field.key];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "boolean") {
      sp.set(field.key, value ? "true" : "false");
    } else {
      sp.set(field.key, String(value));
    }
  }
  return sp;
}

// ── Decode URLSearchParams → validated param object ───────────────────────────

export interface DecodeResult {
  params:  Record<string, unknown>;
  skipped: string[];          // keys that were present but failed validation
}

export function decodeUrlState(
  sp:         URLSearchParams,
  definition: ReportDefinition,
): DecodeResult {
  const params:  Record<string, unknown> = {};
  const skipped: string[]                = [];
  const allowed  = getAllowedFields(definition);

  for (const field of allowed) {
    const raw = sp.get(field.key);
    if (raw === null) continue;

    const result = validateUrlParam(field, raw);
    if (result.ok) {
      params[field.key] = result.value;
    } else {
      skipped.push(field.key);
    }
  }

  return { params, skipped };
}

// ── Per-field validation ──────────────────────────────────────────────────────

type ValidationOk    = { ok: true;  value: unknown };
type ValidationError = { ok: false; reason: string };
type ValidationResult = ValidationOk | ValidationError;

function validateUrlParam(
  field: ReportParameterField,
  raw:   string,
): ValidationResult {
  // Belt-and-suspenders: re-check forbidden status even though getAllowedFields filters.
  if (isForbiddenKey(field.key)) return { ok: false, reason: "forbidden key" };

  switch (field.type) {
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))   return { ok: false, reason: "invalid date format" };
      if (isNaN(Date.parse(raw)))               return { ok: false, reason: "invalid calendar date" };
      return { ok: true, value: raw };
    }

    case "number": {
      const n = Number(raw);
      if (!isFinite(n))                                         return { ok: false, reason: "not a finite number" };
      if (field.minimum !== undefined && n < field.minimum)     return { ok: false, reason: "below minimum" };
      if (field.maximum !== undefined && n > field.maximum)     return { ok: false, reason: "above maximum" };
      return { ok: true, value: n };
    }

    case "airport": {
      const code = raw.trim().toUpperCase();
      if (!/^[A-Z]{3,4}$/.test(code)) return { ok: false, reason: "invalid airport code" };
      return { ok: true, value: code };
    }

    case "select": {
      const validOptions = field.options?.map((o) => o.value) ?? [];
      if (!validOptions.includes(raw)) return { ok: false, reason: "unknown option" };
      return { ok: true, value: raw };
    }

    case "boolean": {
      if (raw === "true")  return { ok: true, value: true };
      if (raw === "false") return { ok: true, value: false };
      return { ok: false, reason: "not 'true' or 'false'" };
    }

    case "text": {
      if (raw.length === 0 || raw.length > 200) return { ok: false, reason: "invalid text length" };
      return { ok: true, value: raw };
    }

    default:
      return { ok: false, reason: "unknown field type" };
  }
}
