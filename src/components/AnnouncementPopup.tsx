import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Megaphone02Icon, Cancel01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import type { AnnouncementItem } from "@/hooks/useAnnouncements";

interface AnnouncementPopupProps {
  announcement: AnnouncementItem;
  onDismiss: (id: string) => void;
}

export function AnnouncementPopup({ announcement, onDismiss }: AnnouncementPopupProps) {
  const { id, title, body, cta_label, cta_url, image_url } = announcement;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={() => onDismiss(id)}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          {/* Optional header image */}
          {image_url && (
            <div className="w-full h-36 overflow-hidden">
              <img src={image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6">
            {/* Title row with X button */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {!image_url && (
                  <div className="h-9 w-9 rounded-full bg-[#EEF5F5] flex items-center justify-center shrink-0">
                    <HugeiconsIcon icon={Megaphone02Icon} size={18} color="#345C5A" strokeWidth={1.5} />
                  </div>
                )}
                <h2 className="text-[17px] font-bold text-[#1C2B2B] leading-snug">{title}</h2>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(id)}
                className="text-[#9CA3AF] hover:text-[#374151] transition-colors ml-3 mt-0.5"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
            </div>

            <p className="text-sm text-[#6B7280] leading-relaxed mb-5">{body}</p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onDismiss(id)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#6B7280] hover:border-[#345C5A] transition-colors"
              >
                Got it
              </button>
              {cta_label && cta_url && (
                <a
                  href={cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onDismiss(id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#345C5A] text-white text-sm font-semibold hover:bg-[#2a4a48] transition-colors"
                >
                  <HugeiconsIcon icon={Tick01Icon} size={15} color="white" />
                  {cta_label}
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
