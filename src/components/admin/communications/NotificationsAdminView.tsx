import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Cancel01Icon,
  PencilEdit01Icon,
  Tick02Icon,
  ArrowReloadHorizontalIcon,
  Delete01Icon,
  Notification01Icon,
  UserGroupIcon,
  Settings01Icon,
  SentIcon,
  ListViewIcon,
} from "@hugeicons/core-free-icons";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
  AdminSavingIndicator,
  AdminToggleRow,
} from "../developer-tools/DeveloperToolsAdminShell";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationTypeConfig {
  id: string;
  type: string;
  label: string;
  notification_group: string;
  group_color: string;
  description: string | null;
  default_title: string | null;
  default_body: string | null;
  audience: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TypeStat {
  total_count: number;
  last_sent: string | null;
}

interface SentNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  notification_group: string;
  audience: string;
  is_read: boolean;
  created_at: string;
}

type TabOption = "types" | "sent";

type FormState = {
  type: string;
  label: string;
  notification_group: string;
  group_color: string;
  description: string;
  default_title: string;
  default_body: string;
  audience: string;
  is_active: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = ["All", "Admin"] as const;

const COLOR_PRESETS = [
  { hex: "#3B82F6", name: "Blue" },
  { hex: "#10B981", name: "Emerald" },
  { hex: "#F59E0B", name: "Amber" },
  { hex: "#8B5CF6", name: "Purple" },
  { hex: "#EF4444", name: "Red" },
  { hex: "#6B7280", name: "Gray" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#059669", name: "Green" },
];

const GROUP_SUGGESTIONS = ["Flights", "Friends", "System", "Admin", "Performance", "General"];

const EMPTY_FORM: FormState = {
  type: "",
  label: "",
  notification_group: "General",
  group_color: "#059669",
  description: "",
  default_title: "",
  default_body: "",
  audience: "All",
  is_active: true,
};

const INPUT_CLASS =
  "w-full h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30";

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30 resize-none";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  try { return format(parseISO(iso), "MMM d, yyyy h:mm a"); } catch { return iso; }
}

function configToForm(c: NotificationTypeConfig): FormState {
  return {
    type: c.type,
    label: c.label,
    notification_group: c.notification_group,
    group_color: c.group_color,
    description: c.description ?? "",
    default_title: c.default_title ?? "",
    default_body: c.default_body ?? "",
    audience: c.audience,
    is_active: c.is_active,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function AudienceBadge({ audience }: { audience: string }) {
  const style =
    audience === "Admin"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${style}`}>
      {audience}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <AdminCard className="flex flex-col gap-0.5 min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">{label}</p>
      <p className="text-2xl font-black text-[#1A2E2E] leading-none mt-1">{value}</p>
      {sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</p>}
    </AdminCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationsAdminView() {
  const [activeTab, setActiveTab] = useState<TabOption>("types");

  // ── Types tab state ──
  const [configs, setConfigs] = useState<NotificationTypeConfig[]>([]);
  const [stats, setStats] = useState<Record<string, TypeStat>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // null = closed, "new" = creating, config = editing
  const [modal, setModal] = useState<null | "new" | NotificationTypeConfig>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<NotificationTypeConfig | null>(null);

  // ── Sent tab state ──
  const [sent, setSent] = useState<SentNotification[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentError, setSentError] = useState<string | null>(null);
  const [sentSearch, setSentSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: cfgData, error: cfgErr }, { data: statData, error: statErr }] =
        await Promise.all([
          supabase
            .from("notification_type_configs")
            .select("*")
            .order("notification_group")
            .order("label"),
          supabase.rpc("get_notification_type_stats"),
        ]);

      if (cfgErr) throw cfgErr;
      if (statErr) throw statErr;

      setConfigs((cfgData ?? []) as NotificationTypeConfig[]);

      const statsMap: Record<string, TypeStat> = {};
      for (const row of statData ?? []) {
        statsMap[row.type] = { total_count: Number(row.total_count), last_sent: row.last_sent };
      }
      setStats(statsMap);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadSent = async () => {
    setSentLoading(true);
    setSentError(null);
    try {
      const { data, error: err } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, body, notification_group, audience, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) throw err;
      setSent((data ?? []) as SentNotification[]);
    } catch (e: unknown) {
      setSentError(e instanceof Error ? e.message : String(e));
    } finally {
      setSentLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (activeTab === "sent" && sent.length === 0 && !sentLoading) loadSent();
  }, [activeTab]);

  const byGroup = useMemo(() => {
    const map: Record<string, NotificationTypeConfig[]> = {};
    for (const c of configs) {
      (map[c.notification_group] ??= []).push(c);
    }
    return map;
  }, [configs]);

  const totalSent = useMemo(
    () => Object.values(stats).reduce((s, v) => s + v.total_count, 0),
    [stats],
  );

  const sentFiltered = useMemo(() => {
    if (!sentSearch.trim()) return sent;
    const q = sentSearch.toLowerCase();
    return sent.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.notification_group.toLowerCase().includes(q),
    );
  }, [sent, sentSearch]);

  const openEdit = (cfg: NotificationTypeConfig) => {
    setForm(configToForm(cfg));
    setSaveError(null);
    setModal(cfg);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModal("new");
  };

  const closeModal = () => { setModal(null); setSaveError(null); };

  const handleToggleActive = async (cfg: NotificationTypeConfig) => {
    const { error: err } = await supabase
      .from("notification_type_configs")
      .update({ is_active: !cfg.is_active })
      .eq("id", cfg.id);
    if (!err) setConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, is_active: !c.is_active } : c));
  };

  const handleSave = async () => {
    if (!form.type.trim() || !form.label.trim()) {
      setSaveError("Type identifier and label are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (modal === "new") {
        const { data, error: err } = await supabase
          .from("notification_type_configs")
          .insert({
            type: form.type.trim().toLowerCase().replace(/\s+/g, "_"),
            label: form.label.trim(),
            notification_group: form.notification_group.trim() || "General",
            group_color: form.group_color,
            description: form.description.trim() || null,
            default_title: form.default_title.trim() || null,
            default_body: form.default_body.trim() || null,
            audience: form.audience,
            is_active: form.is_active,
          })
          .select()
          .single();
        if (err) throw err;
        setConfigs((prev) => [...prev, data as NotificationTypeConfig].sort((a, b) =>
          a.notification_group.localeCompare(b.notification_group) || a.label.localeCompare(b.label),
        ));
      } else if (modal && modal !== "new") {
        const { data, error: err } = await supabase
          .from("notification_type_configs")
          .update({
            label: form.label.trim(),
            notification_group: form.notification_group.trim() || "General",
            group_color: form.group_color,
            description: form.description.trim() || null,
            default_title: form.default_title.trim() || null,
            default_body: form.default_body.trim() || null,
            audience: form.audience,
            is_active: form.is_active,
          })
          .eq("id", modal.id)
          .select()
          .single();
        if (err) throw err;
        setConfigs((prev) => prev.map((c) => c.id === modal.id ? data as NotificationTypeConfig : c));
      }
      closeModal();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error: err } = await supabase
      .from("notification_type_configs")
      .delete()
      .eq("id", confirmDelete.id);
    if (!err) setConfigs((prev) => prev.filter((c) => c.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  return (
    <DeveloperToolsAdminShell
      title="Notifications Control Room"
      description="Configure notification types, groups, templates, and audience visibility across the app."
      actions={
        <>
          <button
            type="button"
            onClick={activeTab === "types" ? load : loadSent}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors"
            title="Refresh"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={17} color="currentColor" strokeWidth={2} />
          </button>
          {activeTab === "types" && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#059669] text-white text-xs font-bold hover:bg-[#047857] transition-colors"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={14} color="white" strokeWidth={2.5} />
              New Type
            </button>
          )}
        </>
      }
      loading={loading}
      error={error}
    >
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F2F3F3] self-start">
        {([
          { id: "types" as TabOption, label: "Types", icon: ListViewIcon },
          { id: "sent"  as TabOption, label: "Sent",  icon: SentIcon },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-bold transition-all",
              activeTab === id
                ? "bg-white text-[#1A2E2E] shadow-sm"
                : "text-[#9CA3AF] hover:text-[#6B7280]",
            )}
          >
            <HugeiconsIcon icon={icon} size={13} color="currentColor" strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {/* ══ TYPES TAB ══ */}
      {activeTab === "types" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Types Configured" value={configs.length} />
            <StatCard label="Active Types" value={configs.filter((c) => c.is_active).length} />
            <StatCard label="Total Sent" value={totalSent.toLocaleString()} sub="all time" />
            <StatCard label="Groups" value={Object.keys(byGroup).length} />
          </div>

          {Object.keys(byGroup).length === 0 && !loading && (
            <AdminCard className="flex flex-col items-center py-10 gap-3 text-center">
              <HugeiconsIcon icon={Notification01Icon} size={28} color="#9CA3AF" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-[#6B7280]">No notification types configured yet.</p>
              <button type="button" onClick={openCreate} className="text-xs font-bold text-[#059669] hover:underline">
                Add the first type
              </button>
            </AdminCard>
          )}

          {Object.entries(byGroup).map(([group, items]) => (
            <div key={group} className="flex flex-col gap-2">
              <AdminSectionLabel>{group}</AdminSectionLabel>
              {items.map((cfg) => {
                const stat = stats[cfg.type];
                return (
                  <AdminCard key={cfg.id} className="flex items-center gap-3 py-3.5">
                    <div
                      className="w-1 self-stretch rounded-full flex-shrink-0"
                      style={{ background: cfg.group_color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm font-bold text-[#1A2E2E]", !cfg.is_active && "opacity-40 line-through")}>
                          {cfg.label}
                        </span>
                        <AudienceBadge audience={cfg.audience} />
                        {!cfg.is_active && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB]">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">{cfg.type}</p>
                      {cfg.description && (
                        <p className="text-xs text-[#6B7280] mt-1 leading-relaxed line-clamp-1">{cfg.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#9CA3AF]">
                        <span>{stat ? `${stat.total_count.toLocaleString()} sent` : "0 sent"}</span>
                        {stat?.last_sent && <span>· Last: {fmtDate(stat.last_sent)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(cfg)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors"
                        title="Edit"
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} size={15} color="currentColor" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(cfg)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={15} color="currentColor" strokeWidth={2} />
                      </button>
                    </div>
                  </AdminCard>
                );
              })}
            </div>
          ))}
        </>
      )}

      {/* ══ SENT TAB ══ */}
      {activeTab === "sent" && (
        <>
          {/* Search bar */}
          <input
            className="w-full h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
            placeholder="Search by title, type, or group…"
            value={sentSearch}
            onChange={(e) => setSentSearch(e.target.value)}
          />

          {sentError && (
            <AdminCard className="text-xs text-red-500 font-semibold">{sentError}</AdminCard>
          )}

          {sentLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <AdminCard key={i} className="animate-pulse h-16" />
              ))}
            </div>
          )}

          {!sentLoading && sentFiltered.length === 0 && (
            <AdminCard className="flex flex-col items-center py-10 gap-3 text-center">
              <HugeiconsIcon icon={SentIcon} size={28} color="#9CA3AF" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-[#6B7280]">
                {sentSearch ? "No notifications match your search." : "No sent notifications found."}
              </p>
            </AdminCard>
          )}

          {!sentLoading && sentFiltered.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-[#9CA3AF] font-semibold px-0.5">
                {sentFiltered.length} notification{sentFiltered.length !== 1 ? "s" : ""}
                {sentSearch ? " matching search" : ""}
              </p>
              {sentFiltered.map((n) => (
                <AdminCard key={n.id} className="flex items-center gap-3 py-3">
                  {/* Read/unread indicator strip */}
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ background: n.is_read ? "#E5E7EB" : "#EF4444" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#1A2E2E]">{n.title}</span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border"
                        style={{
                          background: n.is_read ? "#F3F4F6" : "#FEF2F2",
                          color: n.is_read ? "#9CA3AF" : "#EF4444",
                          borderColor: n.is_read ? "#E5E7EB" : "#FECACA",
                        }}
                      >
                        {n.is_read ? "Read" : "Unread"}
                      </span>
                      <AudienceBadge audience={n.audience ?? "All"} />
                    </div>
                    <p className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">{n.type}</p>
                    {n.body && (
                      <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{n.body}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[#9CA3AF]">
                      <span className="font-mono">{n.user_id.slice(-8)}</span>
                      <span>·</span>
                      <span>
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                      <span>·</span>
                      <span>{fmtDate(n.created_at)}</span>
                    </div>
                  </div>
                </AdminCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Edit / Create modal ── */}
      <AnimatePresence>
        {modal !== null && (
          <motion.div
            key="notif-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F1F1]">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}>
                    <HugeiconsIcon icon={modal === "new" ? PlusSignIcon : PencilEdit01Icon} size={13} color="white" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-base font-black text-[#1A2E2E]">
                    {modal === "new" ? "New Notification Type" : `Edit: ${(modal as NotificationTypeConfig).label}`}
                  </h3>
                </div>
                <button type="button" onClick={closeModal} className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors">
                  <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                {/* Type identifier (read-only in edit) */}
                <div>
                  <FieldLabel required>Type Identifier</FieldLabel>
                  <input
                    className={cn(INPUT_CLASS, modal !== "new" && "opacity-60 cursor-not-allowed bg-[#F9FAFA]")}
                    placeholder="e.g. friend_request_received"
                    value={form.type}
                    readOnly={modal !== "new"}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  />
                  <p className="text-[11px] text-[#9CA3AF] mt-1">Matches the <span className="font-mono">type</span> field on the notifications table. Lowercase with underscores.</p>
                </div>

                {/* Label */}
                <div>
                  <FieldLabel required>Display Label</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    placeholder="e.g. Friend Request Received"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>

                {/* Group + Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Group</FieldLabel>
                    <input
                      className={INPUT_CLASS}
                      list="group-suggestions"
                      placeholder="e.g. Friends"
                      value={form.notification_group}
                      onChange={(e) => setForm((f) => ({ ...f, notification_group: e.target.value }))}
                    />
                    <datalist id="group-suggestions">
                      {GROUP_SUGGESTIONS.map((g) => <option key={g} value={g} />)}
                    </datalist>
                  </div>
                  <div>
                    <FieldLabel>Audience</FieldLabel>
                    <select
                      className={cn(INPUT_CLASS, "cursor-pointer")}
                      value={form.audience}
                      onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                    >
                      {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                {/* Group Color */}
                <div>
                  <FieldLabel>Group Color</FieldLabel>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.name}
                        onClick={() => setForm((f) => ({ ...f, group_color: c.hex }))}
                        className={cn(
                          "h-7 w-7 rounded-full flex-shrink-0 transition-all",
                          form.group_color === c.hex ? "ring-2 ring-offset-2 ring-[#1A2E2E] scale-110" : "hover:scale-110",
                        )}
                        style={{ background: c.hex }}
                      />
                    ))}
                    <div className="flex items-center gap-1.5 ml-1">
                      <input
                        type="color"
                        value={form.group_color}
                        onChange={(e) => setForm((f) => ({ ...f, group_color: e.target.value }))}
                        className="h-7 w-7 rounded-lg border border-[#E5E7EB] cursor-pointer p-0.5 bg-white"
                        title="Custom color"
                      />
                      <span className="text-[11px] font-mono text-[#9CA3AF]">{form.group_color}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    className={TEXTAREA_CLASS}
                    rows={2}
                    placeholder="Brief description of when this notification is sent..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                {/* Default Title / Body */}
                <div>
                  <FieldLabel>Default Title Template</FieldLabel>
                  <input
                    className={INPUT_CLASS}
                    placeholder="Optional — template for the notification title"
                    value={form.default_title}
                    onChange={(e) => setForm((f) => ({ ...f, default_title: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Default Body Template</FieldLabel>
                  <textarea
                    className={TEXTAREA_CLASS}
                    rows={2}
                    placeholder="Optional — template for the notification body"
                    value={form.default_body}
                    onChange={(e) => setForm((f) => ({ ...f, default_body: e.target.value }))}
                  />
                </div>

                {/* Is Active */}
                <AdminToggleRow
                  label="Active"
                  description="Inactive types are hidden from the app and cannot receive new notifications."
                  checked={form.is_active}
                  onChange={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                />

                {saveError && (
                  <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-between px-5 pt-3 pb-4 border-t border-[#F0F1F1]">
                {saving ? <AdminSavingIndicator /> : <span />}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={closeModal} className="h-9 px-4 rounded-xl text-sm font-semibold text-[#6B7280] hover:bg-[#F2F3F3] transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#059669] text-white text-sm font-bold hover:bg-[#047857] transition-colors disabled:opacity-50"
                  >
                    <HugeiconsIcon icon={Tick02Icon} size={14} color="white" strokeWidth={2.5} />
                    {modal === "new" ? "Create" : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirm ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            key="delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6"
            >
              <h3 className="text-base font-black text-[#1A2E2E] mb-1">Delete Notification Type?</h3>
              <p className="text-sm text-[#6B7280] mb-5">
                <span className="font-semibold text-[#1A2E2E]">{confirmDelete.label}</span> will be removed from the registry. Existing notifications of this type are not affected.
              </p>
              <div className="flex items-center gap-2 justify-end">
                <button type="button" onClick={() => setConfirmDelete(null)} className="h-9 px-4 rounded-xl text-sm font-semibold text-[#6B7280] hover:bg-[#F2F3F3] transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleDelete} className="h-9 px-4 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DeveloperToolsAdminShell>
  );
}
