import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/hooks/useNotifications";
import { getNotificationIcon } from "@/components/admin/notifications/notificationIconRegistry";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterOption = "All" | "Unread";
type DateGroup = "Today" | "Yesterday" | "Older";

const SECTION_ORDER: DateGroup[] = ["Today", "Yesterday", "Older"];

// ── Fallback color config (used when no notification_type_config row exists) ──

const GROUP_FALLBACKS: Record<string, { main: string; bg: string; border: string }> = {
  System:        { main: "#059669", bg: "rgba(5,150,105,0.10)",   border: "#A7F3D0" },
  General:       { main: "#059669", bg: "rgba(5,150,105,0.10)",   border: "#A7F3D0" },
  Friends:       { main: "#3B82F6", bg: "rgba(59,130,246,0.10)",  border: "#BFDBFE" },
  Flights:       { main: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "#FDE68A" },
  Trips:         { main: "#8B5CF6", bg: "rgba(139,92,246,0.10)",  border: "#DDD6FE" },
  Trip:          { main: "#8B5CF6", bg: "rgba(139,92,246,0.10)",  border: "#DDD6FE" },
  "Job Schedules": { main: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "#FDE68A" },
  Admin:         { main: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "#FECACA" },
  Performance:   { main: "#EC4899", bg: "rgba(236,72,153,0.10)",  border: "#FBCFE8" },
};
const DEFAULT_FALLBACK = { main: "#9CA3AF", bg: "rgba(156,163,175,0.10)", border: "#E5E7EB" };

function resolveColors(n: AppNotification) {
  if (n.main_color) {
    return {
      main: n.main_color,
      bg: n.background_color ?? "rgba(0,0,0,0.05)",
      border: n.border_color ?? "#E5E7EB",
    };
  }
  const group = n.notification_group ?? "General";
  return GROUP_FALLBACKS[group] ?? DEFAULT_FALLBACK;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateGroup(dateStr: string): DateGroup {
  const d = new Date(dateStr);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const notifStart = new Date(d);
  notifStart.setHours(0, 0, 0, 0);
  const diff = todayStart.getTime() - notifStart.getTime();
  if (diff === 0) return "Today";
  if (diff === 86_400_000) return "Yesterday";
  return "Older";
}

// ── Section label — matches AdminDashboardView SectionLabel style ─────────────

function SectionLabelRow({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] whitespace-nowrap">
        {children}{count != null && count > 0 ? ` (${count})` : ""}
      </span>
      <div className="flex-1 h-px bg-[#EEF0F0]" />
    </div>
  );
}

// ── Notification icon (config-driven with keyword fallback) ───────────────────

function NotificationIcon({ notification }: { notification: AppNotification }) {
  const colors = resolveColors(notification);
  const IconComponent = getNotificationIcon(notification.icon_name);
  return (
    <div
      className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: colors.bg }}
    >
      <HugeiconsIcon icon={IconComponent} size={15} color={colors.main} strokeWidth={2} />
    </div>
  );
}

// ── Display-type badge pill ───────────────────────────────────────────────────

function DisplayBadge({ notification }: { notification: AppNotification }) {
  const colors = resolveColors(notification);
  const label = notification.display_type ?? notification.notification_group ?? "General";
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-medium capitalize flex-shrink-0"
      style={{
        background: colors.bg,
        color: colors.main,
      }}
    >
      <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ background: colors.main }} />
      {label}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
};

function NotificationCard({ notification }: { notification: AppNotification }) {
  const markRead = useMarkNotificationRead();
  const unread = !notification.is_read;
  const colors = resolveColors(notification);

  return (
    <motion.div
      variants={cardVariants}
      exit="exit"
      onClick={() => {
        if (unread) markRead.mutate(notification.id);
      }}
      className={cn(
        "relative bg-white rounded-2xl border px-3.5 py-3 cursor-pointer transition-colors active:bg-[#FAFAFA]",
        unread ? "border-gray-600" : "border-[#F0F1F1]",
      )}
      style={{
        boxShadow: unread
          ? "0 4px 20px 0 rgba(239,68,68,0.14), 0 2px 8px 0 rgba(0,0,0,0.08)"
          : "0 1px 4px 0 rgba(0,0,0,0.05)",
      }}
    >
      {/* Floating unread indicator */}
      {unread && (
        <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 border-2 border-white" />
      )}

      {/* Content row */}
      <div className="flex items-start gap-3">
        <NotificationIcon notification={notification} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p
              className={cn(
                "text-sm uppercase tracking-wider leading-tight text-[#2E4A4A]",
                unread ? "font-bold" : "font-semibold",
              )}
            >
              {notification.title}
            </p>
            <DisplayBadge notification={notification} />
          </div>
          {notification.body && (
            <p className="text-xs text-[#6B7B7B] mt-0.5">{notification.body}</p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <Clock size={9} className="text-[#9CA3AF] flex-shrink-0" />
            <span className="text-[10px] text-[#9CA3AF]">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#F0F1F1] px-3.5 py-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-[#E8EEEE] flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-[#E8EEEE] rounded-lg w-1/2" />
            <div className="h-4 bg-[#E8EEEE] rounded-full w-14" />
          </div>
          <div className="h-3 bg-[#E8EEEE] rounded-lg w-full" />
          <div className="h-3 bg-[#E8EEEE] rounded-lg w-1/3" />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterOption>("All");
  const { data: notifications, isLoading } = useNotifications(true);
  const markAll = useMarkAllNotificationsRead();

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  const grouped = useMemo(() => {
    const list = notifications ?? [];
    const visible = filter === "Unread" ? list.filter((n) => !n.is_read) : list;
    const map: Partial<Record<DateGroup, AppNotification[]>> = {};
    for (const n of visible) {
      const g = getDateGroup(n.created_at);
      (map[g] ??= []).push(n);
    }
    return map;
  }, [notifications, filter]);

  const hasVisible = SECTION_ORDER.some((g) => (grouped[g]?.length ?? 0) > 0);

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Toggle bar ── */}
      <div className="px-4 pt-3 pb-3 flex items-center gap-3">
        {/* All / Unread toggle — same pill/slider pattern as Flight Type switch */}
        <div
          className="rounded-full p-[2px] flex relative flex-1"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
          }}
        >
          <div
            className="absolute top-[2px] bottom-[2px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out"
            style={{
              background: "#10B981",
              width: "calc((100% - 4px) / 2)",
              left: filter === "All" ? "2px" : "calc(50%)",
            }}
          />
          {(["All", "Unread"] as FilterOption[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setFilter(opt)}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold rounded-full transition-colors duration-300 relative z-10",
                filter === opt ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
              )}
            >
              {opt}
              {opt === "Unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
          ))}
        </div>

        {/* Mark all read */}
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1.5 h-10 px-3 rounded-full text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <CheckCheck size={13} strokeWidth={2} />
            <span className="whitespace-nowrap">Mark all read</span>
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : !hasVisible ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #E3FEEF 0%, #D1FAE5 100%)" }}
            >
              <Bell size={24} className="text-[#059669]" />
            </div>
            <p className="text-[#2E4A4A] font-semibold text-sm mb-1">
              {filter === "Unread" ? "No unread notifications" : "All caught up!"}
            </p>
            <p className="text-[#9CA3AF] text-xs">
              {filter === "Unread"
                ? "Switch to All to see your full history."
                : "You have no notifications yet."}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } } }}
            >
              {SECTION_ORDER.map((section) => {
                const items = grouped[section];
                if (!items?.length) return null;
                return (
                  <div key={section} className="mb-5">
                    <SectionLabelRow count={items.length}>{section}</SectionLabelRow>
                    <div className="flex flex-col gap-2.5">
                      {items.map((n) => (
                        <NotificationCard key={n.id} notification={n} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
