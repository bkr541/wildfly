import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserGroupIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { AdminCard } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { previewAudience } from "@/services/adminMessaging";
import { formatRecipientCount } from "./messagingHelpers";
import type { AudienceFilterDefinition, AudiencePreview, MessageChannel, MessageClassification } from "./messagingTypes";

interface Props {
  filterDefinition: AudienceFilterDefinition;
  channels: MessageChannel[];
  classification: MessageClassification;
}

export function MessagingAudiencePreview({ filterDefinition, channels, classification }: Props) {
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setLoading(true);
    setError(null);
    try {
      const result = await previewAudience(filterDefinition, channels, classification);
      setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminCard className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1C2B2B]">
          <HugeiconsIcon icon={UserGroupIcon} size={15} />
          Audience Preview
        </div>
        <button
          type="button"
          onClick={runPreview}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#345C5A] hover:text-[#1C2B2B] transition-colors disabled:opacity-60"
        >
          <HugeiconsIcon icon={RefreshIcon} size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!preview && !loading && (
        <p className="text-xs text-[#9CA3AF]">Click Refresh to estimate audience size.</p>
      )}

      {preview && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Eligible", value: preview.eligible_count, color: "text-green-600" },
              { label: "Suppressed", value: preview.suppressed_count, color: "text-amber-600" },
              { label: "Invalid", value: preview.invalid_count, color: "text-red-500" },
              { label: "Total", value: preview.total_count, color: "text-[#1C2B2B]" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#F8FAFA] rounded-xl p-3 text-center">
                <div className={`text-lg font-bold ${color}`}>{formatRecipientCount(value)}</div>
                <div className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide">{label}</div>
              </div>
            ))}
          </div>

          {preview.sample.length > 0 && (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">
                Sample (up to 5)
              </div>
              <div className="space-y-1">
                {preview.sample.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#374151]">
                    <span className="w-4 h-4 rounded-full bg-[#E8F0EF] text-[#345C5A] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {(row.recipient_name || row.email)[0]?.toUpperCase()}
                    </span>
                    <span className="font-medium truncate">{row.recipient_name || "—"}</span>
                    <span className="text-[#9CA3AF] truncate">{row.email}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AdminCard>
  );
}
