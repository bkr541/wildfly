import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bell, Search, Users, UserPlus, Activity, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFriends,
  useFriendRequests,
  useUserSearch,
  useAcceptFriendRequest,
  useUpdateFriendRequest,
  useSendFriendRequest,
} from "@/hooks/useFriends";
import {
  FriendCard,
  IncomingRequestCard,
  OutgoingRequestCard,
  UserSearchResultCard,
  FriendCardSkeleton,
  RequestCardSkeleton,
} from "@/components/friends/FriendComponents";
import { toast } from "@/hooks/use-toast";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";

// ── Helpers ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Empty States ───────────────────────────────────────────────────────────

function EmptyFriends({ onFindFriends }: { onFindFriends: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="h-20 w-20 rounded-full flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #E3FEEF 0%, #D1FAE5 100%)" }}
      >
        <Users size={32} className="text-[#059669]" />
      </div>
      <p className="text-[#2E4A4A] font-semibold text-base mb-1">No friends yet</p>
      <p className="text-[#9CA3AF] text-sm mb-5">You haven't added any friends yet.</p>
      <Button
        onClick={onFindFriends}
        className="h-9 px-5 text-sm font-semibold bg-[#059669] hover:bg-[#047857] text-white border-0 rounded-full"
      >
        Find Friends
      </Button>
    </div>
  );
}

function EmptyRequests() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <UserPlus size={28} className="text-[#D1D5DB] mb-2" />
      <p className="text-[#9CA3AF] text-sm">No pending friend requests</p>
    </div>
  );
}

function SearchPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <Search size={28} className="text-[#D1D5DB] mb-2" />
      <p className="text-[#9CA3AF] text-sm">Search for people by username or city</p>
    </div>
  );
}

// ── Notifications Sheet (simple slide-down panel) ──────────────────────────

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-50 bg-white rounded-b-2xl shadow-xl pt-4 pb-6 px-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-[#2E4A4A]">Notifications</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors p-1"
        >
          <ArrowLeft size={18} />
        </button>
      </div>
      <p className="text-[#9CA3AF] text-sm text-center py-6">Notifications coming soon.</p>
    </div>
  );
}

// ── Tab: My Friends ─────────────────────────────────────────────────────────

function MyFriendsTab({ onFindFriends }: { onFindFriends: () => void }) {
  const { data: friends, isLoading } = useFriends();

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 pt-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <FriendCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!friends || friends.length === 0) {
    return <EmptyFriends onFindFriends={onFindFriends} />;
  }

  return (
    <div className="space-y-2 px-4 pt-3 pb-6">
      <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">
        {friends.length} {friends.length === 1 ? "friend" : "friends"}
      </p>
      {friends.map((f) => (
        <FriendCard key={f.friend_user_id} friend={f} />
      ))}
    </div>
  );
}

// ── Tab: Requests ───────────────────────────────────────────────────────────

function RequestsTab() {
  const { data, isLoading } = useFriendRequests();
  const accept = useAcceptFriendRequest();
  const update = useUpdateFriendRequest();

  const [actingIds, setActingIds] = useState<Set<string>>(new Set());

  const markActing = (id: string) => setActingIds((s) => new Set([...s, id]));
  const unmarkActing = (id: string) => setActingIds((s) => { const n = new Set(s); n.delete(id); return n; });

  const handleAccept = async (id: string) => {
    markActing(id);
    try {
      await accept.mutateAsync(id);
      toast({ title: "Friend request accepted 🎉" });
    } catch {
      toast({ title: "Failed to accept request", variant: "destructive" });
    } finally {
      unmarkActing(id);
    }
  };

  const handleDecline = async (id: string) => {
    markActing(id);
    try {
      await update.mutateAsync({ requestId: id, status: "declined" });
    } catch {
      toast({ title: "Failed to decline request", variant: "destructive" });
    } finally {
      unmarkActing(id);
    }
  };

  const handleCancel = async (id: string) => {
    markActing(id);
    try {
      await update.mutateAsync({ requestId: id, status: "canceled" });
    } catch {
      toast({ title: "Failed to cancel request", variant: "destructive" });
    } finally {
      unmarkActing(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 pt-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <RequestCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  if (incoming.length === 0 && outgoing.length === 0) {
    return <EmptyRequests />;
  }

  return (
    <div className="px-4 pt-3 pb-6 space-y-5">
      {incoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">
            Incoming · {incoming.length}
          </p>
          {incoming.map((r) => (
            <IncomingRequestCard
              key={r.id}
              request={r}
              onAccept={handleAccept}
              onDecline={handleDecline}
              isAccepting={actingIds.has(r.id) && accept.isPending}
              isDeclining={actingIds.has(r.id) && update.isPending}
            />
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">
            Outgoing · {outgoing.length}
          </p>
          {outgoing.map((r) => (
            <OutgoingRequestCard
              key={r.id}
              request={r}
              onCancel={handleCancel}
              isCanceling={actingIds.has(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Search ─────────────────────────────────────────────────────────────

function SearchTab() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const { data: results, isLoading } = useUserSearch(debouncedQuery);
  const { data: friends } = useFriends();
  const { data: requestsData } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build lookup sets
  const friendIds = new Set((friends ?? []).map((f) => f.friend_user_id).filter(Boolean) as string[]);
  const pendingIds = new Set([
    ...(requestsData?.incoming ?? []).map((r) => r.requester_user_id),
    ...(requestsData?.outgoing ?? []).map((r) => r.recipient_user_id),
    ...sentIds,
  ]);

  const handleAdd = async (authUserId: string) => {
    setSendingId(authUserId);
    try {
      await sendRequest.mutateAsync(authUserId);
      setSentIds((s) => new Set([...s, authUserId]));
      toast({ title: "Friend request sent ✈️" });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast({ title: "Request already sent" });
      } else {
        toast({ title: "Failed to send request", variant: "destructive" });
      }
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="flex flex-col px-4 pt-3 pb-6 gap-3">
      {/* Search input */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-2.5"
        style={{
          background: "rgba(255,255,255,0.9)",
          border: "1.5px solid rgba(5,150,105,0.18)",
          boxShadow: "0 2px 8px 0 rgba(5,150,105,0.08)",
        }}
      >
        <Search size={16} className="text-[#9CA3AF] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username or city"
          className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results */}
      {!debouncedQuery || debouncedQuery.trim().length < 2 ? (
        <SearchPrompt />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <FriendCardSkeleton key={i} />
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((u) => {
            const uid = u.auth_user_id ?? "";
            const state =
              friendIds.has(uid) ? "friends" :
              pendingIds.has(uid) ? "pending" :
              "none";
            return (
              <UserSearchResultCard
                key={uid}
                user={u}
                requestState={state as any}
                onAddFriend={handleAdd}
                isSending={sendingId === uid}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-[#9CA3AF] text-sm">No users found for "{debouncedQuery}"</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Activity ───────────────────────────────────────────────────────────

function ActivityTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)" }}
      >
        <Activity size={24} className="text-[#D1D5DB]" />
      </div>
      <p className="text-[#2E4A4A] font-semibold text-sm mb-1">Coming soon</p>
      <p className="text-[#9CA3AF] text-sm">Friend activity will appear here.</p>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

type FriendsTab = "friends" | "requests" | "search" | "activity";

const FriendsPage = () => {
  const [activeTab, setActiveTab] = useState<FriendsTab>("friends");
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = useUnreadNotificationCount();

  const { data: requestsData } = useFriendRequests();
  const incomingCount = requestsData?.incoming?.length ?? 0;

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-0px)]">

      {/* Notifications sheet */}
      <NotificationsSheet open={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <h1
          className="text-[22px] font-black tracking-widest uppercase select-none"
          style={{ background: "linear-gradient(90deg, #059669 0%, #10b981 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          FRIENDS
        </h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab("search"); }}
            className="h-9 w-9 flex items-center justify-center rounded-full text-[#2E4A4A]/60 hover:text-[#2E4A4A] hover:bg-black/5 transition-colors"
          >
            <Search size={20} />
          </button>
          <button
            type="button"
            onClick={() => setShowNotifications(true)}
            className="h-9 w-9 flex items-center justify-center rounded-full text-[#2E4A4A]/60 hover:text-[#2E4A4A] hover:bg-black/5 transition-colors relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FriendsTab)}
        className="flex flex-col flex-1"
      >
        <div className="px-4 pt-1 pb-0">
          <TabsList className="w-full h-9 bg-white/70 rounded-full p-0.5 shadow-sm gap-0">
            <TabsTrigger
              value="friends"
              className={cn(
                "flex-1 h-8 text-xs font-semibold rounded-full transition-all",
                "data-[state=active]:bg-[#059669] data-[state=active]:text-white data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-[#6B7280]",
              )}
            >
              My Friends
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className={cn(
                "flex-1 h-8 text-xs font-semibold rounded-full transition-all relative",
                "data-[state=active]:bg-[#059669] data-[state=active]:text-white data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-[#6B7280]",
              )}
            >
              Requests
              {incomingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {incomingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className={cn(
                "flex-1 h-8 text-xs font-semibold rounded-full transition-all",
                "data-[state=active]:bg-[#059669] data-[state=active]:text-white data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-[#6B7280]",
              )}
            >
              Search
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className={cn(
                "flex-1 h-8 text-xs font-semibold rounded-full transition-all",
                "data-[state=active]:bg-[#059669] data-[state=active]:text-white data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-[#6B7280]",
              )}
            >
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto smooth-scroll">
          <TabsContent value="friends" className="mt-0 focus-visible:outline-none">
            <MyFriendsTab onFindFriends={() => setActiveTab("search")} />
          </TabsContent>

          <TabsContent value="requests" className="mt-0 focus-visible:outline-none">
            <RequestsTab />
          </TabsContent>

          <TabsContent value="search" className="mt-0 focus-visible:outline-none">
            <SearchTab />
          </TabsContent>

          <TabsContent value="activity" className="mt-0 focus-visible:outline-none">
            <ActivityTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default FriendsPage;
