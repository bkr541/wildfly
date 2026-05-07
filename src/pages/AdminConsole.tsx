import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChartRoseIcon,
  UserIcon,
  AirplaneTakeOff01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Search01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  DatabaseIcon,
  CodeCircleIcon,
  UserGroupIcon,
  BookOpen01Icon,
  Coins01Icon,
  Settings01Icon,
  UnfoldMoreIcon,
  UnfoldLessIcon,
  SquareArrowUpDownIcon,
  FilterMailSquareIcon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "dashboard" | "users" | "flights" | "data";

interface UserRow {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  signup_type: string;
  last_login: string | null;
  home_airport: string | null;
  home_city: string | null;
  onboarding_complete: string;
  is_discoverable: boolean;
  bio: string | null;
  dob: string | null;
  mobile_number: string | null;
  locations: { name: string; city: string | null; state: string | null; country: string | null } | null;
}

interface FlightRow {
  id: string;
  user_id: string;
  departure_airport: string;
  arrival_airport: string | null;
  departure_date: string;
  return_date: string | null;
  trip_type: string;
  all_destinations: string;
  gowild_found: boolean | null;
  flight_results_count: number | null;
  credits_cost: number | null;
  arrival_airports_count: number | null;
  search_timestamp: string;
  triggered_by: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

const NAV_ITEMS: { id: View; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: ChartRoseIcon },
  { id: "users",     label: "Users",     icon: UserIcon },
  { id: "flights",   label: "Flights",   icon: AirplaneTakeOff01Icon },
  { id: "data",      label: "Data",      icon: DatabaseIcon },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(row: UserRow): string {
  const f = row.first_name?.[0] ?? "";
  const l = row.last_name?.[0] ?? "";
  return (f + l).toUpperCase() || row.email[0].toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy h:mm a"); } catch { return iso; }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ row }: { row: UserRow }) {
  const [imgErr, setImgErr] = useState(false);
  if (row.avatar_url && !imgErr) {
    return (
      <img
        src={row.avatar_url}
        alt={initials(row)}
        onError={() => setImgErr(true)}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
      style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
    >
      {initials(row)}
    </div>
  );
}

// ── Users Table ───────────────────────────────────────────────────────────────

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

const USER_FILTER_FIELDS = [
  { label: "Email",        key: "email" },
  { label: "First Name",   key: "first_name" },
  { label: "Last Name",    key: "last_name" },
  { label: "Username",     key: "username" },
  { label: "Display Name", key: "display_name" },
  { label: "Status",       key: "status" },
  { label: "Signup Type",  key: "signup_type" },
  { label: "Home City",    key: "home_city" },
];

const FILTER_OPERATORS = [
  { label: "contains",         key: "contains" },
  { label: "does not contain", key: "not_contains" },
  { label: "equals",           key: "equals" },
  { label: "not equals",       key: "not_equals" },
  { label: "starts with",      key: "starts_with" },
  { label: "ends with",        key: "ends_with" },
  { label: "is empty",         key: "is_empty" },
  { label: "is not empty",     key: "is_not_empty" },
];

const NO_VALUE_OPS = new Set(["is_empty", "is_not_empty"]);

function newCondition(): FilterCondition {
  return { id: Math.random().toString(36).slice(2), field: "", operator: "", value: "" };
}

function applyCondition(u: UserRow, cond: FilterCondition): boolean {
  const raw = (u as Record<string, unknown>)[cond.field];
  const str = raw == null ? "" : String(raw).toLowerCase();
  const val = cond.value.toLowerCase();
  switch (cond.operator) {
    case "contains":     return str.includes(val);
    case "not_contains": return !str.includes(val);
    case "equals":       return str === val;
    case "not_equals":   return str !== val;
    case "starts_with":  return str.startsWith(val);
    case "ends_with":    return str.endsWith(val);
    case "is_empty":     return str === "";
    case "is_not_empty": return str !== "";
    default:             return true;
  }
}

interface SortCondition {
  id: string;
  field: string;
  direction: "asc" | "desc" | "";
}

const SORT_DIRECTIONS = [
  { label: "Ascending",  key: "asc" },
  { label: "Descending", key: "desc" },
];

function newSortCondition(): SortCondition {
  return { id: Math.random().toString(36).slice(2), field: "", direction: "" };
}

function UsersView() {
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(0);
  const [filterOpen, setFilterOpen]     = useState(false);
  const [conditions, setConditions]     = useState<FilterCondition[]>([newCondition()]);
  const [appliedConditions, setApplied] = useState<FilterCondition[]>([]);
  const [sortOpen, setSortOpen]         = useState(false);
  const [sortConditions, setSortConds]  = useState<SortCondition[]>([newSortCondition()]);
  const [appliedSorts, setAppliedSorts] = useState<SortCondition[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setUsers([]); return; }
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
        if (json?.users) setUsers(json.users as UserRow[]);
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        [u.email, u.first_name, u.last_name, u.username, u.display_name]
          .some((v) => v?.toLowerCase().includes(q))
      );
    }
    for (const cond of appliedConditions) {
      result = result.filter((u) => applyCondition(u, cond));
    }
    if (appliedSorts.length > 0) {
      result = [...result].sort((a, b) => {
        for (const s of appliedSorts) {
          const av = String((a as Record<string, unknown>)[s.field] ?? "").toLowerCase();
          const bv = String((b as Record<string, unknown>)[s.field] ?? "").toLowerCase();
          if (av < bv) return s.direction === "asc" ? -1 : 1;
          if (av > bv) return s.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [users, search, appliedConditions, appliedSorts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageRows   = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const canApply = conditions.length > 0 && conditions.every(
    (c) => c.field && c.operator && (NO_VALUE_OPS.has(c.operator) || c.value.trim())
  );

  const updateCondition = (id: string, patch: Partial<FilterCondition>) =>
    setConditions((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));

  const handleApply = () => {
    setApplied(conditions.filter((c) => c.field && c.operator && (NO_VALUE_OPS.has(c.operator) || c.value.trim())));
    setFilterOpen(false);
    setPage(0);
  };

  const clearAll = () => {
    setConditions([newCondition()]);
    setApplied([]);
    setPage(0);
  };

  const hasApplied    = appliedConditions.length > 0;
  const hasAppliedSort = appliedSorts.length > 0;

  const canApplySort = sortConditions.length > 0 && sortConditions.every((s) => s.field && s.direction);

  const handleApplySort = () => {
    setAppliedSorts(sortConditions.filter((s) => s.field && s.direction));
    setSortOpen(false);
    setPage(0);
  };

  const clearAllSorts = () => {
    setSortConds([newSortCondition()]);
    setAppliedSorts([]);
    setPage(0);
  };


  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={CARD_STYLE}>
        <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9 flex-1 max-w-xs">
          <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search users…"
            className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#6B7B7B]">
              <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors duration-200"
            style={hasAppliedSort
              ? { background: "#345C5A", color: "white" }
              : sortOpen
              ? { background: "#F2F3F3", color: "#059669" }
              : { color: "#9CA3AF" }
            }
          >
            <HugeiconsIcon icon={SquareArrowUpDownIcon} size={17} color="currentColor" strokeWidth={2} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Sort</span>
            {hasAppliedSort && (
              <span className="w-4 h-4 rounded-full bg-white text-[#345C5A] text-[9px] font-bold flex items-center justify-center flex-shrink-0 leading-none">
                {appliedSorts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors duration-200"
            style={hasApplied
              ? { background: "#345C5A", color: "white" }
              : filterOpen
              ? { background: "#F2F3F3", color: "#059669" }
              : { color: "#9CA3AF" }
            }
          >
            <HugeiconsIcon icon={FilterMailSquareIcon} size={17} color="currentColor" strokeWidth={2} />
            <span className="text-[11px] font-semibold uppercase tracking-wide">Filter</span>
            {hasApplied && (
              <span className="w-4 h-4 rounded-full bg-white text-[#345C5A] text-[9px] font-bold flex items-center justify-center flex-shrink-0 leading-none">
                {appliedConditions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sort panel */}
      {sortOpen && (
        <div className="rounded-2xl px-5 py-4 flex flex-col gap-3" style={CARD_STYLE}>
          <p className="text-xs font-semibold text-[#6B7B7B]">Sort records by</p>
          <div className="flex flex-col gap-2">
            {sortConditions.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs text-[#9CA3AF] w-10 flex-shrink-0 text-right">
                  {idx === 0 ? "By" : "Then"}
                </span>
                <div className="app-input-container flex-1" style={{ minHeight: 38 }}>
                  <select
                    value={s.field}
                    onChange={(e) => setSortConds((prev) => prev.map((c) => c.id === s.id ? { ...c, field: e.target.value } : c))}
                    className="app-input"
                    style={{ fontSize: 13, paddingBlock: "0.3em", cursor: "pointer" }}
                  >
                    <option value="">Field…</option>
                    {USER_FILTER_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="app-input-container flex-1" style={{ minHeight: 38 }}>
                  <select
                    value={s.direction}
                    onChange={(e) => setSortConds((prev) => prev.map((c) => c.id === s.id ? { ...c, direction: e.target.value as "asc" | "desc" } : c))}
                    className="app-input"
                    style={{ fontSize: 13, paddingBlock: "0.3em", cursor: "pointer" }}
                    disabled={!s.field}
                  >
                    <option value="">Direction…</option>
                    {SORT_DIRECTIONS.map((d) => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
                {sortConditions.length > 1 && (
                  <button
                    onClick={() => setSortConds((prev) => prev.filter((c) => c.id !== s.id))}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors flex-shrink-0"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={11} color="currentColor" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setSortConds((prev) => [...prev, newSortCondition()])}
              className="self-start flex items-center gap-1.5 text-xs font-semibold mt-1 text-[#059669] hover:text-[#047857] transition-colors"
            >
              <span className="text-sm leading-none">+</span> Add sort
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E8EEEE]">
            <button
              onClick={clearAllSorts}
              className="text-xs font-semibold text-[#9CA3AF] hover:text-[#6B7B7B] transition-colors"
            >
              Clear all sorts
            </button>
            <button
              onClick={handleApplySort}
              disabled={!canApplySort}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Filter panel */}
      {filterOpen && (
        <div className="rounded-2xl px-5 py-4 flex flex-col gap-3" style={CARD_STYLE}>
          <p className="text-xs font-semibold text-[#6B7B7B]">In this view show records</p>
          <div className="flex flex-col gap-2">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-3">
                <span className="text-xs text-[#9CA3AF] w-10 flex-shrink-0 text-right">
                  {idx === 0 ? "Where" : "And"}
                </span>
                <div className="app-input-container" style={{ minHeight: 38, width: 140, flexShrink: 0 }}>
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(cond.id, { field: e.target.value, operator: "", value: "" })}
                    className="app-input"
                    style={{ fontSize: 13, paddingBlock: "0.3em", cursor: "pointer" }}
                  >
                    <option value="">Field…</option>
                    {USER_FILTER_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="app-input-container" style={{ minHeight: 38, width: 160, flexShrink: 0 }}>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(cond.id, { operator: e.target.value, value: "" })}
                    className="app-input"
                    style={{ fontSize: 13, paddingBlock: "0.3em", cursor: "pointer" }}
                    disabled={!cond.field}
                  >
                    <option value="">Operator…</option>
                    {FILTER_OPERATORS.map((op) => (
                      <option key={op.key} value={op.key}>{op.label}</option>
                    ))}
                  </select>
                </div>
                {!NO_VALUE_OPS.has(cond.operator) && (
                  <div className="app-input-container flex-1" style={{ minHeight: 38 }}>
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                      placeholder="Enter value…"
                      disabled={!cond.operator}
                      className="app-input disabled:opacity-40"
                      style={{ fontSize: 13, paddingBlock: "0.3em" }}
                    />
                  </div>
                )}
                {conditions.length > 1 && (
                  <button
                    onClick={() => setConditions((prev) => prev.filter((c) => c.id !== cond.id))}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors flex-shrink-0"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={11} color="currentColor" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
            {/* Add filter — always below last condition */}
            <button
              onClick={() => setConditions((prev) => [...prev, newCondition()])}
              className="self-start flex items-center gap-1.5 text-xs font-semibold mt-1 text-[#059669] hover:text-[#047857] transition-colors"
            >
              <span className="text-sm leading-none">+</span> Add filter
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E8EEEE]">
            <button
              onClick={clearAll}
              className="text-xs font-semibold text-[#9CA3AF] hover:text-[#6B7B7B] transition-colors"
            >
              Clear all filters
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden p-3" style={CARD_STYLE}>
        {/* Header */}
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_0.7fr_0.7fr_0.9fr] gap-3 px-5 py-2.5 border-b border-[#F0F1F1] bg-[#F8F9F9]">
          {["User", "Email", "Home Location", "Signup", "Status", "Last Login"].map((h) => (
            <span key={h} className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Loading users…</div>
        ) : pageRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No users found.</div>
        ) : (
          <div className="divide-y divide-[#F0F1F1] overflow-y-auto" style={{ maxHeight: "calc(100vh - 310px)" }}>
            {pageRows.map((u) => (
              <div key={u.id} className="grid grid-cols-[1.5fr_1.5fr_1fr_0.7fr_0.7fr_0.9fr] gap-3 px-5 py-3 items-center hover:bg-[#FAFAFA] transition-colors">
                {/* User */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar row={u} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A2E2E] truncate">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.display_name || "—"}
                    </p>
                    {u.username && <p className="text-[11px] text-[#10B981] truncate">@{u.username}</p>}
                  </div>
                </div>
                {/* Email */}
                <p className="text-xs text-[#9CA3AF] truncate min-w-0">{u.email}</p>
                {/* Home Location */}
                <div className="min-w-0">
                  <p className="text-sm text-[#2E4A4A] truncate">{u.locations?.name ?? u.home_city ?? "—"}</p>
                  {u.locations?.country && (
                    <p className="text-xs text-[#9CA3AF] truncate">{u.locations.country}</p>
                  )}
                </div>
                {/* Signup */}
                <span className="text-xs text-[#6B7B7B] capitalize">{u.signup_type}</span>
                {/* Status */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: u.status === "active" ? "#059669" : "#9CA3AF" }}
                  />
                  <span className="text-xs font-medium capitalize" style={{ color: u.status === "active" ? "#059669" : "#9CA3AF" }}>
                    {u.status}
                  </span>
                </div>
                {/* Last Login */}
                <span className="text-xs text-[#9CA3AF]">{fmtDate(u.last_login)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
        )}
      </div>
    </div>
  );
}

// ── Flights Table ─────────────────────────────────────────────────────────────

function FlightsView() {
  const [flights, setFlights]   = useState<FlightRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState("");

  const fetchPage = async (p: number) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setFlights([]); setTotal(0); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-list-flight-searches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ page: p, page_size: PAGE_SIZE }),
        }
      );
      const json = await res.json();
      setFlights((json?.flights ?? []) as FlightRow[]);
      setTotal(json?.total ?? 0);
    } catch (e) {
      console.error("Failed to load flights", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPage(page); }, [page]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flights;
    const q = search.toLowerCase();
    return flights.filter((f) =>
      [f.departure_airport, f.arrival_airport, f.user_id, f.trip_type]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [flights, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={CARD_STYLE}>
        <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9 flex-1 max-w-xs">
          <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter this page…"
            className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#6B7B7B]">
              <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
        <span className="text-xs text-[#9CA3AF] ml-auto">{total.toLocaleString()} total records</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden p-3" style={CARD_STYLE}>
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-2.5 border-b border-[#F0F1F1] bg-[#F8F9F9]">
          {["Route", "Date", "Trip Type", "All Dest", "GoWild", "Results", "Timestamp"].map((h) => (
            <span key={h} className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Loading flights…</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No records found.</div>
        ) : (
          <div className="divide-y divide-[#F0F1F1] overflow-y-auto" style={{ maxHeight: "calc(100vh - 310px)" }}>
            {filtered.map((f) => {
              const isAdmin = f.triggered_by === "admin_bulk_search";
              return (
                <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 items-center hover:bg-[#FAFAFA] transition-colors">
                  {/* Route */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div>
                      <p className="text-sm font-bold text-[#1A2E2E] font-mono">
                        {f.departure_airport} → {f.arrival_airport ?? "ALL"}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] truncate max-w-[160px]" title={f.user_id}>
                        {isAdmin
                          ? <span className="text-[#d97706] font-semibold">admin bulk</span>
                          : f.user_id.slice(0, 8) + "…"
                        }
                      </p>
                    </div>
                  </div>
                  {/* Date */}
                  <span className="text-xs text-[#2E4A4A]">{fmtDate(f.departure_date)}</span>
                  {/* Trip Type */}
                  <span className="text-xs text-[#6B7B7B] capitalize">{f.trip_type.replace(/_/g, " ")}</span>
                  {/* All Dest */}
                  <span className="text-xs font-semibold" style={{ color: f.all_destinations === "Yes" ? "#059669" : "#9CA3AF" }}>
                    {f.all_destinations === "Yes" ? "Yes" : "No"}
                  </span>
                  {/* GoWild */}
                  <span className="text-xs font-semibold" style={{ color: f.gowild_found ? "#059669" : "#9CA3AF" }}>
                    {f.gowild_found ? "Yes" : "—"}
                  </span>
                  {/* Results */}
                  <span className="text-xs text-[#6B7B7B]">{f.flight_results_count ?? "—"}</span>
                  {/* Timestamp */}
                  <span className="text-xs text-[#9CA3AF]">{fmtTs(f.search_timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPage={(p) => { setPage(p); }} />
        )}
      </div>
    </div>
  );
}

// ── Data View ─────────────────────────────────────────────────────────────────

interface TableEntry {
  name: string;
  views?: string[];
}

const COLUMN_MAP: Record<string, string[]> = {
  // Users
  users: ["id", "email", "first_name", "last_name", "username", "dob", "image_file", "home_location_id", "bio", "onboarding_complete", "auth_user_id", "mobile_number", "display_name", "avatar_url", "home_city", "home_airport", "is_discoverable", "status", "signup_type", "last_login"],
  user_public_profiles: ["auth_user_id", "username", "display_name", "first_name", "last_name", "avatar_url", "home_city", "home_airport", "is_discoverable"],
  user_settings: ["user_id", "notifications_enabled", "notify_gowild_availability", "notify_new_routes", "notify_pass_sales", "notify_new_features", "theme_preference", "created_at", "updated_at", "default_departure_to_home", "allow_friend_requests", "show_home_city_to_friends", "show_upcoming_trips_to_friends", "show_activity_feed_to_friends", "show_trip_overlap_alerts"],
  user_locations: ["id", "user_id", "location_id", "created_at"],
  user_homepage: ["id", "user_id", "component_name", "order", "status", "created_at", "updated_at"],
  user_flights: ["id", "user_id", "flight_key", "provider", "provider_offer_id", "origin_iata", "destination_iata", "start_time", "end_time", "trip_type", "airline", "flight_number", "stops", "duration_minutes", "price_total", "currency", "gowild_eligible", "nonstop", "cabin_class", "seats_remaining", "saved_at", "snapshot_json", "snapshot_updated_at"],
  user_events: ["id", "user_id", "edmtrain_event_id", "start_time", "end_time", "saved_at", "snapshot_json"],
  user_credit_wallet: ["user_id", "monthly_used", "monthly_period_start", "monthly_period_end", "purchased_balance", "updated_at"],
  user_favorite_artists: ["user_id", "artist_id"],
  user_favorite_genres: ["user_id", "genre_id"],
  user_favorite_locations: ["user_id", "location_id"],
  user_subscriptions: ["user_id", "plan_id", "status", "stripe_customer_id", "stripe_subscription_id", "stripe_price_id", "current_period_start", "current_period_end", "updated_at", "cancel_at_period_end"],
  // Flights
  flight_searches: ["id", "user_id", "search_timestamp", "departure_airport", "arrival_airport", "departure_date", "return_date", "trip_type", "all_destinations", "json_body", "request_body", "gowild_found", "flight_results_count", "triggered_by"],
  flight_search_cache: ["id", "cache_key", "reset_bucket", "canonical_request", "provider", "status", "payload", "error", "created_at", "updated_at"],
  gowild_snapshots: ["id", "observed_at", "observed_date", "origin_iata", "destination_iata", "travel_date", "total_flights", "gowild_flights", "nonstop_total", "nonstop_gowild", "gowild_avalseats", "min_gowild_fare", "min_fare", "raw_response"],
  route_favorites: ["id", "user_id", "origin_iata", "dest_iata", "created_at"],
  // Social
  friends: ["id", "user_id", "friend_user_id", "created_at", "source_request_id"],
  friends_with_profiles: ["user_id", "friend_user_id", "username", "display_name", "avatar_url", "home_city", "home_airport"],
  friend_requests: ["id", "requester_user_id", "recipient_user_id", "status", "created_at", "responded_at"],
  pending_friend_requests: ["id", "requester_user_id", "recipient_user_id", "requester_username", "requester_avatar", "created_at"],
  notifications: ["id", "user_id", "type", "title", "body", "data", "is_read", "created_at"],
  trip_shares: ["id", "user_flight_id", "owner_user_id", "shared_with_user_id", "status", "created_at"],
  // Content
  artists: ["id", "display_name", "edmtrain_id", "normalized_name", "genres", "image_url", "spotify_id"],
  artist_genres: ["artist_id", "genre_id"],
  genres: ["id", "genre_name", "parent_genre", "energy", "mood_tags"],
  announcements: ["id", "title", "body", "cta_label", "cta_url", "image_url", "audience", "priority", "is_published", "publish_at", "expires_at", "created_by", "created_at"],
  announcement_views: ["id", "announcement_id", "user_id", "seen_at", "dismissed_at"],
  // Credits
  credit_packs: ["id", "name", "credits_amount", "stripe_price_id", "price_usd", "is_active", "display_order", "created_at"],
  credit_transactions: ["id", "user_id", "transaction_type", "source_type", "source_id", "amount", "bucket", "balance_before", "balance_after", "metadata", "created_at"],
  // System
  app_config: ["id", "user_id", "config_key", "config_value", "created_at", "updated_at"],
  developer_allowlist: ["user_id"],
  developer_settings: ["user_id", "debug_enabled", "show_raw_payload", "log_level", "flags", "created_at", "updated_at", "enabled_debug_components", "logging_enabled", "enabled_component_logging"],
  locations: ["id", "name", "city", "state", "state_code", "region", "country", "latitude", "longitude", "edmtrain_locationid"],
  airports: ["id", "name", "iata_code", "icao_code", "latitude", "longitude", "timezone", "location_id", "is_hub"],
  plans: ["id", "name", "monthly_allowance_credits", "features", "created_at"],
};

const TABLE_GROUPS: { label: string; icon: any; tables: TableEntry[] }[] = [
  {
    label: "Users",
    icon: UserIcon,
    tables: [
      { name: "users", views: ["user_public_profiles"] },
      { name: "user_settings" },
      { name: "user_locations" },
      { name: "user_homepage" },
      { name: "user_flights" },
      { name: "user_events" },
      { name: "user_credit_wallet" },
      { name: "user_favorite_artists" },
      { name: "user_favorite_genres" },
      { name: "user_favorite_locations" },
      { name: "user_subscriptions" },
    ],
  },
  {
    label: "Flights",
    icon: AirplaneTakeOff01Icon,
    tables: [
      { name: "flight_searches" },
      { name: "flight_search_cache" },
      { name: "gowild_snapshots" },
      { name: "route_favorites" },
    ],
  },
  {
    label: "Social",
    icon: UserGroupIcon,
    tables: [
      { name: "friends", views: ["friends_with_profiles"] },
      { name: "friend_requests", views: ["pending_friend_requests"] },
      { name: "notifications" },
      { name: "trip_shares" },
    ],
  },
  {
    label: "Content",
    icon: BookOpen01Icon,
    tables: [
      { name: "artists" },
      { name: "artist_genres" },
      { name: "genres" },
      { name: "announcements" },
      { name: "announcement_views" },
    ],
  },
  {
    label: "Credits",
    icon: Coins01Icon,
    tables: [
      { name: "credit_packs" },
      { name: "credit_transactions" },
    ],
  },
  {
    label: "System",
    icon: Settings01Icon,
    tables: [
      { name: "app_config" },
      { name: "developer_allowlist" },
      { name: "developer_settings" },
      { name: "locations" },
      { name: "airports" },
      { name: "plans" },
    ],
  },
];

function fmtCell(val: unknown): { text: string; muted: boolean; isJson: boolean } {
  if (val === null || val === undefined) return { text: "null", muted: true, isJson: false };
  if (typeof val === "boolean") return { text: String(val), muted: false, isJson: false };
  if (typeof val === "object") return { text: JSON.stringify(val), muted: false, isJson: true };
  // Check if the string value is JSON
  if (typeof val === "string") {
    const trimmed = val.trim();
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) ) {
      try { JSON.parse(trimmed); return { text: trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed, muted: false, isJson: true }; } catch {}
    }
  }
  const str = String(val);
  return { text: str.length > 80 ? str.slice(0, 80) + "…" : str, muted: false, isJson: false };
}

// ── JSON popup helpers ────────────────────────────────────────────────────────

function parseJson(val: unknown): unknown {
  if (typeof val === "string") { try { return JSON.parse(val); } catch {} }
  return val;
}

function calcJsonStats(root: unknown) {
  let nodes = 0, objects = 0, arrays = 0, strings = 0, numbers = 0, booleans = 0, nulls = 0, maxDepth = 0, maxArray = 0;
  const keyCounts: Record<string, number> = {};

  function walk(v: unknown, depth: number) {
    nodes++;
    if (depth > maxDepth) maxDepth = depth;
    if (v === null) { nulls++; return; }
    if (typeof v === "boolean") { booleans++; return; }
    if (typeof v === "number") { numbers++; return; }
    if (typeof v === "string") { strings++; return; }
    if (Array.isArray(v)) {
      arrays++;
      if (v.length > maxArray) maxArray = v.length;
      v.forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof v === "object") {
      objects++;
      Object.entries(v as Record<string, unknown>).forEach(([k, child]) => {
        keyCounts[k] = (keyCounts[k] ?? 0) + 1;
        walk(child, depth + 1);
      });
    }
  }
  walk(root, 0);

  const totalKeys = Object.keys(keyCounts).length;
  const topKeys = Object.entries(keyCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const valueTypes = [
    { label: "Objects",  count: objects },
    { label: "Arrays",   count: arrays },
    { label: "Strings",  count: strings },
    { label: "Numbers",  count: numbers },
    { label: "Booleans", count: booleans },
    { label: "Nulls",    count: nulls },
  ];
  return { nodes, totalKeys, maxDepth, objects, arrays, maxArray, valueTypes, topKeys };
}

function TreeNode({ keyName, value, depth = 0 }: { keyName?: string; value: unknown; depth?: number }) {
  const isArr = Array.isArray(value);
  const isObj = value !== null && typeof value === "object" && !isArr;
  const isExpandable = isArr || isObj;
  const [open, setOpen] = useState(depth < 2);

  const entries: [string, unknown][] = isObj
    ? Object.entries(value as Record<string, unknown>)
    : isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : [];

  const valueNode = () => {
    if (value === null) return <span className="text-[#9CA3AF] font-mono text-xs">null</span>;
    if (typeof value === "boolean") return <span className="text-[#F59E0B] font-mono text-xs">{String(value)}</span>;
    if (typeof value === "number") return <span className="text-[#3B82F6] font-mono text-xs">{String(value)}</span>;
    if (typeof value === "string") {
      const display = value.length > 60 ? value.slice(0, 60) + "…" : value;
      return <span className="text-[#059669] font-mono text-xs">"{display}"</span>;
    }
    return null;
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 rounded hover:bg-[#F2F3F3] ${isExpandable ? "cursor-pointer" : ""}`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={isExpandable ? () => setOpen((o) => !o) : undefined}
      >
        <span className={`w-3 text-[#9CA3AF] text-[10px] flex-shrink-0 transition-transform ${isExpandable ? "" : "opacity-0"} ${isExpandable && !open ? "-rotate-90" : ""}`}>▾</span>
        {keyName !== undefined && (
          <span className="text-[#345C5A] font-mono text-xs font-semibold mr-1">{keyName}:</span>
        )}
        {isExpandable ? (
          <span className="text-[#9CA3AF] font-mono text-xs">
            {isArr ? `[ ${entries.length} ]` : `{ ${entries.length} }`}
          </span>
        ) : valueNode()}
      </div>
      {isExpandable && open && entries.map(([k, v]) => (
        <TreeNode key={k} keyName={isArr ? undefined : k} value={v} depth={depth + 1} />
      ))}
    </div>
  );
}

function JsonPopup({ col, val, onClose }: { col: string; val: unknown; onClose: () => void }) {
  const [tab, setTab] = useState<"code" | "tree" | "stats">("code");
  const parsed = parseJson(val);

  let pretty = "";
  try { pretty = JSON.stringify(parsed, null, 2); } catch { pretty = String(val); }

  const stats = tab === "stats" ? calcJsonStats(parsed) : null;
  const maxTypeCount = stats ? Math.max(...stats.valueTypes.map((t) => t.count), 1) : 1;

  const TABS: { id: "code" | "tree" | "stats"; label: string }[] = [
    { id: "code",  label: "Code" },
    { id: "tree",  label: "Tree View" },
    { id: "stats", label: "Stats" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col"
        style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(255,255,255,0.6)", height: "75vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F1F1] flex-shrink-0">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={CodeCircleIcon} size={16} color="#059669" strokeWidth={2} />
            <span className="text-sm font-bold text-[#1A2E2E] font-mono">{col}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-0 border-b border-[#F0F1F1] flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "text-[#059669] border-[#059669] bg-[#F0FDF4]"
                  : "text-[#9CA3AF] border-transparent hover:text-[#6B7B7B]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-5">
          {tab === "code" && (
            <pre className="text-xs font-mono text-[#1A2E2E] whitespace-pre-wrap break-all leading-relaxed">{pretty}</pre>
          )}

          {tab === "tree" && (
            <div className="select-none">
              <TreeNode value={parsed} depth={0} />
            </div>
          )}

          {tab === "stats" && stats && (
            <div className="flex flex-col gap-4">
              {/* Stat boxes */}
              <div className="grid grid-cols-6 gap-2">
                {[
                  { label: "NODES",     value: stats.nodes },
                  { label: "KEYS",      value: stats.totalKeys },
                  { label: "DEPTH",     value: stats.maxDepth },
                  { label: "OBJECTS",   value: stats.objects },
                  { label: "ARRAYS",    value: stats.arrays },
                  { label: "MAX ARRAY", value: stats.maxArray },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-[#F8F9F9] border border-[#F0F1F1] px-3 py-2.5">
                    <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-lg font-black text-[#1A2E2E]">{value}</p>
                  </div>
                ))}
              </div>

              {/* Two columns */}
              <div className="grid grid-cols-2 gap-4">
                {/* Value Types */}
                <div className="rounded-xl border border-[#F0F1F1] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#F8F9F9] border-b border-[#F0F1F1]">
                    <span className="text-[11px] font-bold text-[#6B7B7B] uppercase tracking-wide">Value Types</span>
                  </div>
                  <div className="divide-y divide-[#F0F1F1]">
                    {stats.valueTypes.map(({ label, count }) => (
                      <div key={label} className="flex items-center gap-3 px-4 py-2">
                        <span className="text-xs text-[#2E4A4A] w-16 flex-shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-[#F0F1F1] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(count / maxTypeCount) * 100}%`,
                              background: "linear-gradient(90deg, #059669, #10b981)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#6B7B7B] w-8 text-right flex-shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Keys */}
                <div className="rounded-xl border border-[#F0F1F1] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#F8F9F9] border-b border-[#F0F1F1]">
                    <span className="text-[11px] font-bold text-[#6B7B7B] uppercase tracking-wide">Top Keys</span>
                  </div>
                  <div className="divide-y divide-[#F0F1F1]">
                    {stats.topKeys.map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs font-mono text-[#2E4A4A] truncate">{key}</span>
                        <span className="text-xs font-semibold text-[#9CA3AF] ml-2 flex-shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ALL_TABLES = [
  "airports", "announcement_views", "announcements", "app_config", "artist_genres", "artists",
  "credit_packs", "credit_transactions", "developer_allowlist", "developer_settings",
  "flight_search_cache", "flight_searches", "friend_requests", "friends", "genres",
  "gowild_snapshots", "locations", "notifications", "plans", "route_favorites", "trip_shares",
  "user_credit_wallet", "user_events", "user_favorite_artists", "user_favorite_genres",
  "user_favorite_locations", "user_flights", "user_homepage", "user_locations", "user_settings",
  "user_subscriptions", "users",
];

const ALL_VIEWS = ["friends_with_profiles", "pending_friend_requests", "user_public_profiles"];

function QueryView() {
  const [tablesOpen, setTablesOpen] = useState(true);
  const [viewsOpen, setViewsOpen]   = useState(true);

  return (
    <div className="flex flex-row gap-4 items-start">
      {/* Left group */}
      <div className="flex flex-col gap-3 w-1/4 min-w-0 flex-shrink-0">
        <div className="rounded-2xl p-5" style={CARD_STYLE}>
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Schemas</p>
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {/* Tables section */}
            <div>
              <button
                onClick={() => setTablesOpen((v) => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#F2F3F3] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={DatabaseIcon} size={16} color="#2E4A4A" strokeWidth={2} className="flex-shrink-0" />
                  <span className="text-sm font-semibold text-[#2E4A4A]">Tables</span>
                  <span className="text-[11px] text-[#9CA3AF]">{ALL_TABLES.length}</span>
                </div>
                <HugeiconsIcon
                  icon={ArrowDown01Icon} size={13} color="#9CA3AF" strokeWidth={2.5}
                  className={`flex-shrink-0 transition-transform duration-200 ${tablesOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {tablesOpen && (
                <div className="flex flex-col gap-0.5 mt-0.5 ml-5">
                  {ALL_TABLES.map((t) => (
                    <div key={t} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-[#F2F3F3] transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] flex-shrink-0" />
                      <span className="text-xs font-mono text-[#2E4A4A] truncate">{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Views section */}
            <div>
              <button
                onClick={() => setViewsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#F2F3F3] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={CodeCircleIcon} size={16} color="#2E4A4A" strokeWidth={2} className="flex-shrink-0" />
                  <span className="text-sm font-semibold text-[#2E4A4A]">Views</span>
                  <span className="text-[11px] text-[#9CA3AF]">{ALL_VIEWS.length}</span>
                </div>
                <HugeiconsIcon
                  icon={ArrowDown01Icon} size={13} color="#9CA3AF" strokeWidth={2.5}
                  className={`flex-shrink-0 transition-transform duration-200 ${viewsOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {viewsOpen && (
                <div className="flex flex-col gap-0.5 mt-0.5 ml-5">
                  {ALL_VIEWS.map((v) => (
                    <div key={v} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-[#F2F3F3] transition-colors">
                      <span className="w-1.5 h-1.5 rounded-sm bg-[#6B7B7B] flex-shrink-0" />
                      <span className="text-xs font-mono text-[#9CA3AF] truncate">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right group */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="rounded-2xl overflow-hidden p-3 flex items-center justify-center" style={{ ...CARD_STYLE, minHeight: 240 }}>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-12 w-12 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-1">
              <HugeiconsIcon icon={DatabaseIcon} size={22} color="#059669" strokeWidth={1.5} />
            </div>
            <p className="text-base font-bold text-[#2E4A4A]">Query editor coming soon</p>
            <p className="text-sm text-[#9CA3AF]">Run SQL queries against your tables and views.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataView() {
  const [mode, setMode] = useState<"tables" | "query">("tables");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(TABLE_GROUPS.map((g) => [g.label, true]))
  );
  const [selected, setSelected]   = useState<string | null>(null);
  const [rows, setRows]           = useState<Record<string, unknown>[]>([]);
  const [loadingRows, setLoading] = useState(false);
  const [jsonPopup, setJsonPopup] = useState<{ col: string; val: unknown } | null>(null);

  const toggle = (label: string) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  const columns = selected ? (COLUMN_MAP[selected] ?? []) : [];

  useEffect(() => {
    if (!selected) return;
    setRows([]);
    setLoading(true);
    supabase
      .from(selected)
      .select("*")
      .limit(200)
      .then(({ data }) => {
        setRows((data as Record<string, unknown>[]) ?? []);
        setLoading(false);
      });
  }, [selected]);

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="flex justify-end">
        <div className="flex items-center bg-white rounded-xl p-1 gap-0.5" style={{ boxShadow: "0 1px 4px 0 rgba(52,92,90,0.08)", border: "1px solid rgba(255,255,255,0.6)" }}>
          {(["tables", "query"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
                mode === m ? "text-white" : "text-[#6B7280] hover:text-[#2E4A4A]"
              }`}
              style={mode === m ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {mode === "query" && <QueryView />}
      {mode === "tables" && <div className="flex flex-row gap-4 items-start">
      {/* Left group — max 25% */}
      <div className="flex flex-col gap-3 w-1/4 min-w-0 flex-shrink-0">
        <div className="rounded-2xl p-5" style={CARD_STYLE}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Tables</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(Object.fromEntries(TABLE_GROUPS.map((g) => [g.label, true])))}
                title="Expand all"
                className="w-6 h-6 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#6B7B7B] transition-colors"
              >
                <HugeiconsIcon icon={UnfoldMoreIcon} size={13} color="currentColor" strokeWidth={2} />
              </button>
              <button
                onClick={() => setExpanded(Object.fromEntries(TABLE_GROUPS.map((g) => [g.label, false])))}
                title="Collapse all"
                className="w-6 h-6 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#6B7B7B] transition-colors"
              >
                <HugeiconsIcon icon={UnfoldLessIcon} size={13} color="currentColor" strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {TABLE_GROUPS.map((group) => {
              const isOpen = expanded[group.label];
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggle(group.label)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#F2F3F3] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={group.icon} size={16} color="#2E4A4A" strokeWidth={2} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-[#2E4A4A]">{group.label}</span>
                    </div>
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={13}
                      color="#9CA3AF"
                      strokeWidth={2.5}
                      className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-0.5 mt-0.5 ml-5">
                      {group.tables.map((table) => (
                        <div key={table.name}>
                          <button
                            onClick={() => setSelected(table.name)}
                            className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg transition-colors text-left ${
                              selected === table.name
                                ? "bg-[#F0FDF4] text-[#059669]"
                                : "hover:bg-[#F2F3F3]"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected === table.name ? "bg-[#059669]" : "bg-[#10B981]"}`} />
                            <span className="text-xs font-mono truncate text-[#2E4A4A]">{table.name}</span>
                          </button>
                          {table.views && (
                            <div className="flex flex-col gap-0.5 ml-4">
                              {table.views.map((view) => (
                                <button
                                  key={view}
                                  onClick={() => setSelected(view)}
                                  className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg transition-colors text-left ${
                                    selected === view
                                      ? "bg-[#F0FDF4] text-[#059669]"
                                      : "hover:bg-[#F2F3F3]"
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${selected === view ? "bg-[#059669]" : "bg-[#6B7B7B]"}`} />
                                  <span className="text-xs font-mono truncate text-[#9CA3AF]">{view}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right group — remaining space */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="rounded-2xl overflow-hidden p-3" style={CARD_STYLE}>
          {selected ? (
            <>
              {/* Table name + stats */}
              <div className="px-5 py-3 border-b border-[#F0F1F1] bg-[#F8F9F9] flex items-center gap-2">
                <span className="text-sm font-bold text-[#1A2E2E] font-mono">{selected}</span>
                <span className="text-xs text-[#9CA3AF] ml-1">{columns.length} columns</span>
                {!loadingRows && <span className="text-xs text-[#9CA3AF]">· {rows.length} rows</span>}
              </div>
              {/* Table */}
              <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 230px)" }}>
                {loadingRows ? (
                  <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Loading…</div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#F8F9F9] border-b border-[#F0F1F1]">
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap font-mono border-r border-[#F0F1F1] last:border-r-0"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F1F1]">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="px-5 py-8 text-center text-sm text-[#9CA3AF]">
                            No records found.
                          </td>
                        </tr>
                      ) : rows.map((row, i) => (
                        <tr key={i} className="hover:bg-[#FAFAFA] transition-colors">
                          {columns.map((col) => {
                            const { text, muted, isJson } = fmtCell(row[col]);
                            return (
                              <td
                                key={col}
                                className="px-4 py-2.5 border-r border-[#F0F1F1] last:border-r-0 whitespace-nowrap max-w-[200px] group/cell relative"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-mono truncate block ${muted ? "text-[#D1D5DB]" : "text-[#1A2E2E]"}`}>
                                    {text}
                                  </span>
                                  {isJson && (
                                    <button
                                      onClick={() => setJsonPopup({ col, val: row[col] })}
                                      className="opacity-0 group-hover/cell:opacity-100 flex-shrink-0 text-[#9CA3AF] hover:text-[#059669] transition-all"
                                    >
                                      <HugeiconsIcon icon={CodeCircleIcon} size={14} color="currentColor" strokeWidth={2} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="p-5 flex items-center justify-center" style={{ minHeight: 240 }}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-1">
                  <HugeiconsIcon icon={DatabaseIcon} size={22} color="#059669" strokeWidth={1.5} />
                </div>
                <p className="text-base font-bold text-[#2E4A4A]">Select a table</p>
                <p className="text-sm text-[#9CA3AF]">Click any table or view on the left to inspect its columns.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {jsonPopup && (
        <JsonPopup col={jsonPopup.col} val={jsonPopup.val} onClose={() => setJsonPopup(null)} />
      )}
      </div>}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const getPages = () => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 2) pages.push("…");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 3) pages.push("…");
      pages.push(totalPages - 1);
    }
    return pages;
  };

  const btnBase = "h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors";

  return (
    <div className="flex items-center justify-center gap-1.5 px-5 py-3 border-t border-[#F0F1F1]">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className={`${btnBase} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        Previous
      </button>
      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="text-xs text-[#9CA3AF] px-1">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            className={`${btnBase} ${
              p === page
                ? "text-white"
                : "border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3]"
            }`}
            style={p === page ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
          >
            {(p as number) + 1}
          </button>
        )
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages - 1}
        className={`${btnBase} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        Next
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard",  subtitle: "Overview of app activity and health." },
  users:     { title: "Users",      subtitle: "All registered users and their profile information." },
  flights:   { title: "Flights",    subtitle: "All flight searches across the platform." },
  data:      { title: "Data",       subtitle: "Data insights and platform analytics." },
};

export default function AdminConsole() {
  const [view, setView]               = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { title, subtitle } = VIEW_TITLES[view];

  return (
    <div
      className="h-screen overflow-hidden flex"
      style={{ background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
    >
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 border-r border-[#E8EEEE] transition-all duration-300 overflow-hidden"
        style={{
          width: sidebarOpen ? 220 : 68,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        {/* Logo / toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#F0F1F1]">
          {sidebarOpen && (
            <span className="text-2xl font-black tracking-widest uppercase text-[#10B981] select-none flex-1 text-center">
              Console
            </span>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-[#F2F3F3] transition-colors flex-shrink-0 ${!sidebarOpen ? "mx-auto" : ""}`}
          >
            <HugeiconsIcon
              icon={sidebarOpen ? ArrowLeft01Icon : ArrowRight01Icon}
              size={15}
              color="currentColor"
              strokeWidth={2.5}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 pt-3">
          {NAV_ITEMS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-left ${
                  active ? "text-white" : "text-[#6B7280] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]"
                }`}
                style={active ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  size={17}
                  color={active ? "white" : "currentColor"}
                  strokeWidth={2}
                  className="flex-shrink-0"
                />
                {sidebarOpen && (
                  <span className="text-sm font-semibold truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 p-6 gap-5 overflow-hidden">
        {/* Page header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={view + "-header"}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h1 className="text-2xl font-black text-[#1A2E2E] tracking-tight">{title}</h1>
            <p className="text-sm text-[#6B7B7B] mt-0.5">{subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {/* View content */}
        <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex flex-col gap-4 flex-1 overflow-y-auto pb-6"
        >
        {view === "dashboard" && (
          <div
            className="rounded-2xl flex-1 flex items-center justify-center"
            style={{ ...CARD_STYLE, minHeight: 300 }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-1">
                <HugeiconsIcon icon={ChartRoseIcon} size={22} color="#059669" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-[#2E4A4A]">Dashboard coming soon</p>
              <p className="text-sm text-[#9CA3AF]">App metrics and activity will appear here.</p>
            </div>
          </div>
        )}

        {view === "users"   && <UsersView />}
        {view === "flights" && <FlightsView />}
        {view === "data"    && <DataView />}
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
