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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_config")
        .select("config_value")
        .eq("config_key", "gowilder_token")
        .is("user_id", null)
        .maybeSingle();
      if (data) {
        setToken(data.config_value);
        setSavedToken(data.config_value);
      }
      setInitialLoading(false);
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      const { data: updated, error: updateErr } = await supabase
        .from("app_config")
        .update({ config_value: token } as any)
        .eq("config_key", "gowilder_token")
        .is("user_id", null)
        .select("id");
      if (updateErr) throw updateErr;

      if (!updated || updated.length === 0) {
        const { error: insertErr } = await supabase
          .from("app_config")
          .insert({ user_id: null, config_key: "gowilder_token", config_value: token } as any);
        if (insertErr) throw insertErr;
      }

      setSavedToken(token);
      toast.success("GoWilder Token saved");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("app_config")
        .delete()
        .eq("config_key", "gowilder_token")
        .is("user_id", null);
      if (error) throw error;
      setToken("");
      setSavedToken("");
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
