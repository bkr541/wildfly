import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Alert01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Loading03Icon,
  Timer02Icon,
  Analytics01Icon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";
import { parseISO, format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDuration } from "./reportingFormatters";
import { maskParamValue, hasPiiAccess } from "./ReportRunHistory";
import type { ReportRun, ReportRunStatus } from "./reportingTypes";

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReportRunStatus, { label: string; color: string; icon: unknown }> = {
  running:   { label: "Running",   color: "text-amber-700 bg-amber-50 border-amber-200",  icon: Loading03Icon },
  completed: { label: "Completed", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckmarkCircle01Icon },
  failed:    { label: "Failed",    color: "text-red-700 bg-red-50 border-red-200",        icon: Alert01Icon },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function absTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy HH:mm:ss");
  } catch {
    return iso;
  }
}

// Safe display of a parameter key name (human-readable)
function labelForKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Parameter table ────────────────────────────────────────────────────────────

function ParamTable({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params);
  if (entries.length === 0) {
    return <p className="text-xs text-[#9CA3AF] italic">No parameters</p>;
  }

  // Separate include_pii from other params — show it as a top-level indicator.
  const otherEntries = entries.filter(([k]) => k !== "include_pii");

  return (
    <table className="w-full text-xs" aria-label="Run parameters">
      <tbody className="divide-y divide-[#F0F1F1]">
        {otherEntries.map(([key, val]) => (
          <tr key={key}>
            <td className="py-1.5 pr-3 font-semibold text-[#374151] whitespace-nowrap">
              {labelForKey(key)}
            </td>
            <td className="py-1.5 text-[#1A2E2E] font-mono">
              {maskParamValue(key, val)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({
  label,
  children,
}: {
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide min-w-[90px] pt-0.5">
        {label}
      </span>
      <div className="flex-1 text-xs text-[#1A2E2E]">{children}</div>
    </div>
  );
}

// ── Props & Component ─────────────────────────────────────────────────────────

export interface ReportRunDetailsDrawerProps {
  run:     ReportRun | null;
  open:    boolean;
  onClose: () => void;
}

export function ReportRunDetailsDrawer({
  run,
  open,
  onClose,
}: ReportRunDetailsDrawerProps) {
  const piiRequested = run ? hasPiiAccess(run.parameters) : false;
  const status       = run?.status ?? "completed";
  const statusCfg    = STATUS_CONFIG[status];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[90vw] max-w-[480px] p-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-[#F0F1F1] flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-black text-[#1A2E2E] leading-tight">
                {run?.report_name ?? run?.report_slug ?? "Run Details"}
              </SheetTitle>
              {run?.report_category && (
                <span className="text-[11px] text-[#9CA3AF] font-semibold">
                  {run.report_category}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close run details"
              className="flex-shrink-0 text-[#9CA3AF] hover:text-[#374151] transition-colors mt-0.5"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2.5} />
            </button>
          </div>
        </SheetHeader>

        {/* Body */}
        {run && (
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
            {/* Status */}
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold ${statusCfg.color}`}
              role="status"
            >
              <HugeiconsIcon
                icon={statusCfg.icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
                size={14}
                color="currentColor"
                strokeWidth={2.5}
              />
              {statusCfg.label}
            </div>

            {/* PII notice */}
            {piiRequested && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold"
                role="alert"
                aria-label="PII was included in this run"
              >
                <HugeiconsIcon icon={LockPasswordIcon} size={13} color="currentColor" strokeWidth={2} />
                PII was requested for this run
              </div>
            )}

            {/* Error block */}
            {run.status === "failed" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex flex-col gap-1.5">
                <p className="text-xs font-bold text-red-700">Execution Error</p>
                {run.error_code && (
                  <p className="text-[11px] font-mono text-red-600">{run.error_code}</p>
                )}
                {run.error_message && (
                  <p className="text-[11px] text-red-700 leading-relaxed">{run.error_message}</p>
                )}
              </div>
            )}

            {/* Core details */}
            <section aria-label="Run details" className="flex flex-col gap-3">
              <h3 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">
                Execution Details
              </h3>

              <DetailRow label="Run ID">
                <span
                  className="font-mono text-[11px] text-[#9CA3AF] break-all"
                  title={run.id}
                >
                  {run.id}
                </span>
              </DetailRow>

              <DetailRow label="Report">
                <span className="font-semibold">{run.report_slug}</span>
                <span className="ml-2 text-[#9CA3AF]">v{run.report_version}</span>
              </DetailRow>

              <DetailRow label="Started">
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={Clock01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
                  {absTime(run.started_at)}
                </span>
              </DetailRow>

              {run.completed_at && (
                <DetailRow label="Completed">
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
                    {absTime(run.completed_at)}
                  </span>
                </DetailRow>
              )}

              {run.duration_ms !== null && (
                <DetailRow label="Duration">
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={Timer02Icon} size={11} color="#9CA3AF" strokeWidth={2} />
                    {formatDuration(run.duration_ms)}
                  </span>
                </DetailRow>
              )}

              {run.row_count !== null && (
                <DetailRow label="Rows">
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={Analytics01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
                    {run.row_count.toLocaleString()}
                    {run.truncated && (
                      <span
                        className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"
                        title="Results were truncated"
                      >
                        Truncated
                      </span>
                    )}
                  </span>
                </DetailRow>
              )}
            </section>

            {/* Parameters */}
            <section aria-label="Run parameters">
              <h3 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-3">
                Parameters
              </h3>
              <div className="rounded-xl border border-[#E8EEEE] bg-[#F8F9F9] px-3 py-2">
                <ParamTable params={run.parameters} />
              </div>
              {piiRequested && (
                <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
                  Full PII values were returned in this run. Parameter display
                  above does not include PII field values.
                </p>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
