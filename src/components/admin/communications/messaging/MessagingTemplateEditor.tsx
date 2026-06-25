import { useState, useEffect } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { FloppyDiskIcon, Cancel01Icon, ArchiveIcon } from "@hugeicons/core-free-icons";
import { AdminCard } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { saveTemplate, archiveTemplate } from "@/services/adminMessaging";
import { ALLOWED_TEMPLATE_VARIABLES, REPLY_TO_DEFAULT } from "./messagingConstants";
import { extractVariables, renderPreview } from "./messagingHelpers";
import { PREVIEW_SAMPLE_VARS } from "./messagingConstants";
import type { MessagingTemplate } from "./messagingTypes";

interface Props {
  initial?: MessagingTemplate | null;
  onSaved: (t: MessagingTemplate) => void;
  onCancel: () => void;
}

type EditorTab = "email_html" | "email_text" | "inapp" | "meta";

export function MessagingTemplateEditor({ initial, onSaved, onCancel }: Props) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "product");
  const [isTransactional, setIsTransactional] = useState(initial?.is_transactional ?? false);
  const [emailSubject, setEmailSubject] = useState(initial?.email_subject ?? "");
  const [emailPreheader, setEmailPreheader] = useState(initial?.email_preheader ?? "");
  const [emailHtml, setEmailHtml] = useState(initial?.email_html ?? "");
  const [emailText, setEmailText] = useState(initial?.email_text ?? "");
  const [emailCtaLabel, setEmailCtaLabel] = useState(initial?.email_cta_label ?? "");
  const [emailCtaUrl, setEmailCtaUrl] = useState(initial?.email_cta_url ?? "");
  const [defaultReplyTo, setDefaultReplyTo] = useState(initial?.default_reply_to ?? REPLY_TO_DEFAULT);
  const [notifType, setNotifType] = useState(initial?.notification_type ?? "messaging_broadcast");
  const [notifTitle, setNotifTitle] = useState(initial?.notification_title ?? "");
  const [notifBody, setNotifBody] = useState(initial?.notification_body ?? "");
  const [notifDetail, setNotifDetail] = useState(initial?.notification_detail_text ?? "");
  const [notifCtaLabel, setNotifCtaLabel] = useState(initial?.notification_cta_label ?? "");
  const [notifCtaUrl, setNotifCtaUrl] = useState(initial?.notification_cta_url ?? "");
  const [tab, setTab] = useState<EditorTab>("email_html");
  const [htmlPreview, setHtmlPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!initial) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    }
  }, [name, initial]);

  const usedVars = extractVariables(emailHtml + emailText + notifBody);
  const unknownVars = usedVars.filter(
    v => !ALLOWED_TEMPLATE_VARIABLES.includes(v as typeof ALLOWED_TEMPLATE_VARIABLES[number])
  );

  async function handleSave() {
    if (!slug.trim() || !name.trim()) {
      toast.error("Slug and name are required");
      return;
    }
    if (unknownVars.length) {
      toast.error(`Unknown variables: ${unknownVars.map(v => `{{${v}}}`).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveTemplate({
        id: initial?.id,
        slug, name, description, category,
        is_transactional: isTransactional,
        email_subject: emailSubject,
        email_preheader: emailPreheader,
        email_html: emailHtml,
        email_text: emailText,
        email_cta_label: emailCtaLabel,
        email_cta_url: emailCtaUrl,
        default_reply_to: defaultReplyTo,
        notification_type: notifType,
        notification_title: notifTitle,
        notification_body: notifBody,
        notification_detail_text: notifDetail,
        notification_cta_label: notifCtaLabel,
        notification_cta_url: notifCtaUrl,
      } as MessagingTemplate);
      toast.success(initial ? "Template updated" : "Template created");
      onSaved(saved);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!initial?.id) return;
    if (!confirm("Archive this template? It will no longer be selectable for new messages.")) return;
    setArchiving(true);
    try {
      await archiveTemplate(initial.id);
      toast.success("Template archived");
      // Reflect the archived state in the parent without a full reload
      onSaved({ ...initial, archived_at: new Date().toISOString(), is_active: false });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-4">
      {unknownVars.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
          Unknown variables detected: {unknownVars.map(v => `{{${v}}}`).join(", ")}
        </div>
      )}

      <AdminCard>
        {/* Identity fields */}
        <div className="space-y-3 mb-5">
          {/* Row 1: Name + Category + Transactional */}
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
              />
              {slug && (
                <p className="mt-1 text-[11px] font-mono text-[#9CA3AF] truncate">{slug}</p>
              )}
            </div>
            <div className="w-36 shrink-0">
              <label className="block text-xs font-semibold text-[#374151] mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
              />
            </div>
            <div className="flex items-center gap-2 pt-6 shrink-0">
              <input
                type="checkbox"
                id="is_transactional"
                checked={isTransactional}
                onChange={e => setIsTransactional(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="is_transactional" className="text-sm text-[#374151] font-medium whitespace-nowrap">
                Transactional
              </label>
            </div>
          </div>

          {/* Row 2: Description */}
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
            />
          </div>
        </div>

        <div className="h-px bg-[#EEF0F0] mb-4" />

        {/* Tab row + Edit/Preview toggle */}
        <div className="flex items-center gap-1 mb-4">
          {([
            ["email_html", "Email HTML"],
            ["email_text", "Plain Text"],
            ["inapp", "In-App"],
            ["meta", "Metadata"],
          ] as [EditorTab, string][]).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t ? "bg-[#345C5A] text-white" : "text-[#6B7280] hover:text-[#1C2B2B]"
              }`}
            >
              {label}
            </button>
          ))}
          {tab === "email_html" && (
            <button
              type="button"
              onClick={() => setHtmlPreview(v => !v)}
              className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                htmlPreview ? "bg-[#345C5A] text-white" : "text-[#6B7280] hover:text-[#1C2B2B] border border-[#E5E7EB]"
              }`}
            >
              {htmlPreview ? "Edit" : "Preview"}
            </button>
          )}
        </div>

        {tab === "email_html" && (
          <>
            {htmlPreview ? (
              <iframe
                srcDoc={emailHtml ? renderPreview(emailHtml, PREVIEW_SAMPLE_VARS) : "<p style='font-family:sans-serif;color:#9CA3AF;padding:24px'>No HTML content yet.</p>"}
                sandbox="allow-same-origin"
                title="Email preview"
                className="w-full rounded-xl border border-[#E5E7EB] bg-white"
                style={{ height: 520 }}
              />
            ) : (
              <textarea
                rows={16}
                value={emailHtml}
                onChange={e => setEmailHtml(e.target.value)}
                placeholder="Email HTML content…"
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs font-mono text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 resize-none"
              />
            )}
          </>
        )}

        {tab === "email_text" && (
          <textarea
            rows={10}
            value={emailText}
            onChange={e => setEmailText(e.target.value)}
            placeholder="Plain-text fallback…"
            className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs font-mono text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 resize-none"
          />
        )}

        {tab === "inapp" && (
          <div className="space-y-3">
            {[
              ["notification_type", "Type", notifType, setNotifType],
              ["notification_title", "Title", notifTitle, setNotifTitle],
              ["notification_body", "Body", notifBody, setNotifBody],
              ["notification_detail_text", "Detail Text", notifDetail, setNotifDetail],
              ["notification_cta_label", "CTA Label", notifCtaLabel, setNotifCtaLabel],
              ["notification_cta_url", "CTA URL", notifCtaUrl, setNotifCtaUrl],
            ].map(([, label, value, setter]) => (
              <div key={String(label)}>
                <label className="block text-xs font-semibold text-[#374151] mb-1">{String(label)}</label>
                <input
                  type="text"
                  value={String(value)}
                  onChange={e => (setter as (v: string) => void)(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}

        {tab === "meta" && (
          <div className="space-y-3">
            {[
              ["Subject", emailSubject, setEmailSubject],
              ["Preheader", emailPreheader, setEmailPreheader],
              ["CTA Label", emailCtaLabel, setEmailCtaLabel],
              ["CTA URL", emailCtaUrl, setEmailCtaUrl],
              ["Default Reply-To", defaultReplyTo, setDefaultReplyTo],
            ].map(([label, value, setter]) => (
              <div key={String(label)}>
                <label className="block text-xs font-semibold text-[#374151] mb-1">{String(label)}</label>
                <input
                  type="text"
                  value={String(value)}
                  onChange={e => (setter as (v: string) => void)(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#6B7280] hover:border-[#345C5A] transition-colors"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={15} />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#345C5A] text-white text-sm font-semibold hover:bg-[#2a4a48] disabled:opacity-60 transition-colors"
        >
          <HugeiconsIcon icon={FloppyDiskIcon} size={15} />
          {saving ? "Saving…" : initial ? "Update Template" : "Create Template"}
        </button>
        {initial && !initial.archived_at && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#9CA3AF] hover:border-amber-400 hover:text-amber-600 disabled:opacity-60 transition-colors ml-auto"
          >
            <HugeiconsIcon icon={ArchiveIcon} size={15} />
            {archiving ? "Archiving…" : "Archive"}
          </button>
        )}
      </div>
    </div>
  );
}
