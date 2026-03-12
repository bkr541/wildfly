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
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface AppearanceScreenProps {
  onBack: () => void;
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
    const used = new Set(homepageRows.map((r) => r.component_name));
    const next = COMPONENT_OPTIONS.find((o) => !used.has(o.value));
    if (!next) {
      toast.info("All components are already added.");
      return;
    }
    setHomepageRows((prev) => [
      ...prev,
      { component_name: next.value, order: prev.length + 1, status: "active" },
    ]);
  };

  const removeRow = (index: number) => {
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
    setHomepageRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, component_name: value } : r))
    );
  };

  const handleSave = async () => {
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
      onBack();
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
      <div className="flex-1 px-5 pb-4 space-y-5">

        {/* Theme Section */}
        <div>
          <p className="text-xs font-semibold text-[#6B7B7B] uppercase tracking-wider mb-2 px-1">
            Theme
          </p>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
            {themes.map((t, idx) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelected(t.key)}
                className={`flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors ${idx < themes.length - 1 ? "border-b border-[#F0F1F1]" : ""}`}
              >
                <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center mr-3 shrink-0">
                  <HugeiconsIcon icon={t.icon} size={14} color="#345C5A" strokeWidth={1.5} />
                </span>
                <span className="flex-1 text-sm font-semibold text-[#2E4A4A]">{t.label}</span>
                <span
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected === t.key ? "border-[#345C5A]" : "border-[#D1D5D5]"}`}
                >
                  {selected === t.key && (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#345C5A]" />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Homepage Section */}
        <div>
          <p className="text-xs font-semibold text-[#6B7B7B] uppercase tracking-wider mb-2 px-1">
            Homepage
          </p>

          {/* Add button */}
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-[#059669] text-sm font-semibold mb-3 px-1 hover:opacity-75 transition-opacity"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={15} color="#059669" strokeWidth={2.5} />
            Add Component
          </button>

          <div className="space-y-2">
            {homepageRows.length === 0 && (
              <p className="text-sm text-[#9AADAD] px-1">
                No components configured. Tap "Add Component" to begin.
              </p>
            )}
            {homepageRows.map((row, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-white rounded-xl border border-[#E3E6E6] px-3 py-2 shadow-sm"
              >
                {/* Order number */}
                <span className="text-xs font-bold text-[#9AADAD] w-5 text-center shrink-0">
                  {idx + 1}
                </span>

                {/* Component dropdown */}
                <select
                  value={row.component_name}
                  onChange={(e) => updateComponent(idx, e.target.value)}
                  className="flex-1 text-sm font-medium text-[#2E4A4A] bg-[#F7F8F8] border border-[#E3E6E6] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#059669]/30 appearance-none cursor-pointer"
                >
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
            ))}
          </div>
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
