import { useState, useEffect, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Copy01Icon, PlusSignIcon, ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
  AdminSavingIndicator,
} from "./DeveloperToolsAdminShell";

type DevUser = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

export function DeveloperAllowlistAdminView() {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [devUsers, setDevUsers]   = useState<DevUser[]>([]);
  const [addingUid, setAddingUid] = useState("");
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
    } catch (err: any) {
      setError(err?.message ?? "Failed to load developer allowlist.");
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

  return (
    <DeveloperToolsAdminShell
      title="Developer Allowlist"
      description="Control which users have access to Developer Tools within the admin console."
      loading={loading}
      error={error}
      actions={
        <div className="flex items-center gap-2">
          {saving && <AdminSavingIndicator />}
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-xl text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors disabled:opacity-40"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} color="currentColor" strokeWidth={2} />
          </button>
        </div>
      }
    >
      <AdminCard>
        <AdminSectionLabel>
          {devUsers.length} {devUsers.length === 1 ? "Member" : "Members"}
        </AdminSectionLabel>

        {devUsers.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] mb-4">No users in the developer allowlist.</p>
        ) : (
          <div className="flex flex-col gap-1.5 mb-4">
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
    </DeveloperToolsAdminShell>
  );
}
