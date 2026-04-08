import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PencilEdit01Icon,
  Delete01Icon,
  ArrowDown01Icon,
  CreditCardIcon,
  Settings01Icon,
  Wallet01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

interface UserRow {
  id: number;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
  home_airport: string | null;
  home_city: string | null;
  is_discoverable: boolean;
  signup_type: string;
}

interface UserDetails {
  subscription: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  wallet: Record<string, unknown> | null;
  transactions: Record<string, unknown>[];
}

interface ManageUsersScreenProps {
  onBack: () => void;
}

const ManageUsersScreen = ({ onBack }: ManageUsersScreenProps) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, UserDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/admin-list-users`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );
        const json = await res.json();
        if (json.users) setUsers(json.users);
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchDetails = useCallback(async (authUserId: string) => {
    if (details[authUserId] || detailsLoading[authUserId]) return;
    setDetailsLoading((prev) => ({ ...prev, [authUserId]: true }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-user-details`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target_user_id: authUserId }),
        }
      );
      const json = await res.json();
      setDetails((prev) => ({ ...prev, [authUserId]: json }));
    } catch (e) {
      console.error("Failed to load user details", e);
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [authUserId]: false }));
    }
  }, [details, detailsLoading]);

  const toggleUser = (authUserId: string) => {
    if (expandedUserId === authUserId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(authUserId);
      fetchDetails(authUserId);
    }
  };

  const initials = (u: UserRow) => {
    const f = (u.first_name?.[0] || "").toUpperCase();
    const l = (u.last_name?.[0] || "").toUpperCase();
    return f + l || "U";
  };

  const displayName = (u: UserRow) =>
    [u.first_name, u.last_name].filter(Boolean).join(" ") || u.display_name || u.email;

  return (
    <div className="flex-1 flex flex-col px-5 pb-4 gap-4 relative z-10 animate-fade-in">
      {loading ? (
        <div className="space-y-3 mt-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {users.map((user, idx) => {
            const uid = user.auth_user_id;
            if (!uid) return null;
            const isOpen = expandedUserId === uid;
            const userDetails = details[uid];
            const isLoadingDetails = detailsLoading[uid];

            return (
              <Collapsible key={uid} open={isOpen} onOpenChange={() => toggleUser(uid)}>
                <div
                  className={`${idx < users.length - 1 && !isOpen ? "border-b border-[#F0F1F1]" : ""}`}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors"
                    >
                      <Avatar className="h-9 w-9 mr-3 shrink-0">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-xs font-bold">
                          {initials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#2E4A4A] truncate">
                          {displayName(user)}
                        </p>
                        <p className="text-xs text-[#6B7B7B] truncate">
                          {user.username ? `@${user.username}` : user.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span
                          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5"
                          onClick={(e) => { e.stopPropagation(); /* future edit */ }}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} size={13} color="#6B7B7B" strokeWidth={1.5} />
                        </span>
                        <span
                          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); /* future delete */ }}
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={13} color="#EF4444" strokeWidth={1.5} />
                        </span>
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          size={14}
                          color="#C4CACA"
                          strokeWidth={1.5}
                          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-1 space-y-3 border-b border-[#F0F1F1] bg-[#FAFBFB]">
                      {isLoadingDetails ? (
                        <div className="space-y-2">
                          <Skeleton className="h-10 w-full rounded-lg" />
                          <Skeleton className="h-10 w-full rounded-lg" />
                          <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                      ) : userDetails ? (
                        <>
                          <DetailSection
                            icon={CreditCardIcon}
                            title="Subscription"
                            data={userDetails.subscription}
                          />
                          <DetailSection
                            icon={Settings01Icon}
                            title="Settings"
                            data={userDetails.settings}
                          />
                          <DetailSection
                            icon={Wallet01Icon}
                            title="Credit Wallet"
                            data={userDetails.wallet}
                          />
                          <TransactionsSection transactions={userDetails.transactions} />
                        </>
                      ) : (
                        <p className="text-xs text-[#6B7B7B]">No details available.</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
          {users.length === 0 && (
            <p className="text-center text-sm text-[#6B7B7B] py-8">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Detail Section ─────────────────────────────────────────────── */
const DetailSection = ({
  icon,
  title,
  data,
}: {
  icon: any;
  title: string;
  data: Record<string, unknown> | null;
}) => {
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#6B7B7B]">
        <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={icon} size={12} color="#047857" strokeWidth={1.5} />
        </span>
        <span className="font-semibold text-[#2E4A4A]">{title}</span>
        <span className="ml-auto">—</span>
      </div>
    );
  }

  const entries = Object.entries(data).filter(
    ([k]) => !["user_id", "id", "created_at", "updated_at"].includes(k)
  );

  return (
    <div className="rounded-xl border border-[#E3E6E6] bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F0F1F1]">
        <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={icon} size={12} color="#047857" strokeWidth={1.5} />
        </span>
        <span className="text-xs font-semibold text-[#2E4A4A]">{title}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between text-[11px]">
            <span className="text-[#6B7B7B] font-medium">{key.replace(/_/g, " ")}</span>
            <span className="text-[#2E4A4A] font-semibold text-right max-w-[55%] truncate">
              {value === null ? "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Transactions Section ───────────────────────────────────────── */
const TransactionsSection = ({ transactions }: { transactions: Record<string, unknown>[] }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? transactions : transactions.slice(0, 5);

  return (
    <div className="rounded-xl border border-[#E3E6E6] bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F0F1F1]">
        <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="#047857" strokeWidth={1.5} />
        </span>
        <span className="text-xs font-semibold text-[#2E4A4A]">
          Transactions ({transactions.length})
        </span>
      </div>
      {transactions.length === 0 ? (
        <p className="text-[11px] text-[#6B7B7B] px-3 py-2">No transactions.</p>
      ) : (
        <div className="divide-y divide-[#F0F1F1]">
          {visible.map((tx, i) => (
            <div key={i} className="px-3 py-1.5 flex justify-between text-[11px]">
              <div className="flex flex-col">
                <span className="text-[#2E4A4A] font-semibold">
                  {String(tx.transaction_type ?? "").replace(/_/g, " ")}
                </span>
                <span className="text-[#6B7B7B]">
                  {tx.created_at ? new Date(String(tx.created_at)).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`font-bold ${
                    Number(tx.amount ?? 0) < 0 ? "text-red-500" : "text-emerald-600"
                  }`}
                >
                  {Number(tx.amount ?? 0) > 0 ? "+" : ""}
                  {String(tx.amount ?? 0)}
                </span>
                <p className="text-[#6B7B7B]">{String(tx.bucket ?? "")}</p>
              </div>
            </div>
          ))}
          {transactions.length > 5 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full text-center text-[11px] text-emerald-600 font-semibold py-2 hover:bg-[#F2F3F3]"
            >
              Show all {transactions.length} transactions
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ManageUsersScreen;
