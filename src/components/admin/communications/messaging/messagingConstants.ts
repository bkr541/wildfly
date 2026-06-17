import type { AudienceFilterDefinition, ComposeFormState } from "./messagingTypes";

export const REPLY_TO_DEFAULT = "wildflyapp@gmail.com";

export const MESSAGE_CATEGORIES = [
  "product",
  "marketing",
  "beta",
  "transactional",
  "system",
] as const;

export const NOTIFICATION_TYPES = [
  "messaging_broadcast",
  "product_update",
  "beta_update",
  "system_alert",
  "account",
] as const;

export const DEFAULT_AUDIENCE_FILTER: AudienceFilterDefinition = {
  sources: [{ type: "active_users" }],
  logic: "union",
};

export const EMPTY_COMPOSE: ComposeFormState = {
  internal_name: "",
  internal_description: "",
  category: "product",
  classification: "non_transactional",
  template_id: "",
  channels: ["email"],
  email_subject: "",
  email_preheader: "",
  email_html: "",
  email_text: "",
  email_cta_label: "",
  email_cta_url: "",
  reply_to: REPLY_TO_DEFAULT,
  notification_type: "messaging_broadcast",
  notification_title: "",
  notification_body: "",
  notification_detail_text: "",
  notification_cta_label: "",
  notification_cta_url: "",
  audience_id: "",
  audience_definition: DEFAULT_AUDIENCE_FILTER,
  scheduled_at: "",
};

export const ALLOWED_TEMPLATE_VARIABLES = [
  "recipient_name",
  "recipient_email",
  "first_name",
  "last_name",
  "user_id",
  "beta_application_id",
  "app_name",
  "app_url",
  "action_link",
  "support_email",
  "unsubscribe_url",
  "current_year",
  "home_airport",
  "account_cta_url",
  "account_cta_label",
  "physical_address",
] as const;

export const MESSAGE_STATUS_COLORS: Record<string, string> = {
  draft: "text-stone-400 bg-stone-400/10",
  scheduled: "text-blue-400 bg-blue-400/10",
  queued: "text-yellow-400 bg-yellow-400/10",
  processing: "text-orange-400 bg-orange-400/10",
  partially_completed: "text-amber-400 bg-amber-400/10",
  completed: "text-green-400 bg-green-400/10",
  cancelled: "text-stone-500 bg-stone-500/10",
  failed: "text-red-400 bg-red-400/10",
};

export const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: "text-stone-400 bg-stone-400/10",
  queued: "text-yellow-400 bg-yellow-400/10",
  processing: "text-orange-400 bg-orange-400/10",
  sent: "text-blue-400 bg-blue-400/10",
  delivered: "text-teal-400 bg-teal-400/10",
  opened: "text-green-400 bg-green-400/10",
  clicked: "text-emerald-400 bg-emerald-400/10",
  failed: "text-red-400 bg-red-400/10",
  bounced: "text-red-500 bg-red-500/10",
  complained: "text-red-600 bg-red-600/10",
  suppressed: "text-stone-500 bg-stone-500/10",
  unsubscribed: "text-stone-500 bg-stone-500/10",
  cancelled: "text-stone-500 bg-stone-500/10",
};
