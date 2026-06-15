import type { MessageStatus, RecipientStatus, MessageChannel, MessageClassification } from "./messagingTypes";

const VARIABLE_RE = /\{\{([^}]+)\}\}/g;

export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  VARIABLE_RE.lastIndex = 0;
  while ((m = VARIABLE_RE.exec(template)) !== null) {
    found.add(m[1].trim());
  }
  return [...found];
}

export function renderPreview(template: string, vars: Record<string, string>): string {
  return template.replace(VARIABLE_RE, (_, key) => vars[key.trim()] ?? `{{${key.trim()}}}`);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function parseManualEmails(raw: string): { valid: string[]; invalid: string[] } {
  const lines = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const e of lines) {
    (isValidEmail(e) ? valid : invalid).push(e);
  }
  return { valid, invalid };
}

export function formatRecipientCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function messageStatusLabel(status: MessageStatus): string {
  const map: Record<MessageStatus, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    queued: "Queued",
    processing: "Processing",
    partially_completed: "Partial",
    completed: "Completed",
    cancelled: "Cancelled",
    failed: "Failed",
  };
  return map[status] ?? status;
}

export function recipientStatusLabel(status: RecipientStatus): string {
  const map: Record<RecipientStatus, string> = {
    pending: "Pending",
    queued: "Queued",
    processing: "Processing",
    sent: "Sent",
    delivered: "Delivered",
    opened: "Opened",
    clicked: "Clicked",
    failed: "Failed",
    bounced: "Bounced",
    complained: "Complained",
    suppressed: "Suppressed",
    unsubscribed: "Unsubscribed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

export function channelLabel(ch: MessageChannel): string {
  return ch === "email" ? "Email" : "In-App";
}

export function classificationLabel(c: MessageClassification): string {
  return c === "transactional" ? "Transactional" : "Non-Transactional";
}

export function formatScheduledAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function deliveryRate(sent: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((sent / total) * 100)}%`;
}

// Returns "X/Y (Z%)" label for a delivery metric
export function deliveryLabel(numerator: number, denominator: number): string {
  if (denominator === 0) return "0";
  const pct = Math.round((numerator / denominator) * 100);
  return `${numerator}/${denominator} (${pct}%)`;
}

export function canEditMessage(status: MessageStatus): boolean {
  return status === "draft" || status === "scheduled";
}

export function canCancelMessage(status: MessageStatus): boolean {
  return status === "queued" || status === "scheduled";
}

export function canQueueMessage(status: MessageStatus): boolean {
  return status === "draft" || status === "scheduled";
}

export function isTerminalMessageStatus(status: MessageStatus): boolean {
  return ["completed", "partially_completed", "cancelled", "failed"].includes(status);
}
