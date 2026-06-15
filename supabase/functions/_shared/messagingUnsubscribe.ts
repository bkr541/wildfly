// Secure HMAC-signed unsubscribe tokens.
// Token format: base64url(email):base64url(scope):hex(hmac-sha256)

export async function signUnsubscribeToken(email: string, scope: string): Promise<string> {
  const secret = Deno.env.get("MESSAGING_UNSUBSCRIBE_SECRET");
  if (!secret) throw new Error("MESSAGING_UNSUBSCRIBE_SECRET not configured");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const data = enc.encode(`${email}:${scope}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const emailB64 = btoa(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const scopeB64 = btoa(scope).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${emailB64}.${scopeB64}.${sigHex}`;
}

export async function verifyUnsubscribeToken(
  token: string
): Promise<{ valid: true; email: string; scope: string } | { valid: false }> {
  try {
    const secret = Deno.env.get("MESSAGING_UNSUBSCRIBE_SECRET");
    if (!secret) return { valid: false };

    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false };

    const [emailB64, scopeB64, sigHex] = parts;
    const pad = (s: string) => s + "=".repeat((4 - (s.length % 4)) % 4);
    const email = atob(pad(emailB64.replace(/-/g, "+").replace(/_/g, "/")));
    const scope = atob(pad(scopeB64.replace(/-/g, "+").replace(/_/g, "/")));

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const data = enc.encode(`${email}:${scope}`);
    const sig = await crypto.subtle.sign("HMAC", key, data);
    const expectedHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

    if (sigHex !== expectedHex) return { valid: false };
    return { valid: true, email, scope };
  } catch {
    return { valid: false };
  }
}

export function buildUnsubscribeUrl(email: string, scope: string): Promise<string> {
  return signUnsubscribeToken(email, scope).then((token) => {
    const base = Deno.env.get("MESSAGING_APP_URL") || "https://wildflyapp.com";
    return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
  });
}
