/** Shared browser-side limits and validation for public flight-result snapshots. */
export const SHARED_FLIGHT_RESULT_MAX_BODY_BYTES = 3 * 1024 * 1024;
export const SHARED_FLIGHT_RESULT_RAW_TOKEN_RE = /^[0-9a-f]{64}$/;

export function isValidSharedFlightResultToken(
  token: unknown,
): token is string {
  return (
    typeof token === "string" && SHARED_FLIGHT_RESULT_RAW_TOKEN_RE.test(token)
  );
}

export function serializeSharedFlightResultRequest(value: unknown): {
  serialized: string;
  byteLength: number;
} {
  const serialized = JSON.stringify(value);
  return {
    serialized,
    byteLength: new TextEncoder().encode(serialized).byteLength,
  };
}
