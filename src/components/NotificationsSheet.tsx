import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { BottomSheet } from "@/components/BottomSheet";
import { Bell, CheckCheck, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

// ── Icon map by notification type ────────────────────────────────────────
function NotificationIcon({ type }: { type: string }) {
  const base = "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm";
  if (type.startsWith("friend_request_accepted")) {
    return <div className={cn(base, "bg-emerald-100 text-emerald-600")}>🤝</div>;
  }
  if (type.startsWith("friend_request_received")) {
    return <div className={cn(base, "bg-blue-100 text-blue-600")}>👋</div>;
  }
  if (type.startsWith("trip_invite_received")) {
    return <div className={cn(base, "bg-amber-100 text-amber-600")}>✈️</div>;
  }
  if (type.startsWith("trip_invite_accepted")) {
    return <div className={cn(base, "bg-purple-100 text-purple-600")}>🎉</div>;
  }
  return <div className={cn(base, "bg-[#E8EEEE] text-[#345C5A]")}>🔔</div>;
}

// ── Single notification row ───────────────────────────────────────────────
function NotificationRow({ notification }: { notification: AppNotification }) {
  const markRead = useMarkNotificationRead();

  const handleTap = () => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={handleTap}
      className={cn(
        "flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors active:bg-black/5",
        !notification.is_read ? "bg-emerald-50/60" : "bg-transparent",
      )}
    >
      <NotificationIcon type={notification.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug text-[#2E4A4A]", !notification.is_read ? "font-semibold" : "font-medium")}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
          )}
        </div>
        {notification.body && (
          <p className="text-xs text-[#6B7B7B] mt-0.5 leading-relaxed">{notification.body}</p>
        )}
        <p className="text-[10px] text-[#9CA3AF] mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────
function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 animate-pulse">
      <div className="h-9 w-9 rounded-full bg-[#E8EEEE] flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-[#E8EEEE] rounded w-3/4" />
        <div className="h-2.5 bg-[#E8EEEE] rounded w-1/2" />
      </div>
    </div>
  );
}

// ── Main sheet component ──────────────────────────────────────────────────
interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsSheet({ open, onClose }: NotificationsSheetProps) {
  const { data: notifications, isLoading } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const sheetRef = useRef<HTMLDivElement>(null);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleMarkAll = () => {
    if (unreadCount > 0) markAll.mutate();
  };

  return (
    <BottomSheet open={open} onClose={onClose} style={{ maxHeight: "82vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  <Bell size={15} color="white" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">Notifications</h2>
                  {unreadCount > 0 && (
                    <p className="text-[10px] text-emerald-600 font-semibold">{unreadCount} unread</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    disabled={markAll.isPending}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    <CheckCheck size={13} strokeWidth={2} />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {isLoading ? (
                <div className="py-2">
                  {Array.from({ length: 5 }).map((_, i) => <NotificationSkeleton key={i} />)}
                </div>
              ) : !notifications || notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div
                    className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: "linear-gradient(135deg, #E3FEEF 0%, #D1FAE5 100%)" }}
                  >
                    <Bell size={24} className="text-[#059669]" />
                  </div>
                  <p className="text-[#2E4A4A] font-semibold text-sm mb-1">All caught up!</p>
                  <p className="text-[#9CA3AF] text-xs">You have no notifications yet.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((n, i) => (
                    <div key={n.id}>
                      <NotificationRow notification={n} />
                      {i < notifications.length - 1 && (
                        <div className="h-px bg-[#F0F1F1] mx-5" />
                      )}
                    </div>
                  ))}
                </AnimatePresence>
              )}
              {/* Bottom safe area padding */}
              <div className="h-8" />
            </div>
    </BottomSheet>
  );
}
