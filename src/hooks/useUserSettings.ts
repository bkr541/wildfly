import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  id: string;
  user_id: number;
  notifications_master: boolean;
  notif_gowild_availability: boolean;
  notif_new_route_alerts: boolean;
  notif_pass_sale_alerts: boolean;
  notif_new_feature_announcements: boolean;
  theme_preference: string;
}

const DEFAULTS: Omit<UserSettings, "id" | "user_id"> = {
  notifications_master: false,
  notif_gowild_availability: false,
  notif_new_route_alerts: false,
  notif_pass_sale_alerts: false,
  notif_new_feature_announcements: true,
  theme_preference: "system",
};

export function useUserSettings(userId: number | undefined) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      let { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) {
        const { data: created } = await supabase
          .from("user_settings")
          .insert({ user_id: userId })
          .select()
          .single();
        data = created;
      }
      if (data) setSettings(data as unknown as UserSettings);
      setLoading(false);
    };
    load();
  }, [userId]);

  return { settings, loading, setSettings };
}
