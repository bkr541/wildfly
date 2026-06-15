import { useState, useEffect } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Mail01Icon,
  SentIcon,
  UserGroupIcon,
  CheckmarkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { AdminCard, AdminSectionLabel } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { listMessages } from "@/services/adminMessaging";
import { MessageStatusBadge } from "./MessagingStatusBadge";
import { formatRecipientCount } from "./messagingHelpers";
import type { MessagingMessage } from "./messagingTypes";

interface StatCardProps {
  icon: IconSvgElement;
  label: string;
  value: string | number;
  color?: string;
}

function StatCard({ icon, label, value, color = "text-[#345C5A]" }: StatCardProps) {
  return (
    <AdminCard>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl bg-[#F8FAFA] ${color}`}>
          <HugeiconsIcon icon={icon} size={18} />
        </div>
        <div>
          <div className="text-2xl font-bold text-[#1C2B2B]">{value}</div>
          <div className="text-xs text-[#9CA3AF] font-medium">{label}</div>
        </div>
      </div>
    </AdminCard>
  );
}

export function MessagingOverview() {
  const [recent, setRecent] = useState<MessagingMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listMessages({ page: 0, page_size: 5 })
      .then(r => setRecent(r.messages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed = recent.filter(m => m.status === "completed" || m.status === "partially_completed");
  const totalRecipients = completed.reduce((sum, m) => sum + (m.recipient_count ?? 0), 0);
  const drafts = recent.filter(m => m.status === "draft");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Mail01Icon} label="Recent Messages" value={recent.length} />
        <StatCard icon={SentIcon} label="Completed" value={completed.length} color="text-green-500" />
        <StatCard icon={UserGroupIcon} label="Recipients Reached" value={formatRecipientCount(totalRecipients)} />
        <StatCard icon={CheckmarkSquare02Icon} label="Drafts" value={drafts.length} color="text-amber-500" />
      </div>

      <AdminCard>
        <AdminSectionLabel>Recent Messages</AdminSectionLabel>
        {loading && <p className="text-xs text-[#9CA3AF]">Loading…</p>}
        {!loading && recent.length === 0 && (
          <p className="text-xs text-[#9CA3AF]">No messages yet. Compose your first message from the Messages tab.</p>
        )}
        <div className="space-y-2">
          {recent.map(msg => (
            <div key={msg.id} className="flex items-center gap-3 py-1.5 border-b border-[#EEF0F0] last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#1C2B2B] truncate">{msg.internal_name}</div>
                <div className="text-xs text-[#9CA3AF]">
                  {msg.recipient_count > 0
                    ? `${formatRecipientCount(msg.recipient_count)} recipients`
                    : msg.category}
                </div>
              </div>
              <MessageStatusBadge status={msg.status} />
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
