import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import {
  EditUser02Icon,
  UserRemove01Icon,
  ArrowDown01Icon,
  CreditCardIcon,
  Settings01Icon,
  Wallet01Icon,
  ArrowRight01Icon,
  Search01Icon,
  FilterIcon,
  SortingAZ01Icon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons";
import EditUserScreen from "@/components/account/EditUserScreen";

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
  status: string;
  date_joined: string | null;
  plan_id: string | null;
  plan_status: string | null;
}

interface UserDetails {
  subscription: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  wallet: Record<string, unknown> | null;
  transactions: Record<string, unknown>[];
  searches: Record<string, unknown>[];
}

interface ManageUsersScreenProps {
  onBack: () => void;
}

type SortKey = "name" | "date" | "plan";

const ManageUsersScreen = ({ onBack }: ManageUsersScreenProps) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, UserDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterPlan, setFilterPlan] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

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

  const uniquePlans = useMemo(() => {
    const plans = new Set<string>();
    users.forEach((u) => { if (u.plan_id) plans.add(u.plan_id); });
    return Array.from(plans).sort();
  }, [users]);

  const filtered = useMemo(() => {
    let list = [...users];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        [u.first_name, u.last_name, u.email, u.username, u.display_name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    if (filterPlan) {
      list = list.filter((u) => u.plan_id === filterPlan);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        const na = displayName(a).toLowerCase();
        const nb = displayName(b).toLowerCase();
        cmp = na.localeCompare(nb);
      } else if (sortKey === "date") {
        cmp = (a.date_joined ?? "").localeCompare(b.date_joined ?? "");
      } else if (sortKey === "plan") {
        cmp = (a.plan_id ?? "").localeCompare(b.plan_id ?? "");
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [users, search, filterPlan, sortKey, sortAsc]);

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

  const approveUser = async (authUserId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-update-user-status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target_user_id: authUserId, status: "current" }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setUsers((prev) => prev.map((u) => u.auth_user_id === authUserId ? { ...u, status: "current" } : u));
        const user = users.find((u) => u.auth_user_id === authUserId);
        toast.success(`${displayName(user!)} has been accepted`);
      } else {
        toast.error(json.error || "Failed to approve user");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to approve user");
    }
  };

  const cycleSortKey = () => {
    if (sortKey === "name") { setSortKey("date"); setSortAsc(false); }
    else if (sortKey === "date") { setSortKey("plan"); setSortAsc(true); }
    else { setSortKey("name"); setSortAsc(true); }
  };

  const sortLabel = sortKey === "name" ? "A–Z" : sortKey === "date" ? "Date" : "Plan";

  if (editingUser) {
    return (
      <EditUserScreen
        user={editingUser}
        onBack={() => setEditingUser(null)}
        onUserUpdated={(updated) => {
          setUsers((prev) =>
            prev.map((u) =>
              u.auth_user_id === updated.auth_user_id ? { ...u, ...updated } : u
            )
          );
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pb-4 gap-3 relative z-10 animate-fade-in">
      {/* Search + Filter + Sort bar */}
      <div className="flex flex-col gap-2 mt-1">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <HugeiconsIcon icon={Search01Icon} size={16} color="#6B7B7B" strokeWidth={2} />
          </span>
          <Input
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm rounded-xl border-[#E3E6E6] bg-white shadow-sm focus-visible:ring-emerald-500/30"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
              filterPlan ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-[#E3E6E6] text-[#6B7B7B] hover:bg-[#F2F3F3]"
            }`}
          >
            <HugeiconsIcon icon={FilterIcon} size={12} strokeWidth={2} color={filterPlan ? "#047857" : "#6B7B7B"} />
            {filterPlan ? filterPlan : "Filter"}
          </button>
          <button
            type="button"
            onClick={cycleSortKey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E3E6E6] bg-white text-[#6B7B7B] hover:bg-[#F2F3F3] transition-colors"
          >
            <HugeiconsIcon icon={SortingAZ01Icon} size={12} strokeWidth={2} color="#6B7B7B" />
            {sortLabel} {sortAsc ? "↑" : "↓"}
          </button>
          <span className="ml-auto text-[11px] text-[#6B7B7B] self-center font-medium">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { setFilterPlan(null); setShowFilters(false); }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                !filterPlan ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-[#E3E6E6] text-[#6B7B7B]"
              }`}
            >
              All
            </button>
            {uniquePlans.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setFilterPlan(p); setShowFilters(false); }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                  filterPlan === p ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-[#E3E6E6] text-[#6B7B7B]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 mt-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {filtered.map((user, idx) => {
            const uid = user.auth_user_id;
            if (!uid) return null;
            const isOpen = expandedUserId === uid;
            const userDetails = details[uid];
            const isLoadingDetails = detailsLoading[uid];

            return (
              <Collapsible key={uid} open={isOpen} onOpenChange={() => toggleUser(uid)}>
                <div className={`${idx < filtered.length - 1 && !isOpen ? "border-b border-[#F0F1F1]" : ""}`}>
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
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#2E4A4A] truncate">
                            {displayName(user)}
                          </p>
                          {user.plan_id && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">
                              {user.plan_id}
                            </span>
                          )}
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                            user.status === "current"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {user.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-[#6B7B7B] truncate">
                            {user.username ? `@${user.username}` : user.email}
                          </p>
                          {user.date_joined && (
                            <span className="text-[10px] text-[#A0ADAD] shrink-0">
                              · {new Date(user.date_joined).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span
                          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          <HugeiconsIcon icon={EditUser02Icon} size={13} color="#6B7B7B" strokeWidth={1.5} />
                        </span>
                        {user.status === "pending" && (
                          <span
                            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-emerald-50"
                            onClick={(e) => { e.stopPropagation(); approveUser(uid); }}
                          >
                            <HugeiconsIcon icon={CheckmarkBadge01Icon} size={13} color="#047857" strokeWidth={1.5} />
                          </span>
                        )}
                        <span
                          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          <HugeiconsIcon icon={UserRemove01Icon} size={13} color="#EF4444" strokeWidth={1.5} />
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
                    <div className="px-4 pb-4 pt-1 space-y-2 border-b border-[#F0F1F1] bg-[#FAFBFB]">
                      {isLoadingDetails ? (
                        <div className="space-y-2">
                          <Skeleton className="h-10 w-full rounded-lg" />
                          <Skeleton className="h-10 w-full rounded-lg" />
                          <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                      ) : userDetails ? (
                        <>
                          <CollapsibleDetailSection icon={CreditCardIcon} title="Subscription" data={userDetails.subscription} />
                          <CollapsibleSearchesSection searches={userDetails.searches} />
                          <CollapsibleDetailSection icon={Settings01Icon} title="Settings" data={userDetails.settings} />
                          <CollapsibleDetailSection icon={Wallet01Icon} title="Credit Wallet" data={userDetails.wallet} />
                          <CollapsibleTransactionsSection transactions={userDetails.transactions} />
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
          {filtered.length === 0 && (
            <p className="text-center text-sm text-[#6B7B7B] py-8">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const displayName = (u: UserRow) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.display_name || u.email;

/* ─── Collapsible Detail Section ─────────────────────────────────── */
const CollapsibleDetailSection = ({
  icon,
  title,
  data,
}: {
  icon: any;
  title: string;
  data: Record<string, unknown> | null;
}) => {
  const [open, setOpen] = useState(false);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#6B7B7B] px-1 py-1">
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
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-[#E3E6E6] bg-white overflow-hidden">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-[#F2F3F3] transition-colors">
            <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={icon} size={12} color="#047857" strokeWidth={1.5} />
            </span>
            <span className="text-xs font-semibold text-[#2E4A4A] flex-1">{title}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={12}
              color="#C4CACA"
              strokeWidth={1.5}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 py-2 space-y-1 border-t border-[#F0F1F1]">
            {entries.map(([key, value]) => (
              <div key={key} className="flex justify-between text-[11px]">
                <span className="text-[#6B7B7B] font-medium">{key.replace(/_/g, " ")}</span>
                <span className="text-[#2E4A4A] font-semibold text-right max-w-[55%] truncate">
                  {value === null ? "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

/* ─── Collapsible Transactions Section ───────────────────────────── */
const CollapsibleTransactionsSection = ({ transactions }: { transactions: Record<string, unknown>[] }) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? transactions : transactions.slice(0, 5);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-[#E3E6E6] bg-white overflow-hidden">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-[#F2F3F3] transition-colors">
            <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="#047857" strokeWidth={1.5} />
            </span>
            <span className="text-xs font-semibold text-[#2E4A4A] flex-1">
              Transactions ({transactions.length})
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={12}
              color="#C4CACA"
              strokeWidth={1.5}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-[#F0F1F1]">
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
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
/* ─── Collapsible Searches Section ────────────────────────────────── */
const CollapsibleSearchesSection = ({ searches }: { searches: Record<string, unknown>[] }) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? searches : searches.slice(0, 5);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-[#E3E6E6] bg-white overflow-hidden">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-[#F2F3F3] transition-colors">
            <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Search01Icon} size={12} color="#047857" strokeWidth={1.5} />
            </span>
            <span className="text-xs font-semibold text-[#2E4A4A] flex-1">
              Flight Searches ({searches.length})
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={12}
              color="#C4CACA"
              strokeWidth={1.5}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-[#F0F1F1]">
            {searches.length === 0 ? (
              <p className="text-[11px] text-[#6B7B7B] px-3 py-2">No searches.</p>
            ) : (
              <div className="divide-y divide-[#F0F1F1]">
                {visible.map((s, i) => {
                  const dest = s.all_destinations === "Yes"
                    ? "All Destinations"
                    : String(s.arrival_airport ?? "—");
                  const gwFound = s.gowild_found === true;
                  return (
                    <div key={i} className="px-3 py-1.5 flex justify-between text-[11px]">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[#2E4A4A] font-semibold truncate">
                          {String(s.departure_airport ?? "")} → {dest}
                        </span>
                        <span className="text-[#6B7B7B]">
                          {s.departure_date ? new Date(String(s.departure_date)).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                          {s.return_date ? ` – ${new Date(String(s.return_date)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                          {" · "}
                          {String(s.trip_type ?? "").replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-2 flex flex-col items-end">
                        <span className="text-[#2E4A4A] font-semibold">
                          {s.flight_results_count != null ? `${s.flight_results_count} results` : "—"}
                        </span>
                        <div className="flex items-center gap-1">
                          {gwFound && (
                            <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">GW</span>
                          )}
                          {s.credits_cost != null && (
                            <span className="text-[#6B7B7B]">{String(s.credits_cost)} cr</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {searches.length > 5 && !showAll && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="w-full text-center text-[11px] text-emerald-600 font-semibold py-2 hover:bg-[#F2F3F3]"
                  >
                    Show all {searches.length} searches
                  </button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default ManageUsersScreen;
