import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Sun01Icon,
  Moon01Icon,
  EarthIcon,
  FloppyDiskIcon,
  PlusSignIcon,
  Delete02Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  PaintBrushIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface AppearanceScreenProps {
  onBack: (configChanged?: boolean) => void;
}

const themes = [
  { key: "light", label: "Light", icon: Sun01Icon },
  { key: "dark", label: "Dark", icon: Moon01Icon },
  { key: "system", label: "System", icon: EarthIcon },
] as const;

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

const AppearanceScreen = ({ onBack }: AppearanceScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState("light");
  const [homepageRows, setHomepageRows] = useState<HomepageRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [settingsResult, homepageResult] = await Promise.all([
        supabase
          .from("user_settings")
          .select("theme_preference")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_homepage")
          .select("id, component_name, order, status")
          .eq("user_id", user.id)
          .order("order", { ascending: true }),
      ]);

      if (settingsResult.data?.theme_preference)
        setSelected(settingsResult.data.theme_preference);

      if (homepageResult.data && homepageResult.data.length > 0) {
        setHomepageRows(
          homepageResult.data.map((r) => ({
            id: r.id,
            component_name: r.component_name,
            order: r.order,
            status: r.status,
          }))
        );
      }

      setLoading(false);
    };
    load();
  }, []);

  const addRow = () => {
    // Check if there's already an empty row
    const hasEmpty = homepageRows.some((r) => r.component_name === "");
    if (hasEmpty) {
      toast.info("Please fill in the empty component first.");
      return;
    }
    setHomepageRows((prev) => [
      ...prev,
      { component_name: "", order: prev.length + 1, status: "active" },
    ]);
  };

  const removeRow = (index: number) => {
    setRowErrors((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i !== index) next.add(i > index ? i - 1 : i); });
      return next;
    });
    setHomepageRows((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((r, i) => ({ ...r, order: i + 1 }));
    });
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
    setRowErrors((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setHomepageRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, component_name: value } : r))
    );
  };

  const handleSave = async () => {
    // Validate: no empty component names
    const emptyIndices = new Set<number>();
    homepageRows.forEach((r, i) => {
      if (!r.component_name) emptyIndices.add(i);
    });
    if (emptyIndices.size > 0) {
      setRowErrors(emptyIndices);
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Save theme
    const { error: themeError } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          theme_preference: selected,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    // Save homepage: delete existing then re-insert
    const { error: deleteError } = await supabase
      .from("user_homepage")
      .delete()
      .eq("user_id", user.id);

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
    if (themeError || deleteError) toast.error("Failed to save");
    else {
      toast.success("Appearance updated");
      onBack(true);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#6B7B7B]">Loading...</p>
      </div>
    );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-6">

        {/* Theme Section */}
        <div>
          {/* Section header */}
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <HugeiconsIcon icon={PaintBrushIcon} size={13} color="#059669" strokeWidth={2} />
            <p className="text-xs font-semibold text-[#059669] uppercase tracking-wider">
              Theme
            </p>
          </div>
          <p className="text-xs text-[#6B7B7B] px-1 mb-2.5">
            Change the application's theme and style.
          </p>
...
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <HugeiconsIcon icon={Home01Icon} size={13} color="#059669" strokeWidth={2} />
            <p className="text-xs font-semibold text-[#059669] uppercase tracking-wider">
              Homepage
            </p>
          </div>
          <p className="text-xs text-[#6B7B7B] px-1 mb-2.5">
            Add, edit, and customize your home page with the tools you want to use quickly.
          </p>

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
                    {/* Order number */}
                    <span className="text-xs font-bold text-[#9AADAD] w-5 text-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Component dropdown */}
                    <select
                      value={row.component_name}
                      onChange={(e) => updateComponent(idx, e.target.value)}
                      className={`flex-1 text-sm font-medium bg-[#F7F8F8] border border-[#E3E6E6] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#059669]/30 appearance-none cursor-pointer transition-colors ${
                        !row.component_name ? "text-[#9AADAD]" : "text-[#2E4A4A]"
                      }`}
                    >
                      <option value="" disabled>
                        Select a component…
                      </option>
                      {COMPONENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Up / Down */}
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

                    {/* Delete */}
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
          </div>

          {/* Add button — moved below the list */}
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-[#059669] text-sm font-semibold mt-3 px-1 hover:opacity-75 transition-opacity"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={15} color="#059669" strokeWidth={2.5} />
            Add Component
          </button>
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-widest uppercase shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6"
        >
          <span>{saving ? "Saving..." : "Save Changes"}</span>
          {!saving && (
            <HugeiconsIcon icon={FloppyDiskIcon} size={18} color="white" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
};

export default AppearanceScreen;
