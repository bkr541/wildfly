import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserSettings } from "@/hooks/useUserSettings";
import SubScreenLayout from "@/components/userhub/SubScreenLayout";
import { Monitor, Sun, Moon } from "lucide-react";

const options = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

const Appearance = () => {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUserProfile();
  const { settings, loading: settingsLoading } = useUserSettings(user?.id);

  const [theme, setTheme] = useState("system");
  const [initialTheme, setInitialTheme] = useState("system");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTheme(settings.theme_preference);
    setInitialTheme(settings.theme_preference);
  }, [settings]);

  // Apply theme immediately on change for preview
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  const isDirty = theme !== initialTheme;

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase
      .from("user_settings")
      .update({ theme_preference: theme })
      .eq("id", settings.id);
    setSaving(false);
    setInitialTheme(theme);
  };

  if (userLoading || settingsLoading) return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <SubScreenLayout
      title="Appearance"
      subtitle="Pick the theme that fits your cockpit."
      onBack={() => navigate("/user-hub")}
      isDirty={isDirty}
      isSaving={saving}
      onSave={handleSave}
    >
      <div className="mt-4 space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border transition-colors ${
              theme === opt.value
                ? "border-ring bg-secondary"
                : "border-border hover:bg-secondary/50"
            }`}
          >
            <opt.icon className="w-5 h-5 text-muted-foreground" />
            <span className="text-foreground text-sm font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </SubScreenLayout>
  );
};

export default Appearance;
