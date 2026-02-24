import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeveloperSettings {
  user_id: string;
  debug_enabled: boolean;
  show_raw_payload: boolean;
  log_level: string;
  flags: any;
  logging_enabled: boolean;
  enabled_component_logging: string[];
}

const DEFAULT_SETTINGS: Omit<DeveloperSettings, "user_id"> = {
  debug_enabled: false,
  show_raw_payload: false,
  log_level: "info",
  flags: {},
  logging_enabled: false,
  enabled_component_logging: [],
};

let cachedSettings: DeveloperSettings | null = null;
let settingsPromise: Promise<DeveloperSettings | null> | null = null;

export async function fetchDeveloperSettings(): Promise<DeveloperSettings | null> {
  if (cachedSettings) return cachedSettings;
  if (settingsPromise) return settingsPromise;

  settingsPromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: allowed } = await supabase
        .from("developer_allowlist")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!allowed) return null;

      const { data } = await (supabase.from("developer_settings") as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        cachedSettings = data as DeveloperSettings;
        return cachedSettings;
      }

      const { data: inserted } = await (supabase.from("developer_settings") as any)
        .upsert({ user_id: user.id, ...DEFAULT_SETTINGS } as any, { onConflict: "user_id" })
        .select("*")
        .single();

      cachedSettings = (inserted as DeveloperSettings) ?? null;
      return cachedSettings;
    } catch {
      return null;
    } finally {
      settingsPromise = null;
    }
  })();

  return settingsPromise;
}

export function invalidateSettingsCache() {
  cachedSettings = null;
  settingsPromise = null;
}

export function useDeveloperSettings() {
  const [settings, setSettings] = useState<DeveloperSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    invalidateSettingsCache();
    const s = await fetchDeveloperSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeveloperSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const updateSettings = useCallback(async (partial: Partial<DeveloperSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    setSettings(updated);
    cachedSettings = updated;

    await (supabase.from("developer_settings") as any)
      .update(partial as any)
      .eq("user_id", settings.user_id);
  }, [settings]);

  return { settings, loading, refreshSettings: refresh, updateSettings };
}
