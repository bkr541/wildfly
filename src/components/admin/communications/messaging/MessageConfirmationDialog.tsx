import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, SentIcon } from "@hugeicons/core-free-icons";
import { formatRecipientCount, formatScheduledAt } from "./messagingHelpers";
import type { AudiencePreview } from "./messagingTypes";

interface Props {
  open: boolean;
  recipientCount: number;
  scheduledAt?: string | null;
  audiencePreview?: AudiencePreview | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MessageConfirmationDialog({
  open, recipientCount, scheduledAt, audiencePreview, loading, onConfirm, onCancel,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1C2B2B]">
                {scheduledAt ? "Schedule Message" : "Send Message"}
              </h2>
              <button type="button" onClick={onCancel} className="text-[#9CA3AF] hover:text-[#374151]">
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
            </div>

            <div className="bg-[#F8FAFA] rounded-xl p-4 mb-5 space-y-2">
              <Row label="Recipients" value={formatRecipientCount(recipientCount)} />
              {audiencePreview && (
                <>
                  <Row label="Eligible" value={formatRecipientCount(audiencePreview.eligible_count)} />
                  {audiencePreview.suppressed_count > 0 && (
                    <Row label="Suppressed" value={formatRecipientCount(audiencePreview.suppressed_count)} className="text-amber-600" />
                  )}
                </>
              )}
              {scheduledAt && (
                <Row label="Sends at" value={formatScheduledAt(scheduledAt)} />
              )}
            </div>

            <p className="text-sm text-[#6B7280] mb-5">
              {scheduledAt
                ? `This message will be queued and sent automatically at the scheduled time.`
                : `This message will be sent immediately to all eligible recipients. This action cannot be undone.`}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#6B7280] hover:border-[#345C5A] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#345C5A] text-white text-sm font-semibold hover:bg-[#2a4a48] disabled:opacity-60 transition-colors"
              >
                <HugeiconsIcon icon={SentIcon} size={15} />
                {loading ? "Processing…" : scheduledAt ? "Schedule" : "Send Now"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#9CA3AF] font-medium">{label}</span>
      <span className={`font-semibold text-[#1C2B2B] ${className ?? ""}`}>{value}</span>
    </div>
  );
}
