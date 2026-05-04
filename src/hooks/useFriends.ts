import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  home_city: string | null;
  home_airport: string | null;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/** Fetch the current user's friends from the friends_with_profiles view */
export function useFriends() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["friends", userId],
    queryFn: async () => {
      if (!userId) return [] as FriendProfile[];

      const { data, error } = await supabase
        .from("friends_with_profiles")
        .select("user_id, friend_user_id, username, display_name, avatar_url, home_city, home_airport")
        .eq("user_id", userId)
        .order("username", { ascending: true });

      if (error) throw error;
      return (data ?? []) as FriendProfile[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Fetch pending incoming and outgoing friend requests */
export function useFriendRequests() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["friend-requests", userId],
    queryFn: async () => {
      if (!userId) return { incoming: [] as FriendRequest[], outgoing: [] as FriendRequest[] };

      const { data, error } = await supabase
        .from("friend_requests")
        .select("id, requester_user_id, recipient_user_id, status, created_at, responded_at")
        .or(`requester_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = data ?? [];

      // Collect unique user IDs we need profiles for
      const userIds = [
        ...new Set([
          ...rows
            .filter((r) => r.recipient_user_id === userId)
            .map((r) => r.requester_user_id),
          ...rows
            .filter((r) => r.requester_user_id === userId)
            .map((r) => r.recipient_user_id),
        ]),
      ];

      // Fetch profiles for display
      const profileMap: Record<string, { username: string | null; avatar_url: string | null; display_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.rpc("get_friend_profiles", { _user_ids: userIds });

        (profiles ?? []).forEach((p: any) => {
          if (p.auth_user_id) profileMap[p.auth_user_id] = { username: p.username, avatar_url: p.avatar_url, display_name: p.display_name };
        });
      }

      const incoming: FriendRequest[] = rows
        .filter((r) => r.recipient_user_id === userId)
        .map((r) => ({
          ...r,
          requester_username: profileMap[r.requester_user_id]?.username ?? null,
          requester_avatar: profileMap[r.requester_user_id]?.avatar_url ?? null,
        }));

      const outgoing: FriendRequest[] = rows
        .filter((r) => r.requester_user_id === userId)
        .map((r) => ({
          ...r,
          requester_username: profileMap[r.recipient_user_id]?.username ?? null,
          requester_avatar: profileMap[r.recipient_user_id]?.avatar_url ?? null,
        }));

      return { incoming, outgoing };
    },
    enabled: !!userId,
    staleTime: 15_000,
  });
}

/** Debounced user search — queries user_info by username or home_city */
export function useUserSearch(query: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["user-search", query],
    queryFn: async () => {
      if (!query || query.trim().length < 2) return [] as UserSearchResult[];

      const term = `*${query.trim()}*`;
      const { data, error } = await supabase
        .from("user_public_profiles" as any)
        .select("auth_user_id, username, display_name, first_name, last_name, avatar_url, home_city, home_airport")
        .or(`username.ilike.${term},home_city.ilike.${term}`)
        .neq("auth_user_id", userId ?? "")
        .limit(25);

      if (error) throw error;
      return ((data as unknown) ?? []) as UserSearchResult[];
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

/** Accept an incoming friend request via the accept_friend_request Postgres function */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc("accept_friend_request", { request_id: requestId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests", userId] });
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    },
  });
}

/** Decline or cancel a friend request by updating its status */
export function useUpdateFriendRequest() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: "declined" | "canceled" }) => {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests", userId] });
    },
  });
}

/** Send a friend request */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (recipientAuthUserId: string) => {
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from("friend_requests").insert({
        requester_user_id: userId,
        recipient_user_id: recipientAuthUserId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-search"] });
    },
  });
}
