import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "routeFavorites";

type FavKey = `${string}|${string}`;

function makeFavKey(origin: string, dest: string): FavKey {
  return `${origin}|${dest}`;
}

export function useRouteFavorites() {
  const [favorites, setFavorites] = useState<Set<FavKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (user) {
        setUserId(user.id);
        const { data } = await supabase
          .from("route_favorites")
          .select("origin_iata, dest_iata")
          .eq("user_id", user.id);
        if (!cancelled && data) {
          setFavorites(new Set(data.map((r: any) => makeFavKey(r.origin_iata, r.dest_iata))));
        }
      } else {
        // localStorage fallback
        try {
          const stored = JSON.parse(localStorage.getItem(LS_KEY) || "[]") as string[];
          setFavorites(new Set(stored as FavKey[]));
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const isFavorite = useCallback((origin: string, dest: string) => {
    return favorites.has(makeFavKey(origin, dest));
  }, [favorites]);

  const toggleFavorite = useCallback(async (origin: string, dest: string) => {
    const key = makeFavKey(origin, dest);
    const was = favorites.has(key);
    const next = new Set(favorites);

    if (was) {
      next.delete(key);
      setFavorites(next);
      if (userId) {
        await supabase.from("route_favorites").delete()
          .eq("user_id", userId).eq("origin_iata", origin).eq("dest_iata", dest);
      } else {
        localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      }
    } else {
      next.add(key);
      setFavorites(next);
      if (userId) {
        await supabase.from("route_favorites").insert({ user_id: userId, origin_iata: origin, dest_iata: dest });
      } else {
        localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      }
    }
  }, [favorites, userId]);

  const clearAll = useCallback(async () => {
    setFavorites(new Set());
    if (userId) {
      await supabase.from("route_favorites").delete().eq("user_id", userId);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, [userId]);

  const getFavoritesList = useCallback(() => {
    return [...favorites].map(k => {
      const [origin, dest] = k.split("|");
      return { origin, dest };
    });
  }, [favorites]);

  return { isFavorite, toggleFavorite, clearAll, getFavoritesList, loading };
}
