import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ── Fetch all notifications for current user ──────────────────────────────
export function useNotifications() {
  const { userId } = useAuth();
  return useQuery<AppNotification[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ── Unread count ───────────────────────────────────────────────────────────
export function useUnreadNotificationCount() {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.is_read).length;
}

// ── Mark a single notification as read ────────────────────────────────────
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
    },
  });
}

// ── Mark all notifications as read ────────────────────────────────────────
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
    },
  });
}
