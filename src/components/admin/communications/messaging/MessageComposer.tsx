import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FloppyDiskIcon,
  SentIcon,
  Cancel01Icon,
  Clock01Icon,
  TestTube01Icon,
} from "@hugeicons/core-free-icons";
import { AdminCard, AdminSectionLabel } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { saveMessage, queueMessage, sendTest } from "@/services/adminMessaging";
import { MessageContentEditor } from "./MessageContentEditor";
import { MessageAudienceBuilder } from "./MessageAudienceBuilder";
import { MessageScheduleControls } from "./MessageScheduleControls";
import { MessageConfirmationDialog } from "./MessageConfirmationDialog";
import { EMPTY_COMPOSE, MESSAGE_CATEGORIES, REPLY_TO_DEFAULT } from "./messagingConstants";
import { canEditMessage } from "./messagingHelpers";
import type { ComposeFormState, MessagingMessage } from "./messagingTypes";

interface Props {
  initial?: MessagingMessage | null;
  onSaved?: (msg: MessagingMessage) => void;
  onCancel?: () => void;
}

export function MessageComposer({ initial, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<ComposeFormState>(() => {
    if (!initial) return { ...EMPTY_COMPOSE };
    return {
      internal_name: initial.internal_name,
      internal_description: initial.internal_description ?? "",
      category: initial.category,
      classification: initial.classification,
      template_id: initial.template_id ?? "",
      channels: initial.channels,
      email_subject: initial.email_subject ?? "",
      email_preheader: initial.email_preheader ?? "",
      email_html: initial.email_html ?? "",
      email_text: initial.email_text ?? "",
      email_cta_label: initial.email_cta_label ?? "",
      email_cta_url: initial.email_cta_url ?? "",
      reply_to: initial.reply_to || REPLY_TO_DEFAULT,
      notification_type: initial.notification_type ?? "messaging_broadcast",
      notification_title: initial.notification_title ?? "",
      notification_body: initial.notification_body ?? "",
      notification_detail_text: initial.notification_detail_text ?? "",
      notification_cta_label: initial.notification_cta_label ?? "",
      notification_cta_url: initial.notification_cta_url ?? "",
      audience_id: initial.audience_id ?? "",
      audience_definition: initial.audience_definition,
      scheduled_at: initial.scheduled_at ?? "",
    };
  });

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [testAddresses, setTestAddresses] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const isEdit = !!initial;
  const isEditable = !isEdit || canEditMessage(initial!.status);

  function patch(p: Partial<ComposeFormState>) {
    setForm(f => ({ ...f, ...p }));
  }

  async function handleSave() {
    if (!form.internal_name.trim()) {
      toast.error("Internal name is required");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMessage({ id: initial?.id, ...form });
      toast.success(isEdit ? "Message saved" : "Draft created");
      onSaved?.(saved);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleQueue() {
    if (!initial?.id) {
      toast.error("Save the message before sending");
      return;
    }
    setQueueing(true);
    try {
      const updated = await queueMessage(initial.id, form.scheduled_at || null);
      toast.success(form.scheduled_at ? "Message scheduled" : "Message queued for delivery");
      onSaved?.(updated);
      setConfirmOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setQueueing(false);
    }
  }

  async function handleSendTest() {
    if (!initial?.id) {
      toast.error("Save the message first");
      return;
    }
    const addrs = testAddresses.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (!addrs.length) { toast.error("Enter at least one address"); return; }
    if (addrs.length > 5) { toast.error("Maximum 5 test addresses"); return; }
    setSendingTest(true);
    try {
      const { accepted } = await sendTest(initial.id, addrs);
      toast.success(`Test sent to ${accepted.join(", ")}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <AdminCard>
        <AdminSectionLabel>Message Identity</AdminSectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Internal Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.internal_name}
              disabled={!isEditable}
              onChange={e => patch({ internal_name: e.target.value })}
              placeholder="e.g. June 2026 Product Update"
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 disabled:opacity-60"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-[#374151] mb-1">Description</label>
            <input
              type="text"
              value={form.internal_description}
              disabled={!isEditable}
              onChange={e => patch({ internal_description: e.target.value })}
              placeholder="Internal notes (not sent to recipients)"
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Category</label>
            <select
              value={form.category}
              disabled={!isEditable}
              onChange={e => patch({ category: e.target.value })}
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 disabled:opacity-60"
            >
              {MESSAGE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Classification</label>
            <select
              value={form.classification}
              disabled={!isEditable}
              onChange={e => patch({ classification: e.target.value as ComposeFormState["classification"] })}
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 disabled:opacity-60"
            >
              <option value="non_transactional">Non-Transactional</option>
              <option value="transactional">Transactional</option>
            </select>
          </div>
        </div>
      </AdminCard>

      {/* Content */}
      <AdminCard>
        <MessageContentEditor form={form} onChange={patch} />
      </AdminCard>

      {/* Audience */}
      <AdminCard>
        <MessageAudienceBuilder
          audienceId={form.audience_id}
          audienceDefinition={form.audience_definition}
          channels={form.channels}
          classification={form.classification}
          onAudienceIdChange={id => patch({ audience_id: id })}
          onAudienceDefinitionChange={def => patch({ audience_definition: def })}
        />
      </AdminCard>

      {/* Schedule */}
      <AdminCard>
        <MessageScheduleControls
          scheduledAt={form.scheduled_at}
          onChange={iso => patch({ scheduled_at: iso })}
          onClear={() => patch({ scheduled_at: "" })}
        />
      </AdminCard>

      {/* Test send */}
      {initial?.id && (
        <AdminCard>
          <AdminSectionLabel>Send Test</AdminSectionLabel>
          <p className="text-xs text-[#9CA3AF] mb-2">
            Send a test copy to up to 5 email addresses (subject prefixed with [TEST]).
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testAddresses}
              onChange={e => setTestAddresses(e.target.value)}
              placeholder="email@example.com, another@example.com"
              className="flex-1 border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
            />
            <button
              type="button"
              onClick={handleSendTest}
              disabled={sendingTest}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#345C5A] text-[#345C5A] text-sm font-semibold hover:bg-[#345C5A]/5 disabled:opacity-60 transition-colors"
            >
              <HugeiconsIcon icon={TestTube01Icon} size={15} />
              {sendingTest ? "Sending…" : "Send Test"}
            </button>
          </div>
        </AdminCard>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#6B7280] hover:border-[#345C5A] transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={15} />
            Cancel
          </button>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isEditable}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#345C5A] text-[#345C5A] text-sm font-semibold hover:bg-[#345C5A]/5 disabled:opacity-60 transition-colors"
        >
          <HugeiconsIcon icon={FloppyDiskIcon} size={15} />
          {saving ? "Saving…" : "Save Draft"}
        </button>

        {initial?.id && isEditable && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#345C5A] text-white text-sm font-semibold hover:bg-[#2a4a48] transition-colors"
          >
            <HugeiconsIcon icon={form.scheduled_at ? Clock01Icon : SentIcon} size={15} />
            {form.scheduled_at ? "Schedule" : "Send Now"}
          </button>
        )}
      </div>

      <MessageConfirmationDialog
        open={confirmOpen}
        recipientCount={initial?.recipient_count ?? 0}
        scheduledAt={form.scheduled_at || null}
        loading={queueing}
        onConfirm={handleQueue}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
