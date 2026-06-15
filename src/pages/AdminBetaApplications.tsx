import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Search01Icon,
  Cancel01Icon,
  Refresh01Icon,
  ArrowReloadHorizontalIcon,
  FilterMailSquareIcon,
  Analytics01Icon,
  UserIcon,
  AirportIcon,
  Alert01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  UserAdd01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  GOWILD_STATUS_OPTIONS,
  GOWILD_PASS_DURATION_OPTIONS,
  GOWILD_SEARCH_FREQUENCY_OPTIONS,
  FRONTIER_FLIGHT_FREQUENCY_OPTIONS,
  USES_GOWILD_SEARCH_TOOL_OPTIONS,
  BETA_TESTING_EXPERIENCE_OPTIONS,
  PRIMARY_DEVICE_OPTIONS,
  PREFERRED_FEEDBACK_METHOD_OPTIONS,
  INTERESTED_FEATURES_OPTIONS,
} from "@/constants/betaSignup";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BetaApplication {
  id: string;
  full_name: string;
  email: string;
  home_airport: string;
  gowild_status: string;
  gowild_pass_duration: string | null;
  gowild_search_frequency: string;
  frontier_flight_frequency: string;
  uses_gowild_search_tool: string;
  gowild_search_tool_name: string | null;
  beta_testing_experience: string;
  beta_testing_details: string | null;
  feedback_commitment: boolean;
  primary_device: string;
  preferred_feedback_method: string | null;
  frequent_destinations: string | null;
  interested_features: string[];
  value_expectation: string | null;
  additional_notes: string | null;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  status: string;
  internal_notes: string | null;
  selected_at: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
  auth_user_id: string | null;
  provisioned_at: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

const PAGE_SIZE = 25;

const ALL_STATUSES = ["new", "shortlisted", "invited", "accepted", "rejected"] as const;
type AppStatus = typeof ALL_STATUSES[number];

const STATUS_CONFIG: Record<AppStatus, { label: string; bg: string; text: string; cls: string }> = {
  new:         { label: "New",         bg: "#F2F3F3", text: "#6B7B7B", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  shortlisted: { label: "Shortlisted", bg: "#EFF6FF", text: "#2563EB", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  invited:     { label: "Invited",     bg: "#FFF7ED", text: "#EA580C", cls: "bg-orange-100 text-orange-600 border-orange-200" },
  accepted:    { label: "Accepted",    bg: "#F0FDF4", text: "#059669", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected:    { label: "Rejected",    bg: "#FEF2F2", text: "#DC2626", cls: "bg-red-100 text-red-600 border-red-200" },
};

const GOWILD_BADGE: Record<string, { cls: string; label: string }> = {
  current_pass_holder:   { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Active GoWild" },
  former_pass_holder:    { cls: "bg-amber-100 text-amber-700 border-amber-200",       label: "Former GoWild" },
  considering:           { cls: "bg-sky-100 text-sky-700 border-sky-200",             label: "Considering" },
  no_frontier_flyer:     { cls: "bg-gray-100 text-gray-500 border-gray-200",          label: "No GoWild" },
  no_not_frontier_flyer: { cls: "bg-gray-100 text-gray-500 border-gray-200",          label: "No GoWild" },
};
const EXP_BADGE: Record<string, { cls: string; label: string }> = {
  yes_professional: { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Professional" },
  informal:         { cls: "bg-cyan-100 text-cyan-700 border-cyan-200",          label: "Informal" },
  no:               { cls: "bg-gray-100 text-gray-500 border-gray-200",          label: "None" },
};
const DEVICE_LABEL: Record<string, string> = {
  iphone:         "iPhone",
  android:        "Android",
  desktop_laptop: "Desktop",
  tablet:         "Tablet",
  multiple:       "Multiple",
};

const GRID = "grid-cols-[1.6fr_1.4fr_0.6fr_1.1fr_1.1fr_0.7fr_0.9fr_0.8fr]";

const DROPDOWN_ARROW: React.CSSProperties = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 6px center",
};

const INPUT_CLS = "w-full h-8 bg-[#F2F3F3] rounded-lg px-2.5 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400";
const SELECT_CLS = "w-full h-8 bg-[#F2F3F3] rounded-lg pl-2.5 pr-7 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none";
const GRID_TEMPLATE = "1.6fr 1.4fr 0.6fr 1.1fr 1.1fr 0.7fr 0.9fr 0.8fr";

type BetaSortKey = keyof BetaApplication;
type BetaSortDir = "asc" | "desc";

const BETA_COLS: Array<{ label: string; sortKey: BetaSortKey | null }> = [
  { label: "Applicant",   sortKey: "full_name" },
  { label: "Email",       sortKey: "email" },
  { label: "Airport",     sortKey: "home_airport" },
  { label: "GoWild",      sortKey: "gowild_status" },
  { label: "Experience",  sortKey: "beta_testing_experience" },
  { label: "Device",      sortKey: "primary_device" },
  { label: "Status",      sortKey: "status" },
  { label: "Applied",     sortKey: "created_at" },
];

function BetaSortableHeader({
  children,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: BetaSortKey | null;
  currentKey: BetaSortKey | null;
  currentDir: BetaSortDir;
  onSort: (k: BetaSortKey) => void;
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

function statusConfig(s: string) {
  return STATUS_CONFIG[s as AppStatus] ?? { label: s, bg: "#F2F3F3", text: "#6B7B7B", cls: "bg-gray-100 text-gray-500 border-gray-200" };
}

function labelFor(value: string | null | undefined, options: { value: string; label: string }[]): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

interface BetaKpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "rose" | "cyan" | "default";
  icon: React.ReactNode;
}

function BetaKpiCard({ label, value, sub, accent = "default", icon }: BetaKpiCardProps) {
  const accentColor = {
    green:   "text-emerald-600",
    amber:   "text-amber-500",
    rose:    "text-rose-500",
    cyan:    "text-cyan-600",
    default: "text-[#102625]",
  }[accent];
  return (
    <div
      className="flex-1 min-w-[120px] rounded-2xl bg-white border border-[#E3EBE8] px-4 py-3 flex flex-col gap-1"
      style={{ boxShadow: "0 1px 4px 0 rgba(16,38,37,0.06)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-[#7A8B8A] uppercase tracking-wide leading-tight">{label}</span>
        <span className="flex-shrink-0 text-[#B0BDB9]">{icon}</span>
      </div>
      <p className={cn("text-xl font-black leading-none mt-0.5", accentColor)}>{value}</p>
      {sub && <p className="text-[10px] text-[#7A8B8A] leading-tight">{sub}</p>}
    </div>
  );
}

function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function IconCheckCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function BetaKpiStrip({ applications }: { applications: BetaApplication[] }) {
  const total        = applications.length;
  const newCount     = applications.filter(a => a.status === "new").length;
  const shortlisted  = applications.filter(a => a.status === "shortlisted").length;
  const invited      = applications.filter(a => a.status === "invited").length;
  const accepted     = applications.filter(a => a.status === "accepted").length;
  const goWildActive = applications.filter(a => a.gowild_status === "current_pass_holder").length;

  const acceptPct  = total > 0 ? ((accepted / total) * 100).toFixed(1) : "—";
  const goWildPct  = total > 0 ? ((goWildActive / total) * 100).toFixed(0) : "—";

  return (
    <div className="flex gap-3 overflow-x-auto pb-0.5">
      <BetaKpiCard
        label="Total"
        value={total.toLocaleString()}
        sub="all applications"
        accent="default"
        icon={<IconUsers />}
      />
      <BetaKpiCard
        label="Unreviewed"
        value={newCount.toString()}
        sub={newCount === 0 ? "none pending" : "awaiting review"}
        accent={newCount > 0 ? "amber" : "default"}
        icon={<IconInbox />}
      />
      <BetaKpiCard
        label="Shortlisted"
        value={shortlisted.toString()}
        sub="in consideration"
        accent={shortlisted > 0 ? "cyan" : "default"}
        icon={<IconStar />}
      />
      <BetaKpiCard
        label="Invited"
        value={invited.toString()}
        sub="awaiting acceptance"
        accent={invited > 0 ? "amber" : "default"}
        icon={<IconSend />}
      />
      <BetaKpiCard
        label="Accepted"
        value={`${acceptPct}%`}
        sub={`${accepted} approved`}
        accent={accepted > 0 ? "green" : "default"}
        icon={<IconCheckCircle />}
      />
      <BetaKpiCard
        label="GoWild Pass"
        value={goWildActive.toString()}
        sub={`${goWildPct}% of applicants`}
        accent={goWildActive > 0 ? "green" : "default"}
        icon={<IconLayers />}
      />
    </div>
  );
}

// ── Analytics panel ────────────────────────────────────────────────────────────

function BetaAnalyticsPanel({ applications, filtered }: { applications: BetaApplication[]; filtered: BetaApplication[] }) {
  const total = applications.length;
  const vis   = filtered.length;

  const statusRows = ALL_STATUSES.map(s => ({
    key: s,
    label: STATUS_CONFIG[s].label,
    color: STATUS_CONFIG[s].text,
    count: filtered.filter(a => a.status === s).length,
  }));

  const deviceMap: Record<string, number> = {};
  for (const a of filtered) {
    const d = a.primary_device || "unknown";
    deviceMap[d] = (deviceMap[d] ?? 0) + 1;
  }
  const deviceRows = Object.entries(deviceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxDevice = deviceRows[0]?.[1] ?? 1;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-3 border-t border-[#F0F1F1]">
      {/* Quick stats */}
      <div>
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide mb-2">Quick Stats</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Total",      value: total },
            { label: "Visible",    value: vis },
            { label: "Accepted",   value: filtered.filter(a => a.status === "accepted").length },
            { label: "Invited",    value: filtered.filter(a => a.status === "invited").length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-[#F8F9F9] border border-[#F0F1F1] px-2.5 py-2">
              <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
              <p className="text-base font-black text-[#1A2E2E] leading-tight">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide">By Status</p>
        <div className="flex flex-col gap-1.5">
          {statusRows.map(({ key, label, color, count }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold w-20 flex-shrink-0" style={{ color }}>{label}</span>
              <div className="flex-1 h-2.5 bg-[#F0F1F1] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: vis ? `${(count / vis) * 100}%` : "0%", backgroundColor: color }} />
              </div>
              <span className="text-[10px] text-[#9CA3AF] w-5 text-right flex-shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Device breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#7A8B8A] uppercase tracking-wide">By Device</p>
        <div className="flex flex-col gap-1.5">
          {deviceRows.map(([device, count]) => (
            <div key={device} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold w-16 flex-shrink-0 capitalize text-[#2E4A4A]">{device}</span>
              <div className="flex-1 h-2.5 bg-[#F0F1F1] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxDevice) * 100}%`, background: "linear-gradient(90deg, #059669, #10b981)" }} />
              </div>
              <span className="text-[10px] text-[#9CA3AF] w-5 text-right flex-shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Drawer helpers ────────────────────────────────────────────────────────────

function DrawerCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-[#EAECEC] shadow-sm overflow-hidden">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#F0F1F1] bg-[#FAFBFB]">
        <h3 className="text-sm font-semibold text-[#1A2E2E]">{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DrawerKV({ label, value, copy }: { label: string; value: React.ReactNode; copy?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</div>
      <div className="text-sm text-[#1A2E2E] mt-0.5 flex items-center gap-1.5 break-all">
        <span className="truncate">{value ?? "—"}</span>
        {copy && (
          <button
            onClick={() => navigator.clipboard.writeText(copy)}
            className="text-[#9CA3AF] hover:text-[#059669] shrink-0"
            aria-label={`Copy ${label}`}
          >
            <HugeiconsIcon icon={Copy01Icon} size={12} color="currentColor" strokeWidth={2} />
          </button>
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
  const btn = "h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors";
  return (
    <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-[#F0F1F1]">
      <button onClick={() => onPage(page - 1)} disabled={page === 0}
        className={`${btn} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}>
        Previous
      </button>
      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="text-xs text-[#9CA3AF] px-1">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            className={`${btn} ${p === page ? "text-white" : "border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3]"}`}
            style={p === page ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
          >
            {(p as number) + 1}
          </button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}
        className={`${btn} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}>
        Next
      </button>
    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

type BetaDrawerTab = "overview" | "gowild" | "experience" | "admin";

function BetaApplicationDetailDrawer({
  open,
  onClose,
  app,
  onStatusChange,
  onNotesSave,
  onApprove,
  updatingStatus,
  savingNotes,
  approvingId,
}: {
  open: boolean;
  onClose: () => void;
  app: BetaApplication | null;
  onStatusChange: (id: string, status: AppStatus) => void;
  onNotesSave: (id: string, notes: string) => void;
  onApprove: (id: string) => void;
  updatingStatus: boolean;
  savingNotes: boolean;
  approvingId: string | null;
}) {
  const [tab, setTab] = useState<BetaDrawerTab>("overview");
  const [localNotes, setLocalNotes] = useState(app?.internal_notes ?? "");
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const notesDirty = localNotes !== (app?.internal_notes ?? "");

  useEffect(() => {
    if (open && app) setTab("overview");
  }, [app?.id, open]);

  useEffect(() => {
    setLocalNotes(app?.internal_notes ?? "");
  }, [app?.internal_notes, app?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      cancelAnimationFrame(raf);
    };
  }, [open, onClose]);

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!app && !open) return null;

  const cfg = app ? statusConfig(app.status) : null;
  const gowildB = app ? (GOWILD_BADGE[app.gowild_status] ?? null) : null;
  const interestedLabels = (app?.interested_features ?? [])
    .map((v) => labelFor(v, INTERESTED_FEATURES_OPTIONS))
    .join(", ");

  const TABS: { id: BetaDrawerTab; label: string }[] = [
    { id: "overview",   label: "Overview" },
    { id: "gowild",     label: "GoWild Pass" },
    { id: "experience", label: "Experience" },
    { id: "admin",      label: "Admin" },
  ];

  return createPortal(
    <AnimatePresence>
      {open && app && (
        <motion.div
          key="beta-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9998] bg-black/40"
          onClick={handleBackdrop}
        >
          <motion.aside
            key="beta-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Beta application details"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="absolute top-0 right-0 h-full w-full sm:w-[620px] md:w-[660px] lg:w-[700px] bg-[#F4F6F6] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <header className="px-5 py-4 bg-white border-b border-[#EAECEC] flex items-start gap-3 flex-shrink-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
              >
                {app.full_name.trim()[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-[#1A2E2E] leading-tight">{app.full_name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {cfg && (
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.cls)}>
                      {cfg.label}
                    </span>
                  )}
                  {gowildB && (
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", gowildB.cls)}>
                      {gowildB.label}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                    {DEVICE_LABEL[app.primary_device] ?? app.primary_device}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <p className="text-[11px] text-[#9CA3AF] truncate">{app.email}</p>
                  <span className="text-[#D1D5DB] flex-shrink-0">·</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[11px] text-[#9CA3AF] font-mono">{app.id.slice(0, 8)}…</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(app.id)}
                      className="text-[#9CA3AF] hover:text-emerald-600"
                      aria-label="Copy ID"
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={10} color="currentColor" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="Close drawer"
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[#F2F3F3] hover:bg-[#E5E7E7] text-[#1A2E2E]"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
              </button>
            </header>

            {/* ── Tab bar ── */}
            <div className="flex items-center bg-white border-b border-[#EAECEC] px-4 flex-shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
                    tab === t.id
                      ? "border-emerald-500 text-emerald-700"
                      : "border-transparent text-[#9CA3AF] hover:text-[#1A2E2E]"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ── OVERVIEW TAB ── */}
              {tab === "overview" && (
                <>
                  <DrawerCard title="Applicant">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DrawerKV label="Full Name"      value={app.full_name} />
                      <DrawerKV label="Home Airport"   value={<span className="font-mono font-bold">{app.home_airport}</span>} />
                      <DrawerKV label="Email"          value={<a href={`mailto:${app.email}`} className="text-[#059669] hover:underline truncate">{app.email}</a>} copy={app.email} />
                      <DrawerKV label="Applied"        value={fmt(app.created_at)} />
                      <DrawerKV label="Status"         value={cfg ? <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.cls)}>{cfg.label}</span> : "—"} />
                      <DrawerKV label="Application ID" value={<span className="font-mono text-xs">{app.id.slice(0, 8)}…</span>} copy={app.id} />
                    </div>
                  </DrawerCard>

                  <DrawerCard title="Tracking">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DrawerKV label="Source"       value={app.source} />
                      <DrawerKV label="Referrer"     value={app.referrer} />
                      <DrawerKV label="UTM Source"   value={app.utm_source} />
                      <DrawerKV label="UTM Medium"   value={app.utm_medium} />
                      <DrawerKV label="UTM Campaign" value={app.utm_campaign} />
                    </div>
                  </DrawerCard>
                </>
              )}

              {/* ── GOWILD PASS TAB ── */}
              {tab === "gowild" && (
                <>
                  <DrawerCard title="GoWild Pass">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DrawerKV label="Pass Status"        value={labelFor(app.gowild_status, GOWILD_STATUS_OPTIONS)} />
                      <DrawerKV label="Pass Duration"      value={labelFor(app.gowild_pass_duration, GOWILD_PASS_DURATION_OPTIONS)} />
                      <DrawerKV label="Search Frequency"   value={labelFor(app.gowild_search_frequency, GOWILD_SEARCH_FREQUENCY_OPTIONS)} />
                      <DrawerKV label="Frontier Frequency" value={labelFor(app.frontier_flight_frequency, FRONTIER_FLIGHT_FREQUENCY_OPTIONS)} />
                    </div>
                  </DrawerCard>

                  <DrawerCard title="Current Tools">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DrawerKV label="Uses GoWild Tool" value={labelFor(app.uses_gowild_search_tool, USES_GOWILD_SEARCH_TOOL_OPTIONS)} />
                      <DrawerKV label="Tool Name"        value={app.gowild_search_tool_name} />
                    </div>
                  </DrawerCard>
                </>
              )}

              {/* ── EXPERIENCE TAB ── */}
              {tab === "experience" && (
                <>
                  <DrawerCard title="Beta Testing Experience">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DrawerKV label="Experience Level" value={labelFor(app.beta_testing_experience, BETA_TESTING_EXPERIENCE_OPTIONS)} />
                      <DrawerKV label="Commitment"       value={app.feedback_commitment ? "Yes" : "No"} />
                      <DrawerKV label="Primary Device"   value={labelFor(app.primary_device, PRIMARY_DEVICE_OPTIONS)} />
                      <DrawerKV label="Feedback Method"  value={labelFor(app.preferred_feedback_method, PREFERRED_FEEDBACK_METHOD_OPTIONS)} />
                    </div>
                    {app.beta_testing_details && (
                      <div className="mt-3 p-3 rounded-xl bg-[#FAFBFB] border border-[#F0F1F1]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1.5">Details</p>
                        <p className="text-sm text-[#2E4A4A] leading-relaxed">{app.beta_testing_details}</p>
                      </div>
                    )}
                  </DrawerCard>

                  <DrawerCard title="Preferences">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
                      <DrawerKV label="Frequent Destinations" value={app.frequent_destinations} />
                      <DrawerKV label="Interested Features"   value={interestedLabels || "—"} />
                    </div>
                    {(app.value_expectation || app.additional_notes) && (
                      <div className="space-y-2">
                        {app.value_expectation && (
                          <div className="p-3 rounded-xl bg-[#FAFBFB] border border-[#F0F1F1]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1.5">Value Expectation</p>
                            <p className="text-sm text-[#2E4A4A] leading-relaxed">{app.value_expectation}</p>
                          </div>
                        )}
                        {app.additional_notes && (
                          <div className="p-3 rounded-xl bg-[#FAFBFB] border border-[#F0F1F1]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1.5">Additional Notes</p>
                            <p className="text-sm text-[#2E4A4A] leading-relaxed">{app.additional_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </DrawerCard>
                </>
              )}

              {/* ── ADMIN TAB ── */}
              {tab === "admin" && (
                <>
                  <DrawerCard title="Timeline">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <DrawerKV label="Applied"     value={fmt(app.created_at)} />
                      <DrawerKV label="Invited At"  value={fmt(app.invited_at)} />
                      <DrawerKV label="Selected At" value={fmt(app.selected_at)} />
                    </div>
                  </DrawerCard>

                  <DrawerCard title="Set Status">
                    <div className="flex flex-wrap gap-2">
                      {ALL_STATUSES.map((s) => {
                        const scfg = STATUS_CONFIG[s];
                        const active = app.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={updatingStatus || active}
                            onClick={() => onStatusChange(app.id, s)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={
                              active
                                ? { background: scfg.bg, color: scfg.text, border: `1.5px solid ${scfg.text}` }
                                : { background: "#F2F3F3", color: "#6B7B7B", border: "1.5px solid #E5E7EB" }
                            }
                          >
                            {active && updatingStatus ? "Saving…" : scfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </DrawerCard>

                  <DrawerCard title="Internal Notes">
                    <textarea
                      value={localNotes}
                      onChange={(e) => setLocalNotes(e.target.value)}
                      rows={4}
                      placeholder="Private notes visible only to admins…"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFB] text-xs text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/10 resize-none transition-all"
                    />
                    {notesDirty && (
                      <div className="flex items-center justify-end mt-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setLocalNotes(app.internal_notes ?? "")}
                          className="text-xs text-[#9CA3AF] hover:text-[#6B7B7B] transition-colors"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          disabled={savingNotes}
                          onClick={() => onNotesSave(app.id, localNotes)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold text-white transition-opacity disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                        >
                          {savingNotes ? "Saving…" : "Save notes"}
                        </button>
                      </div>
                    )}
                  </DrawerCard>

                  <DrawerCard title="Account">
                    {app.provisioned_at ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color="#059669" strokeWidth={2} />
                          <span className="text-xs font-semibold text-[#059669]">Account provisioned</span>
                        </div>
                        <p className="text-[11px] text-[#9CA3AF]">{fmt(app.provisioned_at)}</p>
                        {app.auth_user_id && (
                          <p className="text-[10px] text-[#C4C9CA] font-mono">{app.auth_user_id}</p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={approvingId === app.id}
                        onClick={() => onApprove(app.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                      >
                        <HugeiconsIcon icon={UserAdd01Icon} size={15} color="white" strokeWidth={2.5} />
                        {approvingId === app.id ? "Creating account…" : "Approve & Create Account"}
                      </button>
                    )}
                  </DrawerCard>
                </>
              )}

            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ── AdminBetaApplications ─────────────────────────────────────────────────────

export default function AdminBetaApplications({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();

  const [applications, setApplications] = useState<BetaApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGowildStatus, setFilterGowildStatus] = useState("");
  const [filterDevice, setFilterDevice] = useState("");
  const [filterAirport, setFilterAirport] = useState("");
  const [filterAppliedFrom, setFilterAppliedFrom] = useState("");
  const [filterAppliedTo, setFilterAppliedTo] = useState("");

  // Toolbar panels
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);

  // Column sort
  const [sortKey, setSortKey] = useState<BetaSortKey | null>("created_at");
  const [sortDir, setSortDir] = useState<BetaSortDir>("desc");
  const [sortClickCount, setSortClickCount] = useState(1);

  const handleSort = (k: BetaSortKey) => {
    if (sortKey === k) {
      if (sortClickCount >= 2) {
        setSortKey(null);
        setSortDir("desc");
        setSortClickCount(0);
      } else {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        setSortClickCount(c => c + 1);
      }
    } else {
      setSortKey(k);
      setSortDir("desc");
      setSortClickCount(1);
    }
  };

  // Selected row
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedApp = useMemo(() => applications.find(a => a.id === selectedId) ?? null, [applications, selectedId]);

  // Per-row action state
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Approve result modal
  const [approveResult, setApproveResult] = useState<{
    name: string;
    email: string;
    welcomeDeliveryStatus: string;
    welcomeMessageId: string | null;
    alreadyExisted: boolean;
  } | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not signed in."); setLoading(false); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-list-beta-applications`,
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
      if (!res.ok || json?.error) {
        setError(json?.error ?? "Failed to load applications.");
      } else {
        setApplications(json.applications ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Status update ──────────────────────────────────────────────────────────

  async function handleStatusChange(id: string, status: AppStatus) {
    setUpdatingStatusId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not signed in."); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-update-beta-application`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, status }),
        }
      );
      const json = await res.json();
      if (!res.ok || json?.error) {
        toast.error(json?.error ?? "Failed to update status.");
      } else {
        setApplications((prev) =>
          prev.map((a) => (a.id === id ? (json.application as BetaApplication) : a))
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // ── Notes save ─────────────────────────────────────────────────────────────

  async function handleNotesSave(id: string, internal_notes: string) {
    setSavingNotesId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not signed in."); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-update-beta-application`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, internal_notes: internal_notes.trim() || null }),
        }
      );
      const json = await res.json();
      if (!res.ok || json?.error) {
        toast.error(json?.error ?? "Failed to save notes.");
      } else {
        setApplications((prev) =>
          prev.map((a) => (a.id === id ? (json.application as BetaApplication) : a))
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingNotesId(null);
    }
  }

  // ── Approve + provision ────────────────────────────────────────────────────

  async function handleApprove(id: string) {
    const app = applications.find((a) => a.id === id);
    if (!app) return;

    setApprovingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not signed in."); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-approve-beta-application`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            application_id: id,
            redirect_to: `${window.location.origin}/reset-password`,
          }),
        }
      );
      const json = await res.json();

      if (!res.ok || json?.error) {
        if (json?.already_provisioned) {
          toast.info("This application has already been provisioned.");
        } else {
          toast.error(json?.error ?? "Failed to create account.");
        }
        return;
      }

      // Update local application state
      setApplications((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: "accepted",
                auth_user_id: json.user_id,
                provisioned_at: new Date().toISOString(),
                selected_at: a.selected_at ?? new Date().toISOString(),
              }
            : a
        )
      );

      setApproveResult({
        name: app.full_name,
        email: app.email,
        welcomeDeliveryStatus: json.welcome_delivery_status ?? "unknown",
        welcomeMessageId: json.welcome_message_id ?? null,
        alreadyExisted: json.already_existed ?? false,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = applications;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.full_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.home_airport.toLowerCase().includes(q)
      );
    }
    if (filterStatus)       result = result.filter((a) => a.status === filterStatus);
    if (filterGowildStatus) result = result.filter((a) => a.gowild_status === filterGowildStatus);
    if (filterDevice)       result = result.filter((a) => a.primary_device === filterDevice);
    if (filterAirport.trim()) {
      const q = filterAirport.trim().toLowerCase();
      result = result.filter((a) => a.home_airport.toLowerCase().includes(q));
    }
    if (filterAppliedFrom) result = result.filter((a) => a.created_at >= filterAppliedFrom);
    if (filterAppliedTo)   result = result.filter((a) => a.created_at.slice(0, 10) <= filterAppliedTo);
    return result;
  }, [applications, search, filterStatus, filterGowildStatus, filterDevice, filterAirport, filterAppliedFrom, filterAppliedTo]);

  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageRows   = sortedFiltered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const hasFilters = !!(search || filterStatus || filterGowildStatus || filterDevice || filterAirport || filterAppliedFrom || filterAppliedTo);

  function clearFilters() {
    setSearch("");
    setFilterStatus("");
    setFilterGowildStatus("");
    setFilterDevice("");
    setFilterAirport("");
    setFilterAppliedFrom("");
    setFilterAppliedTo("");
    setPage(0);
  }

  const advancedFilterCount = [filterDevice, filterAirport, filterAppliedFrom, filterAppliedTo].filter(Boolean).length;

  // ── Layout ─────────────────────────────────────────────────────────────────

  const outerCls = embedded
    ? "flex flex-col w-full gap-4 pb-8"
    : "min-h-screen flex flex-col";

  const innerCls = embedded
    ? "flex flex-col w-full gap-4"
    : "flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 pt-8 pb-12 gap-4";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={outerCls}
      style={embedded ? undefined : { background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
    >
      <div className={innerCls}>

        {/* ── Header (standalone only) ─────────────────────────────────────── */}
        {!embedded && (
          <div className="px-1 mb-1 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => navigate("/admin/console")}
                className="mt-1 w-8 h-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors flex-shrink-0"
                aria-label="Back to admin console"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={2.5} />
              </button>
              <div>
                <div className="flex items-baseline gap-1.5 select-none">
                  <span className="text-[22px] font-medium text-[#6B7280]">Beta</span>
                  <span className="text-[22px] font-black tracking-widest uppercase text-[#10B981]">Applications</span>
                </div>
                <p className="text-sm text-[#6B7B7B] mt-0.5">
                  {loading ? "Loading…" : `${applications.length} total application${applications.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#059669] transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ background: "rgba(209,250,229,0.7)", border: "1px solid #6EE7B7" }}
              aria-label="Refresh"
            >
              <HugeiconsIcon icon={Refresh01Icon} size={13} color="#059669" strokeWidth={2.5} />
              Refresh
            </button>
          </div>
        )}

        {/* ── KPI Strip ────────────────────────────────────────────────────────── */}
        <BetaKpiStrip applications={applications} />

        {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
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
                  placeholder="Search name, email, airport..."
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
                style={DROPDOWN_ARROW}
              >
                <option value="">All Statuses</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>

              {/* GoWild quick filter */}
              <select
                value={filterGowildStatus}
                onChange={(e) => { setFilterGowildStatus(e.target.value); setPage(0); }}
                aria-label="Filter by GoWild status"
                className="h-9 bg-[#F2F3F3] rounded-xl pl-2.5 pr-7 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none"
                style={DROPDOWN_ARROW}
              >
                <option value="">All GoWild</option>
                {GOWILD_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
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
                onClick={load}
                disabled={loading}
                aria-label="Refresh"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors disabled:opacity-40"
              >
                <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} color="currentColor" strokeWidth={2} />
              </button>

              {/* Count */}
              <span className="text-xs font-semibold text-[#6B7B7B] flex-shrink-0">
                {filtered.length.toLocaleString()} {hasFilters ? "matching" : "total"}
              </span>
            </div>

            {/* Analytics panel */}
            {analyticsOpen && (
              <BetaAnalyticsPanel applications={applications} filtered={filtered} />
            )}
          </div>

          {/* Advanced filters panel */}
          {advancedOpen && (
            <div className="rounded-2xl px-5 py-4 flex flex-col gap-4" style={CARD_STYLE}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6B7B7B] uppercase tracking-wide">Filters</p>
                <button onClick={clearFilters} className="text-[10px] font-semibold text-[#9CA3AF] hover:text-rose-500 transition-colors">
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Device</label>
                  <select
                    value={filterDevice}
                    onChange={(e) => { setFilterDevice(e.target.value); setPage(0); }}
                    className={SELECT_CLS}
                    style={DROPDOWN_ARROW}
                  >
                    <option value="">All Devices</option>
                    {PRIMARY_DEVICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Home Airport</label>
                  <div className="relative">
                    <HugeiconsIcon icon={AirportIcon} size={12} color="#9CA3AF" strokeWidth={2} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={filterAirport}
                      onChange={(e) => { setFilterAirport(e.target.value.toUpperCase().slice(0, 4)); setPage(0); }}
                      placeholder="ATL"
                      className={cn(INPUT_CLS, "pl-6")}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Applied From</label>
                  <input
                    type="date"
                    value={filterAppliedFrom}
                    onChange={(e) => { setFilterAppliedFrom(e.target.value); setPage(0); }}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Applied To</label>
                  <input
                    type="date"
                    value={filterAppliedTo}
                    onChange={(e) => { setFilterAppliedTo(e.target.value); setPage(0); }}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden p-3" style={CARD_STYLE}>

          {/* Column headers */}
          <div
            className="px-5 border-b border-[#F0F1F1] bg-[#F8F9F9]"
            style={{ display: "grid", gridTemplateColumns: GRID_TEMPLATE, gap: "12px", alignItems: "stretch" }}
          >
            {BETA_COLS.map((col, idx) => (
              <div key={col.label || `col-${idx}`} className="relative flex items-stretch">
                <BetaSortableHeader
                  sortKey={col.sortKey}
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                >
                  {col.label}
                </BetaSortableHeader>
                {idx < BETA_COLS.length - 1 && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-px bg-[#E5E7EB]" />
                )}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Loading applications…</div>
          ) : error ? (
            <div className="px-5 py-8 flex flex-col items-center gap-3">
              <HugeiconsIcon icon={Alert01Icon} size={24} color="#DC2626" strokeWidth={2} />
              <p className="text-sm font-semibold text-[#DC2626]">{error}</p>
              <button onClick={load} className="text-xs font-bold text-[#059669] hover:opacity-70 transition-opacity">
                Try again
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className="px-5 py-12 flex flex-col items-center gap-2">
              <HugeiconsIcon icon={UserIcon} size={28} color="#9CA3AF" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-[#6B7B7B] mt-1">No applications yet</p>
              <p className="text-xs text-[#9CA3AF]">Applications submitted via /beta will appear here.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-[#6B7B7B]">No results match the current filters.</p>
              <button onClick={clearFilters} className="text-xs font-bold text-[#059669] hover:opacity-70 transition-opacity">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#F0F1F1] overflow-y-auto" style={{ maxHeight: "calc(100vh - 310px)" }}>
              {pageRows.map((app) => {
                const cfg       = statusConfig(app.status);
                const gowildB   = GOWILD_BADGE[app.gowild_status] ?? { cls: "bg-gray-100 text-gray-500 border-gray-200", label: app.gowild_status ?? "—" };
                const expB      = EXP_BADGE[app.beta_testing_experience] ?? { cls: "bg-slate-100 text-slate-600 border-slate-200", label: app.beta_testing_experience ?? "—" };
                const deviceLbl = DEVICE_LABEL[app.primary_device] ?? (app.primary_device ?? "—");
                const isSelected = selectedId === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedId(app.id)}
                    className={cn(`w-full text-left grid ${GRID} gap-3 px-5 py-3 items-center transition-colors cursor-pointer focus:outline-none`,
                      isSelected ? "bg-[#F0FDF4] border-l-2 border-l-emerald-500" : "hover:bg-[#F1FAF6]"
                    )}
                  >
                      {/* Applicant */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                          style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                        >
                          {app.full_name.trim()[0]?.toUpperCase() ?? "?"}
                        </div>
                        <p className="text-sm font-semibold text-[#1A2E2E] truncate">{app.full_name}</p>
                      </div>

                      {/* Email */}
                      <p className="text-xs text-[#9CA3AF] truncate min-w-0">{app.email}</p>

                      {/* Airport */}
                      <span className="text-sm font-mono font-bold text-[#6B7B7B]">{app.home_airport}</span>

                      {/* GoWild */}
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit", gowildB.cls)}>
                        {gowildB.label}
                      </span>

                      {/* Experience */}
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit", expB.cls)}>
                        {expB.label}
                      </span>

                      {/* Device */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit bg-slate-100 text-slate-600 border-slate-200">
                        {deviceLbl}
                      </span>

                      {/* Status badge */}
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit whitespace-nowrap", cfg.cls)}>
                        {cfg.label}
                      </span>

                      {/* Applied */}
                      <span className="text-xs text-[#9CA3AF]">{fmt(app.created_at)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {totalPages > 1 && !loading && (
            <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
          )}
        </div>

      </div>

      {/* ── Approve result modal ─────────────────────────────────────────── */}
      {approveResult && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="rounded-2xl p-6 max-w-md w-full flex flex-col gap-4"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 8px 32px 0 rgba(52,92,90,0.18)",
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} color="white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[15px] font-black text-[#1A2E2E]">
                  {approveResult.alreadyExisted ? "Account Upgraded" : "Account Created"}
                </p>
                <p className="text-xs text-[#6B7B7B] mt-0.5">{approveResult.name}</p>
                <p className="text-xs text-[#9CA3AF]">{approveResult.email}</p>
              </div>
            </div>

            {/* What was provisioned */}
            <div className="rounded-xl bg-[#F0FDF4] border border-[#D1FAE5] px-4 py-3 flex flex-col gap-1.5">
              <p className="text-[11px] font-bold text-[#059669] uppercase tracking-wide">What was set up</p>
              {([
                approveResult.alreadyExisted ? "Existing account activated" : "Auth account created",
                "Account status → active",
                approveResult.alreadyExisted ? null : "Homepage components added",
                "Subscription upgraded → Gold (unlimited)",
                "Beta application → Accepted",
              ] as (string | null)[])
                .filter(Boolean)
                .map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] flex-shrink-0" />
                    <span className="text-xs text-[#374151]">{item}</span>
                  </div>
                ))}
            </div>

            {/* Welcome email status */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">
                Welcome Email
              </p>
              {approveResult.welcomeDeliveryStatus === "sent" ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <p className="text-xs text-green-700 font-medium">
                    Welcome email sent to {approveResult.email}
                  </p>
                </div>
              ) : approveResult.welcomeDeliveryStatus === "failed" ? (
                <div className="flex flex-col gap-1 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-red-700 font-medium">Welcome email failed to send.</p>
                  {approveResult.welcomeMessageId && (
                    <p className="text-[11px] text-red-500">
                      Check Messaging → Delivery for message ID {approveResult.welcomeMessageId.slice(0, 8)}…
                    </p>
                  )}
                  <p className="text-[11px] text-red-500">
                    The user can still sign in and use "Forgot Password" to set their password.
                  </p>
                </div>
              ) : approveResult.welcomeDeliveryStatus === "no_template" ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-amber-700">
                    No active <code className="font-mono text-[10px]">beta-applicant-selected</code> template found.
                    The user can sign in using "Forgot Password" to set their password.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF]">
                  Email status: {approveResult.welcomeDeliveryStatus}.
                  The user can use "Forgot Password" on the login screen to set their password.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setApproveResult(null)}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Detail drawer ── */}
      <BetaApplicationDetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        app={selectedApp}
        onStatusChange={handleStatusChange}
        onNotesSave={handleNotesSave}
        onApprove={handleApprove}
        updatingStatus={!!updatingStatusId}
        savingNotes={!!savingNotesId}
        approvingId={approvingId}
      />
    </div>
  );
}
