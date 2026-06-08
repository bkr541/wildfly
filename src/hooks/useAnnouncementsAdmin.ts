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

export interface NewAnnouncementInput {
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
      const { data: rows, error: rowErr } = await (supabase as any)
        .from("announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (rowErr) throw rowErr;

      const { data: viewRows } = await (supabase as any)
        .from("announcement_views")
        .select("announcement_id, user_id");

      const viewMap: Record<string, { count: number; userIds: string[] }> = {};
      for (const v of viewRows ?? []) {
        if (!viewMap[v.announcement_id]) viewMap[v.announcement_id] = { count: 0, userIds: [] };
        viewMap[v.announcement_id].count += 1;
        viewMap[v.announcement_id].userIds.push(v.user_id);
      }

      const enriched: Announcement[] = (rows ?? []).map((a: Announcement) => ({
        ...a,
        _view_count: viewMap[a.id]?.count ?? 0,
        _seen_by: viewMap[a.id]?.userIds ?? [],
      }));

      setAnnouncements(enriched);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load announcements";
      setError(msg);
      toast.error(`Failed to load: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: NewAnnouncementInput): Promise<boolean> => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      const payload = {
        title: input.title,
        body: input.body,
        cta_label: input.cta_label ?? null,
        cta_url: input.cta_url ?? null,
        image_url: input.image_url ?? null,
        audience: input.audience,
        priority: input.priority,
        is_published: input.is_published,
        publish_at: input.publish_at ?? null,
        expires_at: input.expires_at ?? null,
        created_by: user?.id ?? null,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${session?.access_token}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      toast.success("Announcement created!");
      await load();
      return true;
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { announcements, loading, saving, error, reload: load, create };
}
