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
  SentIcon,
  ListViewIcon,
} from "@hugeicons/core-free-icons";
import { Clock } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
  AdminSavingIndicator,
  AdminToggleRow,
} from "../developer-tools/DeveloperToolsAdminShell";
import {
  NOTIFICATION_ICON_REGISTRY,
  getNotificationIcon,
} from "@/components/admin/notifications/notificationIconRegistry";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationTypeConfig {
  id: string;
  type: string;
  label: string;
  display_type: string | null;
  notification_group: string;
  icon_name: string | null;
  main_color: string | null;
  background_color: string | null;
  border_color: string | null;
  group_color: string;
  description: string | null;
  default_title: string | null;
  default_body: string | null;
  default_detail_text: string | null;
  audience: string;
  authority: string;
  severity: string;
  sort_order: number;
  is_active: boolean;
  show_in_admin: boolean;
  show_in_user_notifications: boolean;
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
  display_type: string;
  notification_group: string;
  icon_name: string;
  main_color: string;
  background_color: string;
  border_color: string;
  description: string;
  default_title: string;
  default_body: string;
  default_detail_text: string;
  audience: string;
  authority: string;
  severity: string;
  sort_order: number;
  is_active: boolean;
  show_in_admin: boolean;
  show_in_user_notifications: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = ["All", "Admin"] as const;
const AUTHORITY_OPTIONS = ["user", "admin", "system"] as const;
const SEVERITY_OPTIONS = ["info", "success", "warning", "critical"] as const;

const DISPLAY_TYPE_SUGGESTIONS = [
  "Request", "Invite", "Issue", "Flight Alert", "Success", "System", "Reminder",
];
const GROUP_SUGGESTIONS = [
  "Friends", "Trips", "Flights", "Job Schedules", "System", "Account", "GoWild Insights",
];

const SEVERITY_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  info:     { text: "#2563EB", bg: "#EFF6FF",  border: "#BFDBFE" },
  success:  { text: "#059669", bg: "#ECFDF5",  border: "#A7F3D0" },
  warning:  { text: "#D97706", bg: "#FFFBEB",  border: "#FDE68A" },
  critical: { text: "#DC2626", bg: "#FEF2F2",  border: "#FECACA" },
};

const EMPTY_FORM: FormState = {
  type: "",
  label: "",
  display_type: "System",
  notification_group: "General",
  icon_name: "Notification01Icon",
  main_color: "#059669",
  background_color: "#ECFDF5",
  border_color: "#A7F3D0",
  description: "",
  default_title: "",
  default_body: "",
  default_detail_text: "",
  audience: "All",
  authority: "user",
  severity: "info",
  sort_order: 100,
  is_active: true,
  show_in_admin: true,
  show_in_user_notifications: true,
};

const INPUT_CLASS =
  "w-full h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30";
const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30 resize-none";
const SELECT_CLASS = cn(INPUT_CLASS, "cursor-pointer appearance-none");

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  try { return format(parseISO(iso), "MMM d, yyyy h:mm a"); } catch { return iso; }
}

function configToForm(c: NotificationTypeConfig): FormState {
  return {
    type: c.type,
    label: c.label,
    display_type: c.display_type ?? "System",
    notification_group: c.notification_group,
    icon_name: c.icon_name ?? "Notification01Icon",
    main_color: c.main_color ?? c.group_color ?? "#059669",
    background_color: c.background_color ?? "#ECFDF5",
    border_color: c.border_color ?? "#A7F3D0",
    description: c.description ?? "",
    default_title: c.default_title ?? "",
    default_body: c.default_body ?? "",
    default_detail_text: c.default_detail_text ?? "",
    audience: c.audience,
    authority: c.authority ?? "user",
    severity: c.severity ?? "info",
    sort_order: c.sort_order ?? 100,
    is_active: c.is_active,
    show_in_admin: c.show_in_admin ?? true,
    show_in_user_notifications: c.show_in_user_notifications ?? true,
  };
}

function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#059669] border-b border-[#F0F1F1] pb-1">
        {title}
      </p>
      {children}
    </div>
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

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border"
      style={{ color: s.text, background: s.bg, borderColor: s.border }}
    >
      {severity}
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex(value) ? value : "#059669"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 rounded-lg border border-[#E5E7EB] cursor-pointer p-0.5 bg-white flex-shrink-0"
        />
        <input
          className={cn(INPUT_CLASS, "font-mono text-xs")}
          value={value}
          maxLength={7}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
        <div
          className="h-9 w-9 rounded-lg border border-[#E5E7EB] flex-shrink-0"
          style={{ background: isValidHex(value) ? value : "#ccc" }}
        />
      </div>
    </div>
  );
}

// ── Live preview card ─────────────────────────────────────────────────────────

function PreviewCard({ form }: { form: FormState }) {
  const IconComponent = getNotificationIcon(form.icon_name);
  const mainColor = isValidHex(form.main_color) ? form.main_color : "#059669";
  const bgColor = isValidHex(form.background_color) ? form.background_color : "#ECFDF5";
  const borderColor = isValidHex(form.border_color) ? form.border_color : "#A7F3D0";
  const sev = SEVERITY_STYLES[form.severity] ?? SEVERITY_STYLES.info;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9CA3AF]">Live Preview</p>

      {/* Unread state */}
      <div
        className="relative bg-white rounded-2xl border p-4"
        style={{
          borderColor: "rgb(248 113 113)",
          boxShadow: "0 4px 20px 0 rgba(239,68,68,0.14), 0 2px 8px 0 rgba(0,0,0,0.08)",
        }}
      >
        <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 border-2 border-white" />
        <div className="flex items-start gap-3.5">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: bgColor }}
          >
            <HugeiconsIcon icon={IconComponent} size={28} color={mainColor} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-[17px] leading-snug text-[#1A1A1A] font-bold">
                {form.default_title || "Notification Title"}
              </p>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
                style={{ background: bgColor, color: mainColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: mainColor }} />
                {form.display_type || "Type"}
              </span>
            </div>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              {form.default_body || "Notification body text will appear here."}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <Clock size={10} className="text-[#9CA3AF] flex-shrink-0" />
              <span className="text-[11px] text-[#9CA3AF]">just now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Read state */}
      <div
        className="bg-white rounded-2xl border p-4"
        style={{
          borderColor,
          boxShadow: "0 1px 4px 0 rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-start gap-3.5">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: bgColor }}
          >
            <HugeiconsIcon icon={IconComponent} size={28} color={mainColor} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-[17px] leading-snug text-[#1A1A1A] font-semibold">
                {form.default_title || "Notification Title"}
              </p>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
                style={{ background: bgColor, color: mainColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: mainColor }} />
                {form.display_type || "Type"}
              </span>
            </div>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              {form.default_body || "Notification body text will appear here."}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-[#9CA3AF] flex-shrink-0" />
                <span className="text-[11px] text-[#9CA3AF]">5 minutes ago</span>
              </div>
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border"
                style={{ color: sev.text, background: sev.bg, borderColor: sev.border }}
              >
                {form.severity}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  const [modal, setModal] = useState<null | "new" | NotificationTypeConfig>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<NotificationTypeConfig | null>(null);

  // ── Sent tab state ──
  const [sent, setSent] = useState<SentNotification[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentError, setSentError] = useState<string | null>(null);
  const [sentSearch, setSentSearch] = useState("");

  // ── Data loading ──

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: cfgData, error: cfgErr }, { data: statData, error: statErr }] =
        await Promise.all([
          supabase
            .from("notification_type_configs")
            .select("*")
            .order("sort_order")
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

  // ── Derived ──

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
        (n.notification_group ?? "").toLowerCase().includes(q),
    );
  }, [sent, sentSearch]);

  // ── Modal actions ──

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
    const errs: string[] = [];
    if (!form.type.trim())              errs.push("Type identifier is required.");
    if (!form.label.trim())             errs.push("Label is required.");
    if (!form.display_type.trim())      errs.push("Display type is required.");
    if (!form.notification_group.trim()) errs.push("Group is required.");
    if (!NOTIFICATION_ICON_REGISTRY.find((e) => e.name === form.icon_name)) errs.push("Select a valid icon.");
    if (!isValidHex(form.main_color))   errs.push("Main color must be a valid hex value.");
    if (!isValidHex(form.background_color)) errs.push("Background color must be a valid hex value.");
    if (!isValidHex(form.border_color)) errs.push("Border color must be a valid hex value.");
    if (!SEVERITY_OPTIONS.includes(form.severity as typeof SEVERITY_OPTIONS[number])) errs.push("Invalid severity.");
    if (isNaN(form.sort_order))         errs.push("Sort order must be a number.");
    if (errs.length) { setSaveError(errs.join(" ")); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        label:                      form.label.trim(),
        display_type:               form.display_type.trim(),
        notification_group:         form.notification_group.trim() || "General",
        icon_name:                  form.icon_name,
        main_color:                 form.main_color,
        background_color:           form.background_color,
        border_color:               form.border_color,
        group_color:                form.main_color,
        description:                form.description.trim() || null,
        default_title:              form.default_title.trim() || null,
        default_body:               form.default_body.trim() || null,
        default_detail_text:        form.default_detail_text.trim() || null,
        audience:                   form.audience,
        authority:                  form.authority,
        severity:                   form.severity,
        sort_order:                 form.sort_order,
        is_active:                  form.is_active,
        show_in_admin:              form.show_in_admin,
        show_in_user_notifications: form.show_in_user_notifications,
      };

      if (modal === "new") {
        const { data, error: err } = await supabase
          .from("notification_type_configs")
          .insert({
            ...payload,
            type: form.type.trim().toLowerCase().replace(/\s+/g, "_"),
          })
          .select()
          .single();
        if (err) throw err;
        setConfigs((prev) =>
          [...prev, data as NotificationTypeConfig].sort(
            (a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.label.localeCompare(b.label),
          ),
        );
      } else if (modal) {
        const { data, error: err } = await supabase
          .from("notification_type_configs")
          .update(payload)
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DeveloperToolsAdminShell
      title="Notifications Control Room"
      description="Configure notification types, groups, templates, icon, colors, and audience visibility across the app."
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
          { id: "types" as TabOption, label: "Types",  icon: ListViewIcon },
          { id: "sent"  as TabOption, label: "Sent",   icon: SentIcon },
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
                const mainColor = cfg.main_color ?? cfg.group_color ?? "#059669";
                const bgColor = cfg.background_color ?? "#ECFDF5";
                const IconComp = getNotificationIcon(cfg.icon_name);
                return (
                  <AdminCard key={cfg.id} className="flex items-center gap-3 py-3.5">
                    {/* Color strip */}
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: mainColor }} />

                    {/* Icon preview */}
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: bgColor }}
                    >
                      <HugeiconsIcon icon={IconComp} size={18} color={mainColor} strokeWidth={1.5} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm font-bold text-[#1A2E2E]", !cfg.is_active && "opacity-40 line-through")}>
                          {cfg.label}
                        </span>
                        {cfg.display_type && (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border"
                            style={{
                              color: mainColor,
                              background: bgColor,
                              borderColor: cfg.border_color ?? "#A7F3D0",
                            }}
                          >
                            {cfg.display_type}
                          </span>
                        )}
                        <AudienceBadge audience={cfg.audience} />
                        <SeverityBadge severity={cfg.severity ?? "info"} />
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
                      {/* Color swatches */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {[mainColor, bgColor, cfg.border_color ?? "#A7F3D0"].map((hex, i) => (
                          <div
                            key={i}
                            title={hex}
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ background: hex }}
                          />
                        ))}
                        <span className="text-[11px] text-[#9CA3AF] ml-1">
                          {stat ? `${stat.total_count.toLocaleString()} sent` : "0 sent"}
                          {stat?.last_sent && ` · Last: ${fmtDate(stat.last_sent)}`}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
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
          <input
            className={INPUT_CLASS}
            placeholder="Search by title, type, or group…"
            value={sentSearch}
            onChange={(e) => setSentSearch(e.target.value)}
          />
          {sentError && <AdminCard className="text-xs text-red-500 font-semibold">{sentError}</AdminCard>}
          {sentLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => <AdminCard key={i} className="animate-pulse h-16" />)}
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
                {sentFiltered.length} notification{sentFiltered.length !== 1 ? "s" : ""}{sentSearch ? " matching search" : ""}
              </p>
              {sentFiltered.map((n) => (
                <AdminCard key={n.id} className="flex items-center gap-3 py-3">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: n.is_read ? "#E5E7EB" : "#EF4444" }} />
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
                    {n.body && <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{n.body}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[#9CA3AF]">
                      <span className="font-mono">{n.user_id.slice(-8)}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
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

      {/* ══ EDIT / CREATE MODAL ══ */}
      <AnimatePresence>
        {modal !== null && (
          <motion.div
            key="notif-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="w-full max-w-4xl rounded-2xl bg-[#F8F9FA] shadow-2xl overflow-hidden my-4"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F1F1] bg-white">
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

              {/* Modal body: form left | preview right */}
              <div className="flex flex-col lg:flex-row gap-0">

                {/* ── Left: form ── */}
                <div className="flex-1 px-5 py-5 flex flex-col gap-5 overflow-y-auto max-h-[75vh] lg:max-h-[80vh]">

                  {/* Identity */}
                  <FormSection title="Identity">
                    <div>
                      <FieldLabel required>Type Identifier</FieldLabel>
                      <input
                        className={cn(INPUT_CLASS, modal !== "new" && "opacity-60 cursor-not-allowed bg-[#F9FAFA]")}
                        placeholder="e.g. friend_request_received"
                        value={form.type}
                        readOnly={modal !== "new"}
                        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      />
                      <p className="text-[11px] text-[#9CA3AF] mt-1">Exact event key. Lowercase with underscores. Cannot change after creation.</p>
                    </div>
                    <div>
                      <FieldLabel required>Display Label</FieldLabel>
                      <input
                        className={INPUT_CLASS}
                        placeholder="e.g. Friend Request Received"
                        value={form.label}
                        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel required>Display Type</FieldLabel>
                        <input
                          className={INPUT_CLASS}
                          list="display-type-suggestions"
                          placeholder="e.g. Request"
                          value={form.display_type}
                          onChange={(e) => setForm((f) => ({ ...f, display_type: e.target.value }))}
                        />
                        <datalist id="display-type-suggestions">
                          {DISPLAY_TYPE_SUGGESTIONS.map((v) => <option key={v} value={v} />)}
                        </datalist>
                      </div>
                      <div>
                        <FieldLabel required>Group</FieldLabel>
                        <input
                          className={INPUT_CLASS}
                          list="group-suggestions"
                          placeholder="e.g. Friends"
                          value={form.notification_group}
                          onChange={(e) => setForm((f) => ({ ...f, notification_group: e.target.value }))}
                        />
                        <datalist id="group-suggestions">
                          {GROUP_SUGGESTIONS.map((v) => <option key={v} value={v} />)}
                        </datalist>
                      </div>
                    </div>
                  </FormSection>

                  {/* Classification */}
                  <FormSection title="Classification">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Severity</FieldLabel>
                        <select
                          className={SELECT_CLASS}
                          value={form.severity}
                          onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                        >
                          {SEVERITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Audience</FieldLabel>
                        <select
                          className={SELECT_CLASS}
                          value={form.audience}
                          onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                        >
                          {AUDIENCE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Authority</FieldLabel>
                        <select
                          className={SELECT_CLASS}
                          value={form.authority}
                          onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))}
                        >
                          {AUTHORITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Sort Order</FieldLabel>
                        <input
                          type="number"
                          className={INPUT_CLASS}
                          value={form.sort_order}
                          onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 100 }))}
                        />
                      </div>
                    </div>
                  </FormSection>

                  {/* Icon */}
                  <FormSection title="Icon">
                    <div>
                      <FieldLabel>Select Icon</FieldLabel>
                      <div className="grid grid-cols-5 gap-2">
                        {NOTIFICATION_ICON_REGISTRY.map((entry) => {
                          const selected = form.icon_name === entry.name;
                          const mainColor = isValidHex(form.main_color) ? form.main_color : "#059669";
                          const bgColor = isValidHex(form.background_color) ? form.background_color : "#ECFDF5";
                          return (
                            <button
                              key={entry.name}
                              type="button"
                              title={entry.label}
                              onClick={() => setForm((f) => ({ ...f, icon_name: entry.name }))}
                              className={cn(
                                "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all",
                                selected
                                  ? "border-[#059669] shadow-sm"
                                  : "border-[#E5E7EB] hover:border-[#059669]/40 bg-white",
                              )}
                              style={selected ? { background: bgColor } : {}}
                            >
                              <HugeiconsIcon
                                icon={entry.Icon}
                                size={20}
                                color={selected ? mainColor : "#9CA3AF"}
                                strokeWidth={1.5}
                              />
                              <span className="text-[9px] text-center text-[#9CA3AF] leading-tight line-clamp-1 w-full">
                                {entry.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </FormSection>

                  {/* Colors */}
                  <FormSection title="Colors">
                    <ColorField label="Main Color" value={form.main_color} onChange={(v) => setForm((f) => ({ ...f, main_color: v }))} />
                    <ColorField label="Background Color" value={form.background_color} onChange={(v) => setForm((f) => ({ ...f, background_color: v }))} />
                    <ColorField label="Border Color" value={form.border_color} onChange={(v) => setForm((f) => ({ ...f, border_color: v }))} />
                  </FormSection>

                  {/* Templates */}
                  <FormSection title="Default Templates">
                    <div>
                      <FieldLabel>Default Title</FieldLabel>
                      <input
                        className={INPUT_CLASS}
                        placeholder="Optional template for notification title"
                        value={form.default_title}
                        onChange={(e) => setForm((f) => ({ ...f, default_title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Default Body</FieldLabel>
                      <textarea
                        className={TEXTAREA_CLASS}
                        rows={2}
                        placeholder="Optional template for notification body"
                        value={form.default_body}
                        onChange={(e) => setForm((f) => ({ ...f, default_body: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Default Detail Text</FieldLabel>
                      <textarea
                        className={TEXTAREA_CLASS}
                        rows={2}
                        placeholder="Optional extended technical detail"
                        value={form.default_detail_text}
                        onChange={(e) => setForm((f) => ({ ...f, default_detail_text: e.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Description</FieldLabel>
                      <textarea
                        className={TEXTAREA_CLASS}
                        rows={2}
                        placeholder="Brief description of when this notification is sent"
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                  </FormSection>

                  {/* Visibility */}
                  <FormSection title="Visibility">
                    <AdminToggleRow
                      label="Active"
                      description="Inactive types are hidden from the app and cannot receive new notifications."
                      checked={form.is_active}
                      onChange={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    />
                    <AdminToggleRow
                      label="Show in Admin"
                      description="Surface sent notifications of this type in the admin Sent tab."
                      checked={form.show_in_admin}
                      onChange={() => setForm((f) => ({ ...f, show_in_admin: !f.show_in_admin }))}
                    />
                    <AdminToggleRow
                      label="Show in User Notifications"
                      description="Display these notifications in the user-facing Notifications page."
                      checked={form.show_in_user_notifications}
                      onChange={() => setForm((f) => ({ ...f, show_in_user_notifications: !f.show_in_user_notifications }))}
                    />
                  </FormSection>

                  {saveError && (
                    <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>
                  )}
                </div>

                {/* ── Right: live preview ── */}
                <div className="lg:w-80 lg:flex-shrink-0 px-5 py-5 border-t lg:border-t-0 lg:border-l border-[#F0F1F1] bg-[#F8F9FA]">
                  <div className="lg:sticky lg:top-5">
                    <PreviewCard form={form} />
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-between px-5 pt-3 pb-4 border-t border-[#F0F1F1] bg-white">
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

      {/* ══ DELETE CONFIRM ══ */}
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
