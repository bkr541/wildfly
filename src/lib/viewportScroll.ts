/**
 * Return the browser document to its visual origin before mounting a new app
 * screen. iOS browsers may preserve the login form's document scroll offset
 * after React swaps in the signed-in shell, so reset every scroll surface that
 * can retain that position.
 */
export function resetViewportScroll({ blurActiveElement = true } = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (blurActiveElement && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  if (typeof window.scrollTo === "function") {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      // Some embedded/test browsers expose scrollTo without implementing it.
    }
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}