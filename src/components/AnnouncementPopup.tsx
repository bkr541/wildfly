import { HugeiconsIcon } from "@hugeicons/react";
import { Megaphone02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AnnouncementItem } from "@/hooks/useAnnouncements";

interface AnnouncementPopupProps {
  announcement: AnnouncementItem;
  onDismiss: (id: string) => void;
}

export function AnnouncementPopup({ announcement, onDismiss }: AnnouncementPopupProps) {
  const { id, title, body, cta_label, cta_url, image_url } = announcement;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(id); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-2xl gap-0">
        {/* Optional header image */}
        {image_url && (
          <div className="w-full h-36 overflow-hidden">
            <img
              src={image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Icon + content */}
        <div className="flex flex-col gap-4 p-6">
          {!image_url && (
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-[#F0FDF4] flex items-center justify-center">
                <HugeiconsIcon
                  icon={Megaphone02Icon}
                  size={22}
                  color="#059669"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          )}

          <DialogHeader className="gap-1.5 text-center items-center">
            <DialogTitle className="text-[17px] font-bold text-[#1A2E2E] leading-snug">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#4B6363] leading-relaxed text-center">
              {body}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-1">
            {cta_label && cta_url && (
              <a
                href={cta_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onDismiss(id)}
                className="w-full h-11 rounded-xl bg-[#059669] text-white text-sm font-semibold flex items-center justify-center hover:bg-[#047857] transition-colors"
              >
                {cta_label}
              </a>
            )}
            <button
              type="button"
              onClick={() => onDismiss(id)}
              className="w-full h-10 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#4B6363] flex items-center justify-center gap-1.5 hover:bg-[#F9FAFB] transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={13} color="currentColor" strokeWidth={2} />
              Got it
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
