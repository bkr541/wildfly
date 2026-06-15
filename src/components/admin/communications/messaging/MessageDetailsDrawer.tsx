import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  PencilEdit01Icon,
  Delete01Icon,
  SentIcon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { getMessage, cancelMessage, deleteDraft, retryDeliveries, listDeliveries } from "@/services/adminMessaging";
import { MessageComposer } from "./MessageComposer";
import { MessagePreview } from "./MessagePreview";
import { MessageStatusBadge } from "./MessagingStatusBadge";
import { RecipientStatusBadge } from "./MessagingStatusBadge";
import { canEditMessage, canCancelMessage, formatScheduledAt } from "./messagingHelpers";
import type { MessagingMessage, MessagingRecipient } from "./messagingTypes";

interface Props {
  messageId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export function MessageDetailsDrawer({ messageId, onClose, onChanged }: Props) {
  const [message, setMessage] = useState<MessagingMessage | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<Record<string, number>>({});
  const [recipients, setRecipients] = useState<MessagingRecipient[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [recipientsPage] = useState(0);

  useEffect(() => {
    if (!messageId) {
      setMessage(null);
      setEditing(false);
      return;
    }
    setLoading(true);
    getMessage(messageId)
      .then(({ message: m, delivery_summary }) => {
        setMessage(m);
        setDeliverySummary(delivery_summary);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));

    listDeliveries({ message_id: messageId, page: recipientsPage, page_size: 20 })
      .then(r => setRecipients(r.recipients))
      .catch(() => {});
  }, [messageId, recipientsPage]);

  async function handleCancel() {
    if (!message) return;
    setCancelling(true);
    try {
      const updated = await cancelMessage(message.id);
      setMessage(updated);
      onChanged?.();
      toast.success("Message cancelled");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  async function handleDelete() {
    if (!message) return;
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteDraft(message.id);
      toast.success("Draft deleted");
      onClose();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRetryFailed() {
    if (!message) return;
    const failedIds = recipients.filter(r => r.status === "failed").map(r => r.id);
    if (!failedIds.length) { toast.error("No failed recipients"); return; }
    setRetrying(true);
    try {
      const { retried } = await retryDeliveries(failedIds);
      toast.success(`${retried} recipient${retried !== 1 ? "s" : ""} re-queued`);
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  const open = !!messageId;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 z-10 bg-white border-b border-[#EEF0F0] px-6 py-4 flex items-center gap-3">
              <button type="button" onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151]">
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#1C2B2B] truncate text-sm">
                  {message?.internal_name ?? "Loading…"}
                </div>
              </div>
              {message && <MessageStatusBadge status={message.status} />}
            </div>

            <div className="p-6">
              {loading && <p className="text-sm text-[#9CA3AF]">Loading…</p>}

              {message && !editing && (
                <>
                  <MessagePreview message={message} />

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-6">
                    {canEditMessage(message.status) && (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#345C5A] text-[#345C5A] text-xs font-semibold hover:bg-[#345C5A]/5 transition-colors"
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} size={13} />
                        Edit
                      </button>
                    )}
                    {canCancelMessage(message.status) && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-400 text-amber-700 text-xs font-semibold hover:bg-amber-50 disabled:opacity-60 transition-colors"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={13} />
                        {cancelling ? "Cancelling…" : "Cancel Send"}
                      </button>
                    )}
                    {message.status === "draft" && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={13} />
                        {deleting ? "Deleting…" : "Delete Draft"}
                      </button>
                    )}
                    {recipients.some(r => r.status === "failed") && (
                      <button
                        type="button"
                        onClick={handleRetryFailed}
                        disabled={retrying}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#345C5A] text-[#345C5A] text-xs font-semibold hover:bg-[#345C5A]/5 disabled:opacity-60 transition-colors"
                      >
                        <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={13} />
                        {retrying ? "Re-queuing…" : "Retry Failed"}
                      </button>
                    )}
                  </div>

                  {/* Delivery summary */}
                  {Object.keys(deliverySummary).length > 0 && (
                    <div className="mt-6">
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] mb-2">
                        Delivery Summary
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(deliverySummary).map(([status, count]) => (
                          <div key={status} className="bg-[#F8FAFA] rounded-xl px-3 py-2 flex items-center justify-between">
                            <RecipientStatusBadge status={status as MessagingRecipient["status"]} />
                            <span className="text-xs font-bold text-[#1C2B2B]">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent recipients */}
                  {recipients.length > 0 && (
                    <div className="mt-6">
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] mb-2">
                        Recent Recipients
                      </div>
                      <div className="space-y-1">
                        {recipients.map(r => (
                          <div key={r.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-[#EEF0F0] last:border-0">
                            <span className="flex-1 truncate text-[#374151]">{r.email}</span>
                            <RecipientStatusBadge status={r.status} />
                            {r.sent_at && (
                              <span className="text-[#9CA3AF] whitespace-nowrap">
                                {new Date(r.sent_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {message && editing && (
                <MessageComposer
                  initial={message}
                  onSaved={updated => {
                    setMessage(updated);
                    setEditing(false);
                    onChanged?.();
                  }}
                  onCancel={() => setEditing(false)}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
