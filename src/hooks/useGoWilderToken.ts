import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function getJWTExpiry(token: string): Date | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

export function useGoWilderToken() {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Non-null when the loaded token came from a legacy per-user row.
  // Cleared to null after a successful migration to the global row.
  const [legacyUserId, setLegacyUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // 1. Try the global row first.
      const { data: globalRow } = await (supabase as any)
        .from("app_config")
        .select("config_value")
        .eq("config_key", "gowilder_token")
        .is("user_id", null)
        .maybeSingle();

      if (globalRow) {
        setToken(globalRow.config_value);
        setSavedToken(globalRow.config_value);
        setInitialLoading(false);
        return;
      }

      // 2. No global row — fall back to the current user's legacy row.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: legacyRow } = await (supabase as any)
          .from("app_config")
          .select("config_value")
          .eq("config_key", "gowilder_token")
          .eq("user_id", user.id)
          .maybeSingle();

        if (legacyRow) {
          setToken(legacyRow.config_value);
          setSavedToken(legacyRow.config_value);
          setLegacyUserId(user.id);
        }
      }

      setInitialLoading(false);
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    const isLegacyMigration = legacyUserId !== null;
    try {
      if (isLegacyMigration && legacyUserId) {
        // Delete the legacy per-user row first to avoid duplicates, then insert global.
        const { error: deleteErr } = await (supabase as any)
          .from("app_config")
          .delete()
          .eq("config_key", "gowilder_token")
          .eq("user_id", legacyUserId);
        if (deleteErr) throw deleteErr;

        const { error: insertErr } = await (supabase as any)
          .from("app_config")
          .insert({ user_id: null, config_key: "gowilder_token", config_value: token });
        if (insertErr) throw insertErr;

        setLegacyUserId(null);
      } else {
        // Normal upsert: update the global row or insert if it doesn't exist yet.
        const { data: updated, error: updateErr } = await (supabase as any)
          .from("app_config")
          .update({ config_value: token } as any)
          .eq("config_key", "gowilder_token")
          .is("user_id", null)
          .select("id");
        if (updateErr) throw updateErr;

        if (!updated || updated.length === 0) {
          const { error: insertErr } = await (supabase as any)
            .from("app_config")
            .insert({ user_id: null, config_key: "gowilder_token", config_value: token });
          if (insertErr) throw insertErr;
        }
      }

      setSavedToken(token);
      toast.success(isLegacyMigration ? "GoWilder Token migrated to global" : "GoWilder Token saved");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      let deleteErr: Error | null = null;

      if (legacyUserId) {
        const { error } = await (supabase as any)
          .from("app_config")
          .delete()
          .eq("config_key", "gowilder_token")
          .eq("user_id", legacyUserId);
        deleteErr = error;
      } else {
        const { error } = await (supabase as any)
          .from("app_config")
          .delete()
          .eq("config_key", "gowilder_token")
          .is("user_id", null);
        deleteErr = error;
      }

      if (deleteErr) throw deleteErr;

      setToken("");
      setSavedToken("");
      setLegacyUserId(null);
      toast.success("GoWilder Token deleted");
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const expiry = savedToken ? getJWTExpiry(savedToken) : null;

  return { token, setToken, savedToken, loading, initialLoading, expiry, save, remove };
}
