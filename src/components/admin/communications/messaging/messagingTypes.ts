// Shared frontend types for the Messaging system.

export type MessageStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "processing"
  | "partially_completed"
  | "completed"
  | "cancelled"
  | "failed";

export type RecipientStatus =
  | "pending"
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "unsubscribed"
  | "cancelled";

export type MessageClassification = "transactional" | "non_transactional";

export type MessageChannel = "email" | "in_app";

export type SuppressionReason = "unsubscribed" | "hard_bounce" | "complaint" | "manual" | "invalid";

export type SuppressionScope =
  | "marketing"
  | "product_updates"
  | "beta_updates"
  | "all_non_transactional"
  | "all";

// ── Message ───────────────────────────────────────────────────

export interface MessagingMessage {
  id: string;
  internal_name: string;
  internal_description: string | null;
  category: string;
  classification: MessageClassification;
  template_id: string | null;
  template_version: number | null;
  status: MessageStatus;
  channels: MessageChannel[];

  audience_id: string | null;
  audience_definition: AudienceFilterDefinition;
  recipient_count: number;
  eligible_count: number;
  suppressed_count: number;
  invalid_count: number;

  email_subject: string | null;
  email_preheader: string | null;
  email_html: string | null;
  email_text: string | null;
  email_cta_label: string | null;
  email_cta_url: string | null;
  reply_to: string;

  notification_type: string | null;
  notification_title: string | null;
  notification_body: string | null;
  notification_detail_text: string | null;
  notification_cta_label: string | null;
  notification_cta_url: string | null;

  scheduled_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;

  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  idempotency_key: string | null;
  last_error: string | null;
}

// ── Template ──────────────────────────────────────────────────

export interface MessagingTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
  is_transactional: boolean;
  supported_channels: MessageChannel[];

  email_subject: string | null;
  email_preheader: string | null;
  email_html: string | null;
  email_text: string | null;
  email_cta_label: string | null;
  email_cta_url: string | null;
  default_reply_to: string;

  notification_type: string | null;
  notification_title: string | null;
  notification_body: string | null;
  notification_detail_text: string | null;
  notification_cta_label: string | null;
  notification_cta_url: string | null;

  available_variables: string[];
  required_variables: string[];
  version: number;

  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ── Audience ──────────────────────────────────────────────────

export interface MessagingAudience {
  id: string;
  name: string;
  description: string | null;
  filter_definition: AudienceFilterDefinition;
  is_active: boolean;
  last_estimated_count: number | null;
  last_estimated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type AudienceSourceType =
  | "active_users"
  | "beta_applicants"
  | "manual_emails";

export interface AudienceSourceConfig {
  type: AudienceSourceType;
  filters?: {
    status?: string;
    plan?: string;
    home_airport?: string;
    email_pref?: string;
    onboarding_complete?: "yes" | "no";
    signup_type?: string;
  };
  emails?: string[];
}

export interface AudienceFilterDefinition {
  sources: AudienceSourceConfig[];
  logic: "union" | "intersect";
}

export interface AudiencePreview {
  total_count: number;
  eligible_count: number;
  suppressed_count: number;
  invalid_count: number;
  sample: AudienceSampleRow[];
}

export interface AudienceSampleRow {
  email: string;
  recipient_name: string;
  user_id: string | null;
  beta_application_id: string | null;
}

// ── Recipient ─────────────────────────────────────────────────

export interface MessagingRecipient {
  id: string;
  message_id: string;
  channel: MessageChannel;
  user_id: string | null;
  beta_application_id: string | null;
  email: string | null;
  normalized_email: string | null;
  recipient_name: string | null;
  status: RecipientStatus;
  provider: string | null;
  provider_message_id: string | null;
  attempt_count: number;
  last_error: string | null;
  queued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  failed_at: string | null;
  bounced_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

// ── Compose form state ────────────────────────────────────────

export interface ComposeFormState {
  // Identity
  internal_name: string;
  internal_description: string;
  category: string;
  classification: MessageClassification;
  template_id: string;

  // Channels
  channels: MessageChannel[];

  // Email
  email_subject: string;
  email_preheader: string;
  email_html: string;
  email_text: string;
  email_cta_label: string;
  email_cta_url: string;
  reply_to: string;

  // In-App
  notification_type: string;
  notification_title: string;
  notification_body: string;
  notification_detail_text: string;
  notification_cta_label: string;
  notification_cta_url: string;

  // Audience
  audience_id: string;
  audience_definition: AudienceFilterDefinition;

  // Schedule
  scheduled_at: string;
}

// ── Provider settings ─────────────────────────────────────────

export interface MessagingProviderStatus {
  name: string;
  from_email: string | null;
  from_name: string | null;
  reply_to: string;
  configured: boolean;
}

export interface MessagingSettingsResponse {
  settings: Record<string, string>;
  env_status: Record<string, boolean>;
  provider: MessagingProviderStatus;
}

// ── Email preferences ─────────────────────────────────────────

export interface UserEmailPreferences {
  user_id: string;
  email_enabled: boolean;
  email_product_updates: boolean;
  email_gowild_updates: boolean;
  email_beta_updates: boolean;
  email_account_messages: boolean;
  email_marketing: boolean;
  unsubscribed_at: string | null;
}
