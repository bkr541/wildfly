import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowReloadHorizontalIcon,
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
  Analytics01Icon,
  Home13Icon,
  Radar01Icon,
  Menu03Icon,
  Logout01Icon,
  Notebook01Icon,
  PlayIcon,
  StopIcon,
  Copy01Icon,
  Delete01Icon,
  SourceCodeSquareIcon,
  FileExportIcon,
  ShieldKeyIcon,
  Clock01Icon,
  CpuIcon,
  Calendar01Icon,
  BubbleChatNotificationIcon,
  Notification01Icon,
  SentIcon,
  DatabaseAddIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "@/hooks/use-toast";
import { Avatar as UIAvatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import { FlightsView } from "@/components/admin/flights/FlightsView";
import GoWildRadarMap from "@/components/admin/GoWildRadarMap";
import GoWildSnapshotCard from "@/components/insights/GoWildSnapshotCard";
import { groupLegsIntoItineraries } from "@/components/insights/itineraryHelpers";
import AirportGoWildInsightsSection from "@/components/insights/AirportGoWildInsightsSection";
import GoWildRouteAnalyticsSection from "@/components/insights/GoWildRouteAnalyticsSection";
import GoWildTimingAnalyticsSection from "@/components/insights/GoWildTimingAnalyticsSection";
import SeatAvailabilityIntelligence from "@/components/insights/SeatAvailabilityIntelligence";
import RouteAvailabilityCalendarCard from "@/components/insights/RouteAvailabilityCalendarCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { type FlightSnapshot } from "@/components/insights/airportHelpers";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";
import { supabase } from "@/integrations/supabase/client";
import AdminDashboardView from "@/components/admin/AdminDashboardView";
import AdminBetaApplications from "./AdminBetaApplications";
import { DeveloperToolsAdminShell, AdminCard } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { DesignSystemAdminView } from "@/components/admin/developer-tools/DesignSystemAdminView";
import { DebugSettingsAdminView } from "@/components/admin/developer-tools/DebugSettingsAdminView";
import { GoWilderTokenAdminView } from "@/components/admin/developer-tools/GoWilderTokenAdminView";
import { LoggingSettingsAdminView } from "@/components/admin/developer-tools/LoggingSettingsAdminView";
import { SqlCacheAdminView } from "@/components/admin/developer-tools/SqlCacheAdminView";
import { DeveloperAllowlistAdminView } from "@/components/admin/developer-tools/DeveloperAllowlistAdminView";
import { SignupControlsAdminView } from "@/components/admin/developer-tools/SignupControlsAdminView";
import { ScheduledJobsAdminView } from "@/components/admin/developer-tools/ScheduledJobsAdminView";
import { NotificationsAdminView } from "@/components/admin/communications/NotificationsAdminView";
import { MessagingAdminView } from "@/components/admin/communications/messaging/MessagingAdminView";
import { ReportingAdminView } from "@/components/admin/reporting/ReportingAdminView";

// ── Types ─────────────────────────────────────────────────────────────────────

type View =
  | "dashboard" | "users" | "flights" | "data" | "gowild" | "radar" | "beta-applications"
  | "developer-design-system" | "developer-debug"
  | "developer-sql-cache" | "developer-token" | "developer-logging"
  | "auth-developer-allowlist" | "auth-signup-controls"
  | "system-reporting"
  | "system-scheduled-jobs"
  | "communications-messaging"
  | "communications-notifications";

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
  { id: "flights",   label: "Flights",   icon: AirplaneTakeOff01Icon },
];

const WILDFLY_TOOLS_ITEMS: { id: View; label: string; icon: any }[] = [
  { id: "gowild", label: "GoWild Insights", icon: Analytics01Icon },
  { id: "radar",  label: "GoWild Radar",    icon: Radar01Icon },
];

const ACCOUNTS_ITEMS: { id: View; label: string; icon: any }[] = [
  { id: "users",             label: "Users",             icon: UserIcon },
  { id: "beta-applications", label: "Beta Applications", icon: Notebook01Icon },
];

const DEV_ITEMS: { id: View; label: string; icon: any }[] = [
  { id: "data",                     label: "Data",             icon: DatabaseIcon },
  { id: "developer-design-system", label: "Design System",    icon: BookOpen01Icon },
  { id: "developer-debug",         label: "Debug Settings",   icon: Settings01Icon },
  { id: "developer-sql-cache",     label: "SQL / Cache Tools", icon: DatabaseIcon },
  { id: "developer-token",         label: "GoWilder Token",   icon: Coins01Icon },
  { id: "developer-logging",       label: "Logging Settings", icon: FilterMailSquareIcon },
];

const AUTH_ACCESS_ITEMS: { id: View; label: string; icon: any }[] = [
  { id: "auth-developer-allowlist", label: "Developer Allowlist", icon: UserGroupIcon },
  { id: "auth-signup-controls",     label: "Signup Controls",     icon: Settings01Icon },
];

const SYSTEM_PROCESS_ITEMS: { id: string; label: string; icon: any; disabled?: boolean }[] = [
  { id: "system-reporting",      label: "Reporting",   icon: Analytics01Icon },
  { id: "system-scheduled-jobs", label: "System Jobs", icon: Clock01Icon },
  { id: "system-scheduler",      label: "Scheduler",      icon: Calendar01Icon, disabled: true },
];

const COMMUNICATIONS_ITEMS: { id: View; label: string; icon: any }[] = [
  { id: "communications-messaging",     label: "Messaging",     icon: SentIcon },
  { id: "communications-notifications", label: "Notifications", icon: Notification01Icon },
];

// ── Migration push ────────────────────────────────────────────────────────────

const MIGRATION_FILES = import.meta.glob("/supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

interface LocalMigration { version: string; name: string; sql: string }

const LOCAL_MIGRATIONS: LocalMigration[] = Object.entries(MIGRATION_FILES)
  .map(([path, sql]) => {
    const file = path.split("/").pop() ?? "";
    const base = file.replace(/\.sql$/i, "");
    const m = base.match(/^(\d{14})_?(.*)$/);
    return { version: m?.[1] ?? base, name: m?.[2] ?? base, sql: String(sql) };
  })
  .filter((m) => /^\d{14}$/.test(m.version))
  .sort((a, b) => a.version.localeCompare(b.version));

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
  const raw = (u as unknown as Record<string, unknown>)[cond.field];
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

const USERS_DROPDOWN_ARROW: React.CSSProperties = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 6px center",
};
const USERS_INPUT_CLS  = "w-full h-8 bg-[#F2F3F3] rounded-lg px-2.5 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400";
const USERS_SELECT_CLS = "w-full h-8 bg-[#F2F3F3] rounded-lg pl-2.5 pr-7 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none";

function UserAnalyticsPanel({ users, filtered }: { users: UserRow[]; filtered: UserRow[] }) {
  const total    = users.length;
  const vis      = filtered.length;
  const active   = filtered.filter(u => u.status === "active").length;
  const inactive = vis - active;

  const signupMap: Record<string, number> = {};
  for (const u of filtered) {
    const t = u.signup_type || "unknown";
    signupMap[t] = (signupMap[t] ?? 0) + 1;
  }
  const signupRows = Object.entries(signupMap).sort((a, b) => b[1] - a[1]);
  const maxSignup  = signupRows[0]?.[1] ?? 1;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-3 border-t border-[#F0F1F1]">
      {/* Quick stats */}
      <div>
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide mb-2">Quick Stats</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Total",    value: total },
            { label: "Visible",  value: vis },
            { label: "Active",   value: active },
            { label: "Inactive", value: inactive },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-[#F8F9F9] border border-[#F0F1F1] px-2.5 py-2">
              <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
              <p className="text-base font-black text-[#1A2E2E] leading-tight">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Signup type breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide">By Signup Type</p>
        <div className="flex flex-col gap-1.5">
          {signupRows.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold w-16 flex-shrink-0 capitalize text-[#2E4A4A]">{type}</span>
              <div className="flex-1 h-2.5 bg-[#F0F1F1] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxSignup) * 100}%`, background: "linear-gradient(90deg, #059669, #10b981)" }} />
              </div>
              <span className="text-[10px] text-[#9CA3AF] w-5 text-right flex-shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide">Status</p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: "Active",   count: active,   color: "#059669" },
            { label: "Inactive", count: inactive, color: "#9CA3AF" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold w-14 flex-shrink-0" style={{ color }}>{label}</span>
              <div className="flex-1 h-2.5 bg-[#F0F1F1] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: vis ? `${(count / vis) * 100}%` : "0%", backgroundColor: color }} />
              </div>
              <span className="text-[10px] text-[#9CA3AF] w-5 text-right flex-shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const USER_COLS = [
  { label: "User",          sortKey: "first_name" },
  { label: "Email",         sortKey: "email" },
  { label: "Home Location", sortKey: "home_city" },
  { label: "Signup",        sortKey: "signup_type" },
  { label: "Status",        sortKey: "status" },
  { label: "Last Login",    sortKey: "last_login" },
];

function UserSortableHeader({
  children,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: string | null;
  currentKey: string | null;
  currentDir: "asc" | "desc";
  onSort: (k: string) => void;
}) {
  const active = sortKey != null && currentKey === sortKey;
  return (
    <button
      onClick={() => sortKey && onSort(sortKey)}
      disabled={!sortKey}
      className={cn(
        "flex items-center gap-1 text-left text-[10px] uppercase tracking-wide transition-all self-stretch w-full",
        sortKey ? "cursor-pointer hover:text-[#2E4A4A]" : "cursor-default",
        active
          ? "font-extrabold text-emerald-700 bg-emerald-50 px-1.5 rounded-sm"
          : "font-semibold text-[#9CA3AF] py-2.5",
      )}
    >
      {children}
      {active && (
        <span>
          <HugeiconsIcon
            icon={currentDir === "asc" ? ArrowUp01Icon : ArrowDown01Icon}
            size={10}
            color="currentColor"
            strokeWidth={2}
          />
        </span>
      )}
    </button>
  );
}

function UsersView() {
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(0);

  // Quick filters
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterSignup, setFilterSignup]   = useState("");

  // Advanced ("More") filters
  const [filterHomeAirport, setFilterHomeAirport]       = useState("");
  const [filterHomeCity, setFilterHomeCity]             = useState("");
  const [filterOnboarding, setFilterOnboarding]         = useState("");
  const [filterDiscoverable, setFilterDiscoverable]     = useState("");

  // Toolbar panels
  const [advancedOpen, setAdvancedOpen]   = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Column-header sort (click-to-sort, 3rd click clears)
  const [colSortKey, setColSortKey]               = useState<string | null>(null);
  const [colSortDir, setColSortDir]               = useState<"asc" | "desc">("desc");
  const [colSortClickCount, setColSortClickCount] = useState(0);

  const handleColSort = (k: string) => {
    if (colSortKey === k) {
      if (colSortClickCount >= 2) {
        setColSortKey(null);
        setColSortDir("desc");
        setColSortClickCount(0);
      } else {
        setColSortDir(d => d === "asc" ? "desc" : "asc");
        setColSortClickCount(c => c + 1);
      }
    } else {
      setColSortKey(k);
      setColSortDir("desc");
      setColSortClickCount(1);
    }
  };

  const loadUsers = useCallback(async () => {
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
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = useMemo(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        [u.email, u.first_name, u.last_name, u.username, u.display_name]
          .some((v) => v?.toLowerCase().includes(q))
      );
    }
    if (filterStatus)  result = result.filter((u) => u.status === filterStatus);
    if (filterSignup)  result = result.filter((u) => u.signup_type === filterSignup);
    if (filterHomeAirport.trim()) {
      const q = filterHomeAirport.trim().toLowerCase();
      result = result.filter((u) => u.home_airport?.toLowerCase().includes(q));
    }
    if (filterHomeCity.trim()) {
      const q = filterHomeCity.trim().toLowerCase();
      result = result.filter((u) =>
        (u.home_city ?? u.locations?.city ?? "").toLowerCase().includes(q)
      );
    }
    if (filterOnboarding === "yes") result = result.filter((u) => u.onboarding_complete === "yes");
    if (filterOnboarding === "no")  result = result.filter((u) => u.onboarding_complete !== "yes");
    if (filterDiscoverable === "yes") result = result.filter((u) => u.is_discoverable === true);
    if (filterDiscoverable === "no")  result = result.filter((u) => u.is_discoverable === false);
    return result;
  }, [users, search, filterStatus, filterSignup, filterHomeAirport, filterHomeCity, filterOnboarding, filterDiscoverable]);

  const sortedFiltered = useMemo(() => {
    if (!colSortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[colSortKey] ?? "").toLowerCase();
      const bv = String((b as unknown as Record<string, unknown>)[colSortKey] ?? "").toLowerCase();
      if (av < bv) return colSortDir === "asc" ? -1 : 1;
      if (av > bv) return colSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, colSortKey, colSortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageRows   = sortedFiltered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const hasFilters = !!(search || filterStatus || filterSignup || filterHomeAirport || filterHomeCity || filterOnboarding || filterDiscoverable);
  const advancedFilterCount = [filterHomeAirport, filterHomeCity, filterOnboarding, filterDiscoverable].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setFilterStatus("");
    setFilterSignup("");
    setFilterHomeAirport("");
    setFilterHomeCity("");
    setFilterOnboarding("");
    setFilterDiscoverable("");
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="rounded-2xl px-4 py-3 flex flex-col gap-3" style={CARD_STYLE}>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9 flex-1 min-w-[180px] max-w-md">
              <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search users..."
                className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#6B7B7B]">
                  <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Status quick filter */}
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              aria-label="Filter by status"
              className="h-9 bg-[#F2F3F3] rounded-xl pl-2.5 pr-7 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none"
              style={USERS_DROPDOWN_ARROW}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Signup type quick filter */}
            <select
              value={filterSignup}
              onChange={(e) => { setFilterSignup(e.target.value); setPage(0); }}
              aria-label="Filter by signup type"
              className="h-9 bg-[#F2F3F3] rounded-xl pl-2.5 pr-7 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none"
              style={USERS_DROPDOWN_ARROW}
            >
              <option value="">All Signup Types</option>
              <option value="google">Google</option>
              <option value="email">Email</option>
              <option value="apple">Apple</option>
            </select>

            {/* More filters */}
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-xl text-xs font-semibold transition-colors",
                advancedFilterCount > 0
                  ? "bg-[#345C5A] text-white"
                  : advancedOpen
                  ? "bg-[#F2F3F3] text-emerald-600"
                  : "text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]",
              )}
            >
              <HugeiconsIcon icon={FilterMailSquareIcon} size={15} color="currentColor" strokeWidth={2} />
              <span>More</span>
              {advancedFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-[#345C5A] text-[9px] font-bold flex items-center justify-center leading-none">
                  {advancedFilterCount}
                </span>
              )}
            </button>

            <div className="flex-1" />

            {/* Analytics toggle */}
            <button
              onClick={() => setAnalyticsOpen(v => !v)}
              aria-label="Toggle analytics"
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-xl transition-colors",
                analyticsOpen ? "bg-emerald-50 text-emerald-600" : "text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]",
              )}
            >
              <HugeiconsIcon icon={Analytics01Icon} size={16} color="currentColor" strokeWidth={2} />
            </button>

            {/* Refresh */}
            <button
              onClick={loadUsers}
              disabled={loading}
              aria-label="Refresh"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors disabled:opacity-40"
            >
              <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} color="currentColor" strokeWidth={2} />
            </button>

            {/* Count */}
            <span className="text-xs font-semibold text-[#6B7B7B] flex-shrink-0">
              {sortedFiltered.length.toLocaleString()} {hasFilters ? "matching" : "total"}
            </span>
          </div>

          {/* Analytics panel */}
          {analyticsOpen && (
            <UserAnalyticsPanel users={users} filtered={filtered} />
          )}
        </div>

        {/* Advanced filters panel */}
        {advancedOpen && (
          <div className="rounded-2xl px-5 py-4 flex flex-col gap-4" style={CARD_STYLE}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#6B7B7B] uppercase tracking-wide">More Filters</p>
              <button onClick={clearFilters} className="text-[10px] font-semibold text-[#9CA3AF] hover:text-rose-500 transition-colors">
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Home Airport</label>
                <input
                  type="text"
                  value={filterHomeAirport}
                  onChange={(e) => { setFilterHomeAirport(e.target.value.toUpperCase().slice(0, 4)); setPage(0); }}
                  placeholder="ATL"
                  className={USERS_INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Home City</label>
                <input
                  type="text"
                  value={filterHomeCity}
                  onChange={(e) => { setFilterHomeCity(e.target.value); setPage(0); }}
                  placeholder="Atlanta"
                  className={USERS_INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Onboarding</label>
                <select
                  value={filterOnboarding}
                  onChange={(e) => { setFilterOnboarding(e.target.value); setPage(0); }}
                  className={USERS_SELECT_CLS}
                  style={USERS_DROPDOWN_ARROW}
                >
                  <option value="">All</option>
                  <option value="yes">Complete</option>
                  <option value="no">Incomplete</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Discoverable</label>
                <select
                  value={filterDiscoverable}
                  onChange={(e) => { setFilterDiscoverable(e.target.value); setPage(0); }}
                  className={USERS_SELECT_CLS}
                  style={USERS_DROPDOWN_ARROW}
                >
                  <option value="">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden p-3" style={CARD_STYLE}>
        {/* Header */}
        <div
          className="px-5 border-b border-[#F0F1F1] bg-[#F8F9F9]"
          style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 0.7fr 0.7fr 0.9fr", gap: "12px", alignItems: "stretch" }}
        >
          {USER_COLS.map((col, idx) => (
            <div key={col.label} className="relative flex items-stretch">
              <UserSortableHeader
                sortKey={col.sortKey}
                currentKey={colSortKey}
                currentDir={colSortDir}
                onSort={handleColSort}
              >
                {col.label}
              </UserSortableHeader>
              {idx < USER_COLS.length - 1 && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-px bg-[#E5E7EB]" />
              )}
            </div>
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
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit bg-slate-100 text-slate-600 border-slate-200 capitalize">
                  {u.signup_type || "—"}
                </span>
                {/* Status */}
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit",
                  u.status === "active"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-gray-100 text-gray-500 border-gray-200"
                )}>
                  {u.status ?? "—"}
                </span>
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

// ── Flights View ── (extracted to src/components/admin/flights/FlightsView.tsx)


// ── Data View ─────────────────────────────────────────────────────────────────

interface TableEntry {
  name: string;
  views?: string[];
}

interface ColumnInfo { name: string; type: string; length: number | null; }
function c(name: string, type: string, length?: number): ColumnInfo {
  return { name, type, length: length ?? null };
}

const COLUMN_MAP: Record<string, ColumnInfo[]> = {
  // Users
  users: [
    c("id","uuid"), c("email","text"), c("first_name","text"), c("last_name","text"),
    c("username","text"), c("dob","date"), c("image_file","text"), c("home_location_id","uuid"),
    c("bio","text"), c("onboarding_complete","bool"), c("auth_user_id","uuid"),
    c("mobile_number","text"), c("display_name","text"), c("avatar_url","text"),
    c("home_city","text"), c("home_airport","varchar",3), c("is_discoverable","bool"),
    c("status","text"), c("signup_type","text"), c("last_login","timestamptz"),
  ],
  user_public_profiles: [
    c("auth_user_id","uuid"), c("username","text"), c("display_name","text"),
    c("first_name","text"), c("last_name","text"), c("avatar_url","text"),
    c("home_city","text"), c("home_airport","varchar",3), c("is_discoverable","bool"),
  ],
  user_settings: [
    c("user_id","uuid"), c("notifications_enabled","bool"), c("notify_gowild_availability","bool"),
    c("notify_new_routes","bool"), c("notify_pass_sales","bool"), c("notify_new_features","bool"),
    c("theme_preference","text"), c("created_at","timestamptz"), c("updated_at","timestamptz"),
    c("default_departure_to_home","bool"), c("allow_friend_requests","bool"),
    c("show_home_city_to_friends","bool"), c("show_upcoming_trips_to_friends","bool"),
    c("show_activity_feed_to_friends","bool"), c("show_trip_overlap_alerts","bool"),
  ],
  user_locations: [
    c("id","uuid"), c("user_id","uuid"), c("location_id","uuid"), c("created_at","timestamptz"),
  ],
  user_homepage: [
    c("id","uuid"), c("user_id","uuid"), c("component_name","text"),
    c("order","int4"), c("status","text"), c("created_at","timestamptz"), c("updated_at","timestamptz"),
  ],
  user_flights: [
    c("id","uuid"), c("user_id","uuid"), c("flight_key","text"), c("provider","text"),
    c("provider_offer_id","text"), c("origin_iata","varchar",3), c("destination_iata","varchar",3),
    c("start_time","timestamptz"), c("end_time","timestamptz"), c("trip_type","text"),
    c("airline","text"), c("flight_number","text"), c("stops","int4"), c("duration_minutes","int4"),
    c("price_total","float8"), c("currency","varchar",3), c("gowild_eligible","bool"),
    c("nonstop","bool"), c("cabin_class","text"), c("seats_remaining","int4"),
    c("saved_at","timestamptz"), c("snapshot_json","jsonb"), c("snapshot_updated_at","timestamptz"),
  ],
  user_events: [
    c("id","uuid"), c("user_id","uuid"), c("edmtrain_event_id","text"),
    c("start_time","timestamptz"), c("end_time","timestamptz"),
    c("saved_at","timestamptz"), c("snapshot_json","jsonb"),
  ],
  user_credit_wallet: [
    c("user_id","uuid"), c("monthly_used","int4"), c("monthly_period_start","timestamptz"),
    c("monthly_period_end","timestamptz"), c("purchased_balance","int4"), c("updated_at","timestamptz"),
  ],
  user_favorite_artists: [c("user_id","uuid"), c("artist_id","int4")],
  user_favorite_genres:  [c("user_id","uuid"), c("genre_id","uuid")],
  user_favorite_locations: [c("user_id","uuid"), c("location_id","uuid")],
  user_subscriptions: [
    c("user_id","uuid"), c("plan_id","uuid"), c("status","text"),
    c("stripe_customer_id","text"), c("stripe_subscription_id","text"), c("stripe_price_id","text"),
    c("current_period_start","timestamptz"), c("current_period_end","timestamptz"),
    c("updated_at","timestamptz"), c("cancel_at_period_end","bool"),
  ],
  // Flights
  flight_searches: [
    c("id","uuid"), c("user_id","uuid"), c("search_timestamp","timestamptz"),
    c("departure_airport","varchar",3), c("arrival_airport","varchar",3),
    c("departure_date","date"), c("return_date","date"), c("trip_type","text"),
    c("all_destinations","bool"), c("json_body","jsonb"), c("request_body","jsonb"),
    c("gowild_found","bool"), c("flight_results_count","int4"), c("triggered_by","text"),
  ],
  flight_search_cache: [
    c("id","uuid"), c("cache_key","text"), c("reset_bucket","text"),
    c("canonical_request","text"), c("provider","text"), c("status","text"),
    c("payload","jsonb"), c("error","text"), c("created_at","timestamptz"), c("updated_at","timestamptz"),
  ],
  gowild_snapshots: [
    c("id","uuid"), c("observed_at","timestamptz"), c("observed_date","date"),
    c("origin_iata","varchar",3), c("destination_iata","varchar",3), c("travel_date","date"),
    c("total_flights","int4"), c("gowild_flights","int4"), c("nonstop_total","int4"),
    c("nonstop_gowild","int4"), c("gowild_avalseats","int4"),
    c("min_gowild_fare","float8"), c("min_fare","float8"), c("raw_response","jsonb"),
  ],
  route_favorites: [
    c("id","uuid"), c("user_id","uuid"), c("origin_iata","varchar",3),
    c("dest_iata","varchar",3), c("created_at","timestamptz"),
  ],
  // Social
  friends: [
    c("id","uuid"), c("user_id","uuid"), c("friend_user_id","uuid"),
    c("created_at","timestamptz"), c("source_request_id","uuid"),
  ],
  friends_with_profiles: [
    c("user_id","uuid"), c("friend_user_id","uuid"), c("username","text"),
    c("display_name","text"), c("avatar_url","text"),
    c("home_city","text"), c("home_airport","varchar",3),
  ],
  friend_requests: [
    c("id","uuid"), c("requester_user_id","uuid"), c("recipient_user_id","uuid"),
    c("status","text"), c("created_at","timestamptz"), c("responded_at","timestamptz"),
  ],
  pending_friend_requests: [
    c("id","uuid"), c("requester_user_id","uuid"), c("recipient_user_id","uuid"),
    c("requester_username","text"), c("requester_avatar","text"), c("created_at","timestamptz"),
  ],
  notifications: [
    c("id","uuid"), c("user_id","uuid"), c("type","text"), c("title","text"),
    c("body","text"), c("data","jsonb"), c("is_read","bool"), c("created_at","timestamptz"),
  ],
  trip_shares: [
    c("id","uuid"), c("user_flight_id","uuid"), c("owner_user_id","uuid"),
    c("shared_with_user_id","uuid"), c("status","text"), c("created_at","timestamptz"),
  ],
  // Content
  artists: [
    c("id","int4"), c("display_name","text"), c("edmtrain_id","int4"),
    c("normalized_name","text"), c("genres","text[]"), c("image_url","text"), c("spotify_id","text"),
  ],
  artist_genres: [c("artist_id","int4"), c("genre_id","uuid")],
  genres: [
    c("id","uuid"), c("genre_name","text"), c("parent_genre","text"),
    c("energy","float8"), c("mood_tags","text[]"),
  ],
  announcements: [
    c("id","uuid"), c("title","text"), c("body","text"), c("cta_label","text"),
    c("cta_url","text"), c("image_url","text"), c("audience","text"), c("priority","int4"),
    c("is_published","bool"), c("publish_at","timestamptz"), c("expires_at","timestamptz"),
    c("created_by","uuid"), c("created_at","timestamptz"),
  ],
  announcement_views: [
    c("id","uuid"), c("announcement_id","uuid"), c("user_id","uuid"),
    c("seen_at","timestamptz"), c("dismissed_at","timestamptz"),
  ],
  // Credits
  credit_packs: [
    c("id","uuid"), c("name","text"), c("credits_amount","int4"), c("stripe_price_id","text"),
    c("price_usd","float8"), c("is_active","bool"), c("display_order","int4"), c("created_at","timestamptz"),
  ],
  credit_transactions: [
    c("id","uuid"), c("user_id","uuid"), c("transaction_type","text"), c("source_type","text"),
    c("source_id","text"), c("amount","int4"), c("bucket","text"),
    c("balance_before","int4"), c("balance_after","int4"),
    c("metadata","jsonb"), c("created_at","timestamptz"),
  ],
  // Beta
  beta_applications: [
    c("id","uuid"), c("full_name","text"), c("email","text"), c("home_airport","varchar",3),
    c("gowild_status","text"), c("gowild_pass_duration","text"),
    c("gowild_search_frequency","text"), c("frontier_flight_frequency","text"),
    c("uses_gowild_search_tool","text"), c("gowild_search_tool_name","text"),
    c("beta_testing_experience","text"), c("beta_testing_details","text"),
    c("feedback_commitment","bool"), c("primary_device","text"),
    c("preferred_feedback_method","text"), c("frequent_destinations","text"),
    c("interested_features","text[]"), c("value_expectation","text"),
    c("additional_notes","text"), c("source","text"), c("utm_source","text"),
    c("utm_medium","text"), c("utm_campaign","text"), c("referrer","text"),
    c("status","text"), c("internal_notes","text"), c("selected_at","timestamptz"),
    c("invited_at","timestamptz"), c("created_at","timestamptz"), c("updated_at","timestamptz"),
  ],
  // System
  app_config: [
    c("id","uuid"), c("user_id","uuid"), c("config_key","text"),
    c("config_value","jsonb"), c("created_at","timestamptz"), c("updated_at","timestamptz"),
  ],
  developer_allowlist: [c("user_id","uuid")],
  developer_settings: [
    c("user_id","uuid"), c("debug_enabled","bool"), c("show_raw_payload","bool"),
    c("log_level","text"), c("flags","jsonb"), c("created_at","timestamptz"),
    c("updated_at","timestamptz"), c("enabled_debug_components","text[]"),
    c("logging_enabled","bool"), c("enabled_component_logging","text[]"),
  ],
  locations: [
    c("id","uuid"), c("name","text"), c("city","text"), c("state","text"),
    c("state_code","varchar",2), c("region","text"), c("country","text"),
    c("latitude","float8"), c("longitude","float8"), c("edmtrain_locationid","int4"),
  ],
  airports: [
    c("id","uuid"), c("name","text"), c("iata_code","varchar",3), c("icao_code","varchar",4),
    c("latitude","float8"), c("longitude","float8"), c("timezone","text"),
    c("location_id","uuid"), c("is_hub","bool"),
  ],
  plans: [
    c("id","uuid"), c("name","text"), c("monthly_allowance_credits","int4"),
    c("features","jsonb"), c("created_at","timestamptz"),
  ],
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
    label: "Beta",
    icon: Notebook01Icon,
    tables: [
      { name: "beta_applications" },
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



function formatSQLQuery(sql: string): string {
  const BREAK_BEFORE = /\b(FROM|WHERE|(?:(?:LEFT|RIGHT|INNER|OUTER|CROSS)\s+)?JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|UNION(?:\s+ALL)?|ON|SET|VALUES)\b/gi;
  const KEYWORDS = /\b(SELECT|DISTINCT|FROM|WHERE|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|AS|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|UNION|ALL|INSERT\s+INTO|UPDATE|DELETE\s+FROM|SET|VALUES|RETURNING|WITH|CASE|WHEN|THEN|ELSE|END|ASC|DESC)\b/gi;
  return sql
    .trim()
    .replace(/\s+/g, " ")
    .replace(KEYWORDS, (m) => m.toUpperCase())
    .replace(BREAK_BEFORE, "\n$1")
    .trim();
}

function DataView() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(TABLE_GROUPS.map((g) => [g.label, true]))
  );
  const [selected, setSelected]   = useState<string | null>(null);
  const [rows, setRows]           = useState<Record<string, unknown>[]>([]);
  const [loadingRows, setLoading] = useState(false);
  const [jsonPopup, setJsonPopup] = useState<{ col: string; val: unknown } | null>(null);

  const [fieldsOpen, setFieldsOpen] = useState<Record<string, boolean>>({});

  // SQL editor state
  const [sqlOpen, setSqlOpen]     = useState(false);
  const [sqlText, setSqlText]     = useState("");
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlResult, setSqlResult] = useState<{ rows: Record<string, unknown>[]; cols: string[]; ms: number } | null>(null);
  const [sqlError, setSqlError]   = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);
  const sqlAbortRef               = useRef(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef                   = useRef<HTMLDivElement>(null);

  const runSql = useCallback(async () => {
    if (!sqlText.trim() || sqlRunning) return;
    sqlAbortRef.current = false;
    setSqlRunning(true);
    setSqlError(null);
    setSqlResult(null);
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.rpc("exec_sql", { query: sqlText.trim() });
      if (sqlAbortRef.current) return;
      if (error) throw error;
      const resultRows: Record<string, unknown>[] = Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : [];
      const cols = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];
      const ms = Math.round(performance.now() - t0);
      setSqlResult({ rows: resultRows, cols, ms });
    } catch (err: any) {
      if (!sqlAbortRef.current) {
        const msg: string = err?.message ?? "Query failed";
        const isTimeout = /timeout|canceling/i.test(msg);
        if (isTimeout) {
          const tableMatch = sqlText.match(/\bfrom\s+(\w+)/i);
          const tableName = tableMatch?.[1] ?? null;
          const tableFields = tableName ? (COLUMN_MAP[tableName] ?? []) : [];
          const heavyCols = tableFields.filter(f => f.type === "jsonb").map(f => f.name);
          const lightCols = tableFields.filter(f => f.type !== "jsonb").map(f => f.name);
          const suggestion = heavyCols.length > 0 && lightCols.length > 0
            ? `\n\nSELECT * included ${heavyCols.map(c => `"${c}"`).join(", ")} (jsonb — highlighted amber in the field panel). Try:\nSELECT ${lightCols.join(", ")}\nFROM ${tableName}\nLIMIT 1000`
            : "\n\nTry reducing the row count or selecting specific columns.";
          setSqlError(msg + suggestion);
        } else {
          setSqlError(msg);
        }
      }
    } finally {
      if (!sqlAbortRef.current) setSqlRunning(false);
    }
  }, [sqlText, sqlRunning]);

  const stopSql = useCallback(() => {
    sqlAbortRef.current = true;
    setSqlRunning(false);
  }, []);

  const copySql = useCallback(async () => {
    await navigator.clipboard.writeText(sqlText);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 1500);
  }, [sqlText]);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  const columns = selected ? (COLUMN_MAP[selected] ?? []) : [];

  const getExportData = useCallback((): { rows: Record<string, unknown>[]; cols: string[]; name: string } | null => {
    if (sqlResult && sqlResult.rows.length > 0) {
      return { rows: sqlResult.rows, cols: sqlResult.cols, name: "query_result" };
    }
    if (selected && rows.length > 0) {
      const cols = columns.map((c) => c.name);
      return { rows, cols, name: selected };
    }
    return null;
  }, [sqlResult, selected, rows, columns]);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsXLSX = useCallback(() => {
    const d = getExportData();
    if (!d) return;
    const ws = XLSX.utils.json_to_sheet(d.rows, { header: d.cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, d.name.slice(0, 31));
    XLSX.writeFile(wb, `${d.name}.xlsx`);
    setExportOpen(false);
  }, [getExportData]);

  const exportAsCSV = useCallback(() => {
    const d = getExportData();
    if (!d) return;
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [d.cols.join(","), ...d.rows.map((r) => d.cols.map((c) => esc(r[c])).join(","))];
    triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `${d.name}.csv`);
    setExportOpen(false);
  }, [getExportData]);

  const exportAsJSON = useCallback(() => {
    const d = getExportData();
    if (!d) return;
    triggerDownload(new Blob([JSON.stringify(d.rows, null, 2)], { type: "application/json" }), `${d.name}.json`);
    setExportOpen(false);
  }, [getExportData]);

  const exportAsSQLInsert = useCallback(() => {
    const d = getExportData();
    if (!d) return;
    const fmtVal = (v: unknown): string => {
      if (v == null) return "NULL";
      if (typeof v === "number" || typeof v === "bigint") return String(v);
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      return `'${String(v).replace(/'/g, "''")}'`;
    };
    const colList = d.cols.map((c) => `"${c}"`).join(", ");
    const stmts = d.rows.map(
      (r) => `INSERT INTO "${d.name}" (${colList}) VALUES (${d.cols.map((c) => fmtVal(r[c])).join(", ")});`,
    );
    triggerDownload(new Blob([stmts.join("\n")], { type: "text/plain;charset=utf-8;" }), `${d.name}_inserts.sql`);
    setExportOpen(false);
  }, [getExportData]);

  const toggle = (label: string) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  const toggleFieldsPanel = (name: string) =>
    setFieldsOpen((prev) => ({ ...prev, [name]: !prev[name] }));

  useEffect(() => {
    if (!selected) return;
    setRows([]);
    setLoading(true);
    supabase
      .from(selected as never)
      .select("*")
      .limit(200)
      .then(({ data }) => {
        setRows((data as Record<string, unknown>[]) ?? []);
        setLoading(false);
      });
  }, [selected]);

  return (
    <div className="flex flex-row gap-4 items-start">
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
                      {group.tables.map((table) => {
                        const isSelected = selected === table.name;
                        const isFieldsOpen = fieldsOpen[table.name] ?? false;
                        const fields = COLUMN_MAP[table.name] ?? [];
                        return (
                          <div key={table.name}>
                            <div
                              className={cn(
                                "group flex items-center gap-1 py-1 px-2 rounded-lg transition-colors",
                                isSelected ? "bg-[#F0FDF4]" : "hover:bg-[#F2F3F3]",
                              )}
                            >
                              <button
                                onClick={() => setSelected(table.name)}
                                className="flex items-center gap-2 min-w-0 text-left"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? "bg-[#059669]" : "bg-[#10B981]"}`} />
                                <span className="text-xs font-mono truncate text-[#2E4A4A]">{table.name}</span>
                              </button>
                              {fields.length > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFieldsPanel(table.name); }}
                                  title="Show fields"
                                  className={cn(
                                    "h-5 px-1 flex items-center justify-center rounded transition-all flex-shrink-0",
                                    isFieldsOpen
                                      ? "opacity-100 text-[#059669]"
                                      : "opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-[#059669]",
                                  )}
                                >
                                  <span className="text-[9px] font-semibold whitespace-nowrap">{isFieldsOpen ? "Hide Fields" : "Show Fields"}</span>
                                </button>
                              )}
                            </div>
                            {isFieldsOpen && fields.length > 0 && (
                              <div className="ml-5 mt-0.5 mb-1 rounded-lg overflow-hidden bg-[#F8F9F9] border border-[#F0F1F1]">
                                {/* Header */}
                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 px-2.5 py-1 border-b border-[#E8EEEE] bg-[#F0F1F1]">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">Name</span>
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">Type</span>
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] text-right">Len</span>
                                </div>
                                {fields.map((field, i) => (
                                  <div
                                    key={field.name}
                                    className={cn(
                                      "grid grid-cols-[1fr_auto_auto] gap-x-2 px-2.5 py-0.5 text-[10px] font-mono",
                                      i < fields.length - 1 && "border-b border-[#F0F1F1]",
                                    )}
                                  >
                                    <span className="text-[#2E4A4A] truncate">{field.name}</span>
                                    <span className={field.type === "jsonb" ? "text-amber-500 font-bold" : "text-[#059669]"}>{field.type}</span>
                                    <span className="text-[#9CA3AF] text-right">{field.length ?? "—"}</span>
                                  </div>
                                ))}
                              </div>
                            )}
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
                        );
                      })}
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
        <div className="rounded-2xl overflow-hidden p-5" style={CARD_STYLE}>

          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Records</p>
            <button
              onClick={() => { setSqlOpen((v) => !v); setSqlResult(null); setSqlError(null); }}
              className={cn(
                "text-xs font-semibold uppercase tracking-wide transition-colors",
                sqlOpen ? "text-[#059669]" : "text-[#9CA3AF] hover:text-[#059669]",
              )}
            >
              SQL Query
            </button>
          </div>

          {/* SQL Editor */}
          {sqlOpen && (
            <div className="mb-4 rounded-xl border border-[#E8EBEB] overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[#F8F9F9] border-b border-[#E8EBEB]">
                {/* Run */}
                <button
                  onClick={runSql}
                  disabled={!sqlText.trim() || sqlRunning}
                  title="Run (⌘ Enter)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  <HugeiconsIcon icon={PlayIcon} size={11} color="white" strokeWidth={2.5} />
                  Run
                </button>
                {/* Stop */}
                <button
                  onClick={stopSql}
                  disabled={!sqlRunning}
                  title="Stop"
                  className="flex items-center justify-center w-7 h-7 rounded-md text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <HugeiconsIcon icon={StopIcon} size={13} color="currentColor" strokeWidth={2.5} />
                </button>
                <div className="w-px h-4 bg-[#E8EBEB] mx-1" />
                {/* Format */}
                <button
                  onClick={() => setSqlText(formatSQLQuery(sqlText))}
                  title="Format SQL"
                  className="flex items-center justify-center w-7 h-7 rounded-md text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors"
                >
                  <HugeiconsIcon icon={SourceCodeSquareIcon} size={13} color="currentColor" strokeWidth={2} />
                </button>
                {/* Clear */}
                <button
                  onClick={() => { setSqlText(""); setSqlResult(null); setSqlError(null); }}
                  title="Clear editor"
                  className="flex items-center justify-center w-7 h-7 rounded-md text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors"
                >
                  <HugeiconsIcon icon={Delete01Icon} size={13} color="currentColor" strokeWidth={2} />
                </button>
                <div className="w-px h-4 bg-[#E8EBEB] mx-1" />
                {/* Copy */}
                <button
                  onClick={copySql}
                  title={sqlCopied ? "Copied!" : "Copy query"}
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
                    sqlCopied ? "text-[#059669]" : "text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]",
                  )}
                >
                  <HugeiconsIcon icon={Copy01Icon} size={13} color="currentColor" strokeWidth={2} />
                </button>
                <div className="w-px h-4 bg-[#E8EBEB] mx-1" />
                {/* Export */}
                <div className="relative" ref={exportRef}>
                  <button
                    onClick={() => setExportOpen((v) => !v)}
                    disabled={!getExportData()}
                    title="Export data"
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
                      exportOpen ? "bg-[#F0FDF4] text-[#059669]" : "text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]",
                      !getExportData() && "opacity-30 cursor-not-allowed",
                    )}
                  >
                    <HugeiconsIcon icon={FileExportIcon} size={13} color="currentColor" strokeWidth={2} />
                  </button>
                  {exportOpen && (
                    <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-52 rounded-xl overflow-hidden border border-[#E8EBEB] bg-white" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                      <div className="px-3 py-2 border-b border-[#F0F1F1]">
                        <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Export as…</p>
                      </div>
                      {[
                        { label: "Excel (.xlsx)", desc: "Microsoft Excel workbook", fn: exportAsXLSX },
                        { label: "CSV",           desc: "Comma-separated values",   fn: exportAsCSV },
                        { label: "JSON",          desc: "JSON array of objects",    fn: exportAsJSON },
                        { label: "SQL Insert",    desc: "INSERT INTO statements",   fn: exportAsSQLInsert },
                      ].map(({ label, desc, fn }) => (
                        <button
                          key={label}
                          onClick={fn}
                          className="w-full flex flex-col items-start px-3 py-2.5 hover:bg-[#F8F9F9] transition-colors border-b border-[#F0F1F1] last:border-b-0"
                        >
                          <span className="text-xs font-semibold text-[#1A2E2E]">{label}</span>
                          <span className="text-[11px] text-[#9CA3AF]">{desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Status */}
                <div className="ml-auto flex items-center gap-2 pl-2">
                  {sqlRunning && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Running…
                    </span>
                  )}
                  {sqlResult && !sqlRunning && (
                    <span className="text-[11px] font-medium text-[#059669]">
                      {sqlResult.rows.length} row{sqlResult.rows.length !== 1 ? "s" : ""} · {sqlResult.ms}ms
                    </span>
                  )}
                  {sqlError && !sqlRunning && (
                    <span className="text-[11px] font-medium text-red-500">Error</span>
                  )}
                </div>
              </div>
              {/* Textarea */}
              <textarea
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    runSql();
                  }
                }}
                placeholder={"SELECT *\nFROM users\nLIMIT 10;\n\n-- Avoid SELECT * on tables with jsonb columns (shown amber in field panel)"}
                rows={6}
                className="w-full px-4 py-3 text-xs font-mono text-[#1A2E2E] bg-white resize-y outline-none placeholder:text-[#D1D5DB] leading-relaxed"
                spellCheck={false}
              />
              {/* Error */}
              {sqlError && (
                <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 flex items-start gap-2">
                  <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide shrink-0 mt-0.5">Error</span>
                  <p className="text-xs font-mono text-red-600 whitespace-pre-wrap">{sqlError}</p>
                </div>
              )}
            </div>
          )}

          {/* Meta line */}
          {(selected || sqlResult) && (
            <div className="flex items-center gap-2 px-2 pt-4 pb-1.5 mb-3">
              {sqlResult ? (
                <>
                  <span className="text-xs font-mono font-semibold text-[#2E4A4A] uppercase">Query Result</span>
                  <span className="text-[11px] text-[#9CA3AF]">{sqlResult.rows.length} rows · {sqlResult.ms}ms</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-mono font-semibold text-[#2E4A4A] uppercase">{selected}</span>
                  {!loadingRows && <span className="text-[11px] text-[#9CA3AF]">{rows.length} rows · {columns.length} cols</span>}
                </>
              )}
            </div>
          )}

          {/* Records — SQL result */}
          {sqlResult ? (
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 230px)" }}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#F8F9F9] border-b border-[#F0F1F1]">
                    {sqlResult.cols.map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap font-mono border-r border-[#F0F1F1] last:border-r-0">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F1F1]">
                  {sqlResult.rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(sqlResult.cols.length, 1)} className="px-5 py-8 text-center text-sm text-[#9CA3AF]">
                        No rows returned.
                      </td>
                    </tr>
                  ) : sqlResult.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-[#FAFAFA] transition-colors">
                      {sqlResult.cols.map((col) => {
                        const { text, muted, isJson } = fmtCell(row[col]);
                        return (
                          <td key={col} className="px-4 py-2.5 border-r border-[#F0F1F1] last:border-r-0 whitespace-nowrap max-w-[200px] group/cell relative">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-mono truncate block ${muted ? "text-[#D1D5DB]" : "text-[#1A2E2E]"}`}>{text}</span>
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
            </div>

          ) : selected ? (
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 230px)" }}>
              {loadingRows ? (
                <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Loading…</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#F8F9F9] border-b border-[#F0F1F1]">
                      {columns.map((col) => (
                        <th key={col.name} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap font-mono border-r border-[#F0F1F1] last:border-r-0">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F1F1]">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="px-5 py-8 text-center text-sm text-[#9CA3AF]">No records found.</td>
                      </tr>
                    ) : rows.map((row, i) => (
                      <tr key={i} className="hover:bg-[#FAFAFA] transition-colors">
                        {columns.map((col) => {
                          const { text, muted, isJson } = fmtCell(row[col.name]);
                          return (
                            <td key={col.name} className="px-4 py-2.5 border-r border-[#F0F1F1] last:border-r-0 whitespace-nowrap max-w-[200px] group/cell relative">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-mono truncate block ${muted ? "text-[#D1D5DB]" : "text-[#1A2E2E]"}`}>{text}</span>
                                {isJson && (
                                  <button
                                    onClick={() => setJsonPopup({ col: col.name, val: row[col.name] })}
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
    </div>
  );
}

// ── GoWild Insights View ──────────────────────────────────────────────────────

type GoWildPeriodKey = "24h" | "7d" | "30d" | "all";

const GOWILD_PERIODS: { key: GoWildPeriodKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "24 hours", hours: 24 },
  { key: "7d",  label: "7 days",   hours: 24 * 7 },
  { key: "30d", label: "30 days",  hours: 24 * 30 },
  { key: "all", label: "All time", hours: null },
];

const GOWILD_PAGE_SIZE = 1000;
const GOWILD_HARD_SAFETY_PAGE_LIMIT = 5000;

function GoWildInsightsView() {
  const [snapshots, setSnapshots] = useState<FlightSnapshot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [period, setPeriod]       = useState<GoWildPeriodKey>("7d");
  const { dict: airportDict }     = useAirportDictionary();

  const currentSinceIso = useMemo(() => {
    const p = GOWILD_PERIODS.find((x) => x.key === period)!;
    if (p.hours === null) return null;
    return new Date(Date.now() - p.hours * 3600 * 1000).toISOString();
  }, [period]);

  const sinceIso = useMemo(() => {
    const p = GOWILD_PERIODS.find((x) => x.key === period)!;
    if (p.hours === null) return null;
    return new Date(Date.now() - p.hours * 2 * 3600 * 1000).toISOString();
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSnapshots([]);

    (async () => {
      const all: FlightSnapshot[] = [];
      const seenIds = new Set<string>();
      try {
        let page = 0;
        while (true) {
          if (cancelled) return;
          if (page >= GOWILD_HARD_SAFETY_PAGE_LIMIT) {
            throw new Error(
              `Aborted after ${GOWILD_HARD_SAFETY_PAGE_LIMIT} pages (${all.length} rows). Possible pagination issue — analytics not shown to avoid misleading partial data.`,
            );
          }
          const offset = page * GOWILD_PAGE_SIZE;
          const { data, error: pageError } = await (supabase.rpc as any)(
            "get_global_gowild_insight_snapshots",
            { p_since: sinceIso, p_limit: GOWILD_PAGE_SIZE, p_offset: offset },
          );
          if (cancelled) return;
          if (pageError) {
            throw new Error(
              `Page ${page + 1} failed: ${pageError.message}. Analytics cannot be considered complete.`,
            );
          }
          const rows = (data ?? []) as FlightSnapshot[];
          for (const r of rows) {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              all.push(r);
            }
          }
          if (rows.length < GOWILD_PAGE_SIZE) break;
          page += 1;
        }
        if (cancelled) return;
        setSnapshots(all);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setSnapshots([]);
        setError(e?.message ?? "Unknown error loading snapshots");
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sinceIso, period]);

  const currentSnapshots = useMemo<FlightSnapshot[]>(() => {
    if (!currentSinceIso) return snapshots;
    const cutoff = new Date(currentSinceIso).getTime();
    return snapshots.filter((s) => {
      const t = new Date(s.snapshot_at).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }, [snapshots, currentSinceIso]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs font-medium text-gray-500">Search Last:</span>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as GoWildPeriodKey)}
            className="appearance-none rounded-full bg-white border border-gray-200 pl-3 pr-8 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
          >
            {GOWILD_PERIODS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      <div className="relative min-h-[400px]">
        {loading && <LoadingInsightsOverlay />}

        {error ? (
          <div className="rounded-2xl p-5" style={CARD_STYLE}>
            <p className="text-sm font-medium text-red-500">Failed to load GoWild data</p>
            <p className="text-xs text-[#9CA3AF] mt-1">{error}</p>
          </div>
        ) : !loading && (
          <div className="flex flex-col gap-4">
            <GoWildSnapshotCard itineraries={groupLegsIntoItineraries(snapshots as any)} period={period} />
            <AirportGoWildInsightsSection snapshots={currentSnapshots} airportDict={airportDict} />
            <GoWildRouteAnalyticsSection snapshots={currentSnapshots} airportDict={airportDict} />
            <RouteAvailabilityCalendarCard snapshots={currentSnapshots} />
            <GoWildTimingAnalyticsSection snapshots={currentSnapshots} />
            <SeatAvailabilityIntelligence snapshots={currentSnapshots} airportDict={airportDict} />
          </div>
        )}
      </div>
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

// ── GoWild Insights Loading Overlay ─────────────────────────────────────────────

const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

function SplitFlapWord({ word, green, delay = 0 }: { word: string; green?: boolean; delay?: number }) {
  const [display, setDisplay] = useState<string[]>(Array(word.length).fill(" "));
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const allTimeouts: ReturnType<typeof setTimeout>[] = [];
    const allIntervals: ReturnType<typeof setInterval>[] = [];

    const runCycle = (cycleDelay: number) => {
      word.split("").forEach((finalChar, idx) => {
        const to = setTimeout(
          () => {
            if (!activeRef.current) return;
            let step = 0;
            const steps = 6;
            const iv = setInterval(() => {
              if (!activeRef.current) {
                clearInterval(iv);
                return;
              }
              step++;
              if (step >= steps) {
                clearInterval(iv);
                setDisplay((prev) => {
                  const n = [...prev];
                  n[idx] = finalChar;
                  return n;
                });
              } else {
                const r = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
                setDisplay((prev) => {
                  const n = [...prev];
                  n[idx] = r;
                  return n;
                });
              }
            }, 40);
            allIntervals.push(iv);
          },
          cycleDelay + delay + idx * 55,
        );
        allTimeouts.push(to);
      });
    };

    const cycleLength = word.length * 55 + 600;
    let cycle = 0;
    const schedule = () => {
      if (!activeRef.current) return;
      runCycle(cycle * cycleLength);
      const loopTo = setTimeout(schedule, cycleLength);
      allTimeouts.push(loopTo);
      cycle++;
    };
    schedule();

    return () => {
      activeRef.current = false;
      allTimeouts.forEach(clearTimeout);
      allIntervals.forEach(clearInterval);
    };
  }, []);

  return (
    <div className="flex gap-1">
      {display.map((char, i) => (
        <div
          key={i}
          className="relative flex flex-col items-center justify-center rounded-lg shadow-md border overflow-hidden"
          style={{
            width: 28,
            height: 36,
            background: green ? "linear-gradient(160deg,#6ee7b7 0%,#10B981 100%)" : "#e8eaed",
            borderColor: green ? "#059669" : "#d1d5db",
          }}
        >
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
            style={{ background: green ? "#059669aa" : "#b0b5bdaa" }}
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
            style={{ background: green ? "#d1fae5" : "#e8eaed", borderColor: green ? "#059669" : "#d1d5db" }}
          />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
            style={{ background: green ? "#d1fae5" : "#e8eaed", borderColor: green ? "#059669" : "#d1d5db" }}
          />
          <span
            className="font-black text-base leading-none select-none"
            style={{ color: green ? "#fff" : "#1f2937", letterSpacing: "0.04em" }}
          >
            {char === " " ? "" : char}
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadingInsightsOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#F2F3F3]/95 backdrop-blur-sm rounded-2xl gap-5">
      <SplitFlapWord word="LOADING" delay={0} />
      <SplitFlapWord word="INSIGHTS" green delay={100} />
      <p className="text-sm text-[#6B7B7B] mt-2">Fetching GoWild analytics…</p>
    </div>
  );
}

// ── Developer Tools placeholder views ────────────────────────────────────────

function DeveloperUnauthorizedView() {
  return (
    <DeveloperToolsAdminShell
      title="Developer Tools"
      description="Restricted access"
      error="Your account is not on the developer allowlist. Contact an admin to request access."
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const VIEW_HEADERS: Record<View, { prefix: string; label: string }> = {
  dashboard:          { prefix: "Admin",  label: "DASHBOARD" },
  users:              { prefix: "Admin",  label: "USERS" },
  flights:            { prefix: "Admin",  label: "FLIGHTS" },
  data:               { prefix: "Developer", label: "DATA" },
  gowild:             { prefix: "GoWild", label: "INSIGHTS" },
  radar:              { prefix: "GoWild", label: "RADAR" },
  "beta-applications":         { prefix: "Beta",      label: "APPLICATIONS" },
  "developer-design-system":   { prefix: "Developer", label: "DESIGN SYSTEM" },
  "developer-debug":           { prefix: "Developer", label: "DEBUG SETTINGS" },
  "developer-sql-cache":       { prefix: "Developer", label: "SQL / CACHE TOOLS" },
  "developer-token":           { prefix: "Developer", label: "GOWILD TOKEN" },
  "developer-logging":            { prefix: "Developer",      label: "LOGGING SETTINGS" },
  "auth-developer-allowlist":    { prefix: "Auth & Access", label: "DEVELOPER ALLOWLIST" },
  "system-reporting":                    { prefix: "Operations",     label: "REPORTING" },
  "system-scheduled-jobs":              { prefix: "Operations",     label: "SYSTEM JOBS" },
  "auth-signup-controls":               { prefix: "Auth & Access",  label: "SIGNUP CONTROLS" },
  "communications-messaging":            { prefix: "Communications", label: "MESSAGING" },
  "communications-notifications":       { prefix: "Communications", label: "NOTIFICATIONS" },
};

const DRAWER_WIDTH_PCT = 80;
const DRAWER_MAX_PX = 320;

export default function AdminConsole() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read a deep-link view from ?view= on first render so callers can land on a
  // specific section (e.g. /admin/console?view=developer-debug).
  const _paramView = searchParams.get("view") as View | null;
  const _initialView: View = (_paramView && _paramView in VIEW_HEADERS) ? _paramView : "dashboard";

  const [view, setView]               = useState<View>(_initialView);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [gowildLoading, setGowildLoading] = useState(false);
  const _initialOpenGroup =
    _initialView === "users" || _initialView === "beta-applications" ? "accounts" :
    _initialView === "gowild" || _initialView === "radar" ? "wildfly-tools" :
    _initialView === "data" || (_initialView as string).startsWith("developer-") ? "dev-tools" :
    (_initialView as string).startsWith("auth-") ? "auth-access" :
    (_initialView as string).startsWith("system-") ? "system-process" :
    (_initialView as string).startsWith("communications-") ? "communications" :
    null;
  const [openGroup, setOpenGroup] = useState<string | null>(_initialOpenGroup);
  const toggleGroup = (group: string) => setOpenGroup((prev) => (prev === group ? null : group));
  const accountsExpanded      = openGroup === "accounts";
  const wildflyToolsExpanded  = openGroup === "wildfly-tools";
  const devToolsExpanded      = openGroup === "dev-tools";
  const authAccessExpanded    = openGroup === "auth-access";
  const systemProcessExpanded = openGroup === "system-process";
  const communicationsExpanded = openGroup === "communications";
  const [isDeveloper, setIsDeveloper]           = useState(false);
  const [isDeveloperChecked, setIsDeveloperChecked] = useState(false);
  const [pushingMigrations, setPushingMigrations] = useState(false);

  const handlePushMigrations = useCallback(async () => {
    if (pushingMigrations) return;
    setPushingMigrations(true);
    try {
      const { data: appliedRaw, error: listErr } = await supabase.rpc("list_applied_migrations");
      if (listErr) throw listErr;
      const applied = new Set<string>((appliedRaw as string[] | null) ?? []);
      const pending = LOCAL_MIGRATIONS.filter((m) => !applied.has(m.version));

      if (pending.length === 0) {
        toast({ title: "No pending migrations", description: "Database is up to date." });
        return;
      }

      let applied_count = 0;
      const failures: { version: string; error: string }[] = [];
      for (const mig of pending) {
        const { error } = await supabase.rpc("apply_pending_migration", {
          p_version: mig.version,
          p_name: mig.name,
          p_sql: mig.sql,
        });
        if (error) {
          failures.push({ version: mig.version, error: error.message });
          continue;
        }
        applied_count++;
      }

      if (failures.length === 0) {
        toast({
          title: `Applied ${applied_count} migration${applied_count === 1 ? "" : "s"}`,
          description: pending.map((m) => m.version).join(", "),
        });
      } else {
        toast({
          variant: "destructive",
          title: `Applied ${applied_count}, ${failures.length} failed`,
          description: `${failures[0].version}: ${failures[0].error}`,
        });
        console.error("Migration failures", failures);
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Migration push failed",
        description: (e as Error).message,
      });
    } finally {
      setPushingMigrations(false);
    }
  }, [pushingMigrations]);

  const accountsActive       = view === "users" || view === "beta-applications";
  const wildflyToolsActive   = view === "gowild" || view === "radar";
  const devToolsActive       = view === "data" || (view as string).startsWith("developer-");
  const authAccessActive     = (view as string).startsWith("auth-");
  const systemProcessActive    = (view as string).startsWith("system-");
  const communicationsActive   = (view as string).startsWith("communications-");
  const navigate = useNavigate();

  // Remove the ?view= param from the URL once state is initialised so the
  // address bar stays clean and refreshing doesn't re-trigger the deep-link.
  useEffect(() => {
    if (searchParams.get("view")) {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { avatarUrl, initials: profileInitials, fullName } = useProfile();

  const { prefix, label } = VIEW_HEADERS[view];

  const handleNavClick = (id: View) => {
    setDrawerOpen(false);
    const fire = () => {
      if (id === "gowild") {
        setGowildLoading(true);
        setView("gowild");
        setTimeout(() => setGowildLoading(false), 2200);
      } else {
        setView(id);
      }
    };
    setTimeout(fire, 280);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (user) {
          const { data: dev } = await supabase
            .from("developer_allowlist")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!active) return;
          setIsDeveloper(!!dev);
        }
      } catch {
        // allowlist query error — isDeveloper stays false
      } finally {
        if (active) setIsDeveloperChecked(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <div
      className="relative h-screen overflow-hidden flex"
      style={{ background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
    >
      {/* ── Sidebar drawer panel ── */}
      <div
        className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white"
        style={{
          width: `min(${DRAWER_WIDTH_PCT}%, ${DRAWER_MAX_PX}px)`,
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
        }}
      >
        {/* Profile header */}
        <div className="flex items-center gap-3 px-6 pt-10 pb-2">
          <UIAvatar
            className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => { setDrawerOpen(false); sessionStorage.setItem("adminReturn", "1"); setTimeout(() => navigate("/"), 280); }}
          >
            <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
            <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">
              {profileInitials}
            </AvatarFallback>
          </UIAvatar>
          <div className="flex-1 min-w-0">
            <p className="text-[#9CA3AF] text-sm font-medium">Hello,</p>
            <p className="text-[#2E4A4A] text-lg font-semibold truncate leading-tight">{fullName}</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors"
            type="button"
            aria-label="Close menu"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="currentColor" strokeWidth={1.5} />
          </button>
        </div>

        <div className="h-px bg-[#E5E7EB] mx-6" />

        <div className="flex-1 min-h-0 overflow-y-auto">
        <nav className="px-6 pt-2 pb-6 flex flex-col justify-start gap-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#059669] px-2 pt-3 pb-0.5">
            Console
          </p>
          {/* Dashboard */}
          {NAV_ITEMS.slice(0, 1).map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
                  active ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                )}
              >
                <HugeiconsIcon icon={item.icon} size={20} color="currentColor" strokeWidth={active ? 2 : 1.5} />
                <span className={cn("text-base", active ? "font-extrabold" : "font-semibold")}>{item.label}</span>
              </button>
            );
          })}

          {/* Accounts — expandable group */}
          <button
            type="button"
            onClick={() => toggleGroup("accounts")}
            className={cn(
              "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
              accountsActive ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
            )}
          >
            <HugeiconsIcon
              icon={UserGroupIcon}
              size={20}
              color="currentColor"
              strokeWidth={accountsActive ? 2 : 1.5}
            />
            <span className={cn("text-base flex-1 text-left", accountsActive ? "font-extrabold" : "font-semibold")}>
              Accounts
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              color="currentColor"
              strokeWidth={2}
              style={{
                transform: accountsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          <AnimatePresence initial={false}>
            {accountsExpanded && (
              <motion.div
                key="accounts-children"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="pb-1.5"
                style={{ overflow: "hidden" }}
              >
                {ACCOUNTS_ITEMS.map((item) => {
                  const active = view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-11 transition-colors w-full hover:bg-[#F2F3F3]",
                        active ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                      )}
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        size={18}
                        color="currentColor"
                        strokeWidth={active ? 2 : 1.5}
                      />
                      <span className={cn("text-sm", active ? "font-extrabold" : "font-semibold")}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flights */}
          {NAV_ITEMS.slice(1).map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
                  active ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                )}
              >
                <HugeiconsIcon icon={item.icon} size={20} color="currentColor" strokeWidth={active ? 2 : 1.5} />
                <span className={cn("text-base", active ? "font-extrabold" : "font-semibold")}>{item.label}</span>
              </button>
            );
          })}

          {/* Wildfly Tools — expandable group */}
          <button
            type="button"
            onClick={() => toggleGroup("wildfly-tools")}
            className={cn(
              "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
              wildflyToolsActive ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
            )}
          >
            <HugeiconsIcon
              icon={Analytics01Icon}
              size={20}
              color="currentColor"
              strokeWidth={wildflyToolsActive ? 2 : 1.5}
            />
            <span className={cn("text-base flex-1 text-left", wildflyToolsActive ? "font-extrabold" : "font-semibold")}>
              Wildfly Tools
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              color="currentColor"
              strokeWidth={2}
              style={{
                transform: wildflyToolsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          <AnimatePresence initial={false}>
            {wildflyToolsExpanded && (
              <motion.div
                key="wildfly-tools-children"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="pb-1.5"
                style={{ overflow: "hidden" }}
              >
                {WILDFLY_TOOLS_ITEMS.map((item) => {
                  const active = view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-11 transition-colors w-full hover:bg-[#F2F3F3]",
                        active ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                      )}
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        size={18}
                        color="currentColor"
                        strokeWidth={active ? 2 : 1.5}
                      />
                      <span className={cn("text-sm", active ? "font-extrabold" : "font-semibold")}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Developer Tools expandable section — only shown to developer_allowlist members */}
          {isDeveloper && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#059669] px-2 pt-4 pb-0.5">
                Administration
              </p>
              <button
                type="button"
                onClick={() => toggleGroup("dev-tools")}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
                  devToolsActive ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                )}
              >
                <HugeiconsIcon
                  icon={CodeCircleIcon}
                  size={20}
                  color="currentColor"
                  strokeWidth={devToolsActive ? 2 : 1.5}
                />
                <span className={cn("text-base flex-1 text-left", devToolsActive ? "font-extrabold" : "font-semibold")}>
                  Developer Tools
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={2}
                  style={{
                    transform: devToolsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              <AnimatePresence initial={false}>
                {devToolsExpanded && (
                  <motion.div
                    key="dev-tools-children"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    className="pb-1.5"
                    style={{ overflow: "hidden" }}
                  >
                    {DEV_ITEMS.map((item) => {
                      const active = view === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.id)}
                          className={cn(
                            "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-11 transition-colors w-full hover:bg-[#F2F3F3]",
                            active ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                          )}
                        >
                          <HugeiconsIcon
                            icon={item.icon}
                            size={18}
                            color="currentColor"
                            strokeWidth={active ? 2 : 1.5}
                          />
                          <span className={cn("text-sm", active ? "font-extrabold" : "font-semibold")}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={handlePushMigrations}
                      disabled={pushingMigrations}
                      className="flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-11 transition-colors w-full hover:bg-[#F2F3F3] text-[#2E4A4A] hover:text-[#345C5A] disabled:opacity-60"
                    >
                      <HugeiconsIcon icon={DatabaseAddIcon} size={18} color="currentColor" strokeWidth={1.5} />
                      <span className="text-sm font-semibold">
                        {pushingMigrations ? "Pushing…" : "Push Migrations"}
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Auth & Access — expandable group below Developer Tools */}
              <button
                type="button"
                onClick={() => toggleGroup("auth-access")}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
                  authAccessActive ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                )}
              >
                <HugeiconsIcon
                  icon={ShieldKeyIcon}
                  size={20}
                  color="currentColor"
                  strokeWidth={authAccessActive ? 2 : 1.5}
                />
                <span className={cn("text-base flex-1 text-left", authAccessActive ? "font-extrabold" : "font-semibold")}>
                  Auth & Access
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={2}
                  style={{
                    transform: authAccessExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              <AnimatePresence initial={false}>
                {authAccessExpanded && (
                  <motion.div
                    key="auth-access-children"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    className="pb-1.5"
                    style={{ overflow: "hidden" }}
                  >
                    {AUTH_ACCESS_ITEMS.map((item) => {
                      const active = view === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.id)}
                          className={cn(
                            "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-11 transition-colors w-full hover:bg-[#F2F3F3]",
                            active ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                          )}
                        >
                          <HugeiconsIcon
                            icon={item.icon}
                            size={18}
                            color="currentColor"
                            strokeWidth={active ? 2 : 1.5}
                          />
                          <span className={cn("text-sm", active ? "font-extrabold" : "font-semibold")}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Operations — expandable group below Auth & Access */}
              <button
                type="button"
                onClick={() => toggleGroup("system-process")}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
                  systemProcessActive ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                )}
              >
                <HugeiconsIcon
                  icon={CpuIcon}
                  size={20}
                  color="currentColor"
                  strokeWidth={systemProcessActive ? 2 : 1.5}
                />
                <span className={cn("text-base flex-1 text-left", systemProcessActive ? "font-extrabold" : "font-semibold")}>
                  Operations
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={2}
                  style={{
                    transform: systemProcessExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              <AnimatePresence initial={false}>
                {systemProcessExpanded && (
                  <motion.div
                    key="operations-children"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    className="pb-1.5"
                    style={{ overflow: "hidden" }}
                  >
                    {SYSTEM_PROCESS_ITEMS.map((item) => {
                      const active = view === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={item.disabled}
                          onClick={() => !item.disabled && handleNavClick(item.id as View)}
                          className={cn(
                            "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-11 transition-colors w-full",
                            item.disabled
                              ? "opacity-40 cursor-not-allowed text-[#2E4A4A]"
                              : active
                                ? "text-[#059669]"
                                : "text-[#2E4A4A] hover:bg-[#F2F3F3] hover:text-[#345C5A]",
                          )}
                        >
                          <HugeiconsIcon
                            icon={item.icon}
                            size={18}
                            color="currentColor"
                            strokeWidth={active ? 2 : 1.5}
                          />
                          <span className={cn("text-sm", active ? "font-extrabold" : "font-semibold")}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Communications — expandable group below Operations */}
              <button
                type="button"
                onClick={() => toggleGroup("communications")}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-5 transition-colors w-full hover:bg-[#F2F3F3]",
                  communicationsActive ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                )}
              >
                <HugeiconsIcon
                  icon={BubbleChatNotificationIcon}
                  size={20}
                  color="currentColor"
                  strokeWidth={communicationsActive ? 2 : 1.5}
                />
                <span className={cn("text-base flex-1 text-left", communicationsActive ? "font-extrabold" : "font-semibold")}>
                  Communications
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={2}
                  style={{
                    transform: communicationsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              <AnimatePresence initial={false}>
                {communicationsExpanded && (
                  <motion.div
                    key="communications-children"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    className="pb-1.5"
                    style={{ overflow: "hidden" }}
                  >
                    {COMMUNICATIONS_ITEMS.map((item) => {
                      const active = view === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.id)}
                          className={cn(
                            "flex items-center gap-2.5 py-1.5 rounded-xl px-2 pl-11 transition-colors w-full",
                            active
                              ? "text-[#059669]"
                              : "text-[#2E4A4A] hover:bg-[#F2F3F3] hover:text-[#345C5A]",
                          )}
                        >
                          <HugeiconsIcon
                            icon={item.icon}
                            size={18}
                            color="currentColor"
                            strokeWidth={active ? 2 : 1.5}
                          />
                          <span className={cn("text-sm", active ? "font-extrabold" : "font-semibold")}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </nav>
        </div>

        <div className="flex-shrink-0">
          <div className="h-px bg-[#E5E7EB] mx-6" />
          <button
            onClick={() => { setDrawerOpen(false); sessionStorage.setItem("adminReturn", "1"); setTimeout(() => navigate("/"), 280); }}
            type="button"
            className="flex items-center gap-4 px-8 py-5 text-[#2E4A4A] hover:text-red-600 transition-colors w-full"
          >
            <HugeiconsIcon icon={Home13Icon} size={20} color="currentColor" strokeWidth={1.5} />
            <span className="text-base font-semibold">Back to Wildfly</span>
          </button>
        </div>
      </div>

      {/* ── Scrim ── */}
      <div
        className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]"
        style={{
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? "auto" : "none",
          transition: "opacity 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* ── Main content panel (push + card effect) ── */}
      <div
        className="relative flex flex-col h-full w-full min-w-0"
        style={{
          background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)",
          transform: drawerOpen ? `translateX(min(${DRAWER_WIDTH_PCT * 0.55}%, ${DRAWER_MAX_PX * 0.55}px))` : "translateX(0)",
          borderRadius: drawerOpen ? "20px" : "0px",
          boxShadow: drawerOpen ? "0 8px 40px 0 rgba(0,0,0,0.22), 0 2px 8px 0 rgba(0,0,0,0.10)" : "none",
          transition:
            "transform 0.32s cubic-bezier(0.4,0,0.2,1), border-radius 0.32s cubic-bezier(0.4,0,0.2,1), box-shadow 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
          overflow: drawerOpen ? "hidden" : "visible",
        }}
      >
        <div className="flex-1 flex flex-col min-w-0 px-5 pb-6 pt-4 gap-5 overflow-hidden">

        {/* Page header — hamburger + title + back button in one row */}
        <AnimatePresence mode="wait">
          <motion.div
            key={view + "-header"}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex items-center gap-3"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="h-10 w-10 flex items-center justify-center text-[#2E4A4A] hover:opacity-70 transition-opacity flex-shrink-0"
              aria-label="Open menu"
            >
              <HugeiconsIcon icon={Menu03Icon} size={26} color="currentColor" strokeWidth={2} />
            </button>
            <div className="flex-1 flex flex-col select-none -ml-1 min-w-0">
              <span className="text-[11px] font-semibold text-[#9CA3AF] leading-none mb-0.5">{prefix}</span>
              <span className="text-[22px] font-black tracking-widest uppercase text-[#10B981] leading-none">{label}</span>
            </div>
            <button
              type="button"
              onClick={() => { sessionStorage.setItem("adminReturn", "1"); navigate("/"); }}
              className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-[#6B7280] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors flex-shrink-0 whitespace-nowrap"
              aria-label="Back to app"
              title="Back to app"
            >
              <HugeiconsIcon icon={Home13Icon} size={17} color="currentColor" strokeWidth={2} />
              <span className="hidden sm:inline">Back To Wildfly</span>
            </button>
          </motion.div>
        </AnimatePresence>

        {gowildLoading && <LoadingInsightsOverlay />}

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
        {view === "dashboard"          && <AdminDashboardView />}
        {view === "users"              && <UsersView />}
        {view === "flights"            && <FlightsView />}
        {view === "gowild"             && <GoWildInsightsView />}
        {view === "radar"              && <GoWildRadarMap />}
        {view === "beta-applications"  && <AdminBetaApplications embedded />}
        {devToolsActive && isDeveloperChecked && !isDeveloper && <DeveloperUnauthorizedView />}
        {devToolsActive && isDeveloper && view === "data"                    && <DataView />}
        {devToolsActive && isDeveloper && view === "developer-design-system" && <DesignSystemAdminView />}
        {devToolsActive && isDeveloper && view === "developer-debug"         && <DebugSettingsAdminView />}
        {devToolsActive && isDeveloper && view === "developer-sql-cache"     && <SqlCacheAdminView />}
        {devToolsActive && isDeveloper && view === "developer-token"         && <GoWilderTokenAdminView />}
        {devToolsActive && isDeveloper && view === "developer-logging"    && <LoggingSettingsAdminView />}
        {isDeveloper && view === "auth-developer-allowlist" && <DeveloperAllowlistAdminView />}
        {isDeveloper && view === "system-reporting" && (
          <ReportingAdminView />
        )}
        {isDeveloper && view === "system-scheduled-jobs"              && <ScheduledJobsAdminView />}
        {isDeveloper && view === "auth-signup-controls"             && <SignupControlsAdminView />}
        {isDeveloper && view === "communications-messaging"          && <MessagingAdminView />}
        {isDeveloper && view === "communications-notifications"     && <NotificationsAdminView />}
        </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
