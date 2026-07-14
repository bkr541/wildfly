/** Security contracts shared by the public flight-share Edge Functions. */
export const SHARED_FLIGHT_RESULT_MAX_BODY_BYTES = 3 * 1024 * 1024;
export const SHARED_FLIGHT_RESULT_RAW_TOKEN_RE = /^[0-9a-f]{64}$/;

const MAX_SANITIZE_DEPTH = 30;
const SENSITIVE_KEYS = new Set([
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "token",
  "apikey",
  "xapikey",
  "jwt",
  "password",
  "clientsecret",
  "secret",
  "credential",
  "credentials",
  "headers",
  "requestheaders",
  "responseheaders",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Recursively removes credentials and request headers before raw search data is
 * persisted. Objects deeper than the bounded traversal limit are replaced with
 * null so adversarial nesting cannot consume unbounded stack or CPU.
 */
export function sanitizeSharedFlightResultPayload(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return null;
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeSharedFlightResultPayload(item, depth + 1),
    );
  }
  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SENSITIVE_KEYS.has(normalizeKey(key))) continue;
      sanitized[key] = sanitizeSharedFlightResultPayload(
        nestedValue,
        depth + 1,
      );
    }
    return sanitized;
  }
  return value;
}

export function normalizePublicAppUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return null;
    if (parsed.username || parsed.password) return null;
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}
