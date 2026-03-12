import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FriendProfile {
  user_id: string | null;
  friend_user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_airport: string | null;
}

export interface FriendRequest {
  id: string;
  requester_user_id: string;
  recipient_user_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  requester_username?: string | null;
  requester_avatar?: string | null;
}

export interface UserSearchResult {
  auth_user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_airport: string | null;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/** Fetch the current user's friends from the friends_with_profiles view */
export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [] as FriendProfile[];

      const { data, error } = await supabase
        .from("friends_with_profiles")
        .select("user_id, friend_user_id, username, display_name, avatar_url, home_city, home_airport")
        .eq("user_id", user.id)
        .order("username", { ascending: true });

      if (error) throw error;
      return (data ?? []) as FriendProfile[];
    },
    staleTime: 30_000,
  });
}

/** Fetch pending incoming and outgoing friend requests */
export function useFriendRequests() {
  return useQuery({
    queryKey: ["friend-requests"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { incoming: [] as FriendRequest[], outgoing: [] as FriendRequest[] };

      const { data, error } = await supabase
        .from("friend_requests")
        .select("id, requester_user_id, recipient_user_id, status, created_at, responded_at")
        .or(`requester_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = data ?? [];

      // Collect unique user IDs we need profiles for
      const userIds = [
        ...new Set([
          ...rows
            .filter((r) => r.recipient_user_id === user.id)
            .map((r) => r.requester_user_id),
          ...rows
            .filter((r) => r.requester_user_id === user.id)
            .map((r) => r.recipient_user_id),
        ]),
      ];

      // Fetch profiles for display
      const profileMap: Record<string, { username: string | null; avatar_url: string | null; display_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_info")
          .select("auth_user_id, username, avatar_url, display_name")
          .in("auth_user_id", userIds);

        (profiles ?? []).forEach((p) => {
          if (p.auth_user_id) profileMap[p.auth_user_id] = { username: p.username, avatar_url: p.avatar_url, display_name: p.display_name };
        });
      }

      const incoming: FriendRequest[] = rows
        .filter((r) => r.recipient_user_id === user.id)
        .map((r) => ({
          ...r,
          requester_username: profileMap[r.requester_user_id]?.username ?? null,
          requester_avatar: profileMap[r.requester_user_id]?.avatar_url ?? null,
        }));

      const outgoing: FriendRequest[] = rows
        .filter((r) => r.requester_user_id === user.id)
        .map((r) => ({
          ...r,
          requester_username: profileMap[r.recipient_user_id]?.username ?? null,
          requester_avatar: profileMap[r.recipient_user_id]?.avatar_url ?? null,
        }));

      return { incoming, outgoing };
    },
    staleTime: 15_000,
  });
}

/** Debounced user search — queries user_info by username or home_city */
export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["user-search", query],
    queryFn: async () => {
      if (!query || query.trim().length < 2) return [] as UserSearchResult[];

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const term = `%${query.trim()}%`;
      const { data, error } = await supabase
        .from("user_info")
        .select("auth_user_id, username, display_name, avatar_url, home_city, home_airport")
        .eq("is_discoverable", true)
        .or(`username.ilike.${term},home_city.ilike.${term}`)
        .neq("auth_user_id", user?.id ?? "")
        .limit(25);

      if (error) throw error;
      return (data ?? []) as UserSearchResult[];
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

/** Accept an incoming friend request via the accept_friend_request Postgres function */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc("accept_friend_request", { request_id: requestId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

/** Decline or cancel a friend request by updating its status */
export function useUpdateFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: "declined" | "canceled" }) => {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });
}

/** Send a friend request */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipientAuthUserId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("friend_requests").insert({
        requester_user_id: user.id,
        recipient_user_id: recipientAuthUserId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["user-search"] });
    },
  });
}
