import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Delete01Icon } from "@hugeicons/core-free-icons";
import { AdminSectionLabel } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { listAudiences } from "@/services/adminMessaging";
import { MessagingAudiencePreview } from "./MessagingAudiencePreview";
import { DEFAULT_AUDIENCE_FILTER } from "./messagingConstants";
import type { AudienceFilterDefinition, AudienceSourceConfig, AudienceSourceType, MessagingAudience, MessageChannel, MessageClassification } from "./messagingTypes";

interface Props {
  audienceId: string;
  audienceDefinition: AudienceFilterDefinition;
  channels: MessageChannel[];
  classification: MessageClassification;
  onAudienceIdChange: (id: string) => void;
  onAudienceDefinitionChange: (def: AudienceFilterDefinition) => void;
}

const SOURCE_TYPE_LABELS: Record<AudienceSourceType, string> = {
  active_users: "Active Users",
  beta_applicants: "Beta Applicants",
  manual_emails: "Manual Email List",
};

export function MessageAudienceBuilder({
  audienceId, audienceDefinition, channels, classification,
  onAudienceIdChange, onAudienceDefinitionChange,
}: Props) {
  const [audiences, setAudiences] = useState<MessagingAudience[]>([]);
  const [manualText, setManualText] = useState("");
  const [mode, setMode] = useState<"preset" | "custom">(audienceId ? "preset" : "custom");

  useEffect(() => {
    listAudiences().then(setAudiences).catch(() => {});
  }, []);

  function addSource(type: AudienceSourceType) {
    const newSrc: AudienceSourceConfig = type === "manual_emails"
      ? { type, emails: [] }
      : { type, filters: {} };
    onAudienceDefinitionChange({
      ...audienceDefinition,
      sources: [...audienceDefinition.sources, newSrc],
    });
  }

  function removeSource(index: number) {
    onAudienceDefinitionChange({
      ...audienceDefinition,
      sources: audienceDefinition.sources.filter((_, i) => i !== index),
    });
  }

  function updateManualEmails(index: number, raw: string) {
    setManualText(raw);
    const emails = raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const next = [...audienceDefinition.sources];
    next[index] = { ...next[index], emails };
    onAudienceDefinitionChange({ ...audienceDefinition, sources: next });
  }

  function selectPreset(id: string) {
    onAudienceIdChange(id);
    if (!id) {
      onAudienceDefinitionChange(DEFAULT_AUDIENCE_FILTER);
    } else {
      const found = audiences.find(a => a.id === id);
      if (found) onAudienceDefinitionChange(found.filter_definition);
    }
  }

  return (
    <div>
      <AdminSectionLabel>Audience</AdminSectionLabel>

      <div className="flex gap-2 mb-4">
        {(["preset", "custom"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              mode === m
                ? "bg-[#345C5A] text-white border-[#345C5A]"
                : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#345C5A]"
            }`}
          >
            {m === "preset" ? "Saved Audience" : "Custom"}
          </button>
        ))}
      </div>

      {mode === "preset" && (
        <select
          value={audienceId}
          onChange={e => selectPreset(e.target.value)}
          className="w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm text-[#1C2B2B] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
        >
          <option value="">— Select a saved audience —</option>
          {audiences.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}{a.last_estimated_count != null ? ` (~${a.last_estimated_count})` : ""}
            </option>
          ))}
        </select>
      )}

      {mode === "custom" && (
        <div className="space-y-3">
          {audienceDefinition.sources.map((src, i) => (
            <div key={i} className="bg-[#F8FAFA] rounded-xl p-3 border border-[#EEF0F0]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#374151]">
                  {SOURCE_TYPE_LABELS[src.type]}
                </span>
                <button
                  type="button"
                  onClick={() => removeSource(i)}
                  className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                >
                  <HugeiconsIcon icon={Delete01Icon} size={14} />
                </button>
              </div>

              {src.type === "manual_emails" && (
                <textarea
                  rows={4}
                  placeholder="One email per line, or comma-separated"
                  value={manualText}
                  onChange={e => updateManualEmails(i, e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40 resize-none font-mono"
                />
              )}

              {src.type === "active_users" && (
                <div className="grid grid-cols-2 gap-2">
                  {[["plan", "Plan"], ["home_airport", "Home Airport"]].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-[11px] text-[#9CA3AF] mb-1">{label}</label>
                      <input
                        type="text"
                        placeholder="Any"
                        value={(src.filters as Record<string, string>)?.[field] ?? ""}
                        onChange={e => {
                          const next = [...audienceDefinition.sources];
                          next[i] = { ...next[i], filters: { ...next[i].filters, [field]: e.target.value || undefined } };
                          onAudienceDefinitionChange({ ...audienceDefinition, sources: next });
                        }}
                        className="w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs text-[#374151] bg-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            {(Object.keys(SOURCE_TYPE_LABELS) as AudienceSourceType[]).map(type => {
              const alreadyAdded = type !== "manual_emails" && audienceDefinition.sources.some(s => s.type === type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addSource(type)}
                  className="flex items-center gap-1 text-xs font-semibold text-[#345C5A] hover:text-[#1C2B2B] disabled:opacity-40 disabled:cursor-not-allowed border border-[#345C5A]/30 rounded-lg px-2.5 py-1 transition-colors"
                >
                  <HugeiconsIcon icon={PlusSignIcon} size={11} />
                  {SOURCE_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <MessagingAudiencePreview
        filterDefinition={audienceDefinition}
        channels={channels}
        classification={classification}
      />
    </div>
  );
}
