import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

interface NotificationsScreenProps {
  onBack: () => void;
}

interface Settings {
  notifications_enabled: boolean;
  notify_gowild_availability: boolean;
  notify_new_features: boolean;
  notify_new_routes: boolean;
  notify_pass_sales: boolean;
}

const defaultSettings: Settings = {
  notifications_enabled: true,
  notify_gowild_availability: true,
  notify_new_features: true,
  notify_new_routes: true,
  notify_pass_sales: true,
};

const toggleItems: { key: keyof Settings; label: string; description: string }[] = [
  { key: "notifications_enabled", label: "Push Notifications", description: "Enable or disable all notifications" },
  { key: "notify_gowild_availability", label: "GoWild Availability", description: "Get notified about GoWild pass availability" },
  { key: "notify_new_routes", label: "New Routes", description: "Alerts when new flight routes are added" },
  { key: "notify_pass_sales", label: "Pass Sales", description: "Notifications about pass sales and deals" },
  { key: "notify_new_features", label: "New Features", description: "Learn about new app features and updates" },
];

const NotificationsScreen = ({ onBack }: NotificationsScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_settings")
        .select("notifications_enabled, notify_gowild_availability, notify_new_features, notify_new_routes, notify_pass_sales")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setSettings(data);
      setLoading(false);
    };
    load();
  }, []);

  const toggle = (key: keyof Settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert settings
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    setSaving(false);
    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Notification preferences updated");
      onBack();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">

      <div className="flex-1 px-5 pb-4">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {toggleItems.map((item, idx) => (
            <div
              key={item.key}
              className={`flex items-center justify-between px-4 py-3 ${idx < toggleItems.length - 1 ? "border-b border-[#F0F1F1]" : ""}`}
            >
              <div className="flex-1 mr-3">
                <p className="text-sm font-semibold text-[#2E4A4A]">{item.label}</p>
                <p className="text-xs text-[#6B7B7B]">{item.description}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings[item.key] ? "bg-[#345C5A]" : "bg-[#D1D5D5]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings[item.key] ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
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

export default NotificationsScreen;
