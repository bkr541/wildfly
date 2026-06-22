import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { formatCell } from "./reportingFormatters";
import type { ReportSummaryMetric } from "./reportingTypes";

// ── Shared styles ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:     "rgba(255,255,255,0.88)",
  border:         "1px solid rgba(203,213,225,0.5)",
  boxShadow:      "0 1px 4px 0 rgba(52,92,90,0.06)",
};

// ── Single metric card ─────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: ReportSummaryMetric }) {
  const formatted = formatCell(metric.value, metric.type);

  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
      style={CARD}
      role="group"
      aria-label={metric.label}
    >
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon
          icon={Analytics01Icon}
          size={11}
          color="#9CA3AF"
          strokeWidth={2}
          aria-hidden="true"
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#9CA3AF]">
          {metric.label}
        </span>
      </div>
      <p className="text-2xl font-black text-[#1A2E2E] leading-tight tabular-nums">
        {formatted}
      </p>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportSummaryCardsProps {
  summary: ReportSummaryMetric[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  if (!summary || summary.length === 0) return null;

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))`,
      }}
      role="region"
      aria-label="Report summary"
    >
      {summary.map((metric) => (
        <MetricCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}
