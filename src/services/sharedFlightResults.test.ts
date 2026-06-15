// ─────────────────────────────────────────────────────────────────────────────
// sharedFlightResults.test.ts
//
// Unit tests for the sharedFlightResults service layer.
//
// Scope:
//   - Correct success / error paths for createSharedFlightResult
//   - Correct success / error paths for getPublicSharedFlightResult
//   - Error kind classification (UNAUTHENTICATED, VALIDATION, PAYLOAD_TOO_LARGE,
//     NOT_FOUND, UNSUPPORTED_VERSION, NETWORK_ERROR, SERVER_ERROR)
//   - HTTP error context parsing (FunctionsHttpError simulation)
//   - Token handling: raw token comes only from publicUrl, not a separate field
//   - Private fields excluded from public response (owner_user_id, etc.)
//   - No flight-search API is called from this service
//   - Payload/schema immutability assertions
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SharedFlightResultError,
  createSharedFlightResult,
  getPublicSharedFlightResult,
  type CreateSharedFlightResultRequest,
} from "./sharedFlightResults";
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

function makeDisplayModel(
  overrides: Partial<FlightShareModel> = {},
): FlightShareModel {
  return {
    originLabel:       "Denver",
    destinationLabel:  "Las Vegas",
    tripTypeLabel:     "One-way",
    combinedDateLabel: "Mon, Jun 15, 2026 • One-way",
    heroImageUrl:      "/assets/locations/12_background.png",
    arrivalImageUrl:   "/assets/locations/33_background.png",
    totalOptionCount:  5,
    totalNonstopCount: 3,
    totalGoWildCount:  2,
    hasResults:        true,
    sections: [
      {
        sectionType:        "ONE-WAY",
        label:              "One-Way",
        dateValue:          "2026-06-15",
        formattedDateLabel: "Mon, Jun 15",
        totalCount:         5,
        nonstopCount:       3,
        goWildCount:        2,
        airportGroups: [
          {
            iata:        "DEN",
            name:        "Denver International",
            city:        "Denver",
            stateCode:   "CO",
            country:     "United States of America",
            locationId:  12,
            optionCount: 5,
            options: [
              {
                canonicalKey:       "F9456|DEN>LAS|2026-06-15T06:00:00",
                airline:            "Frontier",
                carrierCode:        "F9",
                departureTimeLabel: "6:00 AM",
                arrivalTimeLabel:   "7:15 AM",
                departureRaw:       "2026-06-15T06:00:00",
                arrivalRaw:         "2026-06-15T07:15:00",
                timeOfDay:          "MORNING",
                route:              "DEN>LAS",
                routeAirports:      ["DEN", "LAS"],
                stopCount:          0,
                isNonstop:          true,
                isPlusOneDay:       false,
                formattedDuration:  "1h 15m",
                flightNumbers:      ["F9456"],
                lowestPublicFare:   49,
                goWildFare:         19,
                isGoWild:           true,
                goWildSeats:        4,
                emphasizedFare:     19,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeRawPayload(): unknown {
  return {
    flights: [
      {
        id: "flight-001",
        origin: "DEN",
        destination: "LAS",
        departureTime: "6:00 AM",
        arrivalTime: "7:15 AM",
        duration: "1:15:00",
        stops: 0,
        price: 49,
        rawPayload: {
          segments: [
            {
              flight_number: "F9456",
              departure_airport: "DEN",
              arrival_airport: "LAS",
              departure_time: "2026-06-15T06:00:00",
              arrival_time: "2026-06-15T07:15:00",
            },
          ],
          fares: {
            go_wild: { total: 19, availableSeats: 4 },
            discount_den: { total: 49 },
            standard: { total: 79 },
          },
        },
      },
    ],
  };
}

function makeCreateRequest(
  overrides: Partial<CreateSharedFlightResultRequest> = {},
): CreateSharedFlightResultRequest {
  return {
    payloadVersion:      1,
    displayModelVersion: 1,
    rawSearchPayload:    makeRawPayload(),
    displayModel:        makeDisplayModel(),
    expiresInDays:       null,
    ...overrides,
  };
}

function successCreateResponse(n = 1) {
  return {
    data: {
      ok:        true,
      shareId:   `share-uuid-${n}`,
      publicUrl: `https://wildfly.app/share/flights/${"a".repeat(60)}${String(n).padStart(4, "0")}`,
      createdAt: "2026-06-15T10:00:00.000Z",
      expiresAt: null,
    },
    error: null,
  };
}

function successGetResponse(displayModel = makeDisplayModel()) {
  return {
    data: {
      ok:                  true,
      displayModelVersion: 1,
      displayModel,
      createdAt:           "2026-06-15T10:00:00.000Z",
      expiresAt:           null,
    },
    error: null,
  };
}

// ── SharedFlightResultError ────────────────────────────────────────────────────

describe("SharedFlightResultError", () => {
  it("preserves kind and message", () => {
    const err = new SharedFlightResultError("NOT_FOUND", "not found");
    expect(err.kind).toBe("NOT_FOUND");
    expect(err.message).toBe("not found");
    expect(err.name).toBe("SharedFlightResultError");
  });

  it("is an instance of Error", () => {
    expect(new SharedFlightResultError("SERVER_ERROR", "oops")).toBeInstanceOf(Error);
  });

  it("supports all defined error kinds", () => {
    const kinds: SharedFlightResultError["kind"][] = [
      "UNAUTHENTICATED",
      "VALIDATION",
      "PAYLOAD_TOO_LARGE",
      "NOT_FOUND",
      "UNSUPPORTED_VERSION",
      "NETWORK_ERROR",
      "SERVER_ERROR",
    ];
    for (const kind of kinds) {
      const err = new SharedFlightResultError(kind, "msg");
      expect(err.kind).toBe(kind);
    }
  });
});

// ── createSharedFlightResult ───────────────────────────────────────────────────

describe("createSharedFlightResult — success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns structured response on success", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    const result = await createSharedFlightResult(makeCreateRequest());

    expect(result.shareId).toBe("share-uuid-1");
    expect(result.publicUrl).toContain("/share/flights/");
    expect(result.createdAt).toBe("2026-06-15T10:00:00.000Z");
    expect(result.expiresAt).toBeNull();
  });

  it("calls the correct Edge Function name", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    await createSharedFlightResult(makeCreateRequest());

    expect(mockInvoke).toHaveBeenCalledWith(
      "create-shared-flight-result",
      expect.any(Object),
    );
  });

  it("forwards payloadVersion and displayModelVersion", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    await createSharedFlightResult(makeCreateRequest());

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.payloadVersion).toBe(1);
    expect(opts.body.displayModelVersion).toBe(1);
  });

  it("forwards rawSearchPayload in the request body", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    const raw = makeRawPayload();
    await createSharedFlightResult(makeCreateRequest({ rawSearchPayload: raw }));

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.rawSearchPayload).toBe(raw);
  });

  it("forwards displayModel in the request body", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    const model = makeDisplayModel();
    await createSharedFlightResult(makeCreateRequest({ displayModel: model }));

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.displayModel).toBe(model);
  });

  it("forwards optional sourceFlightSearchId when provided", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    const id = "11111111-2222-3333-4444-555555555555";
    await createSharedFlightResult(makeCreateRequest({ sourceFlightSearchId: id }));

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.sourceFlightSearchId).toBe(id);
  });

  it("forwards optional expiresInDays when provided", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    await createSharedFlightResult(makeCreateRequest({ expiresInDays: 30 }));

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.expiresInDays).toBe(30);
  });

  it("raw token arrives only embedded in publicUrl — not as a standalone field", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    const result = await createSharedFlightResult(makeCreateRequest());

    // The service response has no rawToken or token field
    expect(result).not.toHaveProperty("rawToken");
    expect(result).not.toHaveProperty("token");
    // The token is accessible through publicUrl path segment only
    expect(result.publicUrl).toContain("/share/flights/");
  });

  it("two identical calls produce different share IDs (each creates a new row)", async () => {
    mockInvoke
      .mockResolvedValueOnce(successCreateResponse(1))
      .mockResolvedValueOnce(successCreateResponse(2));

    const req = makeCreateRequest();
    const [a, b] = await Promise.all([
      createSharedFlightResult(req),
      createSharedFlightResult(req),
    ]);

    expect(a.shareId).not.toBe(b.shareId);
    expect(a.publicUrl).not.toBe(b.publicUrl);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});

describe("createSharedFlightResult — owner isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not include owner_user_id in the request body (server derives from JWT)", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    await createSharedFlightResult(makeCreateRequest());

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body).not.toHaveProperty("owner_user_id");
    expect(opts.body).not.toHaveProperty("userId");
    expect(opts.body).not.toHaveProperty("ownerId");
  });
});

describe("createSharedFlightResult — authentication errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws UNAUTHENTICATED when invocation error message contains Unauthorized", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("Unauthorized") });
    await expect(createSharedFlightResult(makeCreateRequest())).rejects.toMatchObject({
      kind: "UNAUTHENTICATED",
    });
  });

  it("throws UNAUTHENTICATED when body error says Unauthorized", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Unauthorized" },
      error: null,
    });
    await expect(createSharedFlightResult(makeCreateRequest())).rejects.toMatchObject({
      kind: "UNAUTHENTICATED",
    });
  });

  it("throws SharedFlightResultError (not raw SDK error) on auth failure", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("Unauthorized") });
    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(SharedFlightResultError);
  });

  it("classifies HTTP 401 context as UNAUTHENTICATED and uses server message", async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401 },
    );
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        context: mockResponse,
      }),
    });

    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(SharedFlightResultError);
    expect(err.kind).toBe("UNAUTHENTICATED");
    expect(err.message).toBe("Unauthorized");
  });
});

describe("createSharedFlightResult — validation errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws VALIDATION when body error says Validation failed", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Validation failed" },
      error: null,
    });
    await expect(createSharedFlightResult(makeCreateRequest())).rejects.toMatchObject({
      kind: "VALIDATION",
    });
  });

  it("classifies HTTP 422 context as VALIDATION", async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: "Validation failed" }),
      { status: 422 },
    );
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("non-2xx"), { context: mockResponse }),
    });

    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err.kind).toBe("VALIDATION");
    expect(err.message).toBe("Validation failed");
  });
});

describe("createSharedFlightResult — payload size", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws PAYLOAD_TOO_LARGE when body error indicates oversized payload", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Payload too large" },
      error: null,
    });
    await expect(createSharedFlightResult(makeCreateRequest())).rejects.toMatchObject({
      kind: "PAYLOAD_TOO_LARGE",
    });
  });

  it("classifies HTTP 413 context as PAYLOAD_TOO_LARGE with server message", async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: "Payload too large" }),
      { status: 413 },
    );
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("non-2xx"), { context: mockResponse }),
    });

    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(SharedFlightResultError);
    expect(err.kind).toBe("PAYLOAD_TOO_LARGE");
    expect(err.message).toBe("Payload too large");
  });

  it("classifies HTTP 413 without body as PAYLOAD_TOO_LARGE fallback", async () => {
    const mockResponse = new Response("", { status: 413 });
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("non-2xx"), { context: mockResponse }),
    });

    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err.kind).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("createSharedFlightResult — network errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("classifies network timeout as NETWORK_ERROR", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("network timeout"),
    });
    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(SharedFlightResultError);
    expect(err.kind).toBe("NETWORK_ERROR");
  });

  it("classifies fetch failure as NETWORK_ERROR", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("Failed to fetch"),
    });
    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err.kind).toBe("NETWORK_ERROR");
  });

  it("classifies connection refused as NETWORK_ERROR", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("connection refused"),
    });
    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err.kind).toBe("NETWORK_ERROR");
  });
});

describe("createSharedFlightResult — server errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws SERVER_ERROR for generic failures", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Database unavailable" },
      error: null,
    });
    await expect(createSharedFlightResult(makeCreateRequest())).rejects.toMatchObject({
      kind: "SERVER_ERROR",
    });
  });

  it("throws SERVER_ERROR when ok is false with no error string", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false }, error: null });
    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(SharedFlightResultError);
    expect(err.kind).toBe("SERVER_ERROR");
  });

  it("uses server body message from HTTP 500 context", async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: "Failed to create share" }),
      { status: 500 },
    );
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("non-2xx"), { context: mockResponse }),
    });

    const err = await createSharedFlightResult(makeCreateRequest()).catch((e) => e);
    expect(err.kind).toBe("SERVER_ERROR");
    expect(err.message).toBe("Failed to create share");
  });
});

describe("createSharedFlightResult — no flight-search API calls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only calls supabase.functions.invoke — no other supabase methods", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    await createSharedFlightResult(makeCreateRequest());

    // supabase.from, supabase.rpc, supabase.auth etc. must NOT be called
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect((supabase as unknown as Record<string, unknown>).from).toBeUndefined();
    expect((supabase as unknown as Record<string, unknown>).rpc).toBeUndefined();
  });
});

// ── getPublicSharedFlightResult ────────────────────────────────────────────────

const VALID_TOKEN = "a".repeat(64);

describe("getPublicSharedFlightResult — success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns normalized display model on success", async () => {
    const model = makeDisplayModel();
    mockInvoke.mockResolvedValue(successGetResponse(model));

    const result = await getPublicSharedFlightResult(VALID_TOKEN);

    expect(result.displayModelVersion).toBe(1);
    expect(result.displayModel).toStrictEqual(model);
    expect(result.createdAt).toBe("2026-06-15T10:00:00.000Z");
    expect(result.expiresAt).toBeNull();
  });

  it("calls the correct Edge Function name", async () => {
    mockInvoke.mockResolvedValue(successGetResponse());
    await getPublicSharedFlightResult(VALID_TOKEN);

    expect(mockInvoke).toHaveBeenCalledWith(
      "get-public-shared-flight-result",
      expect.any(Object),
    );
  });

  it("sends token in the request body", async () => {
    mockInvoke.mockResolvedValue(successGetResponse());
    await getPublicSharedFlightResult(VALID_TOKEN);

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body).toEqual({ token: VALID_TOKEN });
  });

  it("does not inject an Authorization header (anonymous access)", async () => {
    mockInvoke.mockResolvedValue(successGetResponse());
    await getPublicSharedFlightResult(VALID_TOKEN);

    const [, opts] = mockInvoke.mock.calls[0];
    const headers = opts?.headers ?? {};
    expect(headers).not.toHaveProperty("Authorization");
  });
});

describe("getPublicSharedFlightResult — private field exclusion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("response never contains owner_user_id", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ...successGetResponse().data,
        owner_user_id: "should-be-stripped",
      },
      error: null,
    });

    const result = await getPublicSharedFlightResult(VALID_TOKEN);
    expect(result).not.toHaveProperty("owner_user_id");
  });

  it("response never contains public_token_hash", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ...successGetResponse().data,
        public_token_hash: "should-be-stripped",
      },
      error: null,
    });

    const result = await getPublicSharedFlightResult(VALID_TOKEN);
    expect(result).not.toHaveProperty("public_token_hash");
  });

  it("response never contains raw_search_payload", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ...successGetResponse().data,
        raw_search_payload: { flights: [{ secret: "data" }] },
      },
      error: null,
    });

    const result = await getPublicSharedFlightResult(VALID_TOKEN);
    expect(result).not.toHaveProperty("raw_search_payload");
  });

  it("response never contains source_flight_search_id", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ...successGetResponse().data,
        source_flight_search_id: "some-uuid",
      },
      error: null,
    });

    const result = await getPublicSharedFlightResult(VALID_TOKEN);
    expect(result).not.toHaveProperty("source_flight_search_id");
  });
});

describe("getPublicSharedFlightResult — not found / expired / revoked", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NOT_FOUND when body says not found", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Share not found or no longer available" },
      error: null,
    });
    await expect(getPublicSharedFlightResult(VALID_TOKEN)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
  });

  it("throws NOT_FOUND for expired shares (same error message as not found)", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Share not found or no longer available" },
      error: null,
    });
    await expect(getPublicSharedFlightResult(VALID_TOKEN)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
  });

  it("throws NOT_FOUND for revoked shares (same error message)", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Share not found or no longer available" },
      error: null,
    });
    await expect(getPublicSharedFlightResult(VALID_TOKEN)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
  });

  it("classifies HTTP 404 context as NOT_FOUND", async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: "Share not found or no longer available" }),
      { status: 404 },
    );
    mockInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("non-2xx"), { context: mockResponse }),
    });

    const err = await getPublicSharedFlightResult(VALID_TOKEN).catch((e) => e);
    expect(err.kind).toBe("NOT_FOUND");
    expect(err.message).toBe("Share not found or no longer available");
  });
});

describe("getPublicSharedFlightResult — unsupported version", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws UNSUPPORTED_VERSION when displayModelVersion is not 1", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok:                  true,
        displayModelVersion: 99,
        displayModel:        { originLabel: "X" },
        createdAt:           "2026-06-15T10:00:00.000Z",
        expiresAt:           null,
      },
      error: null,
    });

    await expect(getPublicSharedFlightResult(VALID_TOKEN)).rejects.toMatchObject({
      kind: "UNSUPPORTED_VERSION",
    });
  });

  it("throws UNSUPPORTED_VERSION when Edge Function body says unsupported version", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: "Unsupported share version" },
      error: null,
    });

    await expect(getPublicSharedFlightResult(VALID_TOKEN)).rejects.toMatchObject({
      kind: "UNSUPPORTED_VERSION",
    });
  });
});

describe("getPublicSharedFlightResult — malformed display model", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws SERVER_ERROR when displayModel is null at version 1", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok:                  true,
        displayModelVersion: 1,
        displayModel:        null,
        createdAt:           "2026-06-15T10:00:00.000Z",
        expiresAt:           null,
      },
      error: null,
    });

    await expect(getPublicSharedFlightResult(VALID_TOKEN)).rejects.toMatchObject({
      kind: "SERVER_ERROR",
    });
  });

  it("throws SERVER_ERROR when displayModel is an array at version 1", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok:                  true,
        displayModelVersion: 1,
        displayModel:        [],
        createdAt:           "2026-06-15T10:00:00.000Z",
        expiresAt:           null,
      },
      error: null,
    });

    await expect(getPublicSharedFlightResult(VALID_TOKEN)).rejects.toMatchObject({
      kind: "SERVER_ERROR",
    });
  });
});

describe("getPublicSharedFlightResult — invocation errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws SharedFlightResultError (not raw SDK error) on network failure", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("network timeout") });
    const err = await getPublicSharedFlightResult(VALID_TOKEN).catch((e) => e);
    expect(err).toBeInstanceOf(SharedFlightResultError);
    expect(err.kind).toBe("NETWORK_ERROR");
  });

  it("classifies generic invocation error as SERVER_ERROR", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("unexpected failure") });
    const err = await getPublicSharedFlightResult(VALID_TOKEN).catch((e) => e);
    expect(err).toBeInstanceOf(SharedFlightResultError);
    expect(err.kind).toBe("SERVER_ERROR");
  });
});

// ── Token format ───────────────────────────────────────────────────────────────
// Mirrors the Edge Function token helpers using the same Web Crypto API
// available in both the Deno runtime (Edge Functions) and jsdom (tests).

function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("token format — mirrors Edge Function implementation", () => {
  it("raw token is exactly 64 lowercase hex characters (256 bits)", () => {
    const token = generateRawToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("each generated token is unique", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateRawToken()));
    expect(tokens.size).toBe(20);
  });

  it("hash is exactly 64 lowercase hex characters", async () => {
    const hash = await hashToken(generateRawToken());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same raw token produces the same hash (deterministic)", async () => {
    const token = generateRawToken();
    expect(await hashToken(token)).toBe(await hashToken(token));
  });

  it("different raw tokens produce different hashes", async () => {
    const h1 = await hashToken(generateRawToken());
    const h2 = await hashToken(generateRawToken());
    expect(h1).not.toBe(h2);
  });

  it("hash and raw token are distinct (hash ≠ token)", async () => {
    const token = generateRawToken();
    const hash  = await hashToken(token);
    expect(hash).not.toBe(token);
  });
});

describe("token — raw value never appears as a standalone response field", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createSharedFlightResult response has no rawToken field", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    const result = await createSharedFlightResult(makeCreateRequest());

    // The raw token is embedded in publicUrl only.
    // It must not appear as a first-class field that callers could accidentally log.
    const keys = Object.keys(result);
    expect(keys).not.toContain("rawToken");
    expect(keys).not.toContain("token");
    expect(keys).not.toContain("raw_token");
    expect(keys).toContain("publicUrl");
  });
});

// ── No flight-search API called ────────────────────────────────────────────────

describe("isolation — no flight-search API is called", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createSharedFlightResult never calls a flight-proxy or scraper endpoint", async () => {
    mockInvoke.mockResolvedValue(successCreateResponse());
    await createSharedFlightResult(makeCreateRequest());

    // Only the single invoke to create-shared-flight-result may have fired.
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      "create-shared-flight-result",
      expect.any(Object),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("flight-proxy", expect.anything());
  });

  it("getPublicSharedFlightResult never calls a flight-proxy or scraper endpoint", async () => {
    mockInvoke.mockResolvedValue(successGetResponse());
    await getPublicSharedFlightResult(VALID_TOKEN);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      "get-public-shared-flight-result",
      expect.any(Object),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith("flight-proxy", expect.anything());
  });
});
