import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

const STORAGE_KEY = "wildfly_ios_banner_dismissed";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function isStandalone() {
  return (window.navigator as any).standalone === true;
}

const IOSInstallBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed && isIOS() && isSafari() && !isStandalone()) {
      // Slight delay so it doesn't flash on load
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] mx-auto max-w-[768px]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-3 mb-3 rounded-2xl bg-[#0d2e2c] border border-white/10 shadow-2xl px-4 py-4 text-white flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300">
        <img
          src="/assets/icons/icon-512.png"
          alt="Wildfly icon"
          className="w-12 h-12 rounded-xl flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Install Wildfly</p>
          <p className="text-white/60 text-xs mt-0.5 leading-snug">
            Tap{" "}
            <span className="inline-flex items-center gap-0.5 font-semibold text-white/80">
              Share <span className="text-base">⎙</span>
            </span>{" "}
            then{" "}
            <span className="font-semibold text-white/80">"Add to Home Screen"</span>{" "}
            for the full app experience.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors -mt-0.5"
          aria-label="Dismiss"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} color="currentColor" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default IOSInstallBanner;
