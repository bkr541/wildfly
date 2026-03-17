import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FriendProfile, FriendRequest, UserSearchResult } from "@/hooks/useFriends";
import { format } from "date-fns";

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(username?: string | null, displayName?: string | null): string {
  const name = displayName ?? username ?? "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── FriendCard ─────────────────────────────────────────────────────────────

interface FriendCardProps {
  friend: FriendProfile;
  onClick?: () => void;
}

export function FriendCard({ friend, onClick }: FriendCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl bg-white shadow-sm px-3 py-3 hover:bg-[#F9FAFB] active:bg-[#F2F3F3] transition-colors text-left"
    >
      <Avatar className="h-10 w-10 flex-shrink-0 border border-[#E3E6E6]">
        <AvatarImage src={friend.avatar_url ?? undefined} alt={friend.username ?? "Friend"} />
        <AvatarFallback className="bg-[#E3FEEF] text-[#059669] text-sm font-bold">
          {getInitials(friend.username, friend.display_name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2E4A4A] truncate">
          {friend.display_name ?? friend.username ?? "Unknown"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {friend.username && (
            <span className="text-xs text-[#9CA3AF] truncate">@{friend.username}</span>
          )}
          {friend.home_city && (
            <span className="flex items-center gap-0.5 text-xs text-[#9CA3AF] truncate">
              <MapPin size={10} className="flex-shrink-0" />
              {friend.home_city}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={16} className="text-[#D1D5DB] flex-shrink-0" />
    </button>
  );
}

// ── FriendRequestCard ──────────────────────────────────────────────────────

interface IncomingRequestCardProps {
  request: FriendRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  isAccepting?: boolean;
  isDeclining?: boolean;
}

export function IncomingRequestCard({ request, onAccept, onDecline, isAccepting, isDeclining }: IncomingRequestCardProps) {
  const sentDate = request.created_at
    ? format(new Date(request.created_at), "MMM d")
    : null;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white shadow-sm px-3 py-3">
      <Avatar className="h-10 w-10 flex-shrink-0 border border-[#E3E6E6]">
        <AvatarImage src={request.requester_avatar ?? undefined} />
        <AvatarFallback className="bg-[#E3FEEF] text-[#059669] text-sm font-bold">
          {getInitials(request.requester_username)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2E4A4A] truncate">
          {request.requester_username ? `@${request.requester_username}` : "Unknown user"}
        </p>
        {sentDate && (
          <p className="text-xs text-[#9CA3AF] mt-0.5">Sent {sentDate}</p>
        )}
      </div>

      <div className="flex gap-1.5 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs font-semibold border-[#E3E6E6] text-[#6B7280] hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          onClick={() => onDecline(request.id)}
          disabled={isDeclining || isAccepting}
        >
          Decline
        </Button>
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white border-0"
          onClick={() => onAccept(request.id)}
          disabled={isAccepting || isDeclining}
        >
          {isAccepting ? "..." : "Accept"}
        </Button>
      </div>
    </div>
  );
}

interface OutgoingRequestCardProps {
  request: FriendRequest;
  recipientUsername?: string | null;
  onCancel: (id: string) => void;
  isCanceling?: boolean;
}

export function OutgoingRequestCard({ request, recipientUsername, onCancel, isCanceling }: OutgoingRequestCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white shadow-sm px-3 py-3">
      <Avatar className="h-10 w-10 flex-shrink-0 border border-[#E3E6E6]">
        <AvatarFallback className="bg-[#F3F4F6] text-[#9CA3AF] text-sm font-bold">
          {getInitials(request.requester_username ?? recipientUsername)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2E4A4A] truncate">
          {request.requester_username ? `@${request.requester_username}` : "Unknown user"}
        </p>
        <span className="inline-flex items-center gap-1 text-xs text-[#F59E0B] font-medium mt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B] inline-block" />
          Pending
        </span>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-xs font-semibold border-[#E3E6E6] text-[#6B7280] hover:bg-red-50 hover:border-red-200 hover:text-red-600 flex-shrink-0"
        onClick={() => onCancel(request.id)}
        disabled={isCanceling}
      >
        Cancel
      </Button>
    </div>
  );
}

// ── UserSearchResultCard ───────────────────────────────────────────────────

type RequestState = "none" | "pending" | "friends";

interface UserSearchResultCardProps {
  user: UserSearchResult;
  requestState: RequestState;
  onAddFriend: (authUserId: string) => void;
  isSending?: boolean;
}

export function UserSearchResultCard({ user, requestState, onAddFriend, isSending }: UserSearchResultCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white shadow-sm px-3 py-3">
      <Avatar className="h-10 w-10 flex-shrink-0 border border-[#E3E6E6]">
        <AvatarImage src={user.avatar_url ?? undefined} alt={user.username ?? "User"} />
        <AvatarFallback className="bg-[#E3FEEF] text-[#059669] text-sm font-bold">
          {getInitials(user.username, user.display_name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2E4A4A] truncate">
          {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.display_name || user.username || "Unknown"}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {user.username && (
            <span className="text-xs text-[#9CA3AF]">@{user.username}</span>
          )}
          {user.home_city && (
            <span className="flex items-center gap-0.5 text-xs text-[#9CA3AF]">
              <MapPin size={10} />
              {user.home_city}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0">
        {requestState === "friends" ? (
          <span className="text-xs font-semibold text-[#059669] px-2.5 py-1 bg-[#E3FEEF] rounded-full">
            Friends
          </span>
        ) : requestState === "pending" ? (
          <span className="text-xs font-semibold text-[#F59E0B] px-2.5 py-1 bg-[#FEF9E3] rounded-full">
            Pending
          </span>
        ) : (
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white border-0"
            onClick={() => user.auth_user_id && onAddFriend(user.auth_user_id)}
            disabled={isSending || !user.auth_user_id}
          >
            {isSending ? "..." : "Add"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Skeletons ──────────────────────────────────────────────────────────────

export function FriendCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white shadow-sm px-3 py-3">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-4" />
    </div>
  );
}

export function RequestCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white shadow-sm px-3 py-3">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-7 w-16" />
    </div>
  );
}
