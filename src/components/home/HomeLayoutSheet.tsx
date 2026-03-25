import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  PlusSignIcon,
  Delete02Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  FloppyDiskIcon,
  AddCircleIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";

const COMPONENT_OPTIONS = [
  { value: "upcoming_flights", label: "Upcoming Flights" },
  { value: "recent_searches", label: "Recent Searches" },
  { value: "quick_searches", label: "Quick Searches" },
  { value: "day_trips", label: "Day Trips" },
];

interface HomepageRow {
  id?: string;
  component_name: string;
  order: number;
  status: string;
}

interface HomeLayoutSheetProps {
  open: boolean;
  onClose: (configChanged?: boolean) => void;
}

export const HomeLayoutSheet = ({ open, onClose }: HomeLayoutSheetProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [homepageRows, setHomepageRows] = useState<HomepageRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("user_homepage")
        .select("id, component_name, order, status")
        .eq("user_id", user.id)
        .order("order", { ascending: true });

      if (data && data.length > 0) {
        setHomepageRows(data.map((r) => ({
          id: r.id,
          component_name: r.component_name,
          order: r.order,
          status: r.status,
        })));
      } else {
        setHomepageRows([]);
      }
      setLoading(false);
    };
    load();
  }, [open]);

  const addRow = () => {
    const hasEmpty = homepageRows.some((r) => r.component_name === "");
    if (hasEmpty) { toast.info("Please fill in the empty component first."); return; }
    setHomepageRows((prev) => [...prev, { component_name: "", order: prev.length + 1, status: "active" }]);
  };

  const removeRow = (index: number) => {
    setRowErrors((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i !== index) next.add(i > index ? i - 1 : i); });
      return next;
    });
    setHomepageRows((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, order: i + 1 })));
  };

  const moveRow = (index: number, direction: "up" | "down") => {
    setHomepageRows((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next.map((r, i) => ({ ...r, order: i + 1 }));
    });
  };

  const updateComponent = (index: number, value: string) => {
    setRowErrors((prev) => { const next = new Set(prev); next.delete(index); return next; });
    setHomepageRows((prev) => prev.map((r, i) => (i === index ? { ...r, component_name: value } : r)));
  };

  const handleSave = async () => {
    const emptyIndices = new Set<number>();
    homepageRows.forEach((r, i) => { if (!r.component_name) emptyIndices.add(i); });
    if (emptyIndices.size > 0) { setRowErrors(emptyIndices); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: deleteError } = await supabase.from("user_homepage").delete().eq("user_id", user.id);

    if (!deleteError && homepageRows.length > 0) {
      const rows = homepageRows.map((r, i) => ({
        user_id: user.id,
        component_name: r.component_name,
        order: i + 1,
        status: r.status || "active",
      }));
      await supabase.from("user_homepage").insert(rows);
    }

    setSaving(false);
    if (deleteError) { toast.error("Failed to save"); }
    else { toast.success("Home layout updated"); onClose(true); }
  };

  return (
    <BottomSheet open={open} onClose={() => onClose(false)} style={{ top: "30%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <HugeiconsIcon icon={Home01Icon} size={15} color="white" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-[#2E4A4A] leading-tight">Home Layout</h2>
            <p className="text-[11px] text-[#9CA3AF]">Reorder or add home page sections</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onClose(false)}
          className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors"
        >
          <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
        {loading ? (
          <p className="text-sm text-[#9CA3AF] text-center py-8">Loading…</p>
        ) : (
          <div className="space-y-2">
            {homepageRows.length === 0 && (
              <p className="text-sm text-[#9AADAD] px-1">
                No components configured. Tap "Add Component" to begin.
              </p>
            )}
            {homepageRows.map((row, idx) => {
              const hasError = rowErrors.has(idx);
              return (
                <div key={idx}>
                  <div
                    className={`flex items-center gap-2 bg-white rounded-xl border px-3 py-2 shadow-sm transition-colors ${
                      hasError ? "border-red-400" : "border-[#E3E6E6]"
                    }`}
                  >
                    <span className="text-xs font-bold text-[#9AADAD] w-5 text-center shrink-0">
                      {idx + 1}
                    </span>
                    <select
                      value={row.component_name}
                      onChange={(e) => updateComponent(idx, e.target.value)}
                      className={`flex-1 text-sm font-medium bg-[#F7F8F8] border border-[#E3E6E6] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#059669]/30 appearance-none cursor-pointer transition-colors ${
                        !row.component_name ? "text-[#9AADAD]" : "text-[#2E4A4A]"
                      }`}
                    >
                      <option value="" disabled>Select a component…</option>
                      {COMPONENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveRow(idx, "up")}
                        disabled={idx === 0}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#F2F3F3] disabled:opacity-20 transition-colors"
                      >
                        <HugeiconsIcon icon={ArrowUp01Icon} size={12} color="#345C5A" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(idx, "down")}
                        disabled={idx === homepageRows.length - 1}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#F2F3F3] disabled:opacity-20 transition-colors"
                      >
                        <HugeiconsIcon icon={ArrowDown01Icon} size={12} color="#345C5A" strokeWidth={2} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors shrink-0"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} color="#EF4444" strokeWidth={1.5} />
                    </button>
                  </div>
                  {hasError && (
                    <p className="text-xs text-red-500 mt-1 px-1">Component cannot be blank.</p>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-[#059669] text-sm font-semibold mt-3 px-1 hover:opacity-75 transition-opacity"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={15} color="#059669" strokeWidth={2.5} />
              Add Component
            </button>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="px-5 pt-3 pb-4">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-widest uppercase shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6"
        >
          <span>{saving ? "Saving…" : "Save Layout"}</span>
          {!saving && <HugeiconsIcon icon={FloppyDiskIcon} size={18} color="white" strokeWidth={2} />}
        </button>
      </div>
    </BottomSheet>
  );
};
