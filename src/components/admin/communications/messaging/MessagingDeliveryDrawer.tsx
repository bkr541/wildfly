import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { RecipientStatusBadge } from "./MessagingStatusBadge";
import type { MessagingRecipient } from "./messagingTypes";

interface Props {
  recipient: MessagingRecipient | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#EEF0F0] last:border-0">
      <span className="text-xs text-[#9CA3AF] font-semibold min-w-[120px]">{label}</span>
      <span className="text-xs text-[#374151] text-right break-all">{value}</span>
    </div>
  );
}

export function MessagingDeliveryDrawer({ recipient, onClose }: Props) {
  return (
    <AnimatePresence>
      {recipient && (
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
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 z-10 bg-white border-b border-[#EEF0F0] px-6 py-4 flex items-center gap-3">
              <button type="button" onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151]">
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
              <div className="flex-1 font-semibold text-[#1C2B2B] text-sm truncate">
                {recipient.email}
              </div>
              <RecipientStatusBadge status={recipient.status} />
            </div>

            <div className="p-6">
              <div className="space-y-0">
                <Row label="Channel" value={recipient.channel} />
                <Row label="Status" value={recipient.status} />
                <Row label="Email" value={recipient.email} />
                <Row label="Normalized" value={recipient.normalized_email} />
                <Row label="Name" value={recipient.recipient_name} />
                <Row label="Provider" value={recipient.provider} />
                <Row label="Provider ID" value={recipient.provider_message_id} />
                <Row label="Attempts" value={String(recipient.attempt_count)} />
                <Row label="Queued" value={recipient.queued_at ? new Date(recipient.queued_at).toLocaleString() : null} />
                <Row label="Sent" value={recipient.sent_at ? new Date(recipient.sent_at).toLocaleString() : null} />
                <Row label="Delivered" value={recipient.delivered_at ? new Date(recipient.delivered_at).toLocaleString() : null} />
                <Row label="Opened" value={recipient.opened_at ? new Date(recipient.opened_at).toLocaleString() : null} />
                <Row label="Clicked" value={recipient.clicked_at ? new Date(recipient.clicked_at).toLocaleString() : null} />
                <Row label="Failed" value={recipient.failed_at ? new Date(recipient.failed_at).toLocaleString() : null} />
                <Row label="Bounced" value={recipient.bounced_at ? new Date(recipient.bounced_at).toLocaleString() : null} />
                <Row label="Unsubscribed" value={recipient.unsubscribed_at ? new Date(recipient.unsubscribed_at).toLocaleString() : null} />
                {recipient.last_error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-red-500 mb-1">Last Error</div>
                    <p className="text-xs text-red-700 break-all">{recipient.last_error}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
