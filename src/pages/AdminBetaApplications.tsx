import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Search01Icon,
  Cancel01Icon,
  Refresh01Icon,
  UserIcon,
  AirportIcon,
  Alert01Icon,
  ArrowDown01Icon,
  Notebook01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
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

const STATUS_CONFIG: Record<AppStatus, { label: string; bg: string; text: string }> = {
  new:         { label: "New",         bg: "#F2F3F3", text: "#6B7B7B" },
  shortlisted: { label: "Shortlisted", bg: "#EFF6FF", text: "#2563EB" },
  invited:     { label: "Invited",     bg: "#FFF7ED", text: "#EA580C" },
  accepted:    { label: "Accepted",    bg: "#F0FDF4", text: "#059669" },
  rejected:    { label: "Rejected",    bg: "#FEF2F2", text: "#DC2626" },
};

const GRID = "grid-cols-[1.6fr_1.4fr_0.6fr_1.1fr_1.1fr_0.7fr_0.9fr_0.8fr_32px]";

function statusConfig(s: string) {
  return STATUS_CONFIG[s as AppStatus] ?? { label: s, bg: "#F2F3F3", text: "#6B7B7B" };
}

function labelFor(value: string | null | undefined, options: { value: string; label: string }[]): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}

// ── Detail panel sub-components ───────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-[#059669] uppercase tracking-widest mb-1 mt-3 first:mt-0">
      {children}
    </p>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === "" || value === "—";
  return (
    <div className="flex gap-2 py-0.5 border-b border-[#F8F9F9] last:border-0 items-start">
      <dt className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide w-36 flex-shrink-0 pt-0.5">
        {label}
      </dt>
      <dd className={`text-xs break-words flex-1 ${empty ? "text-[#C4C9CA]" : "text-[#2E4A4A]"}`}>
        {empty ? "—" : value}
      </dd>
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

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  app,
  onStatusChange,
  onNotesSave,
  updatingStatus,
  savingNotes,
}: {
  app: BetaApplication;
  onStatusChange: (id: string, status: AppStatus) => void;
  onNotesSave: (id: string, notes: string) => void;
  updatingStatus: boolean;
  savingNotes: boolean;
}) {
  const [localNotes, setLocalNotes] = useState(app.internal_notes ?? "");
  const notesDirty = localNotes !== (app.internal_notes ?? "");

  useEffect(() => {
    setLocalNotes(app.internal_notes ?? "");
  }, [app.internal_notes]);

  const interestedLabels = (app.interested_features ?? [])
    .map((v) => labelFor(v, INTERESTED_FEATURES_OPTIONS))
    .join(", ");

  return (
    <div className="border-t border-[#E8EEEE] bg-[#FAFBFB] px-5 py-3">
      <div className="grid grid-cols-4 gap-x-6 gap-y-0">

        {/* Col 1 — Applicant */}
        <div>
          <SectionLabel>Applicant</SectionLabel>
          <dl>
            <FieldRow label="Full name"    value={app.full_name} />
            <FieldRow label="Email"        value={<a href={`mailto:${app.email}`} className="text-[#059669] hover:underline">{app.email}</a>} />
            <FieldRow label="Home airport" value={app.home_airport} />
            <FieldRow label="Applied"      value={fmt(app.created_at)} />
          </dl>

          <SectionLabel>Tracking</SectionLabel>
          <dl>
            <FieldRow label="Source"       value={app.source} />
            <FieldRow label="UTM source"   value={app.utm_source} />
            <FieldRow label="UTM medium"   value={app.utm_medium} />
            <FieldRow label="UTM campaign" value={app.utm_campaign} />
            <FieldRow label="Referrer"     value={app.referrer} />
          </dl>
        </div>

        {/* Col 2 — GoWild Pass + Current Tools */}
        <div>
          <SectionLabel>GoWild Pass</SectionLabel>
          <dl>
            <FieldRow label="Status"            value={labelFor(app.gowild_status,             GOWILD_STATUS_OPTIONS)} />
            <FieldRow label="Pass duration"      value={labelFor(app.gowild_pass_duration,      GOWILD_PASS_DURATION_OPTIONS)} />
            <FieldRow label="Search frequency"   value={labelFor(app.gowild_search_frequency,   GOWILD_SEARCH_FREQUENCY_OPTIONS)} />
            <FieldRow label="Frontier frequency" value={labelFor(app.frontier_flight_frequency,  FRONTIER_FLIGHT_FREQUENCY_OPTIONS)} />
          </dl>

          <SectionLabel>Current Tools</SectionLabel>
          <dl>
            <FieldRow label="Uses GoWild tool" value={labelFor(app.uses_gowild_search_tool, USES_GOWILD_SEARCH_TOOL_OPTIONS)} />
            <FieldRow label="Tool name"         value={app.gowild_search_tool_name} />
          </dl>
        </div>

        {/* Col 3 — Beta Experience + Availability & Device + Optional */}
        <div>
          <SectionLabel>Beta Experience</SectionLabel>
          <dl>
            <FieldRow label="Experience" value={labelFor(app.beta_testing_experience, BETA_TESTING_EXPERIENCE_OPTIONS)} />
            <FieldRow label="Details"    value={app.beta_testing_details} />
          </dl>

          <SectionLabel>Availability &amp; Device</SectionLabel>
          <dl>
            <FieldRow label="Commitment"      value={app.feedback_commitment ? "Yes" : "No"} />
            <FieldRow label="Primary device"  value={labelFor(app.primary_device,            PRIMARY_DEVICE_OPTIONS)} />
            <FieldRow label="Feedback method" value={labelFor(app.preferred_feedback_method, PREFERRED_FEEDBACK_METHOD_OPTIONS)} />
          </dl>

          <SectionLabel>Optional</SectionLabel>
          <dl>
            <FieldRow label="Destinations"      value={app.frequent_destinations} />
            <FieldRow label="Interested in"     value={interestedLabels || null} />
            <FieldRow label="Value expectation" value={app.value_expectation} />
            <FieldRow label="Additional notes"  value={app.additional_notes} />
          </dl>
        </div>

        {/* Col 4 — Admin actions */}
        <div>
          <SectionLabel>Admin</SectionLabel>
          <dl className="mb-2">
            <FieldRow label="Invited at"  value={fmt(app.invited_at)} />
            <FieldRow label="Selected at" value={fmt(app.selected_at)} />
          </dl>

          {/* Status buttons */}
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5">Set status</p>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
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
                        ? { background: cfg.bg, color: cfg.text, border: `1.5px solid ${cfg.text}` }
                        : { background: "#F2F3F3", color: "#6B7B7B", border: "1.5px solid #E5E7EB" }
                    }
                  >
                    {active && updatingStatus ? "Saving…" : cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Internal notes */}
          <div>
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <HugeiconsIcon icon={Notebook01Icon} size={12} color="currentColor" strokeWidth={2} />
              Internal notes
            </p>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              rows={3}
              placeholder="Private notes visible only to admins…"
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/10 resize-none transition-all"
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
          </div>
        </div>

      </div>
    </div>
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

  // Pagination
  const [page, setPage] = useState(0);

  // Selected row
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Per-row action state
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

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
    return result;
  }, [applications, search, filterStatus, filterGowildStatus, filterDevice, filterAirport]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageRows   = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const hasFilters = !!(search || filterStatus || filterGowildStatus || filterDevice || filterAirport);

  function clearFilters() {
    setSearch("");
    setFilterStatus("");
    setFilterGowildStatus("");
    setFilterDevice("");
    setFilterAirport("");
    setPage(0);
  }

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

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap" style={CARD_STYLE}>
          <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9 flex-1 max-w-xs">
            <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search name, email, airport…"
              className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#6B7B7B]">
                <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="app-input-container" style={{ minHeight: 36, width: 130, flexShrink: 0 }}>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                className="app-input"
                style={{ fontSize: 13, paddingBlock: "0.3em", cursor: "pointer" }}
              >
                <option value="">All statuses</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            <div className="app-input-container" style={{ minHeight: 36, width: 160, flexShrink: 0 }}>
              <select
                value={filterGowildStatus}
                onChange={(e) => { setFilterGowildStatus(e.target.value); setPage(0); }}
                className="app-input"
                style={{ fontSize: 13, paddingBlock: "0.3em", cursor: "pointer" }}
              >
                <option value="">All GoWild statuses</option>
                {GOWILD_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="app-input-container" style={{ minHeight: 36, width: 130, flexShrink: 0 }}>
              <select
                value={filterDevice}
                onChange={(e) => { setFilterDevice(e.target.value); setPage(0); }}
                className="app-input"
                style={{ fontSize: 13, paddingBlock: "0.3em", cursor: "pointer" }}
              >
                <option value="">All devices</option>
                {PRIMARY_DEVICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9" style={{ width: 110, flexShrink: 0 }}>
              <HugeiconsIcon icon={AirportIcon} size={13} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
              <input
                type="text"
                value={filterAirport}
                onChange={(e) => { setFilterAirport(e.target.value); setPage(0); }}
                placeholder="Airport…"
                className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
              />
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-[#9CA3AF] hover:text-[#6B7B7B] transition-colors px-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden p-3" style={CARD_STYLE}>

          {/* Column headers */}
          <div className={`grid ${GRID} gap-3 px-5 py-2.5 border-b border-[#F0F1F1] bg-[#F8F9F9]`}>
            {["Applicant", "Email", "Airport", "GoWild", "Experience", "Device", "Status", "Applied", ""].map((h) => (
              <span key={h} className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{h}</span>
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
                const cfg = statusConfig(app.status);
                const isSelected = selectedId === app.id;
                return (
                  <div key={app.id}>
                    {/* ── Row ── */}
                    <button
                      type="button"
                      onClick={() => setSelectedId((prev) => (prev === app.id ? null : app.id))}
                      className={`w-full text-left grid ${GRID} gap-3 px-5 py-3 items-center transition-colors ${isSelected ? "bg-[#F0FDF4]" : "hover:bg-[#FAFAFA]"}`}
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
                      <span className="text-xs text-[#2E4A4A] truncate">
                        {labelFor(app.gowild_status, GOWILD_STATUS_OPTIONS)}
                      </span>

                      {/* Experience */}
                      <span className="text-xs text-[#2E4A4A] truncate">
                        {labelFor(app.beta_testing_experience, BETA_TESTING_EXPERIENCE_OPTIONS)}
                      </span>

                      {/* Device */}
                      <span className="text-xs text-[#6B7B7B] truncate">
                        {labelFor(app.primary_device, PRIMARY_DEVICE_OPTIONS)}
                      </span>

                      {/* Status badge */}
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap w-fit"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.text }} />
                        {cfg.label}
                      </span>

                      {/* Applied */}
                      <span className="text-xs text-[#9CA3AF]">{fmt(app.created_at)}</span>

                      {/* Chevron */}
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        size={14}
                        color="#9CA3AF"
                        strokeWidth={2}
                        className="flex-shrink-0 transition-transform duration-200 justify-self-center"
                        style={{ transform: isSelected ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>

                    {/* ── Detail panel ── */}
                    {isSelected && (
                      <DetailPanel
                        app={app}
                        onStatusChange={handleStatusChange}
                        onNotesSave={handleNotesSave}
                        updatingStatus={updatingStatusId === app.id}
                        savingNotes={savingNotesId === app.id}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && !loading && (
            <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
          )}
        </div>

      </div>
    </div>
  );
}
