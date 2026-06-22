import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons";
import {
  AdminReportingError,
  type ReportingErrorKind,
} from "./reportingTypes";

// ── Error labels ───────────────────────────────────────────────────────────────

const KIND_LABELS: Record<ReportingErrorKind, string> = {
  UNAUTHENTICATED: "Session expired — please reload and sign in again",
  FORBIDDEN:       "You do not have permission to run this report",
  REPORT_NOT_FOUND: "Report not found — it may have been removed or renamed",
  VALIDATION:      "Some parameters are invalid",
  REPORT_TIMEOUT:  "This report timed out — try narrowing the date range",
  VERSION_MISMATCH:"Report version mismatch — please reload the page",
  INVALID_RESPONSE:"Unexpected response from the reporting service",
  NETWORK:         "Network error — check your connection and try again",
  SERVER_ERROR:    "An error occurred on the server",
};

function getUserMessage(error: Error): string {
  if (error instanceof AdminReportingError) {
    return KIND_LABELS[error.kind] ?? error.message;
  }
  return error.message ?? "An unexpected error occurred";
}

function isRetryable(error: Error): boolean {
  if (!(error instanceof AdminReportingError)) return true;
  // Don't offer retry for auth/permission errors — they need navigation.
  return !["UNAUTHENTICATED", "FORBIDDEN", "VERSION_MISMATCH"].includes(error.kind);
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportErrorStateProps {
  error:    Error;
  onRetry?: () => void;
  /** When true, shows as a compact banner above the previous result. */
  compact?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportErrorState({
  error,
  onRetry,
  compact = false,
}: ReportErrorStateProps) {
  const message  = getUserMessage(error);
  const canRetry = isRetryable(error) && !!onRetry;

  if (compact) {
    return (
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50"
        role="alert"
        aria-live="assertive"
      >
        <HugeiconsIcon
          icon={AlertCircleIcon}
          size={14}
          color="#EF4444"
          strokeWidth={2}
          className="flex-shrink-0"
        />
        <p className="flex-1 text-xs font-semibold text-red-700">{message}</p>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry report"
            className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 transition-colors flex-shrink-0"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} color="currentColor" strokeWidth={2.5} />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-4 py-14 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-red-50">
        <HugeiconsIcon icon={AlertCircleIcon} size={28} color="#EF4444" strokeWidth={1.8} />
      </div>
      <div className="flex flex-col gap-1.5 max-w-sm">
        <h3 className="text-base font-black text-[#1A2E2E]">Report Failed</h3>
        <p className="text-sm text-[#6B7280] leading-relaxed">{message}</p>
        {error instanceof AdminReportingError && error.code && (
          <p className="text-[11px] font-mono text-[#9CA3AF] mt-0.5">
            Code: {error.code}
          </p>
        )}
      </div>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry running the report"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E8EEEE] text-[#374151] hover:bg-[#F2F3F3] transition-colors"
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} color="currentColor" strokeWidth={2.5} />
          Retry
        </button>
      )}
    </div>
  );
}
