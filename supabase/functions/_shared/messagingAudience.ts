import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizeEmail, isValidEmail } from "./messagingRenderer.ts";
import { buildUnsubscribeUrl } from "./messagingUnsubscribe.ts";

// User statuses that represent an eligible active account.
// "current" is the original status set during provisioning.
// "active" is used in some flows.
export const ACTIVE_USER_STATUSES = ["current", "active"] as const;

export interface AudienceFilter {
  sources: AudienceSource[];
  logic: "union" | "intersect";
}

export type AudienceSource =
  | { type: "active_users"; filters: ActiveUsersFilter }
  | { type: "beta_applicants"; filters: BetaApplicantsFilter }
  | { type: "manual_emails"; emails: string[] };

interface ActiveUsersFilter {
  plan?: string;
  home_airport?: string;
  email_pref?: string;
  onboarding_complete?: "yes" | "no";
  signup_type?: string;
}

interface BetaApplicantsFilter {
  status?: string;
  home_airport?: string;
}

export interface ResolvedRecipient {
  email: string;
  normalized_email: string;
  recipient_name: string;
  user_id: string | null;
  beta_application_id: string | null;
  personalization: Record<string, string>;
  is_valid_email: boolean;
}

export async function resolveAudience(
  db: SupabaseClient,
  filterDef: AudienceFilter,
  classification: "transactional" | "non_transactional",
  channels: string[]
): Promise<{
  recipients: ResolvedRecipient[];
  eligible_count: number;
  suppressed_count: number;
  invalid_count: number;
}> {
  const appUrl = Deno.env.get("MESSAGING_APP_URL") || "https://wildflyapp.com";
  const supportEmail = Deno.env.get("MESSAGING_SUPPORT_EMAIL") || "wildflyapp@gmail.com";
  const planName = "Wildfly";

  const raw: ResolvedRecipient[] = [];

  for (const source of filterDef.sources) {
    if (source.type === "active_users") {
      let q = db
        .from("user_info")
        .select("auth_user_id, email, first_name, last_name, home_airport, status")
        .in("status", ACTIVE_USER_STATUSES);

      if (source.filters.home_airport) {
        q = q.eq("home_airport", source.filters.home_airport);
      }
      if (source.filters.onboarding_complete === "yes") {
        q = q.eq("onboarding_complete", "yes");
      }
      if (source.filters.signup_type) {
        q = q.ilike("signup_type", source.filters.signup_type);
      }

      const { data: users } = await q;
      for (const u of users ?? []) {
        if (!u.email) continue;

        // Email pref filter
        if (source.filters.email_pref && classification === "non_transactional") {
          const { data: prefs } = await db
            .from("user_email_preferences")
            .select("*")
            .eq("user_id", u.auth_user_id)
            .maybeSingle();
          if (!prefs || !(prefs as Record<string, boolean>)[source.filters.email_pref]) continue;
        }

        const firstName = u.first_name ?? "";
        const lastName = u.last_name ?? "";
        const unsubscribeUrl = await buildUnsubscribeUrl(normalizeEmail(u.email), "all_non_transactional").catch(() => "");

        raw.push({
          email: u.email,
          normalized_email: normalizeEmail(u.email),
          recipient_name: [firstName, lastName].filter(Boolean).join(" ") || u.email,
          user_id: u.auth_user_id,
          beta_application_id: null,
          is_valid_email: isValidEmail(u.email),
          personalization: {
            first_name: firstName,
            last_name: lastName,
            full_name: [firstName, lastName].filter(Boolean).join(" "),
            email: u.email,
            home_airport: u.home_airport ?? "",
            plan_name: planName,
            app_url: appUrl,
            support_email: supportEmail,
            unsubscribe_url: unsubscribeUrl,
          },
        });
      }
    }

    if (source.type === "beta_applicants") {
      let q = db
        .from("beta_applications")
        .select("id, email, full_name, home_airport, status, auth_user_id");

      if (source.filters.status) {
        q = q.eq("status", source.filters.status);
      }
      if (source.filters.home_airport) {
        q = q.eq("home_airport", source.filters.home_airport);
      }

      const { data: apps } = await q;
      for (const a of apps ?? []) {
        if (!a.email) continue;
        const nameParts = (a.full_name ?? "").trim().split(/\s+/);
        const firstName = nameParts[0] ?? "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        const unsubscribeUrl = await buildUnsubscribeUrl(normalizeEmail(a.email), "all_non_transactional").catch(() => "");

        raw.push({
          email: a.email,
          normalized_email: normalizeEmail(a.email),
          recipient_name: a.full_name ?? a.email,
          user_id: a.auth_user_id ?? null,
          beta_application_id: a.id,
          is_valid_email: isValidEmail(a.email),
          personalization: {
            first_name: firstName,
            last_name: lastName,
            full_name: a.full_name ?? "",
            email: a.email,
            home_airport: a.home_airport ?? "",
            plan_name: planName,
            app_url: appUrl,
            support_email: supportEmail,
            unsubscribe_url: unsubscribeUrl,
          },
        });
      }
    }

    if (source.type === "manual_emails") {
      for (const email of source.emails) {
        const norm = normalizeEmail(email);
        const unsubscribeUrl = await buildUnsubscribeUrl(norm, "all_non_transactional").catch(() => "");
        raw.push({
          email,
          normalized_email: norm,
          recipient_name: email,
          user_id: null,
          beta_application_id: null,
          is_valid_email: isValidEmail(email),
          personalization: {
            first_name: "",
            last_name: "",
            full_name: "",
            email,
            home_airport: "",
            plan_name: planName,
            app_url: appUrl,
            support_email: supportEmail,
            unsubscribe_url: unsubscribeUrl,
          },
        });
      }
    }
  }

  // Deduplicate by normalized email
  const seen = new Map<string, ResolvedRecipient>();
  for (const r of raw) {
    if (!seen.has(r.normalized_email)) seen.set(r.normalized_email, r);
  }
  const deduped = Array.from(seen.values());

  // Apply suppressions (non-transactional only)
  let suppressed_count = 0;
  const eligible: ResolvedRecipient[] = [];

  if (classification === "non_transactional" && channels.includes("email")) {
    const emails = deduped.map((r) => r.normalized_email);
    const { data: suppressions } = await db
      .from("messaging_suppressions")
      .select("normalized_email")
      .in("normalized_email", emails)
      .is("removed_at", null);

    const suppressedSet = new Set((suppressions ?? []).map((s: { normalized_email: string }) => s.normalized_email));
    for (const r of deduped) {
      if (suppressedSet.has(r.normalized_email)) {
        suppressed_count++;
      } else {
        eligible.push(r);
      }
    }
  } else {
    eligible.push(...deduped);
  }

  const invalid_count = eligible.filter((r) => !r.is_valid_email).length;
  const eligible_count = eligible.filter((r) => r.is_valid_email).length;

  return {
    recipients: eligible.filter((r) => r.is_valid_email),
    eligible_count,
    suppressed_count,
    invalid_count,
  };
}
