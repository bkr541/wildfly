import { useState, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, Users, UserPlus, Activity } from "lucide-react";
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

function SearchTab({ query, onQueryChange }: { query: string; onQueryChange: (q: string) => void }) {
  const debouncedQuery = useDebounce(query, 350);
  const { data: results, isLoading } = useUserSearch(debouncedQuery);
  const { data: friends } = useFriends();
  const { data: requestsData } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

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
    <div className="flex flex-col px-4 pt-2 pb-6 gap-3">
      {/* Results only - search bar is now at page level */}
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
          <p className="text-muted-foreground text-sm">No users found for "{debouncedQuery}"</p>
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
  const [searchQuery, setSearchQuery] = useState("");

  const { data: requestsData } = useFriendRequests();
  const incomingCount = requestsData?.incoming?.length ?? 0;

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-0px)]">

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FriendsTab)}
        className="flex flex-col flex-1"
      >
        <div className="px-4 pt-3 pb-0">
          {/* Search bar - frosted glass style matching Flight UI */}
          <div
            className="rounded-2xl overflow-visible px-3 pt-3 pb-1 mb-4"
            style={{
              background: "rgba(255,255,255,0.72)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <div className="app-input-container">
              <button type="button" tabIndex={-1} className="app-input-icon-btn">
                <Search size={20} strokeWidth={2} />
              </button>
              <input
                type="text"
                value={activeTab === "search" ? searchQuery : ""}
                onChange={(e) => {
                  if (activeTab !== "search") setActiveTab("search");
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search by username or city"
                className="app-input"
              />
              {activeTab === "search" && searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="app-input-reset app-input-reset--visible"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Normal tabs - active has green border and green text, NO background */}
          <TabsList className="w-full h-11 bg-transparent p-0 gap-0 border-b border-border rounded-none mt-3">
            <TabsTrigger
              value="friends"
              className={cn(
                "flex-1 h-11 text-sm font-medium rounded-none transition-all border-b-2 border-transparent bg-transparent",
                "data-[state=active]:border-[#059669] data-[state=active]:text-[#059669] data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-transparent",
              )}
            >
              My Friends
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className={cn(
                "flex-1 h-11 text-sm font-medium rounded-none transition-all border-b-2 border-transparent bg-transparent relative",
                "data-[state=active]:border-[#059669] data-[state=active]:text-[#059669] data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-transparent",
              )}
            >
              Requests
              {incomingCount > 0 && (
                <span className="ml-1.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                  {incomingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className={cn(
                "flex-1 h-11 text-sm font-medium rounded-none transition-all border-b-2 border-transparent bg-transparent",
                "data-[state=active]:border-[#059669] data-[state=active]:text-[#059669] data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-transparent",
              )}
            >
              Search
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className={cn(
                "flex-1 h-11 text-sm font-medium rounded-none transition-all border-b-2 border-transparent bg-transparent",
                "data-[state=active]:border-[#059669] data-[state=active]:text-[#059669] data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-transparent",
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
            <SearchTab query={searchQuery} onQueryChange={setSearchQuery} />
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
