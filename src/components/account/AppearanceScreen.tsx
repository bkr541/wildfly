import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon, faCircleHalfStroke } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

interface AppearanceScreenProps {
  onBack: () => void;
}

const themes = [
  { key: "light", label: "Light", icon: faSun },
  { key: "dark", label: "Dark", icon: faMoon },
  { key: "system", label: "System", icon: faCircleHalfStroke },
] as const;

const AppearanceScreen = ({ onBack }: AppearanceScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState("light");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_settings")
        .select("theme_preference")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.theme_preference) setSelected(data.theme_preference);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, theme_preference: selected, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error("Failed to save");
    else { toast.success("Appearance updated"); onBack(); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;

  return (
    <div className="flex flex-col h-full animate-fade-in">

      <div className="flex-1 px-5 pb-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {themes.map((t, idx) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelected(t.key)}
              className={`flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors ${idx < themes.length - 1 ? "border-b border-[#F0F1F1]" : ""}`}
            >
              <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center mr-3 shrink-0">
                <FontAwesomeIcon icon={t.icon} className="w-3.5 h-3.5 text-[#345C5A]" />
              </span>
              <span className="flex-1 text-sm font-semibold text-[#2E4A4A]">{t.label}</span>
              <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected === t.key ? "border-[#345C5A]" : "border-[#D1D5D5]"}`}>
                {selected === t.key && <span className="h-2.5 w-2.5 rounded-full bg-[#345C5A]" />}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-[#345C5A] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default AppearanceScreen;
