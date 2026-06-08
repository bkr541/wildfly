import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  audience: string;
  priority: number;
  is_published: boolean;
  publish_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  _view_count?: number;
  _seen_by?: string[];
}

export interface UpsertAnnouncementInput {
  id?: string;
  title: string;
  body: string;
  cta_label?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  audience: string;
  priority: number;
  is_published: boolean;
  publish_at?: string | null;
  expires_at?: string | null;
}

export function useAnnouncementsAdmin() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "admin-list-announcements",
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setAnnouncements((data?.announcements as Announcement[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load announcements";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upsert = async (input: UpsertAnnouncementInput): Promise<boolean> => {
    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "admin-upsert-announcement",
        { body: input },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast.success(input.id ? "Announcement updated!" : "Announcement created!");
      await load();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { announcements, loading, saving, error, reload: load, upsert };
}
