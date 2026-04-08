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
  Airplane01Icon,
  Search01Icon,
  Alert01Icon,
  Location01Icon,
  FlashIcon,
  Key01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";

const COMPONENT_META: Record<string, {
  label: string;
  description: string;
  icon: any;
  iconBg: string;
  iconColor: string;
}> = {
  upcoming_flights: {
    label: "Upcoming Flights",
    description: "Shows your next booked trip",
    icon: Airplane01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  watched_flights: {
    label: "Watched Flights",
    description: "Tracks price-drop alerts",
    icon: Alert01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  recent_searches: {
    label: "Recent Searches",
    description: "Displays your latest fare lookups",
    icon: Search01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  quick_searches: {
    label: "Quick Searches",
    description: "Fast access to frequent routes",
    icon: FlashIcon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  day_trips: {
    label: "Day Trips",
    description: "Quick getaways from your airport",
    icon: Location01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  token_expiration: {
    label: "Token Expiration",
    description: "Displays your GoWild token status",
    icon: Key01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
};

const ALL_COMPONENT_OPTIONS = Object.entries(COMPONENT_META).map(([value, m]) => ({ value, label: m.label }));
const BASE_VALUES = new Set(["upcoming_flights", "watched_flights", "recent_searches", "quick_searches", "day_trips"]);

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

// Six-dot drag handle
function DragHandle() {
  return (
    <svg width="10" height="15" viewBox="0 0 10 15" fill="none" className="shrink-0">
      {[2, 7, 12].map((cy) =>
        [2, 8].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} fill="#C4CACA" />
        ))
      )}
    </svg>
  );
}

export const HomeLayoutSheet = ({ open, onClose }: HomeLayoutSheetProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"manage" | "explore">("manage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [homepageRows, setHomepageRows] = useState<HomepageRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Set<number>>(new Set());
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      if (!user) { setLoading(false); return; }

      const [{ data }, { data: devRow }] = await Promise.all([
        supabase
          .from("user_homepage")
          .select("id, component_name, order, status")
          .eq("user_id", user.id)
          .order("order", { ascending: true }),
        supabase
          .from("developer_allowlist")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setIsDeveloper(!!devRow);

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

  const availableOptions = ALL_COMPONENT_OPTIONS.filter(
    (opt) => isDeveloper || BASE_VALUES.has(opt.value)
  );

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
    <BottomSheet open={open} onClose={() => onClose(false)} style={{ top: "5%" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
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

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-[rgba(0,0,0,0.06)]">
        {(["manage", "explore"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 h-11 text-sm font-medium border-b-2 transition-all",
              activeTab === tab
                ? "border-[#059669] text-[#059669]"
                : "border-transparent text-[#9CA3AF] hover:text-[#2E4A4A]",
            )}
          >
            {tab === "manage" ? "Manage Widgets" : "Explore Widgets"}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col px-4 pt-3 pb-2">
        {activeTab === "manage" && (
          <>
            {loading ? (
              <p className="text-sm text-[#9CA3AF] text-center py-8">Loading…</p>
            ) : (
              <>
                {homepageRows.length === 0 && (
                  <p className="text-sm text-[#9AADAD] px-1 mb-2">
                    No components configured. Tap "Add Widget" to begin.
                  </p>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
                  {homepageRows.map((row, idx) => {
                    const meta = COMPONENT_META[row.component_name];
                    const hasError = rowErrors.has(idx);
                    const isLast = idx === homepageRows.length - 1;

                    return (
                      <div key={idx}>
                        {/* Configured row */}
                        {meta ? (
                          <div
                            className={cn(
                              "flex items-center gap-3 px-4 py-3",
                              !isLast && "border-b border-[#F0F1F1]",
                              hasError && "bg-red-50",
                            )}
                          >
                            <DragHandle />
                            <span
                              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: meta.iconBg }}
                            >
                              <HugeiconsIcon icon={meta.icon} size={17} color={meta.iconColor} strokeWidth={1.5} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#2E4A4A] leading-tight">{meta.label}</p>
                              <p className="text-xs text-[#6B7B7B] leading-tight mt-0.5">{meta.description}</p>
                            </div>
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveRow(idx, "up")}
                                disabled={idx === 0}
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#F2F3F3] disabled:opacity-20 transition-colors"
                              >
                                <HugeiconsIcon icon={ArrowUp01Icon} size={12} color="#9CA3AF" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRow(idx, "down")}
                                disabled={isLast}
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#F2F3F3] disabled:opacity-20 transition-colors"
                              >
                                <HugeiconsIcon icon={ArrowDown01Icon} size={12} color="#9CA3AF" strokeWidth={2} />
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
                        ) : (
                          /* New row — select picker */
                          <div
                            className={cn(
                              "flex items-center gap-2 px-3 py-2",
                              !isLast && "border-b border-[#F0F1F1]",
                              hasError && "bg-red-50",
                            )}
                          >
                            <select
                              value={row.component_name}
                              onChange={(e) => updateComponent(idx, e.target.value)}
                              className={cn(
                                "flex-1 text-sm font-medium bg-[#F7F8F8] border border-[#E3E6E6] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#059669]/30 appearance-none cursor-pointer transition-colors",
                                !row.component_name ? "text-[#9AADAD]" : "text-[#2E4A4A]",
                              )}
                            >
                              <option value="" disabled>Select a widget…</option>
                              {availableOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors shrink-0"
                            >
                              <HugeiconsIcon icon={Delete02Icon} size={16} color="#EF4444" strokeWidth={1.5} />
                            </button>
                          </div>
                        )}
                        {hasError && (
                          <p className="text-xs text-red-500 px-4 pb-2">Widget cannot be blank.</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-[#059669] text-sm font-semibold mt-auto pt-3 px-1 hover:opacity-75 transition-opacity"
                >
                  <HugeiconsIcon icon={PlusSignIcon} size={15} color="#059669" strokeWidth={2.5} />
                  Add Widget
                </button>
              </>
            )}
          </>
        )}

        {activeTab === "explore" && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#9AADAD]">Coming soon…</p>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="shrink-0 px-5 pt-3 pb-4">
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
