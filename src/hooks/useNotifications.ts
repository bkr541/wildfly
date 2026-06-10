import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Enriched notification record (from notification_feed_view) ────────────────
// Config-derived fields are nullable: they are null when no matching
// notification_type_configs row exists for notifications.type.
export interface AppNotification {
  // Core notification fields
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  detail_text: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  notification_group: string;
  audience: string;
  created_at: string;
  // Config-derived display fields (null when no config row exists)
  config_label: string | null;
  display_type: string | null;
  icon_name: string | null;
  main_color: string | null;
  background_color: string | null;
  border_color: string | null;
  severity: string | null;
  authority: string | null;
  config_is_active: boolean | null;
  show_in_admin: boolean | null;
  show_in_user_notifications: boolean | null;
}

// ── Lightweight unread count (HEAD request — no row data) ─────────────────────
export function useUnreadNotificationCount() {
  const { userId } = useAuth();
  const { data } = useQuery<number>({
    queryKey: ["notifications-unread-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
  return data ?? 0;
}

// ── Full notification feed — queries the enriched view ────────────────────────
// audience filtering will be enforced once Admin-audience notifications exist;
// for now all notifications default to audience='All' so no client-side filter needed.
export function useNotifications(enabled = true) {
  const { userId } = useAuth();
  return useQuery<AppNotification[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notification_feed_view" as "notifications") // cast: view not in generated types yet
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
    enabled: !!userId && enabled,
    staleTime: 30_000,
  });
}

// ── Mark a single notification as read ────────────────────────────────────────
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count", userId] });
    },
  });
}

// ── Mark all notifications as read ────────────────────────────────────────────
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count", userId] });
    },
  });
}
