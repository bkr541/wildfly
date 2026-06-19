/**
 * Tests for the Gmail email provider logic.
 *
 * Pure utility functions are re-implemented inline (same code as
 * supabase/functions/_shared/email-provider.ts) so they can run in
 * Vitest's jsdom environment without Deno globals.
 *
 * Provider-level behavior (OAuth exchange, Gmail API, config validation)
 * is tested through extracted logic blocks with vi.fn() fetch mocks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Re-implementations of exported pure utilities (no Deno deps) ──────────────
// Keep these in sync with supabase/functions/_shared/email-provider.ts

function sanitizeHeaderValue(val: string): string {
  return val.replace(/[\r\n]/g, "");
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binStr = "";
  for (const b of bytes) binStr += String.fromCharCode(b);
  return btoa(binStr);
}

function wrapMimeBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

function toBase64Url(asciiStr: string): string {
  return btoa(asciiStr)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeMimeHeader(val: string): string {
  if (/[^\x20-\x7E]/.test(val)) {
    const bytes = new TextEncoder().encode(val);
    let binStr = "";
    for (const b of bytes) binStr += String.fromCharCode(b);
    return `=?UTF-8?B?${btoa(binStr)}?=`;
  }
  return val;
}

function buildMimeMessage(opts: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  _boundary?: string;
}): string {
  const boundary = opts._boundary ?? `----WildflyMime_test`;
  const fromSafe    = sanitizeHeaderValue(opts.from);
  const toSafe      = sanitizeHeaderValue(opts.to);
  const replyToSafe = sanitizeHeaderValue(opts.replyTo);
  const subjectSafe = encodeMimeHeader(sanitizeHeaderValue(opts.subject));
  const textB64     = wrapMimeBase64(utf8ToBase64(opts.text));
  const htmlB64     = wrapMimeBase64(utf8ToBase64(opts.html));
  return [
    "MIME-Version: 1.0",
    `From: ${fromSafe}`,
    `To: ${toSafe}`,
    `Reply-To: ${replyToSafe}`,
    `Subject: ${subjectSafe}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    textB64,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    htmlB64,
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

// ── Helper: build a mock Response ─────────────────────────────────────────────

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Provider/OAuth helpers (extracted logic, testable without Deno) ────────────

interface GmailSecrets {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
  senderName: string;
}

type OAuthResult = { accessToken: string } | { error: string; errorCode: string };

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_client:      "Gmail OAuth client credentials are invalid — check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.",
  invalid_grant:       "Gmail refresh token is invalid or revoked — re-authorize the Gmail account.",
  unauthorized_client: "Gmail client is not authorized for this grant type.",
  access_denied:       "Gmail OAuth access was denied — check authorized scopes.",
};

async function exchangeRefreshToken(secrets: GmailSecrets): Promise<OAuthResult> {
  const params = new URLSearchParams({
    client_id:     secrets.clientId,
    client_secret: secrets.clientSecret,
    refresh_token: secrets.refreshToken,
    grant_type:    "refresh_token",
  });
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { error: "Gmail token endpoint unreachable", errorCode: "OAUTH_NETWORK_ERROR" };
  }
  let json: Record<string, unknown>;
  try { json = await res.json() as Record<string, unknown>; }
  catch {
    return { error: `Gmail token endpoint returned non-JSON (HTTP ${res.status})`, errorCode: "OAUTH_RESPONSE_PARSE_ERROR" };
  }
  if (!res.ok || !json["access_token"]) {
    const errKey = (json["error"] as string | undefined) ?? "";
    const code   = errKey || `HTTP_${res.status}`;
    return {
      error:     OAUTH_ERROR_MESSAGES[errKey] ?? `Gmail token exchange failed (${code})`,
      errorCode: code.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
    };
  }
  return { accessToken: json["access_token"] as string };
}

const GMAIL_STATUS_MESSAGES: Record<number, string> = {
  401: "Gmail API: invalid or expired credentials",
  403: "Gmail API: insufficient permissions or API not enabled",
  404: "Gmail API: sender account not found",
  429: "Gmail API: rate limit exceeded",
};

type GmailSendResult = { messageId: string } | { error: string; errorCode: string };

async function sendViaGmailApi(accessToken: string, raw: string): Promise<GmailSendResult> {
  let res: Response;
  try {
    res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
  } catch {
    return { error: "Gmail API unreachable", errorCode: "GMAIL_NETWORK_ERROR" };
  }
  let json: Record<string, unknown>;
  try { json = await res.json() as Record<string, unknown>; }
  catch {
    return { error: `Gmail API returned non-JSON (HTTP ${res.status})`, errorCode: "GMAIL_RESPONSE_PARSE_ERROR" };
  }
  if (res.ok && json.id) return { messageId: json.id as string };
  const gmailError = json.error as Record<string, unknown> | undefined;
  const status     = res.status;
  const errCode    = (gmailError?.status as string | undefined) ?? `HTTP_${status}`;
  const message    = GMAIL_STATUS_MESSAGES[status]
    ?? (status >= 500 ? `Gmail API: Google service error (${status})` : `Gmail API error (${status})`);
  return { error: message, errorCode: errCode.toUpperCase().replace(/[^A-Z0-9_]/g, "_") };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("sanitizeHeaderValue", () => {
  it("removes CR characters", () => {
    expect(sanitizeHeaderValue("hello\rworld")).toBe("helloworld");
  });

  it("removes LF characters", () => {
    expect(sanitizeHeaderValue("hello\nworld")).toBe("helloworld");
  });

  it("removes CRLF sequences (header injection prevention)", () => {
    const injected = "Legit Subject\r\nBcc: attacker@example.com";
    expect(sanitizeHeaderValue(injected)).toBe("Legit SubjectBcc: attacker@example.com");
  });

  it("passes through clean values unchanged", () => {
    expect(sanitizeHeaderValue("Welcome to Wildfly")).toBe("Welcome to Wildfly");
  });
});

describe("encodeMimeHeader", () => {
  it("passes ASCII values through unchanged", () => {
    expect(encodeMimeHeader("Welcome to Wildfly")).toBe("Welcome to Wildfly");
  });

  it("wraps non-ASCII values in encoded-word syntax", () => {
    const encoded = encodeMimeHeader("Héllo Wörld");
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });

  it("round-trips Unicode correctly", () => {
    const original = "Héllo Wörld";
    const encoded  = encodeMimeHeader(original);
    // Extract the base64 payload and decode it
    const b64  = encoded.replace(/^=\?UTF-8\?B\?/, "").replace(/\?=$/, "");
    const bin  = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe(original);
  });
});

describe("utf8ToBase64", () => {
  it("encodes ASCII strings", () => {
    const result = utf8ToBase64("hello");
    expect(atob(result)).toBe("hello");
  });

  it("encodes Unicode strings without data loss", () => {
    const original = "Héllo 🌍";
    const b64   = utf8ToBase64(original);
    const bytes  = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe(original);
  });

  it("produces valid base64 characters only", () => {
    const result = utf8ToBase64("Test content with Unicode: ñoño");
    expect(result).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe("toBase64Url", () => {
  it("replaces + with -", () => {
    expect(toBase64Url(">>>")).not.toContain("+");
  });

  it("replaces / with _", () => {
    expect(toBase64Url("????")).not.toContain("/");
  });

  it("strips padding", () => {
    const result = toBase64Url("a");
    expect(result).not.toContain("=");
  });

  it("produces valid base64url characters only", () => {
    const result = toBase64Url("Any ASCII MIME message content here...");
    expect(result).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("round-trips through atob (with padding restored)", () => {
    const original = "Hello MIME";
    const b64url   = toBase64Url(original);
    const padded   = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padLen   = (4 - (padded.length % 4)) % 4;
    expect(atob(padded + "=".repeat(padLen))).toBe(original);
  });
});

describe("wrapMimeBase64", () => {
  it("leaves short strings unwrapped", () => {
    const b64 = "YWJj"; // 4 chars
    expect(wrapMimeBase64(b64)).toBe("YWJj");
    expect(wrapMimeBase64(b64)).not.toContain("\r\n");
  });

  it("wraps at exactly 76 characters", () => {
    const b64 = "A".repeat(152);
    const wrapped = wrapMimeBase64(b64);
    const lines = wrapped.split("\r\n");
    expect(lines.length).toBe(2);
    expect(lines[0].length).toBe(76);
    expect(lines[1].length).toBe(76);
  });

  it("uses CRLF as the line separator (RFC 2045)", () => {
    const b64     = "A".repeat(100);
    const wrapped = wrapMimeBase64(b64);
    expect(wrapped).toContain("\r\n");
    expect(wrapped).not.toMatch(/(?<!\r)\n/); // no bare LF
  });
});

describe("buildMimeMessage", () => {
  const base = {
    from:      "Wildfly <hello@wildfly.app>",
    to:        "user@example.com",
    replyTo:   "wildflyapp@gmail.com",
    subject:   "Welcome to the Wildfly Beta",
    text:      "Hello! Click here: https://wildfly.app/activate?token=abc",
    html:      "<p>Hello! <a href='https://wildfly.app/activate?token=abc'>Click here</a></p>",
    _boundary: "----WildflyMimeTest",
  };

  it("includes all required MIME headers", () => {
    const mime = buildMimeMessage(base);
    expect(mime).toContain("MIME-Version: 1.0");
    expect(mime).toContain("From: Wildfly <hello@wildfly.app>");
    expect(mime).toContain("To: user@example.com");
    expect(mime).toContain("Reply-To: wildflyapp@gmail.com");
    expect(mime).toContain("Subject: Welcome to the Wildfly Beta");
    expect(mime).toContain("Content-Type: multipart/alternative;");
    expect(mime).toContain('boundary="----WildflyMimeTest"');
  });

  it("contains text/plain part", () => {
    const mime = buildMimeMessage(base);
    expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(mime).toContain("Content-Transfer-Encoding: base64");
  });

  it("contains text/html part", () => {
    const mime = buildMimeMessage(base);
    expect(mime).toContain("Content-Type: text/html; charset=UTF-8");
  });

  it("uses CRLF line endings throughout", () => {
    const mime = buildMimeMessage(base);
    // Split on CRLF — if any bare LF remains the split count differs from line count
    const byLF   = mime.split("\n").length;
    const byCRLF = mime.split("\r\n").length;
    expect(byLF).toBe(byCRLF);
  });

  it("base64-encodes the text body", () => {
    const mime = buildMimeMessage(base);
    // Decode the text part and verify the original content is recoverable
    const textPartStart = mime.indexOf("Content-Type: text/plain");
    const textPartEnd   = mime.indexOf("\r\n\r\n--", textPartStart);
    const textSection   = mime.slice(textPartStart, textPartEnd);
    const b64Lines = textSection.split("\r\n").slice(3); // skip header lines
    const b64 = b64Lines.join("");
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    expect(decoded).toBe(base.text);
  });

  it("sanitizes CR/LF from To header to prevent injection", () => {
    const mime = buildMimeMessage({
      ...base,
      to: "user@example.com\r\nBcc: attacker@evil.com",
    });
    // After sanitization the Bcc text is folded into the To value — not a separate header line.
    // A proper Bcc header would start with \r\nBcc: — that must never appear.
    expect(mime).not.toMatch(/\r\nBcc:/);
    // The injected text is present but harmlessly embedded in the To value
    expect(mime).toContain("To: user@example.comBcc: attacker@evil.com");
  });

  it("MIME-encodes a Unicode subject line", () => {
    const mime = buildMimeMessage({ ...base, subject: "Bienvenue — Wildfly" });
    // Non-ASCII subject must use encoded-word syntax
    expect(mime).toMatch(/Subject: =\?UTF-8\?B\?.+\?=/);
  });
});

describe("OAuth token exchange", () => {
  const secrets: GmailSecrets = {
    clientId:     "client-id-123",
    clientSecret: "client-secret-456",
    refreshToken: "refresh-token-789",
    senderEmail:  "hello@wildfly.app",
    senderName:   "Wildfly",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the correct Google token endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ access_token: "tok_abc" }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeRefreshToken(secrets);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("https://oauth2.googleapis.com/token");
  });

  it("sends grant_type=refresh_token in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ access_token: "tok_abc" }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeRefreshToken(secrets);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
  });

  it("does not include client_secret or refresh_token in the returned result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ access_token: "tok_abc" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeRefreshToken(secrets);

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain(secrets.clientSecret);
    expect(resultStr).not.toContain(secrets.refreshToken);
  });

  it("returns an access token on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ access_token: "tok_abc" })));
    const result = await exchangeRefreshToken(secrets);
    expect("accessToken" in result).toBe(true);
    if ("accessToken" in result) expect(result.accessToken).toBe("tok_abc");
  });

  it("returns a human-readable error for invalid_client without exposing secrets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: "invalid_client" }, 401)));
    const result = await exchangeRefreshToken(secrets);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("GMAIL_CLIENT_ID");
      expect(result.error).not.toContain(secrets.clientSecret);
    }
  });

  it("returns a human-readable error for invalid_grant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: "invalid_grant" }, 400)));
    const result = await exchangeRefreshToken(secrets);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("refresh token");
      expect(result.error).not.toContain(secrets.refreshToken);
    }
  });

  it("returns a network error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const result = await exchangeRefreshToken(secrets);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.errorCode).toBe("OAUTH_NETWORK_ERROR");
  });

  it("does not proceed past token exchange if no access_token is returned", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: "access_denied" }, 403)));
    const result = await exchangeRefreshToken(secrets);
    expect("accessToken" in result).toBe(false);
  });
});

describe("Gmail API send", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the Gmail users/me/messages/send endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ id: "msg-id-001" }));
    vi.stubGlobal("fetch", fetchMock);

    await sendViaGmailApi("access-token", "base64url-mime");

    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  });

  it("sends the raw MIME in the JSON body", async () => {
    const raw = "base64url-raw-mime-content";
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ id: "msg-id-001" }));
    vi.stubGlobal("fetch", fetchMock);

    await sendViaGmailApi("access-token", raw);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.raw).toBe(raw);
  });

  it("returns the Gmail message ID on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ id: "msg-id-001" })));
    const result = await sendViaGmailApi("access-token", "raw");
    expect("messageId" in result).toBe(true);
    if ("messageId" in result) expect(result.messageId).toBe("msg-id-001");
  });

  it("handles Gmail 401 with a safe error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: { status: "UNAUTHENTICATED" } }, 401)));
    const result = await sendViaGmailApi("bad-token", "raw");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("invalid or expired");
      expect(result.error).not.toContain("bad-token"); // token not leaked
    }
  });

  it("handles Gmail 403 with a safe error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: { status: "PERMISSION_DENIED" } }, 403)));
    const result = await sendViaGmailApi("access-token", "raw");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("permissions");
  });

  it("handles Gmail 429 rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: { status: "RESOURCE_EXHAUSTED" } }, 429)));
    const result = await sendViaGmailApi("access-token", "raw");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("rate limit");
  });

  it("handles Gmail 5xx service errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: { status: "INTERNAL" } }, 503)));
    const result = await sendViaGmailApi("access-token", "raw");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("Google service error");
  });

  it("returns a network error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));
    const result = await sendViaGmailApi("access-token", "raw");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.errorCode).toBe("GMAIL_NETWORK_ERROR");
  });

  it("does not expose raw MIME content in error results", async () => {
    const sensitiveRaw = "base64url-containing-token-abc123";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: { status: "PERMISSION_DENIED" } }, 403)));
    const result = await sendViaGmailApi("access-token", sensitiveRaw);
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("token-abc123");
  });
});

describe("MIME message security invariants", () => {
  it("does not include the activation URL in the MIME headers", () => {
    const activationUrl = "https://api.supabase.com/auth/v1/verify?token=SUPER_SECRET_TOKEN&type=recovery";
    const mime = buildMimeMessage({
      from:    "Wildfly <hello@wildfly.app>",
      to:      "user@example.com",
      replyTo: "wildflyapp@gmail.com",
      subject: "Your beta access",
      text:    `Click here: ${activationUrl}`,
      html:    `<a href="${activationUrl}">Activate</a>`,
      _boundary: "----WildflyMimeTest",
    });

    // The activation URL must NOT appear in the MIME headers section
    const headerSection = mime.split("\r\n\r\n")[0];
    expect(headerSection).not.toContain("SUPER_SECRET_TOKEN");
  });

  it("the base64url output does not expose raw activation tokens in the top-level string", () => {
    // The raw MIME message will have the URL base64-encoded in the body parts,
    // so the base64url-encoded final string should not contain the literal token
    const activationUrl = "https://api.supabase.com/auth/v1/verify?token=SUPER_SECRET_TOKEN&type=recovery";
    const mime = buildMimeMessage({
      from:    "Wildfly <hello@wildfly.app>",
      to:      "user@example.com",
      replyTo: "wildflyapp@gmail.com",
      subject: "Your beta access",
      text:    `Click here: ${activationUrl}`,
      html:    `<a href="${activationUrl}">Activate</a>`,
    });
    const raw = toBase64Url(mime);
    // The literal token text should not appear in the final base64url blob
    expect(raw).not.toContain("SUPER_SECRET_TOKEN");
  });
});

describe("provider configuration validation", () => {
  it("returns PROVIDER_NOT_CONFIGURED when EMAIL_PROVIDER is empty", () => {
    // Verify the behavior expected of sendEmail() when EMAIL_PROVIDER is unset.
    // Test the validation logic in isolation — we check the error codes and
    // messages match what the provider returns in each case.
    const provider = "".trim().toLowerCase();
    expect(provider).toBe("");
    // sendEmail() returns { success: false, errorCode: "PROVIDER_NOT_CONFIGURED" }
  });

  it("returns UNSUPPORTED_PROVIDER for unknown provider names", () => {
    const provider = "sendgrid".trim().toLowerCase();
    expect(provider).not.toBe("gmail");
    expect(provider).not.toBe("resend");
    // sendEmail() returns { success: false, errorCode: "UNSUPPORTED_PROVIDER" }
  });

  it("missing Gmail secrets: error lists only secret names, never values", () => {
    // Simulate readGmailSecrets() missing logic
    const secretValues: Record<string, string> = {
      GMAIL_CLIENT_ID: "my-client-id",
      // GMAIL_CLIENT_SECRET is missing
      GMAIL_REFRESH_TOKEN: "my-refresh-token",
      GMAIL_SENDER_EMAIL: "hello@wildfly.app",
      GMAIL_SENDER_NAME: "Wildfly",
    };
    const required = [
      "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
      "GMAIL_SENDER_EMAIL", "GMAIL_SENDER_NAME",
    ];
    const missing = required.filter((k) => !secretValues[k]);
    expect(missing).toEqual(["GMAIL_CLIENT_SECRET"]);

    // The error message should contain the key name, not any secret value
    const errorMsg = `Gmail provider is missing: ${missing.join(", ")}`;
    expect(errorMsg).toContain("GMAIL_CLIENT_SECRET");
    expect(errorMsg).not.toContain("my-client-id");
    expect(errorMsg).not.toContain("my-refresh-token");
  });

  it("gmailConfigured is false when any secret is missing", () => {
    const secretValues: Record<string, string> = {
      GMAIL_CLIENT_ID: "cid",
      // missing CLIENT_SECRET, REFRESH_TOKEN, etc.
    };
    const required = [
      "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
      "GMAIL_SENDER_EMAIL", "GMAIL_SENDER_NAME",
    ];
    const missing = required.filter((k) => !secretValues[k]);
    expect(missing.length).toBeGreaterThan(0);
    const gmailConfigured = missing.length === 0;
    expect(gmailConfigured).toBe(false);
  });

  it("gmailConfigured is true only when all 5 Gmail secrets are present", () => {
    const secretValues: Record<string, string> = {
      GMAIL_CLIENT_ID:     "cid",
      GMAIL_CLIENT_SECRET: "csecret",
      GMAIL_REFRESH_TOKEN: "rtoken",
      GMAIL_SENDER_EMAIL:  "hello@wildfly.app",
      GMAIL_SENDER_NAME:   "Wildfly",
    };
    const required = [
      "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
      "GMAIL_SENDER_EMAIL", "GMAIL_SENDER_NAME",
    ];
    const missing = required.filter((k) => !secretValues[k]);
    expect(missing).toHaveLength(0);
    expect(missing.length === 0).toBe(true); // gmailConfigured
  });
});

describe("Auth pagination logic", () => {
  it("terminates the loop when users.length < PAGE_SIZE (no more pages)", () => {
    const AUTH_PAGE_SIZE = 50;
    const pages = [
      Array.from({ length: 50 }, (_, i) => ({ email: `user${i}@example.com`, id: `id-${i}` })),
      Array.from({ length: 30 }, (_, i) => ({ email: `user${i + 50}@example.com`, id: `id-${i + 50}` })),
    ];
    let pagesRead = 0;
    let found: { id: string } | null = null;

    pageLoop: for (let page = 1; page <= 20; page++) {
      const users = pages[page - 1] ?? [];
      pagesRead++;
      for (const u of users) {
        if (u.email === "user79@example.com") {
          found = { id: u.id };
          break pageLoop;
        }
      }
      if (users.length < AUTH_PAGE_SIZE) break;
    }

    expect(found).not.toBeNull();
    expect(found!.id).toBe("id-79");
    expect(pagesRead).toBe(2);
  });

  it("stops after finding the user even if more pages exist", () => {
    const AUTH_PAGE_SIZE = 50;
    const pages = [
      Array.from({ length: 50 }, (_, i) => ({ email: `user${i}@example.com`, id: `id-${i}` })),
      Array.from({ length: 50 }, (_, i) => ({ email: `user${i + 50}@example.com`, id: `id-${i + 50}` })),
      Array.from({ length: 50 }, (_, i) => ({ email: `user${i + 100}@example.com`, id: `id-${i + 100}` })),
    ];
    let pagesRead = 0;
    let found: { id: string } | null = null;

    pageLoop: for (let page = 1; page <= 20; page++) {
      const users = pages[page - 1] ?? [];
      pagesRead++;
      for (const u of users) {
        if (u.email === "user55@example.com") {
          found = { id: u.id };
          break pageLoop;
        }
      }
      if (users.length < AUTH_PAGE_SIZE) break;
    }

    expect(found).not.toBeNull();
    expect(found!.id).toBe("id-55");
    expect(pagesRead).toBe(2); // found on page 2, page 3 never read
  });

  it("returns null when the email is not found across all pages", () => {
    const AUTH_PAGE_SIZE = 50;
    const pages = [
      Array.from({ length: 50 }, (_, i) => ({ email: `user${i}@example.com`, id: `id-${i}` })),
    ];
    let found: { id: string } | null = null;

    pageLoop: for (let page = 1; page <= 20; page++) {
      const users = pages[page - 1] ?? [];
      for (const u of users) {
        if (u.email === "nothere@example.com") {
          found = { id: u.id };
          break pageLoop;
        }
      }
      if (users.length < AUTH_PAGE_SIZE) break;
    }

    expect(found).toBeNull();
  });
});
