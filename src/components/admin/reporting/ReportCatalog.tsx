import React, { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  Search01Icon,
  ArrowDown01Icon,
  LockPasswordIcon,
  UserGroupIcon,
  AirplaneTakeOff01Icon,
  Layers01Icon,
  Rocket01Icon,
  GridViewIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { ReportDefinition } from "./reportingTypes";

// ── Category config ────────────────────────────────────────────────────────────

export const CATEGORY_ORDER = [
  "Users",
  "Flight Searches",
  "GoWild Availability",
  "Beta Program",
  "Operations",
] as const;

type CatalogCategory = (typeof CATEGORY_ORDER)[number];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Users:               UserGroupIcon,
  "Flight Searches":   AirplaneTakeOff01Icon,
  "GoWild Availability": Layers01Icon,
  "Beta Program":      Rocket01Icon,
  Operations:          GridViewIcon,
};

// ── Pure logic helpers (exported for tests) ───────────────────────────────────

export function filterReports(
  reports: ReportDefinition[],
  query: string,
): ReportDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return reports;
  return reports.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q),
  );
}

export function groupReportsByCategory(
  reports: ReportDefinition[],
): Map<string, ReportDefinition[]> {
  const map = new Map<string, ReportDefinition[]>();
  // Initialise in CATEGORY_ORDER so iteration is ordered.
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const r of reports) {
    const bucket = map.get(r.category) ?? [];
    bucket.push(r);
    map.set(r.category, bucket);
  }
  // Drop empty categories and any unknown categories.
  const result = new Map<string, ReportDefinition[]>();
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat) ?? [];
    if (items.length > 0) result.set(cat, items);
  }
  // Append any categories not in CATEGORY_ORDER.
  for (const r of reports) {
    if (!CATEGORY_ORDER.includes(r.category as CatalogCategory)) {
      const existing = result.get(r.category) ?? [];
      if (!existing.includes(r)) existing.push(r);
      result.set(r.category, existing);
    }
  }
  return result;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportCatalogProps {
  reports:         ReportDefinition[];
  isLoading:       boolean;
  selectedSlug:    string | null;
  onSelect:        (slug: string) => void;
  searchQuery:     string;
  onSearchChange:  (q: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportCatalog({
  reports,
  isLoading,
  selectedSlug,
  onSelect,
  searchQuery,
  onSearchChange,
}: ReportCatalogProps) {
  const filtered = filterReports(reports, searchQuery);
  const grouped  = groupReportsByCategory(filtered);

  // All categories start collapsed; track which ones the user has opened.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // When a report is already selected (e.g. deep-link), auto-expand its category.
  useEffect(() => {
    if (!selectedSlug) return;
    const report = reports.find((r) => r.slug === selectedSlug);
    if (!report) return;
    setExpanded((prev) => {
      if (prev.has(report.category)) return prev;
      return new Set([...prev, report.category]);
    });
  }, [selectedSlug, reports]);

  function toggleCategory(cat: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            color="#9CA3AF"
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            aria-label="Search reports"
            placeholder="Search reports…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[#E8EEEE] bg-[#F8F9F9] text-[#1A2E2E] placeholder-[#9CA3AF] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-colors"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-2 pb-3" role="tree" aria-label="Report catalog">
        {isLoading && (
          <div className="flex flex-col gap-2 px-1 pt-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 rounded-xl bg-[#F0F1F1] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center px-3">
            <HugeiconsIcon icon={Analytics01Icon} size={28} color="#D1D5DB" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#9CA3AF]">
              {searchQuery ? "No reports match your search" : "No reports available"}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-xs text-[#059669] font-semibold hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {!isLoading &&
          [...grouped.entries()].map(([category, items]) => {
            const isOpen     = expanded.has(category);
            const CategoryIcon = CATEGORY_ICONS[category] ?? Analytics01Icon;

            return (
              <div key={category} className="mb-1" role="group" aria-label={category}>
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isOpen}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-[#F2F3F3] transition-colors group"
                >
                  <HugeiconsIcon
                    icon={CategoryIcon}
                    size={13}
                    color="#9CA3AF"
                    strokeWidth={2}
                  />
                  <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] group-hover:text-[#6B7280]">
                    {category}
                  </span>
                  <span className="text-[10px] text-[#C4CACC] font-medium mr-0.5">
                    {items.length}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={12}
                    color="#C4CACC"
                    strokeWidth={2.5}
                    style={{
                      transform:  isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>

                {/* Reports in category */}
                {isOpen && (
                  <div className="mt-0.5 flex flex-col gap-0.5" role="group">
                    {items.map((report) => {
                      const isSelected = report.slug === selectedSlug;
                      return (
                        <button
                          key={report.slug}
                          type="button"
                          role="treeitem"
                          aria-selected={isSelected}
                          onClick={() => onSelect(report.slug)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl transition-all group",
                            isSelected
                              ? "bg-[#ECFDF5] text-[#065F46]"
                              : "hover:bg-[#F2F3F3] text-[#374151]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "text-sm font-semibold leading-snug",
                                isSelected ? "text-[#065F46]" : "text-[#1A2E2E]",
                              )}
                            >
                              {report.name}
                            </span>
                            {report.contains_pii && (
                              <span
                                title="Contains PII"
                                aria-label="Contains personally identifiable information"
                              >
                                <HugeiconsIcon
                                  icon={LockPasswordIcon}
                                  size={12}
                                  color={isSelected ? "#059669" : "#9CA3AF"}
                                  strokeWidth={2}
                                  className="flex-shrink-0 mt-0.5"
                                />
                              </span>
                            )}
                          </div>
                          {report.description && (
                            <p
                              className={cn(
                                "text-[11px] mt-0.5 leading-relaxed line-clamp-2",
                                isSelected ? "text-[#059669]/80" : "text-[#9CA3AF]",
                              )}
                            >
                              {report.description}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
