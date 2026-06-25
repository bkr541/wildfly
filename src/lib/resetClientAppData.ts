import { supabase } from "@/integrations/supabase/client";

/**
 * Unregister every service worker registered for this origin.
 * Safe no-op when the Service Worker API is unavailable.
 */
export const unregisterAllServiceWorkers = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((r) => r.unregister()));
  } catch {
    // ignore — individual failures must not stop the rest of the reset
  }
};

/**
 * Delete every Cache Storage entry owned by this origin.
 * Safe no-op when the Cache Storage API is unavailable.
 */
export const deleteAllCacheStorage = async (): Promise<void> => {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.allSettled(names.map((n) => caches.delete(n)));
  } catch {
    // ignore
  }
};

/**
 * Combined startup-safe cleanup used by both main.tsx and the manual reset flow.
 */
export const recoverFromStaleServiceWorkers = async (): Promise<void> => {
  await Promise.allSettled([unregisterAllServiceWorkers(), deleteAllCacheStorage()]);
};

const clearWebStorage = (): void => {
  try {
    window.localStorage?.clear();
  } catch {
    // ignore
  }
  try {
    window.sessionStorage?.clear();
  } catch {
    // ignore
  }
};

const deleteAllIndexedDbDatabases = async (): Promise<void> => {
  if (typeof indexedDB === "undefined") return;
  // indexedDB.databases() is not universally supported (Firefox, older Safari).
  const anyIdb = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (typeof anyIdb.databases !== "function") return;
  try {
    const dbs = await anyIdb.databases();
    await Promise.allSettled(
      dbs
        .map((d) => d?.name)
        .filter((n): n is string => Boolean(n))
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              try {
                const req = indexedDB.deleteDatabase(name);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              } catch {
                resolve();
              }
            }),
        ),
    );
  } catch {
    // ignore
  }
};

const expireAccessibleCookies = (): void => {
  if (typeof document === "undefined" || !document.cookie) return;
  try {
    const hostname = window.location.hostname;
    const hostParts = hostname.split(".");
    const domainCandidates = new Set<string>(["", hostname]);
    // Cover the root domain too (e.g. ".wildfly.app" from "app.wildfly.app").
    for (let i = 1; i < hostParts.length - 1; i++) {
      domainCandidates.add(hostParts.slice(i).join("."));
    }

    const cookies = document.cookie.split(";");
    for (const raw of cookies) {
      const eq = raw.indexOf("=");
      const name = (eq > -1 ? raw.slice(0, eq) : raw).trim();
      if (!name) continue;
      const base = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = base;
      for (const domain of domainCandidates) {
        if (!domain) continue;
        document.cookie = `${base}; domain=${domain}`;
        document.cookie = `${base}; domain=.${domain}`;
      }
    }
  } catch {
    // ignore
  }
};

const callResetEndpoint = async (): Promise<void> => {
  try {
    await fetch("/api/reset-app-data", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    // ignore — endpoint may be unavailable
  }
};

const localSupabaseSignOut = async (): Promise<void> => {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore
  }
};

/**
 * Reset every piece of Wildfly data stored locally on this device, then redirect
 * back to the root. Steps are isolated with Promise.allSettled and feature
 * detection so that any individual failure does not block the others.
 *
 * Does NOT touch any server-side records.
 */
export const resetClientAppData = async (): Promise<void> => {
  try {
    await localSupabaseSignOut();
    await callResetEndpoint();

    clearWebStorage();

    await Promise.allSettled([
      deleteAllCacheStorage(),
      unregisterAllServiceWorkers(),
      deleteAllIndexedDbDatabases(),
    ]);

    expireAccessibleCookies();
  } finally {
    try {
      window.location.replace("/");
    } catch {
      // ignore — nothing left to do
    }
  }
};
