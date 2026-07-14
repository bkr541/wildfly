import { describe, expect, it } from "vitest";
import { sanitizeSharedFlightResultPayload } from "../../supabase/functions/_shared/sharedFlightResultSecurity";

describe("sanitizeSharedFlightResultPayload", () => {
  it("recursively removes credentials and header collections", () => {
    const sanitized = sanitizeSharedFlightResultPayload({
      response: {
        flights: [{ id: "F9-1", token: "secret", nested: { Authorization: "Bearer secret" } }],
      },
      headers: { cookie: "session=secret" },
      request_headers: { "x-api-key": "secret" },
      requestHeaders: { accessToken: "secret" },
      Credentials: { clientSecret: "secret" },
      access_token: "secret",
      safe: "kept",
    });

    expect(sanitized).toEqual({
      response: { flights: [{ id: "F9-1", nested: {} }] },
      safe: "kept",
    });
  });

  it("bounds adversarial nesting", () => {
    let value: Record<string, unknown> = { leaf: "kept" };
    for (let index = 0; index < 40; index += 1) value = { nested: value };

    const serialized = JSON.stringify(sanitizeSharedFlightResultPayload(value));
    expect(serialized.length).toBeLessThan(JSON.stringify(value).length);
    expect(serialized).toContain("null");
  });

  it("does not mutate the original payload", () => {
    const payload = { safe: { value: 1 }, authorization: "secret" };
    sanitizeSharedFlightResultPayload(payload);
    expect(payload).toEqual({ safe: { value: 1 }, authorization: "secret" });
  });
});
