import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon } from "@hugeicons/core-free-icons";

interface ReportLoadingStateProps {
  /** When true, shows a full-page centered state (no previous result exists). */
  full?: boolean;
}

/**
 * Full-page loading state — shown when a report is running and there is no
 * previous result to keep visible.
 */
function FullLoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16"
      role="status"
      aria-live="polite"
      aria-label="Running report…"
    >
      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(5,150,105,0.07)" }}
      >
        <HugeiconsIcon
          icon={Analytics01Icon}
          size={30}
          color="#059669"
          strokeWidth={1.5}
          className="opacity-40"
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-[#059669] border-t-transparent animate-spin flex-shrink-0" />
          <p className="text-sm font-bold text-[#1A2E2E]">Running report…</p>
        </div>
        <p className="text-xs text-[#9CA3AF]">
          This may take a few seconds. Please wait.
        </p>
      </div>
    </div>
  );
}

/**
 * Banner-style loading overlay — shown when a report is re-running and the
 * previous result is still visible underneath.
 */
function RefreshingBanner() {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#059669]/20 bg-[#ECFDF5]"
      role="status"
      aria-live="polite"
      aria-label="Refreshing report results…"
    >
      <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-[#059669] border-t-transparent animate-spin flex-shrink-0" />
      <p className="text-xs font-semibold text-[#065F46]">Refreshing…</p>
    </div>
  );
}

export function ReportLoadingState({ full = false }: ReportLoadingStateProps) {
  return full ? <FullLoadingState /> : <RefreshingBanner />;
}
