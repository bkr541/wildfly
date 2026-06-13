import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FlightShareError,
  createFlightSearchShare,
  getPublicFlightSearchShare,
  type CreateFlightSearchShareRequest,
} from "./flightSearchShares";
import {
  normalizeStoredFlightShare,
} from "@/utils/flightShareNormalize";
import type { FlightShareModel } from "@/utils/flightShareModel";

// ── Mock Supabase client ───────────────────────────────────────────────────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeMinimalModel(overrides: Partial<FlightShareModel> = {}): FlightShareModel {
  return {
    originLabel:       "Chicago",
    destinationLabel:  "Orlando",
    tripTypeLabel:     "One-way",
    combinedDateLabel: "Fri, Jun 13, 2026 • One-way",
    heroImageUrl:      "/assets/locations/42_background.png",
    arrivalImageUrl:   "/assets/locations/55_background.png",
    totalOptionCount:  3,
    totalNonstopCount: 2,
    totalGoWildCount:  1,
    hasResults:        true,
    sections:          [
      {
        sectionType:        "ONE-WAY",
        label:              "One-Way",
        dateValue:          "2026-06-13",
        formattedDateLabel: "Fri, Jun 13",
        totalCount:         3,
        nonstopCount:       2,
        goWildCount:        1,
        airportGroups:      [
          {
            iata:        "ORD",
            name:        "O'Hare International",
            city:        "Chicago",
            stateCode:   "IL",
            country:     "United States of America",
            locationId:  42,
            optionCount: 3,
            options:     [
              {
                canonicalKey:       "F9123|ORD>MCO|2026-06-13T07:00:00",
                airline:            "Frontier",
                carrierCode:        "F9",
                departureTimeLabel: "7:00 AM",
                arrivalTimeLabel:   "10:30 AM",
                departureRaw:       "2026-06-13T07:00:00",
                arrivalRaw:         "2026-06-13T10:30:00",
                timeOfDay:          "MORNING",
                route:              "ORD>MCO",
                routeAirports:      ["ORD", "MCO"],
                stopCount:          0,
                isNonstop:          true,
                isPlusOneDay:       false,
                formattedDuration:  "2h 30m",
                flightNumbers:      ["F9123"],
                lowestPublicFare:   89,
                goWildFare:         null,
                isGoWild:           false,
                goWildSeats:        null,
                emphasizedFare:     89,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeCreateRequest(
  overrides: Partial<CreateFlightSearchShareRequest> = {},
): CreateFlightSearchShareRequest {
  return {
    modelVersion:  1,
    shareModel:    makeMinimalModel(),
    departureDate: "2026-06-13",
    returnDate:    null,
    expiresInDays: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. normalizeStoredFlightShare
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeStoredFlightShare", () => {
  it("returns the payload as-is for model version 1", () => {
    const model = makeMinimalModel();
    const result = normalizeStoredFlightShare(1, model);
    expect(result).toBe(model);
  });

  it("throws UNSUPPORTED_VERSION for version 2", () => {
    expect(() => normalizeStoredFlightShare(2, {})).toThrow("UNSUPPORTED_VERSION");
  });

  it("throws UNSUPPORTED_VERSION for version 0", () => {
    expect(() => normalizeStoredFlightShare(0, {})).toThrow("UNSUPPORTED_VERSION");
  });

  it("throws UNSUPPORTED_VERSION for negative version", () => {
    expect(() => normalizeStoredFlightShare(-1, {})).toThrow("UNSUPPORTED_VERSION");
  });

  it("throws INVALID_PAYLOAD for null payload at version 1", () => {
    expect(() => normalizeStoredFlightShare(1, null)).toThrow("INVALID_PAYLOAD");
  });

  it("throws INVALID_PAYLOAD for array payload at version 1", () => {
    expect(() => normalizeStoredFlightShare(1, [])).toThrow("INVALID_PAYLOAD");
  });

  it("throws INVALID_PAYLOAD for string payload at version 1", () => {
    expect(() => normalizeStoredFlightShare(1, "not an object")).toThrow("INVALID_PAYLOAD");
  });

  it("does not coerce malformed data silently — returns the raw object for the caller to validate", () => {
    const partial = { originLabel: "Chicago" };
    const result = normalizeStoredFlightShare(1, partial);
    expect(result).toBe(partial);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FlightShareError
// ─────────────────────────────────────────────────────────────────────────────

describe("FlightShareError", () => {
  it("preserves kind and message", () => {
    const err = new FlightShareError("NOT_FOUND", "not found");
    expect(err.kind).toBe("NOT_FOUND");
    expect(err.message).toBe("not found");
    expect(err.name).toBe("FlightShareError");
  });

  it("is an instance of Error", () => {
    expect(new FlightShareError("SERVER_ERROR", "oops")).toBeInstanceOf(Error);
  });

  it("supports all error kinds", () => {
    const kinds = [
      "NOT_FOUND",
      "EXPIRED",
      "REVOKED",
      "VALIDATION",
      "UNAUTHENTICATED",
      "UNSUPPORTED_VERSION",
      "SERVER_ERROR",
    ] as const;
    for (const kind of kinds) {
      const err = new FlightShareError(kind, "msg");
      expect(err.kind).toBe(kind);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Token format and hash consistency
//    (Tests the same SHA-256 logic as the Edge Functions, using jsdom's
//     Web Crypto API — the algorithm is identical.)
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a 256-bit hex token (mirrors Edge Function generateRawToken). */
function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hex digest (mirrors Edge Function hashToken). */
async function hashToken(rawToken: string): Promise<string> {
  const data       = new TextEncoder().encode(rawToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("token format", () => {
  it("raw token is exactly 64 lowercase hex characters (256 bits)", () => {
    const token = generateRawToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("each generated token is unique", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateRawToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("token hashing", () => {
  it("hash is exactly 64 lowercase hex characters", async () => {
    const token = generateRawToken();
    const hash  = await hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same raw token always produces the same hash (deterministic)", async () => {
    const token  = generateRawToken();
    const hash1  = await hashToken(token);
    const hash2  = await hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it("different raw tokens produce different hashes", async () => {
    const hash1 = await hashToken(generateRawToken());
    const hash2 = await hashToken(generateRawToken());
    expect(hash1).not.toBe(hash2);
  });

  it("hash and raw token are distinct values", async () => {
    const token = generateRawToken();
    const hash  = await hashToken(token);
    expect(hash).not.toBe(token);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. createFlightSearchShare service
// ─────────────────────────────────────────────────────────────────────────────

describe("createFlightSearchShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns structured response on success", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok:        true,
        shareId:   "share-uuid-abc",
        publicUrl: "https://app.wildfly.co/share/flights/deadbeef",
        createdAt: "2026-06-13T10:00:00Z",
        expiresAt: null,
      },
      error: null,
    });

    const result = await createFlightSearchShare(makeCreateRequest());

    expect(result.shareId).toBe("share-uuid-abc");
    expect(result.publicUrl).toBe("https://app.wildfly.co/share/flights/deadbeef");
    expect(result.createdAt).toBe("2026-06-13T10:00:00Z");
    expect(result.expiresAt).toBeNull();
  });

  it("throws UNAUTHENTICATED when the function returns 401-style error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("Unauthorized"),
    });

    await expect(createFlightSearchShare(makeCreateRequest())).rejects.toMatchObject({
      kind: "UNAUTHENTICATED",
    });
  });

  it("throws UNAUTHENTICATED when the function body says Unauthorized", async () => {
    mockInvoke.mockResolvedValue({
      data:  { ok: false, error: "Unauthorized" },
      error: null,
    });

    await expect(createFlightSearchShare(makeCreateRequest())).rejects.toMatchObject({
      kind: "UNAUTHENTICATED",
    });
  });

  it("throws VALIDATION when the function body returns validation error", async () => {
    mockInvoke.mockResolvedValue({
      data:  { ok: false, error: "Validation failed" },
      error: null,
    });

    await expect(createFlightSearchShare(makeCreateRequest())).rejects.toMatchObject({
      kind: "VALIDATION",
    });
  });

  it("throws SERVER_ERROR for generic failures", async () => {
    mockInvoke.mockResolvedValue({
      data:  { ok: false, error: "Database unavailable" },
      error: null,
    });

    await expect(createFlightSearchShare(makeCreateRequest())).rejects.toMatchObject({
      kind: "SERVER_ERROR",
    });
  });

  it("throws FlightShareError (not a raw Supabase error) on function invocation error", async () => {
    mockInvoke.mockResolvedValue({
      data:  null,
      error: new Error("network timeout"),
    });

    const err = await createFlightSearchShare(makeCreateRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(FlightShareError);
  });

  it("two calls with identical data produce calls to the Edge Function both times (new row each time)", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        data: {
          ok:        true,
          shareId:   "share-id-1",
          publicUrl: "https://app.wildfly.co/share/flights/aaaaaa",
          createdAt: "2026-06-13T10:00:00Z",
          expiresAt: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ok:        true,
          shareId:   "share-id-2",
          publicUrl: "https://app.wildfly.co/share/flights/bbbbbb",
          createdAt: "2026-06-13T10:01:00Z",
          expiresAt: null,
        },
        error: null,
      });

    const req    = makeCreateRequest();
    const first  = await createFlightSearchShare(req);
    const second = await createFlightSearchShare(req);

    // Each call creates an independent share — different IDs and URLs
    expect(first.shareId).toBe("share-id-1");
    expect(second.shareId).toBe("share-id-2");
    expect(first.publicUrl).not.toBe(second.publicUrl);

    // The Edge Function was called twice — never mutated an existing row
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenNthCalledWith(
      1,
      "create-flight-search-share",
      expect.objectContaining({ body: req }),
    );
    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      "create-flight-search-share",
      expect.objectContaining({ body: req }),
    );
  });

  it("does not pass owner_user_id in the request body (server derives it from JWT)", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true, shareId: "x", publicUrl: "https://a.b/share/flights/x",
        createdAt: "2026-06-13T00:00:00Z", expiresAt: null,
      },
      error: null,
    });

    await createFlightSearchShare(makeCreateRequest());

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body).not.toHaveProperty("owner_user_id");
    expect(opts.body).not.toHaveProperty("userId");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. getPublicFlightSearchShare service
// ─────────────────────────────────────────────────────────────────────────────

describe("getPublicFlightSearchShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validToken = "a".repeat(64); // 64-char hex string (placeholder)

  it("returns normalized share model on success", async () => {
    const model = makeMinimalModel();
    mockInvoke.mockResolvedValue({
      data: {
        ok:           true,
        modelVersion: 1,
        shareModel:   model,
        createdAt:    "2026-06-13T10:00:00Z",
        expiresAt:    null,
      },
      error: null,
    });

    const result = await getPublicFlightSearchShare(validToken);

    expect(result.modelVersion).toBe(1);
    expect(result.shareModel).toStrictEqual(model);
    expect(result.createdAt).toBe("2026-06-13T10:00:00Z");
    expect(result.expiresAt).toBeNull();
  });

  it("public response never contains owner_user_id", async () => {
    const model = makeMinimalModel();
    // Simulate a response that accidentally includes owner_user_id
    // (the Edge Function should never do this, but the service must not pass it through)
    mockInvoke.mockResolvedValue({
      data: {
        ok:           true,
        modelVersion: 1,
        shareModel:   model,
        createdAt:    "2026-06-13T10:00:00Z",
        expiresAt:    null,
        owner_user_id: "should-not-appear",
      },
      error: null,
    });

    const result = await getPublicFlightSearchShare(validToken);
    expect(result).not.toHaveProperty("owner_user_id");
  });

  it("public response never contains public_token_hash", async () => {
    const model = makeMinimalModel();
    mockInvoke.mockResolvedValue({
      data: {
        ok:                true,
        modelVersion:      1,
        shareModel:        model,
        createdAt:         "2026-06-13T10:00:00Z",
        expiresAt:         null,
        public_token_hash: "should-not-appear",
      },
      error: null,
    });

    const result = await getPublicFlightSearchShare(validToken);
    expect(result).not.toHaveProperty("public_token_hash");
  });

  it("throws NOT_FOUND when the function returns not found error", async () => {
    mockInvoke.mockResolvedValue({
      data:  { ok: false, error: "Share not found or no longer available" },
      error: null,
    });

    await expect(getPublicFlightSearchShare(validToken)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
  });

  it("throws NOT_FOUND for expired links (the Edge Function returns not found for expired)", async () => {
    mockInvoke.mockResolvedValue({
      data:  { ok: false, error: "Share not found or no longer available" },
      error: null,
    });

    await expect(getPublicFlightSearchShare(validToken)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
  });

  it("throws NOT_FOUND for revoked links", async () => {
    mockInvoke.mockResolvedValue({
      data:  { ok: false, error: "Share not found or no longer available" },
      error: null,
    });

    await expect(getPublicFlightSearchShare(validToken)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
  });

  it("throws UNSUPPORTED_VERSION for unknown model version", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok:           true,
        modelVersion: 99,
        shareModel:   { originLabel: "X" },
        createdAt:    "2026-06-13T10:00:00Z",
        expiresAt:    null,
      },
      error: null,
    });

    await expect(getPublicFlightSearchShare(validToken)).rejects.toMatchObject({
      kind: "UNSUPPORTED_VERSION",
    });
  });

  it("throws UNSUPPORTED_VERSION when function body says unsupported version", async () => {
    mockInvoke.mockResolvedValue({
      data:  { ok: false, error: "Unsupported share version" },
      error: null,
    });

    await expect(getPublicFlightSearchShare(validToken)).rejects.toMatchObject({
      kind: "UNSUPPORTED_VERSION",
    });
  });

  it("throws SERVER_ERROR for malformed payload at version 1 (null shareModel)", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok:           true,
        modelVersion: 1,
        shareModel:   null,
        createdAt:    "2026-06-13T10:00:00Z",
        expiresAt:    null,
      },
      error: null,
    });

    await expect(getPublicFlightSearchShare(validToken)).rejects.toMatchObject({
      kind: "SERVER_ERROR",
    });
  });

  it("throws FlightShareError (not a raw error) on function invocation failure", async () => {
    mockInvoke.mockResolvedValue({
      data:  null,
      error: new Error("connection refused"),
    });

    const err = await getPublicFlightSearchShare(validToken).catch((e) => e);
    expect(err).toBeInstanceOf(FlightShareError);
  });

  it("does not send auth header (anonymous access — no JWT needed)", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true, modelVersion: 1, shareModel: makeMinimalModel(),
        createdAt: "2026-06-13T00:00:00Z", expiresAt: null,
      },
      error: null,
    });

    await getPublicFlightSearchShare(validToken);

    const [fnName, opts] = mockInvoke.mock.calls[0];
    expect(fnName).toBe("get-public-flight-search-share");
    // The service must not inject a hardcoded auth header
    const headers = opts?.headers ?? {};
    expect(headers).not.toHaveProperty("Authorization");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Immutability guarantees (service-layer assertions)
// ─────────────────────────────────────────────────────────────────────────────

describe("immutability — no mutation of existing share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a second createFlightSearchShare call never reuses a previous shareId", async () => {
    const makeSuccessResponse = (n: number) => ({
      data: {
        ok:        true,
        shareId:   `uuid-${n}`,
        publicUrl: `https://app.wildfly.co/share/flights/${"x".repeat(60)}${n}`,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      },
      error: null,
    });

    mockInvoke
      .mockResolvedValueOnce(makeSuccessResponse(1))
      .mockResolvedValueOnce(makeSuccessResponse(2))
      .mockResolvedValueOnce(makeSuccessResponse(3));

    const req = makeCreateRequest();
    const results = await Promise.all([
      createFlightSearchShare(req),
      createFlightSearchShare(req),
      createFlightSearchShare(req),
    ]);

    const ids  = results.map((r) => r.shareId);
    const urls = results.map((r) => r.publicUrl);

    // All IDs are distinct — each call created a new row
    expect(new Set(ids).size).toBe(3);
    // All URLs are distinct
    expect(new Set(urls).size).toBe(3);
    // Edge Function was called 3× — no deduplication or reuse
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });
});
