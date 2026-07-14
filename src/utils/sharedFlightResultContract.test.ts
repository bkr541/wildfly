import { describe, expect, it } from "vitest";
import {
  isValidSharedFlightResultToken,
  serializeSharedFlightResultRequest,
  SHARED_FLIGHT_RESULT_MAX_BODY_BYTES as CLIENT_LIMIT,
} from "./sharedFlightResultContract";
import {
  SHARED_FLIGHT_RESULT_MAX_BODY_BYTES as EDGE_LIMIT,
  SHARED_FLIGHT_RESULT_RAW_TOKEN_RE,
  normalizePublicAppUrl,
} from "../../supabase/functions/_shared/sharedFlightResultSecurity";

describe("shared flight-result contract", () => {
  it("keeps the client and Edge Function UTF-8 body limits identical", () => {
    expect(CLIENT_LIMIT).toBe(3 * 1024 * 1024);
    expect(EDGE_LIMIT).toBe(CLIENT_LIMIT);
  });

  it("measures serialized JSON as UTF-8 bytes", () => {
    const ascii = serializeSharedFlightResultRequest({ value: "aaa" });
    const nonAscii = serializeSharedFlightResultRequest({ value: "✈✈✈" });

    expect(nonAscii.serialized.length).toBe(ascii.serialized.length);
    expect(nonAscii.byteLength).toBeGreaterThan(ascii.byteLength);
  });

  it("accepts only exact 64-character lowercase hexadecimal tokens", () => {
    const valid = "a".repeat(64);
    expect(isValidSharedFlightResultToken(valid)).toBe(true);
    expect(SHARED_FLIGHT_RESULT_RAW_TOKEN_RE.test(valid)).toBe(true);
    expect(isValidSharedFlightResultToken("A".repeat(64))).toBe(false);
    expect(isValidSharedFlightResultToken("a".repeat(63))).toBe(false);
    expect(isValidSharedFlightResultToken(`${"a".repeat(63)}g`)).toBe(false);
  });

  it("normalizes only credential-free HTTP(S) public application URLs", () => {
    expect(normalizePublicAppUrl("https://wildfly.example///")).toBe("https://wildfly.example");
    expect(normalizePublicAppUrl("https://user:secret@wildfly.example")).toBeNull();
    expect(normalizePublicAppUrl("javascript:alert(1)")).toBeNull();
    expect(normalizePublicAppUrl("not a url")).toBeNull();
  });
});
