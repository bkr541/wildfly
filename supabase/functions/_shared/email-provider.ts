// Shared transactional email provider — beta activation workflow.
// Supports Gmail via OAuth 2.0 refresh-token exchange.
// Does NOT fall back silently to any other provider.
// Security: never log client secrets, refresh tokens, access tokens,
// activation links, rendered HTML, or raw MIME messages.

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type EmailProviderName = "gmail" | "resend";

export type EmailSendResult = {
  success: boolean;
  provider: EmailProviderName;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
};

// ── Pure utilities (no Deno deps — safe to unit-test in any environment) ───────

/** Remove CR and LF from a header value to prevent header injection. */
export function sanitizeHeaderValue(val: string): string {
  return val.replace(/[\r\n]/g, "");
}

/**
 * Encode a UTF-8 string to base64.
 * btoa() only handles Latin-1; this correctly handles the full Unicode range
 * by first encoding the string to UTF-8 bytes.
 */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binStr = "";
  for (const b of bytes) {
    binStr += String.fromCharCode(b);
  }
  return btoa(binStr);
}

/** Wrap a base64 string at 76-character line widths (RFC 2045). */
export function wrapMimeBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

/**
 * Convert a pure-ASCII MIME message string to base64url with padding stripped,
 * as required by the Gmail API `raw` field.
 * Never log the input — it contains the activation URL.
 */
export function toBase64Url(asciiStr: string): string {
  return btoa(asciiStr)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * MIME-encode a header value that contains non-ASCII characters.
 * ASCII-only values are returned unchanged.
 * Uses encoded-word syntax: =?UTF-8?B?...?=
 */
export function encodeMimeHeader(val: string): string {
  if (/[^\x20-\x7E]/.test(val)) {
    const bytes = new TextEncoder().encode(val);
    let binStr = "";
    for (const b of bytes) {
      binStr += String.fromCharCode(b);
    }
    return `=?UTF-8?B?${btoa(binStr)}?=`;
  }
  return val;
}

/**
 * Build an RFC-compliant multipart/alternative MIME message.
 * Returns a pure-ASCII string ready to be passed to toBase64Url().
 * Never call console.log on this value — it contains the activation URL.
 */
export function buildMimeMessage(opts: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}): string {
  const boundary = `----WildflyMime_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const fromSafe    = sanitizeHeaderValue(opts.from);
  const toSafe      = sanitizeHeaderValue(opts.to);
  const replyToSafe = sanitizeHeaderValue(opts.replyTo);
  const subjectSafe = encodeMimeHeader(sanitizeHeaderValue(opts.subject));

  const textB64 = wrapMimeBase64(utf8ToBase64(opts.text));
  const htmlB64 = wrapMimeBase64(utf8ToBase64(opts.html));

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

// ── Gmail secrets ──────────────────────────────────────────────────────────────

interface GmailSecrets {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
  senderName: string;
}

function readGmailSecrets(): { secrets: GmailSecrets | null; missing: string[] } {
  const required: Array<[keyof GmailSecrets, string]> = [
    ["clientId",     "GMAIL_CLIENT_ID"],
    ["clientSecret", "GMAIL_CLIENT_SECRET"],
    ["refreshToken", "GMAIL_REFRESH_TOKEN"],
    ["senderEmail",  "GMAIL_SENDER_EMAIL"],
    ["senderName",   "GMAIL_SENDER_NAME"],
  ];

  const missing: string[] = [];
  const values: Partial<GmailSecrets> = {};

  for (const [key, envName] of required) {
    const val = (Deno.env.get(envName) ?? "").trim();
    if (!val) {
      missing.push(envName);
    } else {
      values[key] = val;
    }
  }

  if (missing.length > 0) return { secrets: null, missing };
  return { secrets: values as GmailSecrets, missing: [] };
}

// ── OAuth token exchange ───────────────────────────────────────────────────────

interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_client:       "Gmail OAuth client credentials are invalid — check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.",
  invalid_grant:        "Gmail refresh token is invalid or revoked — re-authorize the Gmail account.",
  unauthorized_client:  "Gmail client is not authorized for this grant type.",
  access_denied:        "Gmail OAuth access was denied — check authorized scopes.",
};

async function exchangeRefreshToken(
  secrets: GmailSecrets,
): Promise<{ accessToken: string } | { error: string; errorCode: string }> {
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

  let json: OAuthTokenResponse;
  try {
    json = await res.json() as OAuthTokenResponse;
  } catch {
    return {
      error: `Gmail token endpoint returned non-JSON (HTTP ${res.status})`,
      errorCode: "OAUTH_RESPONSE_PARSE_ERROR",
    };
  }

  if (!res.ok || !json.access_token) {
    const errKey = json.error ?? "";
    const code   = errKey || `HTTP_${res.status}`;
    const message = OAUTH_ERROR_MESSAGES[errKey]
      ?? `Gmail token exchange failed (${code})`;
    return {
      error: message,
      errorCode: code.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
    };
  }

  return { accessToken: json.access_token };
}

// ── Gmail API send ─────────────────────────────────────────────────────────────

const GMAIL_STATUS_MESSAGES: Record<number, string> = {
  401: "Gmail API: invalid or expired credentials",
  403: "Gmail API: insufficient permissions or API not enabled",
  404: "Gmail API: sender account not found",
  429: "Gmail API: rate limit exceeded",
};

async function sendViaGmailApi(
  accessToken: string,
  raw: string,
): Promise<{ messageId: string } | { error: string; errorCode: string }> {
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
  try {
    json = await res.json() as Record<string, unknown>;
  } catch {
    return {
      error: `Gmail API returned non-JSON (HTTP ${res.status})`,
      errorCode: "GMAIL_RESPONSE_PARSE_ERROR",
    };
  }

  if (res.ok && json.id) {
    return { messageId: json.id as string };
  }

  // Sanitize: extract only error code, never expose the full Google response
  const gmailError = json.error as Record<string, unknown> | undefined;
  const status     = res.status;
  const errCode    = (gmailError?.status as string | undefined) ?? `HTTP_${status}`;

  const message = GMAIL_STATUS_MESSAGES[status]
    ?? (status >= 500
      ? `Gmail API: Google service error (${status})`
      : `Gmail API error (${status})`);

  return {
    error: message,
    errorCode: errCode.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
  };
}

// ── Gmail send orchestrator ────────────────────────────────────────────────────

async function sendViaGmail(msg: EmailMessage): Promise<EmailSendResult> {
  const { secrets, missing } = readGmailSecrets();

  if (!secrets) {
    return {
      success: false,
      provider: "gmail",
      error: `Gmail provider is missing: ${missing.join(", ")}`,
      errorCode: "GMAIL_SECRETS_MISSING",
    };
  }

  // Exchange refresh token for short-lived access token
  const tokenResult = await exchangeRefreshToken(secrets);
  if ("error" in tokenResult) {
    return { success: false, provider: "gmail", ...tokenResult };
  }

  // Build multipart MIME message in local scope only — never log it
  const from = `${secrets.senderName} <${secrets.senderEmail}>`;
  const mime = buildMimeMessage({
    from,
    to:      msg.to,
    replyTo: msg.replyTo ?? secrets.senderEmail,
    subject: msg.subject,
    text:    msg.text ?? "(No plain-text version provided.)",
    html:    msg.html,
  });

  // Encode for Gmail API — raw value is never logged
  const raw = toBase64Url(mime);

  const sendResult = await sendViaGmailApi(tokenResult.accessToken, raw);
  if ("error" in sendResult) {
    return { success: false, provider: "gmail", ...sendResult };
  }

  return { success: true, provider: "gmail", providerMessageId: sendResult.messageId };
}

// ── Public entry point ─────────────────────────────────────────────────────────

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  const provider = (Deno.env.get("EMAIL_PROVIDER") ?? "").trim().toLowerCase();

  // Safe diagnostic: log only configuration presence, never secret values
  const { missing: missingGmailSecrets } = readGmailSecrets();
  console.log("Email provider configuration", {
    provider:           provider || "(not set)",
    gmailConfigured:    missingGmailSecrets.length === 0,
    missingGmailSecrets,
  });

  if (!provider) {
    return {
      success:   false,
      provider:  "gmail",
      error:     "EMAIL_PROVIDER is not configured",
      errorCode: "PROVIDER_NOT_CONFIGURED",
    };
  }

  if (provider === "gmail") {
    return sendViaGmail(msg);
  }

  return {
    success:   false,
    provider:  "gmail",
    error:     `Unsupported email provider: ${provider}`,
    errorCode: "UNSUPPORTED_PROVIDER",
  };
}
