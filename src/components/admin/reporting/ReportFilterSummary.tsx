import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FilterIcon } from "@hugeicons/core-free-icons";
import type { ReportDefinition } from "./reportingTypes";

interface ReportFilterSummaryProps {
  definition: ReportDefinition;
  parameters: Record<string, unknown>;
}

export function ReportFilterSummary({
  definition,
  parameters,
}: ReportFilterSummaryProps) {
  const fields = definition.parameter_schema?.fields ?? [];

  const active = fields.filter((f) => {
    const v = parameters[f.key];
    return v !== undefined && v !== null && String(v).trim() !== "" && v !== false;
  });

  if (active.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="region"
      aria-label="Active report filters"
    >
      <div className="flex items-center gap-1 flex-shrink-0">
        <HugeiconsIcon icon={FilterIcon} size={11} color="#9CA3AF" strokeWidth={2} aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">
          Filters
        </span>
      </div>
      {active.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0F1F1] text-[11px] font-semibold text-[#374151]"
        >
          <span className="text-[#9CA3AF] font-normal">{f.label}:</span>
          {String(parameters[f.key])}
        </span>
      ))}
    </div>
  );
}
