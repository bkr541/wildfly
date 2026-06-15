import { useState, useEffect, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  SearchIcon,
  ArrowReloadHorizontalIcon,
  Mail01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { listMessages } from "@/services/adminMessaging";
import { MessageStatusBadge } from "./MessagingStatusBadge";
import { MessageComposer } from "./MessageComposer";
import { MessageDetailsDrawer } from "./MessageDetailsDrawer";
import { formatScheduledAt, formatRecipientCount } from "./messagingHelpers";
import type { MessagingMessage, MessageStatus } from "./messagingTypes";

const STATUS_FILTERS: { label: string; value: MessageStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Drafts", value: "draft" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Queued", value: "queued" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export function MessagesList() {
  const [messages, setMessages] = useState<MessagingMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MessageStatus | "">("");
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMessages({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setMessages(result.messages);
      setTotal(result.total);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  if (composing) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setComposing(false)}
            className="text-sm text-[#345C5A] font-semibold hover:underline"
          >
            ← Messages
          </button>
          <span className="text-[#9CA3AF]">/</span>
          <span className="text-sm font-semibold text-[#1C2B2B]">New Message</span>
        </div>
        <MessageComposer
          onSaved={() => { setComposing(false); loadMessages(); }}
          onCancel={() => setComposing(false)}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <HugeiconsIcon icon={SearchIcon} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search messages…"
            className="w-full pl-8 pr-3 py-2 border border-[#E5E7EB] rounded-xl text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
          />
        </div>
        <button
          type="button"
          onClick={() => loadMessages()}
          disabled={loading}
          className="p-2 rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:border-[#345C5A] transition-colors"
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#345C5A] text-white text-sm font-semibold hover:bg-[#2a4a48] transition-colors"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={15} />
          Compose
        </button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => { setStatusFilter(f.value); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? "bg-[#345C5A] text-white"
                : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#345C5A]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {messages.length === 0 && !loading ? (
        <AdminCard className="flex flex-col items-center justify-center py-16 gap-3">
          <HugeiconsIcon icon={Mail01Icon} size={36} className="text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF] font-medium">No messages found</p>
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex items-center gap-1.5 text-sm text-[#345C5A] font-semibold hover:underline"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={13} />
            Compose your first message
          </button>
        </AdminCard>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => (
            <button
              key={msg.id}
              type="button"
              onClick={() => setSelectedId(msg.id)}
              className="w-full text-left"
            >
              <AdminCard className="hover:border-[#345C5A]/30 transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <HugeiconsIcon icon={SentIcon} size={16} className="text-[#9CA3AF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-[#1C2B2B] truncate">
                        {msg.internal_name}
                      </span>
                      <MessageStatusBadge status={msg.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                      <span>{msg.category}</span>
                      {msg.recipient_count > 0 && (
                        <span>{formatRecipientCount(msg.recipient_count)} recipients</span>
                      )}
                      {msg.scheduled_at && (
                        <span>Scheduled {formatScheduledAt(msg.scheduled_at)}</span>
                      )}
                      {msg.completed_at && (
                        <span>Sent {new Date(msg.completed_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </AdminCard>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-xs text-[#9CA3AF]">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <MessageDetailsDrawer
        messageId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={loadMessages}
      />
    </div>
  );
}
