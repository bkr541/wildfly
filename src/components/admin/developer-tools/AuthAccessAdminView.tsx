import { useState, useEffect, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Copy01Icon, PlusSignIcon, ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
} from "./DeveloperToolsAdminShell";

// ── Types ─────────────────────────────────────────────────────────────────────

type DevUser = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type SubRow = {
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  email: string | null;
};

type SessionInfo = {
  id: string;
  email: string | null;
  lastSignIn: string | null;
  role: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  trialing: "bg-blue-50 text-blue-700 border-blue-200",
  canceled: "bg-red-50 text-red-700 border-red-200",
  past_due: "bg-amber-50 text-amber-700 border-amber-200",
};
const defaultStatusStyle = "bg-[#F4F5F5] text-[#6B7B7B] border-[#E8EBEB]";

const TABLE_BADGE_STYLES: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  canceled: "bg-red-100 text-red-700",
  past_due: "bg-amber-100 text-amber-700",
};
const defaultTableBadge = "bg-[#F4F5F5] text-[#6B7B7B]";

// ── View ──────────────────────────────────────────────────────────────────────

export function AuthAccessAdminView() {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [session, setSession]   = useState<SessionInfo | null>(null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [subs, setSubs]         = useState<SubRow[]>([]);
  const [addingUid, setAddingUid] = useState("");
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Current session
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSession({
          id: user.id,
          email: user.email ?? null,
          lastSignIn: user.last_sign_in_at ?? null,
          role: user.role ?? null,
        });
      }

      // Developer allowlist
      const { data: devList, error: devErr } = await supabase
        .from("developer_allowlist")
        .select("user_id");
      if (devErr) throw devErr;

      if (devList && devList.length > 0) {
        const uids = devList.map((d) => d.user_id);
        const { data: infos } = await supabase
          .from("user_info")
          .select("auth_user_id, email, first_name, last_name")
          .in("auth_user_id", uids);
        const infoMap = Object.fromEntries(
          (infos ?? []).map((u) => [u.auth_user_id, u]),
        );
        setDevUsers(
          devList.map((d) => ({
            user_id: d.user_id,
            email: infoMap[d.user_id]?.email ?? null,
            first_name: infoMap[d.user_id]?.first_name ?? null,
            last_name: infoMap[d.user_id]?.last_name ?? null,
          })),
        );
      } else {
        setDevUsers([]);
      }

      // Subscriptions
      const { data: subList, error: subErr } = await supabase
        .from("user_subscriptions")
        .select("user_id, plan_id, status, current_period_end")
        .order("status");
      if (subErr) throw subErr;

      if (subList && subList.length > 0) {
        const subUids = subList.map((s) => s.user_id);
        const { data: subInfos } = await supabase
          .from("user_info")
          .select("auth_user_id, email")
          .in("auth_user_id", subUids);
        const subInfoMap = Object.fromEntries(
          (subInfos ?? []).map((u) => [u.auth_user_id, u]),
        );
        setSubs(
          subList.map((s) => ({
            ...s,
            email: subInfoMap[s.user_id]?.email ?? null,
          })),
        );
      } else {
        setSubs([]);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load auth & access data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addToAllowlist = async () => {
    const uid = addingUid.trim();
    if (!uid || saving) return;
    setSaving(true);
    const { error: err } = await supabase
      .from("developer_allowlist")
      .insert({ user_id: uid });
    if (err) {
      toast.error(err.message);
    } else {
      toast.success("Added to developer allowlist");
      setAddingUid("");
      await load();
    }
    setSaving(false);
  };

  const removeFromAllowlist = async (userId: string) => {
    if (saving) return;
    setSaving(true);
    const { error: err } = await supabase
      .from("developer_allowlist")
      .delete()
      .eq("user_id", userId);
    if (err) {
      toast.error(err.message);
    } else {
      toast.success("Removed from developer allowlist");
      await load();
    }
    setSaving(false);
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const subByStatus = subs.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DeveloperToolsAdminShell
      title="Auth & Access"
      description="Manage developer access, inspect active subscriptions, and review the current admin session."
      loading={loading}
      error={error}
      actions={
        <button
          onClick={load}
          disabled={loading}
          title="Refresh"
          className="flex items-center justify-center w-8 h-8 rounded-xl text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors disabled:opacity-40"
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} color="currentColor" strokeWidth={2} />
        </button>
      }
    >
      {/* ── Current Session ───────────────────────────────────────── */}
      <AdminCard>
        <AdminSectionLabel>Current Session</AdminSectionLabel>
        {session ? (
          <div className="divide-y divide-[#F4F5F5]">
            {([
              { label: "User ID",      value: session.id,        copyable: true  },
              { label: "Email",        value: session.email ?? "—", copyable: false },
              { label: "Role",         value: session.role ?? "—", copyable: false },
              { label: "Last Sign In", value: session.lastSignIn ? new Date(session.lastSignIn).toLocaleString() : "—", copyable: false },
            ] as { label: string; value: string; copyable: boolean }[]).map(({ label, value, copyable }) => (
              <div key={label} className="flex items-center gap-3 py-2">
                <span className="text-[11px] font-semibold text-[#9CA3AF] w-24 shrink-0 uppercase tracking-wide">{label}</span>
                <span className="text-xs font-mono text-[#1A2E2E] truncate flex-1 min-w-0">{value}</span>
                {copyable && (
                  <button
                    onClick={() => copy(value)}
                    className="text-[#9CA3AF] hover:text-[#059669] transition-colors flex-shrink-0"
                    title="Copy"
                  >
                    <HugeiconsIcon icon={Copy01Icon} size={12} color="currentColor" strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#9CA3AF]">No active session.</p>
        )}
      </AdminCard>

      {/* ── Developer Allowlist ───────────────────────────────────── */}
      <AdminCard>
        <AdminSectionLabel>Developer Allowlist — {devUsers.length} {devUsers.length === 1 ? "member" : "members"}</AdminSectionLabel>

        {devUsers.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] mb-4">No users in the developer allowlist.</p>
        ) : (
          <div className="flex flex-col gap-1 mb-4">
            {devUsers.map((u) => {
              const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || null;
              return (
                <div
                  key={u.user_id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#F8F9F9] group"
                >
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                  >
                    {name ? name[0].toUpperCase() : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1A2E2E] leading-tight truncate">
                      {name ?? u.email ?? "Unknown"}
                    </p>
                    <p className="text-[10px] font-mono text-[#9CA3AF] truncate">{u.user_id}</p>
                  </div>
                  <button
                    onClick={() => copy(u.user_id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9CA3AF] hover:text-[#059669] flex-shrink-0"
                    title="Copy UUID"
                  >
                    <HugeiconsIcon icon={Copy01Icon} size={12} color="currentColor" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => removeFromAllowlist(u.user_id)}
                    disabled={saving}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9CA3AF] hover:text-red-500 disabled:cursor-not-allowed flex-shrink-0"
                    title="Remove"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 items-center pt-1 border-t border-[#EEF0F0]">
          <input
            type="text"
            value={addingUid}
            onChange={(e) => setAddingUid(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addToAllowlist()}
            placeholder="Auth user UUID…"
            disabled={saving}
            className="flex-1 h-9 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-mono text-[#1A2E2E] placeholder:text-[#9CA3AF] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={addToAllowlist}
            disabled={saving || !addingUid.trim()}
            className="h-9 px-4 rounded-xl bg-[#059669] text-white text-sm font-semibold hover:bg-[#047857] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 flex items-center gap-1.5"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={11} color="white" strokeWidth={2.5} />
            Add
          </button>
        </div>
      </AdminCard>

      {/* ── Subscriptions ─────────────────────────────────────────── */}
      <AdminCard>
        <AdminSectionLabel>Subscriptions — {subs.length} total</AdminSectionLabel>

        {Object.keys(subByStatus).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(subByStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${STATUS_STYLES[status] ?? defaultStatusStyle}`}
                >
                  {status} · {count}
                </span>
              ))}
          </div>
        )}

        {subs.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">No subscriptions found.</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-[#F0F1F1]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F9F9] border-b border-[#F0F1F1]">
                  {["Email / User", "Plan", "Status", "Expires"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F1]">
                {subs.map((s) => (
                  <tr key={s.user_id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-3 py-2.5 text-xs font-mono text-[#2E4A4A] max-w-[160px] truncate">
                      {s.email ?? s.user_id}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-[#1A2E2E] whitespace-nowrap">
                      {s.plan_id}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TABLE_BADGE_STYLES[s.status] ?? defaultTableBadge}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#9CA3AF] whitespace-nowrap">
                      {s.current_period_end
                        ? new Date(s.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </DeveloperToolsAdminShell>
  );
}
