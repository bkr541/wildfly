import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  notifications_enabled: boolean;
  notify_gowild_availability: boolean;
  notify_new_features: boolean;
  notify_new_routes: boolean;
  notify_pass_sales: boolean;
  theme_preference: string;
  default_departure_to_home: boolean;
}

const DEFAULTS: UserSettings = {
  notifications_enabled: false,
  notify_gowild_availability: false,
  notify_new_features: true,
  notify_new_routes: false,
  notify_pass_sales: false,
  theme_preference: "system",
  default_departure_to_home: false,
};

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setSettings({ ...DEFAULTS, ...data });
      } else {
        // Auto-provision
        await supabase.from("user_settings").insert({ user_id: user.id, ...DEFAULTS });
      }
      setLoading(false);
    })();
  }, []);

  const update = useCallback(async (partial: Partial<UserSettings>) => {
    if (!userId) return;
    setSettings(prev => ({ ...prev, ...partial }));
    await supabase.from("user_settings").update(partial as any).eq("user_id", userId);
  }, [userId]);

  return { settings, loading, update };
}
