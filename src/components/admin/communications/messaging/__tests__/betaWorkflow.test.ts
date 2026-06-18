import { describe, it, expect } from "vitest";
import {
  ALLOWED_TEMPLATE_VARIABLES,
  PREVIEW_SAMPLE_VARS,
} from "../messagingConstants";
import { extractVariables, renderPreview } from "../messagingHelpers";

// The required variables that admin-approve-beta-application validates.
// This list must be kept in sync with REQUIRED_BETA_ACCEPTANCE_VARIABLES in the Edge Function.
const REQUIRED_BETA_ACCEPTANCE_VARIABLES = [
  "first_name",
  "account_cta_label",
  "account_cta_url",
  "support_email",
] as const;

// All variables the approval Edge Function can inject.
const APPROVAL_INJECTED_VARIABLES = [
  "recipient_name", "recipient_email",
  "first_name", "last_name", "full_name", "email",
  "home_airport", "app_name", "app_url",
  "account_cta_label", "account_cta_url", "action_link",
  "support_email", "physical_address", "current_year",
] as const;

// ── Registry completeness ──────────────────────────────────────────────────────

describe("ALLOWED_TEMPLATE_VARIABLES", () => {
  it("contains every variable the approval Edge Function can inject", () => {
    for (const v of APPROVAL_INJECTED_VARIABLES) {
      expect(ALLOWED_TEMPLATE_VARIABLES).toContain(v);
    }
  });

  it("contains all required beta acceptance variables", () => {
    for (const v of REQUIRED_BETA_ACCEPTANCE_VARIABLES) {
      expect(ALLOWED_TEMPLATE_VARIABLES).toContain(v);
    }
  });
});

// ── PREVIEW_SAMPLE_VARS coverage ──────────────────────────────────────────────

describe("PREVIEW_SAMPLE_VARS", () => {
  it("has a sample value for every injected approval variable", () => {
    for (const v of APPROVAL_INJECTED_VARIABLES) {
      expect(PREVIEW_SAMPLE_VARS).toHaveProperty(v);
      expect(PREVIEW_SAMPLE_VARS[v]).toBeTruthy();
    }
  });

  it("includes full_name and email", () => {
    expect(PREVIEW_SAMPLE_VARS).toHaveProperty("full_name");
    expect(PREVIEW_SAMPLE_VARS).toHaveProperty("email");
  });

  it("has recipient_name matching full_name for consistency", () => {
    expect(PREVIEW_SAMPLE_VARS.recipient_name).toBe(PREVIEW_SAMPLE_VARS.full_name);
  });

  it("has recipient_email matching email for consistency", () => {
    expect(PREVIEW_SAMPLE_VARS.recipient_email).toBe(PREVIEW_SAMPLE_VARS.email);
  });
});

// ── Template variable extraction ──────────────────────────────────────────────

describe("extractVariables with beta template placeholders", () => {
  it("extracts all expected variables from a beta-acceptance-like template", () => {
    const sampleTemplate = `
      Hi {{first_name}}, your account at {{app_url}} is ready.
      Click {{account_cta_url}} — {{account_cta_label}}.
      Contact {{support_email}}. Address: {{physical_address}}.
      © {{current_year}} {{app_name}}
    `;
    const vars = extractVariables(sampleTemplate);
    const expected = [
      "first_name", "app_url", "account_cta_url", "account_cta_label",
      "support_email", "physical_address", "current_year", "app_name",
    ];
    for (const v of expected) {
      expect(vars).toContain(v);
    }
  });
});

// ── Template rendering ────────────────────────────────────────────────────────

describe("renderPreview with beta template variables", () => {
  it("renders all required beta variables", () => {
    const template =
      "Hi {{first_name}}, click {{account_cta_url}} — {{account_cta_label}}. Email {{support_email}}.";
    const vars: Record<string, string> = {
      first_name: "Jane",
      account_cta_url: "https://wildfly.app/activate?token=abc",
      account_cta_label: "Create your password",
      support_email: "support@wildfly.app",
    };
    const result = renderPreview(template, vars);
    expect(result).toBe(
      "Hi Jane, click https://wildfly.app/activate?token=abc — Create your password. Email support@wildfly.app."
    );
  });

  it("leaves unresolved placeholders intact when var is missing", () => {
    const result = renderPreview("Hi {{first_name}}", {});
    expect(result).toBe("Hi {{first_name}}");
  });

  it("does not expose activation URL when not in vars", () => {
    const template = "Body text only.";
    const result = renderPreview(template, { first_name: "Jane" });
    // No accidental injection of sensitive data
    expect(result).not.toContain("token");
    expect(result).not.toContain("activate");
  });
});

// ── Required variable validation logic ───────────────────────────────────────

describe("required variable validation", () => {
  it("detects missing required variables", () => {
    const vars: Record<string, string> = {
      first_name: "Jane",
      // account_cta_label, account_cta_url, support_email are intentionally absent
    };
    const missing = REQUIRED_BETA_ACCEPTANCE_VARIABLES.filter((v) => !vars[v]);
    expect(missing).toEqual(["account_cta_label", "account_cta_url", "support_email"]);
  });

  it("passes when all required variables are present and non-empty", () => {
    const vars: Record<string, string> = {
      first_name: "Jane",
      account_cta_label: "Create your password and enter Wildfly",
      account_cta_url: "https://wildfly.app/activate?token=abc",
      support_email: "support@wildfly.app",
    };
    const missing = REQUIRED_BETA_ACCEPTANCE_VARIABLES.filter((v) => !vars[v]);
    expect(missing).toHaveLength(0);
  });
});
