import { useEffect, useRef } from "react";

/**
 * Acquires a screen wake lock while `active` is true, then releases it.
 *
 * The Wake Lock API is supported in Safari 16.4+ on iOS and all modern
 * desktop browsers. On unsupported browsers the hook is a silent no-op.
 *
 * The lock is also automatically re-acquired if the page becomes visible
 * again after being backgrounded (the browser releases wake locks when
 * the page is hidden).
 */
export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      // Release any held lock when the caller signals "not active".
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
      return;
    }

    if (!("wakeLock" in navigator)) return;

    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        lockRef.current = sentinel;
      } catch {
        // NotAllowedError if the page isn't visible yet — safe to ignore.
      }
    }

    acquire();

    // Re-acquire after the page returns to the foreground (browser releases
    // wake locks when the document is hidden).
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        acquire();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
