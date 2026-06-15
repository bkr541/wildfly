import { describe, it, expect } from "vitest";
import {
  extractVariables,
  renderPreview,
  isValidEmail,
  parseManualEmails,
  formatRecipientCount,
  pluralise,
  messageStatusLabel,
  recipientStatusLabel,
  channelLabel,
  classificationLabel,
  deliveryRate,
  canEditMessage,
  canCancelMessage,
  canQueueMessage,
  isTerminalMessageStatus,
} from "../messagingHelpers";
import type { MessageStatus, RecipientStatus } from "../messagingTypes";

// ── extractVariables ───────────────────────────────────────────────────────────

describe("extractVariables", () => {
  it("returns empty array for template with no variables", () => {
    expect(extractVariables("Hello world")).toEqual([]);
  });

  it("extracts a single variable", () => {
    expect(extractVariables("Hello {{name}}")).toEqual(["name"]);
  });

  it("extracts multiple variables", () => {
    const vars = extractVariables("{{first_name}} booked {{home_airport}} for {{current_year}}");
    expect(vars).toContain("first_name");
    expect(vars).toContain("home_airport");
    expect(vars).toContain("current_year");
    expect(vars).toHaveLength(3);
  });

  it("deduplicates repeated variables", () => {
    const vars = extractVariables("{{name}} and {{name}} again");
    expect(vars).toEqual(["name"]);
  });

  it("trims whitespace inside braces", () => {
    const vars = extractVariables("{{ recipient_name }}");
    expect(vars).toEqual(["recipient_name"]);
  });
});

// ── renderPreview ──────────────────────────────────────────────────────────────

describe("renderPreview", () => {
  it("replaces known variables", () => {
    const result = renderPreview("Hello {{recipient_name}}!", { recipient_name: "Jane" });
    expect(result).toBe("Hello Jane!");
  });

  it("leaves unknown variables intact", () => {
    const result = renderPreview("Value: {{unknown}}", {});
    expect(result).toBe("Value: {{unknown}}");
  });

  it("handles multiple occurrences", () => {
    const result = renderPreview("{{a}} + {{a}} = double {{a}}", { a: "X" });
    expect(result).toBe("X + X = double X");
  });

  it("handles empty template", () => {
    expect(renderPreview("", {})).toBe("");
  });
});

// ── isValidEmail ───────────────────────────────────────────────────────────────

describe("isValidEmail", () => {
  it("accepts standard email addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("a+b@c.io")).toBe(true);
    expect(isValidEmail("sub.domain@mail.example.org")).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("@nodomain")).toBe(false);
    expect(isValidEmail("noatsign.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

// ── parseManualEmails ──────────────────────────────────────────────────────────

describe("parseManualEmails", () => {
  it("splits comma-separated emails", () => {
    const { valid, invalid } = parseManualEmails("a@b.com, c@d.com");
    expect(valid).toEqual(["a@b.com", "c@d.com"]);
    expect(invalid).toHaveLength(0);
  });

  it("splits newline-separated emails", () => {
    const { valid } = parseManualEmails("a@b.com\nc@d.com");
    expect(valid).toHaveLength(2);
  });

  it("separates valid from invalid", () => {
    const { valid, invalid } = parseManualEmails("a@b.com\nbadentry\nc@d.com");
    expect(valid).toHaveLength(2);
    expect(invalid).toEqual(["badentry"]);
  });

  it("returns empty arrays for blank input", () => {
    const { valid, invalid } = parseManualEmails("   \n  ");
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });
});

// ── formatRecipientCount ───────────────────────────────────────────────────────

describe("formatRecipientCount", () => {
  it("formats small numbers as-is", () => {
    expect(formatRecipientCount(0)).toBe("0");
    expect(formatRecipientCount(999)).toBe("999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatRecipientCount(1000)).toBe("1.0K");
    expect(formatRecipientCount(1500)).toBe("1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatRecipientCount(1_000_000)).toBe("1.0M");
  });
});

// ── pluralise ─────────────────────────────────────────────────────────────────

describe("pluralise", () => {
  it("uses singular for 1", () => {
    expect(pluralise(1, "recipient")).toBe("1 recipient");
  });

  it("uses plural for 0 and 2+", () => {
    expect(pluralise(0, "recipient")).toBe("0 recipients");
    expect(pluralise(5, "recipient")).toBe("5 recipients");
  });

  it("accepts custom plural form", () => {
    expect(pluralise(2, "address", "addresses")).toBe("2 addresses");
  });
});

// ── status labels ─────────────────────────────────────────────────────────────

describe("messageStatusLabel", () => {
  const cases: Array<[MessageStatus, string]> = [
    ["draft", "Draft"],
    ["scheduled", "Scheduled"],
    ["queued", "Queued"],
    ["processing", "Processing"],
    ["partially_completed", "Partial"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
    ["failed", "Failed"],
  ];
  it.each(cases)("maps %s → %s", (status, label) => {
    expect(messageStatusLabel(status)).toBe(label);
  });
});

describe("recipientStatusLabel", () => {
  const cases: Array<[RecipientStatus, string]> = [
    ["pending", "Pending"],
    ["sent", "Sent"],
    ["delivered", "Delivered"],
    ["bounced", "Bounced"],
    ["unsubscribed", "Unsubscribed"],
  ];
  it.each(cases)("maps %s → %s", (status, label) => {
    expect(recipientStatusLabel(status)).toBe(label);
  });
});

describe("channelLabel", () => {
  it("returns Email for email", () => {
    expect(channelLabel("email")).toBe("Email");
  });
  it("returns In-App for in_app", () => {
    expect(channelLabel("in_app")).toBe("In-App");
  });
});

describe("classificationLabel", () => {
  it("returns Transactional for transactional", () => {
    expect(classificationLabel("transactional")).toBe("Transactional");
  });
  it("returns Non-Transactional for non_transactional", () => {
    expect(classificationLabel("non_transactional")).toBe("Non-Transactional");
  });
});

// ── deliveryRate ──────────────────────────────────────────────────────────────

describe("deliveryRate", () => {
  it("returns em dash when total is 0", () => {
    expect(deliveryRate(0, 0)).toBe("—");
  });

  it("calculates percentage", () => {
    expect(deliveryRate(75, 100)).toBe("75%");
  });

  it("rounds to whole number", () => {
    expect(deliveryRate(1, 3)).toBe("33%");
  });
});

// ── lifecycle guards ──────────────────────────────────────────────────────────

describe("canEditMessage", () => {
  it("allows draft and scheduled", () => {
    expect(canEditMessage("draft")).toBe(true);
    expect(canEditMessage("scheduled")).toBe(true);
  });
  it("denies all other statuses", () => {
    (["queued", "processing", "completed", "cancelled", "failed", "partially_completed"] as MessageStatus[])
      .forEach(s => expect(canEditMessage(s)).toBe(false));
  });
});

describe("canCancelMessage", () => {
  it("allows queued and scheduled", () => {
    expect(canCancelMessage("queued")).toBe(true);
    expect(canCancelMessage("scheduled")).toBe(true);
  });
  it("denies other statuses", () => {
    expect(canCancelMessage("draft")).toBe(false);
    expect(canCancelMessage("completed")).toBe(false);
  });
});

describe("canQueueMessage", () => {
  it("allows draft and scheduled", () => {
    expect(canQueueMessage("draft")).toBe(true);
    expect(canQueueMessage("scheduled")).toBe(true);
  });
});

describe("isTerminalMessageStatus", () => {
  it("identifies terminal statuses", () => {
    expect(isTerminalMessageStatus("completed")).toBe(true);
    expect(isTerminalMessageStatus("partially_completed")).toBe(true);
    expect(isTerminalMessageStatus("cancelled")).toBe(true);
    expect(isTerminalMessageStatus("failed")).toBe(true);
  });
  it("does not mark active statuses as terminal", () => {
    expect(isTerminalMessageStatus("draft")).toBe(false);
    expect(isTerminalMessageStatus("queued")).toBe(false);
    expect(isTerminalMessageStatus("processing")).toBe(false);
  });
});
