import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FloppyDiskIcon, CheckmarkSquare02Icon, RemoveSquareIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { AdminCard, AdminSectionLabel } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { getMessagingSettings, saveMessagingSettings } from "@/services/adminMessaging";
import type { MessagingSettingsResponse } from "./messagingTypes";

const EDITABLE_SETTINGS: { key: string; label: string; description?: string; placeholder?: string }[] = [
  { key: "from_email", label: "From Email", placeholder: "hello@wildfly.app", description: "Must be a domain verified with Resend." },
  { key: "from_name", label: "From Name", placeholder: "Wildfly" },
  { key: "reply_to", label: "Default Reply-To", placeholder: "wildflyapp@gmail.com", description: "Users who reply will reach this address." },
];

const ENV_STATUS_LABELS: Record<string, string> = {
  RESEND_API_KEY: "Resend API Key",
  MESSAGING_FROM_EMAIL: "From Email (env)",
  MESSAGING_FROM_NAME: "From Name (env)",
  MESSAGING_UNSUBSCRIBE_SECRET: "Unsubscribe HMAC Secret",
  MESSAGING_DISPATCH_SECRET: "Dispatch Secret",
  RESEND_WEBHOOK_SECRET: "Webhook Secret",
};

export function MessagingSettingsView() {
  const [data, setData] = useState<MessagingSettingsResponse | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMessagingSettings()
      .then(d => {
        setData(d);
        setEdits(d.settings ?? {});
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await saveMessagingSettings(edits);
      setData(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#9CA3AF]">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Provider status */}
      <AdminCard>
        <AdminSectionLabel>Provider Status</AdminSectionLabel>
        {data?.provider && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={data.provider.configured ? CheckmarkSquare02Icon : RemoveSquareIcon}
                size={16}
                className={data.provider.configured ? "text-green-500" : "text-red-400"}
              />
              <span className="text-sm font-semibold text-[#374151]">
                {data.provider.name} {data.provider.configured ? "configured" : "not configured"}
              </span>
            </div>
            {data.provider.from_email && (
              <p className="text-xs text-[#9CA3AF] ml-6">From: <strong>{data.provider.from_name}</strong> &lt;{data.provider.from_email}&gt;</p>
            )}
          </div>
        )}

        <AdminSectionLabel>Environment Variables</AdminSectionLabel>
        <div className="space-y-1.5">
          {data && Object.entries(data.env_status).map(([key, present]) => (
            <div key={key} className="flex items-center gap-2.5">
              <HugeiconsIcon
                icon={present ? CheckmarkSquare02Icon : RemoveSquareIcon}
                size={14}
                className={present ? "text-green-500" : "text-[#D1D5DB]"}
              />
              <span className="text-xs text-[#6B7280]">
                {ENV_STATUS_LABELS[key] ?? key}
              </span>
              {!present && (
                <span className="text-[10px] text-amber-500 font-semibold">Not set</span>
              )}
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Editable settings */}
      <AdminCard>
        <AdminSectionLabel>Sending Configuration</AdminSectionLabel>
        <p className="text-xs text-[#9CA3AF] mb-4">
          These values are stored in the database and override environment variable defaults where applicable.
          Secrets (API keys, HMAC secrets) must be set directly as Supabase environment variables — they are never stored here.
        </p>
        <div className="space-y-4">
          {EDITABLE_SETTINGS.map(({ key, label, description, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[#374151] mb-1">{label}</label>
              {description && (
                <p className="text-[11px] text-[#9CA3AF] mb-1">{description}</p>
              )}
              <input
                type="text"
                value={edits[key] ?? ""}
                onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#345C5A] text-white text-sm font-semibold hover:bg-[#2a4a48] disabled:opacity-60 transition-colors"
          >
            <HugeiconsIcon icon={FloppyDiskIcon} size={15} />
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </AdminCard>

      {/* Security notice */}
      <AdminCard className="bg-amber-50 border-amber-200">
        <AdminSectionLabel>Security Notice</AdminSectionLabel>
        <p className="text-xs text-amber-800 leading-relaxed">
          Never store API keys, HMAC secrets, OAuth tokens, or password reset links in message content, template variables,
          or audit metadata. Set <code className="font-mono bg-amber-100 px-1 rounded">RESEND_API_KEY</code>,{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">MESSAGING_UNSUBSCRIBE_SECRET</code>, and{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">MESSAGING_DISPATCH_SECRET</code> directly in Supabase
          environment variables. These values are never returned to the browser.
        </p>
      </AdminCard>
    </div>
  );
}
