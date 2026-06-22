import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  LockPasswordIcon,
  Clock01Icon,
  BookOpen01Icon,
} from "@hugeicons/core-free-icons";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { ReportDefinition } from "./reportingTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Users":               { bg: "#EFF6FF", text: "#1D4ED8" },
  "Flight Searches":     { bg: "#FFF7ED", text: "#C2410C" },
  "GoWild Availability": { bg: "#ECFDF5", text: "#065F46" },
  "Beta Program":        { bg: "#FAF5FF", text: "#6D28D9" },
  "Operations":          { bg: "#F0FDF4", text: "#166534" },
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? { bg: "#F3F4F6", text: "#374151" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: colors.bg, color: colors.text }}
    >
      {category}
    </span>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportHeaderProps {
  definition:          ReportDefinition;
  lastRunAt:           string | null;
  onMobileCatalogOpen: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportHeader({
  definition,
  lastRunAt,
  onMobileCatalogOpen,
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Mobile: breadcrumb / back button */}
      <button
        type="button"
        onClick={onMobileCatalogOpen}
        className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-[#059669] hover:underline w-fit"
        aria-label="Browse report catalog"
      >
        <HugeiconsIcon icon={BookOpen01Icon} size={13} color="currentColor" strokeWidth={2} />
        Browse Reports
      </button>

      {/* Title row */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(5,150,105,0.08)" }}>
          <HugeiconsIcon icon={Analytics01Icon} size={18} color="#059669" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[#1A2E2E] leading-tight">{definition.name}</h2>
          {definition.description && (
            <p className="text-sm text-[#6B7280] mt-0.5 leading-relaxed">
              {definition.description}
            </p>
          )}
        </div>
      </div>

      {/* Meta row: category, version, PII, last run */}
      <div className="flex items-center gap-2 flex-wrap ml-12">
        <CategoryBadge category={definition.category} />

        <span className="text-[11px] font-mono text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
          v{definition.version}
        </span>

        {definition.contains_pii && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <HugeiconsIcon icon={LockPasswordIcon} size={11} color="currentColor" strokeWidth={2} />
            Contains PII
          </span>
        )}

        {lastRunAt && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF]">
            <HugeiconsIcon icon={Clock01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
            Last run {relTime(lastRunAt)}
          </span>
        )}
      </div>
    </div>
  );
}
