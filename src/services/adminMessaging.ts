import { supabase } from "@/integrations/supabase/client";
import type {
  MessagingMessage,
  MessagingTemplate,
  MessagingAudience,
  MessagingRecipient,
  AudienceFilterDefinition,
  AudiencePreview,
  ComposeFormState,
  MessagingSettingsResponse,
} from "@/components/admin/communications/messaging/messagingTypes";

// ── Helper ─────────────────────────────────────────────────────────────────────

async function callFn<T>(
  name: string,
  body?: unknown,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
  });
  if (error) throw new Error(error.message ?? String(error));
  if (!data?.success && data?.error) {
    throw new Error(data.error.message ?? "Unknown error");
  }
  return data as T;
}

// ── Messages ───────────────────────────────────────────────────────────────────

export interface ListMessagesParams {
  status?: string;
  search?: string;
  category?: string;
  page?: number;
  page_size?: number;
}

export interface ListMessagesResult {
  messages: MessagingMessage[];
  total: number;
  page: number;
  page_size: number;
}

export async function listMessages(params: ListMessagesParams = {}): Promise<ListMessagesResult> {
  const res = await callFn<{ success: true; data: ListMessagesResult }>(
    "admin-messaging-list-messages",
    params,
  );
  return res.data;
}

export async function getMessage(id: string): Promise<{ message: MessagingMessage; delivery_summary: Record<string, number> }> {
  const res = await callFn<{ success: true; data: { message: MessagingMessage; delivery_summary: Record<string, number> } }>(
    "admin-messaging-get-message",
    { id },
  );
  return res.data;
}

export async function saveMessage(form: Partial<ComposeFormState> & { id?: string }): Promise<MessagingMessage> {
  const res = await callFn<{ success: true; data: { message: MessagingMessage } }>(
    "admin-messaging-save-message",
    form,
  );
  return res.data.message;
}

export async function deleteDraft(id: string): Promise<void> {
  await callFn("admin-messaging-delete-draft", { id });
}

export async function queueMessage(id: string, scheduled_at?: string | null): Promise<MessagingMessage> {
  const res = await callFn<{ success: true; data: { message: MessagingMessage } }>(
    "admin-messaging-queue-message",
    { id, scheduled_at: scheduled_at ?? null },
  );
  return res.data.message;
}

export async function cancelMessage(id: string): Promise<MessagingMessage> {
  const res = await callFn<{ success: true; data: { message: MessagingMessage } }>(
    "admin-messaging-cancel-message",
    { id },
  );
  return res.data.message;
}

export async function sendTest(id: string, addresses: string[]): Promise<{ accepted: string[] }> {
  const res = await callFn<{ success: true; data: { accepted: string[] } }>(
    "admin-messaging-send-test",
    { id, addresses },
  );
  return res.data;
}

// ── Templates ──────────────────────────────────────────────────────────────────

export async function listTemplates(include_archived = false): Promise<MessagingTemplate[]> {
  let query = supabase
    .from("messaging_templates")
    .select("id, slug, name, description, category, is_active, is_transactional, supported_channels, available_variables, required_variables, version, created_at, updated_at, archived_at, email_subject, notification_type, notification_title, default_reply_to")
    .order("category")
    .order("name");
  if (!include_archived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTemplate(id: string): Promise<MessagingTemplate> {
  const { data, error } = await supabase
    .from("messaging_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as MessagingTemplate;
}

export async function saveTemplate(template: Partial<MessagingTemplate> & { slug: string; name: string }): Promise<MessagingTemplate> {
  const res = await callFn<{ success: true; data: { template: MessagingTemplate } }>(
    "admin-messaging-save-template",
    template,
  );
  return res.data.template;
}

// ── Audiences ──────────────────────────────────────────────────────────────────

export async function listAudiences(): Promise<MessagingAudience[]> {
  const res = await callFn<{ success: true; data: { audiences: MessagingAudience[] } }>(
    "admin-messaging-list-audiences",
  );
  return res.data.audiences;
}

export async function previewAudience(
  filter_definition: AudienceFilterDefinition,
  channels: string[],
  classification: string,
): Promise<AudiencePreview> {
  const res = await callFn<{ success: true; data: AudiencePreview }>(
    "admin-messaging-preview-audience",
    { filter_definition, channels, classification },
  );
  return res.data;
}

// ── Deliveries ─────────────────────────────────────────────────────────────────

export interface ListDeliveriesParams {
  message_id?: string;
  status?: string;
  channel?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ListDeliveriesResult {
  recipients: MessagingRecipient[];
  total: number;
  page: number;
  page_size: number;
}

export async function listDeliveries(params: ListDeliveriesParams): Promise<ListDeliveriesResult> {
  const res = await callFn<{ success: true; data: ListDeliveriesResult }>(
    "admin-messaging-list-deliveries",
    params,
  );
  return res.data;
}

export async function retryDeliveries(recipient_ids: string[]): Promise<{ retried: number }> {
  const res = await callFn<{ success: true; data: { retried: number } }>(
    "admin-messaging-retry-deliveries",
    { recipient_ids },
  );
  return res.data;
}

// ── Settings ───────────────────────────────────────────────────────────────────

export async function getMessagingSettings(): Promise<MessagingSettingsResponse> {
  const res = await callFn<{ success: true; data: MessagingSettingsResponse }>(
    "admin-messaging-settings",
  );
  return res.data;
}

export async function saveMessagingSettings(settings: Record<string, string>): Promise<MessagingSettingsResponse> {
  const res = await callFn<{ success: true; data: MessagingSettingsResponse }>(
    "admin-messaging-settings",
    { settings },
  );
  return res.data;
}
