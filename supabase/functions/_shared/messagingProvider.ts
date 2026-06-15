// Email provider abstraction. Initial implementation: Resend.

export interface SendEmailOptions {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  tags?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  provider: "resend";
  providerMessageId?: string;
  retryable: boolean;
  error?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { success: false, provider: "resend", retryable: false, error: "RESEND_API_KEY not configured" };
  }

  const fromName = opts.fromName || Deno.env.get("MESSAGING_FROM_NAME") || "Wildfly";
  const fromEmail = opts.fromEmail || Deno.env.get("MESSAGING_FROM_EMAIL") || "";
  if (!fromEmail) {
    return { success: false, provider: "resend", retryable: false, error: "MESSAGING_FROM_EMAIL not configured" };
  }

  const body: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    reply_to: opts.replyTo || Deno.env.get("MESSAGING_REPLY_TO") || "wildflyapp@gmail.com",
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.text) body.text = opts.text;
  if (opts.idempotencyKey) body.idempotency_key = opts.idempotencyKey;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (res.ok) {
      return {
        success: true,
        provider: "resend",
        providerMessageId: json.id as string | undefined,
        retryable: false,
      };
    }

    const errMsg = (json.message as string) || (json.error as string) || `HTTP ${res.status}`;
    const retryable = res.status >= 500 || res.status === 429;

    return { success: false, provider: "resend", retryable, error: errMsg };
  } catch (e) {
    return { success: false, provider: "resend", retryable: true, error: (e as Error).message };
  }
}

export function retryDelayMs(attemptCount: number): number {
  const base = 60_000; // 1 minute
  const max = 24 * 60 * 60_000; // 24 hours
  return Math.min(base * Math.pow(2, attemptCount - 1), max);
}

export const MAX_ATTEMPTS = 5;
