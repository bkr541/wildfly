import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { AdminCard, AdminSectionLabel } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { renderPreview, formatScheduledAt } from "./messagingHelpers";
import { MessageStatusBadge } from "./MessagingStatusBadge";
import { PREVIEW_SAMPLE_VARS } from "./messagingConstants";
import type { MessagingMessage } from "./messagingTypes";

interface Props {
  message: MessagingMessage;
}

export function MessagePreview({ message }: Props) {
  const hasEmail = message.channels.includes("email");
  const hasInApp = message.channels.includes("in_app");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-bold text-[#1C2B2B] flex-1 truncate">{message.internal_name}</h3>
        <MessageStatusBadge status={message.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Pair label="Category" value={message.category} />
        <Pair label="Classification" value={message.classification.replace("_", " ")} />
        <Pair label="Reply-To" value={message.reply_to} />
        {message.scheduled_at && (
          <Pair label="Scheduled" value={formatScheduledAt(message.scheduled_at)} />
        )}
        {message.recipient_count > 0 && (
          <Pair label="Recipients" value={String(message.recipient_count)} />
        )}
      </div>

      {hasEmail && message.email_subject && (
        <AdminCard>
          <AdminSectionLabel>
            <HugeiconsIcon icon={Mail01Icon} size={12} className="inline mr-1" />
            Email Preview
          </AdminSectionLabel>
          <div className="mb-2">
            <span className="text-[11px] text-[#9CA3AF] font-semibold">Subject: </span>
            <span className="text-sm font-medium text-[#1C2B2B]">
              {renderPreview(message.email_subject ?? "", PREVIEW_SAMPLE_VARS)}
            </span>
          </div>
          {message.email_preheader && (
            <div className="mb-3">
              <span className="text-[11px] text-[#9CA3AF] font-semibold">Preheader: </span>
              <span className="text-xs text-[#6B7280]">
                {renderPreview(message.email_preheader, PREVIEW_SAMPLE_VARS)}
              </span>
            </div>
          )}
          {message.email_html && (
            <div
              className="border border-[#EEF0F0] rounded-xl p-4 bg-white text-sm overflow-auto max-h-96"
              dangerouslySetInnerHTML={{ __html: renderPreview(message.email_html, PREVIEW_SAMPLE_VARS) }}
            />
          )}
        </AdminCard>
      )}

      {hasInApp && message.notification_title && (
        <AdminCard>
          <AdminSectionLabel>
            <HugeiconsIcon icon={Notification01Icon} size={12} className="inline mr-1" />
            In-App Preview
          </AdminSectionLabel>
          <div className="bg-[#F8FAFA] rounded-xl p-4 border border-[#EEF0F0]">
            <div className="font-semibold text-sm text-[#1C2B2B] mb-1">
              {renderPreview(message.notification_title ?? "", PREVIEW_SAMPLE_VARS)}
            </div>
            <div className="text-xs text-[#6B7280]">
              {renderPreview(message.notification_body ?? "", PREVIEW_SAMPLE_VARS)}
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-[#9CA3AF]">{label}</div>
      <div className="text-xs font-medium text-[#374151] truncate">{value}</div>
    </div>
  );
}
