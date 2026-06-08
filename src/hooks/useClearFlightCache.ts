import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useClearFlightCache() {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const clear = async () => {
    setClearing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated"); return; }

      const { error: searchErr } = await supabase
        .from("flight_searches")
        .delete()
        .eq("user_id", user.id);
      if (searchErr) throw searchErr;

      const { error: cacheErr } = await supabase.functions.invoke("clear-flight-cache");
      if (cacheErr) throw cacheErr;

      setCleared(true);
    } catch (err: any) {
      toast.error(`Clear failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setClearing(false);
    }
  };

  return { clearing, cleared, setCleared, clear };
}
