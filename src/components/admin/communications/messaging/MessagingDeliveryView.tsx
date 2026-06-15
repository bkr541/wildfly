import { useState, useEffect, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SearchIcon,
  ArrowReloadHorizontalIcon,
  ArrowUpDownIcon,
  Mail01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { listDeliveries, retryDeliveries } from "@/services/adminMessaging";
import { RecipientStatusBadge } from "./MessagingStatusBadge";
import { MessagingDeliveryDrawer } from "./MessagingDeliveryDrawer";
import type { MessagingRecipient, RecipientStatus } from "./messagingTypes";

const STATUS_FILTERS: { label: string; value: RecipientStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Sent", value: "sent" },
  { label: "Delivered", value: "delivered" },
  { label: "Opened", value: "opened" },
  { label: "Clicked", value: "clicked" },
  { label: "Failed", value: "failed" },
  { label: "Bounced", value: "bounced" },
];

export function MessagingDeliveryView() {
  const [recipients, setRecipients] = useState<MessagingRecipient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecipientStatus | "">("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MessagingRecipient | null>(null);
  const [retrying, setRetrying] = useState(false);

  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDeliveries({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setRecipients(result.recipients);
      setTotal(result.total);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const failedIds = recipients.filter(r => r.status === "failed").map(r => r.id);

  async function handleRetryAll() {
    if (!failedIds.length) return;
    setRetrying(true);
    try {
      const { retried } = await retryDeliveries(failedIds);
      toast.success(`${retried} recipient${retried !== 1 ? "s" : ""} re-queued`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <HugeiconsIcon icon={SearchIcon} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by email…"
            className="w-full pl-8 pr-3 py-2 border border-[#E5E7EB] rounded-xl text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
          />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:border-[#345C5A] transition-colors"
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} className={loading ? "animate-spin" : ""} />
        </button>
        {failedIds.length > 0 && (
          <button
            type="button"
            onClick={handleRetryAll}
            disabled={retrying}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#345C5A] text-[#345C5A] text-xs font-semibold hover:bg-[#345C5A]/5 disabled:opacity-60 transition-colors"
          >
            <HugeiconsIcon icon={ArrowUpDownIcon} size={13} />
            {retrying ? "Re-queuing…" : `Retry ${failedIds.length} Failed`}
          </button>
        )}
      </div>

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

      {recipients.length === 0 && !loading ? (
        <AdminCard className="flex flex-col items-center justify-center py-16 gap-3">
          <HugeiconsIcon icon={Mail01Icon} size={36} className="text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF] font-medium">No delivery records found</p>
        </AdminCard>
      ) : (
        <AdminCard className="p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#EEF0F0] bg-[#F8FAFA]">
                {["Email", "Status", "Channel", "Sent", "Delivered"].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipients.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="border-b border-[#EEF0F0] last:border-0 hover:bg-[#F8FAFA] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-[#374151] font-medium truncate max-w-[200px]">{r.email}</td>
                  <td className="px-4 py-3"><RecipientStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-[#6B7280]">{r.channel}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">
                    {r.sent_at ? new Date(r.sent_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF]">
                    {r.delivered_at ? new Date(r.delivered_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

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

      <MessagingDeliveryDrawer recipient={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
