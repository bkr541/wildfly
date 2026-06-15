import { useState } from "react";
import { AdminSectionLabel } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { ALLOWED_TEMPLATE_VARIABLES, REPLY_TO_DEFAULT } from "./messagingConstants";
import { extractVariables, renderPreview } from "./messagingHelpers";
import type { ComposeFormState, MessageChannel } from "./messagingTypes";

type Setter = (patch: Partial<ComposeFormState>) => void;

interface Props {
  form: ComposeFormState;
  onChange: Setter;
}

type EmailTab = "html" | "text" | "meta";
type InAppTab = "content" | "meta";

const SAMPLE_VARS: Record<string, string> = {
  recipient_name: "Jane Doe",
  recipient_email: "jane@example.com",
  first_name: "Jane",
  last_name: "Doe",
  user_id: "user_abc123",
  beta_application_id: "app_xyz",
  app_name: "Wildfly",
  app_url: "https://wildfly.app",
  support_email: "support@wildfly.app",
  unsubscribe_url: "https://wildfly.app/unsubscribe?token=…",
  current_year: String(new Date().getFullYear()),
  home_airport: "SEA",
};

function VariableChip({ name, used }: { name: string; used: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
        used
          ? "bg-[#345C5A]/10 text-[#345C5A]"
          : "bg-[#F3F4F6] text-[#9CA3AF]"
      }`}
    >
      {`{{${name}}}`}
    </span>
  );
}

function FieldWarnings({ template, label }: { template: string; label: string }) {
  const used = extractVariables(template);
  const unknown = used.filter(v => !ALLOWED_TEMPLATE_VARIABLES.includes(v as typeof ALLOWED_TEMPLATE_VARIABLES[number]));
  if (!unknown.length) return null;
  return (
    <p className="text-xs text-amber-600 mt-1">
      {label} uses unknown variables: {unknown.map(v => `{{${v}}}`).join(", ")}
    </p>
  );
}

export function MessageContentEditor({ form, onChange }: Props) {
  const [emailTab, setEmailTab] = useState<EmailTab>("html");
  const [inAppTab, setInAppTab] = useState<InAppTab>("content");
  const [showPreview, setShowPreview] = useState(false);

  const hasEmail = form.channels.includes("email");
  const hasInApp = form.channels.includes("in_app");

  function toggleChannel(ch: MessageChannel) {
    const next = form.channels.includes(ch)
      ? form.channels.filter(c => c !== ch)
      : [...form.channels, ch];
    if (next.length > 0) onChange({ channels: next as MessageChannel[] });
  }

  return (
    <div className="space-y-6">
      {/* Channels */}
      <div>
        <AdminSectionLabel>Channels</AdminSectionLabel>
        <div className="flex gap-3">
          {(["email", "in_app"] as const).map(ch => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                form.channels.includes(ch)
                  ? "bg-[#345C5A] text-white border-[#345C5A]"
                  : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#345C5A]"
              }`}
            >
              {ch === "email" ? "Email" : "In-App"}
            </button>
          ))}
        </div>
      </div>

      {/* Available variables */}
      <div>
        <AdminSectionLabel>Available Template Variables</AdminSectionLabel>
        <div className="flex flex-wrap gap-1">
          {ALLOWED_TEMPLATE_VARIABLES.map(v => {
            const used = extractVariables(form.email_html + form.email_text + form.notification_body).includes(v);
            return <VariableChip key={v} name={v} used={used} />;
          })}
        </div>
      </div>

      {/* Email content */}
      {hasEmail && (
        <div>
          <AdminSectionLabel>Email Content</AdminSectionLabel>
          <div className="flex gap-1 mb-3">
            {(["html", "text", "meta"] as EmailTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setEmailTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  emailTab === tab ? "bg-[#345C5A] text-white" : "text-[#6B7280] hover:text-[#1C2B2B]"
                }`}
              >
                {tab === "html" ? "HTML" : tab === "text" ? "Plain Text" : "Metadata"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowPreview(p => !p)}
              className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold text-[#345C5A] hover:bg-[#345C5A]/10 transition-colors"
            >
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
          </div>

          {emailTab === "html" && (
            <>
              {showPreview ? (
                <div
                  className="w-full h-80 border border-[#E5E7EB] rounded-xl p-4 overflow-auto bg-white text-sm"
                  dangerouslySetInnerHTML={{ __html: renderPreview(form.email_html, SAMPLE_VARS) }}
                />
              ) : (
                <textarea
                  rows={14}
                  placeholder="Email HTML…"
                  value={form.email_html}
                  onChange={e => onChange({ email_html: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 resize-none font-mono"
                />
              )}
              <FieldWarnings template={form.email_html} label="HTML" />
            </>
          )}

          {emailTab === "text" && (
            <>
              <textarea
                rows={10}
                placeholder="Plain-text fallback (optional)"
                value={form.email_text}
                onChange={e => onChange({ email_text: e.target.value })}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 resize-none font-mono"
              />
            </>
          )}

          {emailTab === "meta" && (
            <div className="space-y-3">
              {[
                { label: "Subject", field: "email_subject" as const, required: true },
                { label: "Preheader", field: "email_preheader" as const },
                { label: "CTA Label", field: "email_cta_label" as const },
                { label: "CTA URL", field: "email_cta_url" as const },
                { label: "Reply-To", field: "reply_to" as const },
              ].map(({ label, field, required }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type="text"
                    value={form[field]}
                    onChange={e => onChange({ [field]: e.target.value })}
                    placeholder={field === "reply_to" ? REPLY_TO_DEFAULT : undefined}
                    className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
                  />
                  <FieldWarnings template={form[field]} label={label} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* In-app content */}
      {hasInApp && (
        <div>
          <AdminSectionLabel>In-App Notification</AdminSectionLabel>
          <div className="flex gap-1 mb-3">
            {(["content", "meta"] as InAppTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setInAppTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  inAppTab === tab ? "bg-[#345C5A] text-white" : "text-[#6B7280] hover:text-[#1C2B2B]"
                }`}
              >
                {tab === "content" ? "Content" : "Metadata"}
              </button>
            ))}
          </div>

          {inAppTab === "content" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.notification_title}
                  onChange={e => onChange({ notification_title: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Body <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  value={form.notification_body}
                  onChange={e => onChange({ notification_body: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 resize-none"
                />
                <FieldWarnings template={form.notification_body} label="Body" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Detail Text</label>
                <textarea
                  rows={2}
                  value={form.notification_detail_text}
                  onChange={e => onChange({ notification_detail_text: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 resize-none"
                />
              </div>
            </div>
          )}

          {inAppTab === "meta" && (
            <div className="space-y-3">
              {[
                { label: "Notification Type", field: "notification_type" as const },
                { label: "CTA Label", field: "notification_cta_label" as const },
                { label: "CTA URL", field: "notification_cta_url" as const },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[field]}
                    onChange={e => onChange({ [field]: e.target.value })}
                    className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
