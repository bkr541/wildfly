import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  audience: string;
  priority: number;
}

export function useAnnouncements(active: boolean) {
  const [queue, setQueue] = useState<AnnouncementItem[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!active || fetchedRef.current) return;
    fetchedRef.current = true;

    supabase.functions
      .invoke("get-announcements")
      .then(({ data }) => {
        if (Array.isArray(data?.announcements) && data.announcements.length > 0) {
          setQueue(data.announcements as AnnouncementItem[]);
        }
      })
      .catch(() => {});
  }, [active]);

  const dismiss = useCallback((id: string) => {
    setQueue((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { current: queue[0] ?? null, dismiss };
}
