import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

type EmptyStateType = "no-report" | "no-run";

interface ReportEmptyStateProps {
  type:         EmptyStateType;
  reportName?:  string;
  onBrowse?:    () => void;
}

export function ReportEmptyState({
  type,
  reportName,
  onBrowse,
}: ReportEmptyStateProps) {
  const isNoReport = type === "no-report";

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      role="status"
      aria-label={isNoReport ? "No report selected" : "Report not yet run"}
    >
      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(5,150,105,0.07)" }}
      >
        <HugeiconsIcon
          icon={Analytics01Icon}
          size={32}
          color="#059669"
          strokeWidth={1.5}
        />
      </div>

      {isNoReport ? (
        <>
          <div className="flex flex-col gap-1.5 max-w-xs">
            <h3 className="text-base font-black text-[#1A2E2E]">Select a Report</h3>
            <p className="text-sm text-[#9CA3AF] leading-relaxed">
              Choose a report from the catalog on the left to configure filters and
              view results.
            </p>
          </div>
          {onBrowse && (
            <button
              type="button"
              onClick={onBrowse}
              className="md:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              Browse Reports
              <HugeiconsIcon icon={ArrowRight01Icon} size={15} color="white" strokeWidth={2.5} />
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-1.5 max-w-xs">
          <h3 className="text-base font-black text-[#1A2E2E]">
            Ready to Run
          </h3>
          <p className="text-sm text-[#9CA3AF] leading-relaxed">
            {reportName
              ? `Configure the parameters for "${reportName}" above, then press Run Report.`
              : "Configure the parameters above, then press Run Report."}
          </p>
        </div>
      )}
    </div>
  );
}
