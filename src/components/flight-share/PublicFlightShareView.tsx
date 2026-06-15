import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Rocket01Icon,
  SortByDown02Icon,
  FilterIcon,
  Clock01Icon,
  DollarCircleIcon,
  AirplaneTakeOff01Icon,
  AirplaneTakeOff02Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";
import type { FlightShareModel, FlightShareOption } from "@/utils/flightShareModel";
import { parseDurationToMinutes } from "@/utils/flightShareModel";
import { FlightShareHero } from "./FlightShareHero";
import { FlightShareSummary } from "./FlightShareSummary";
import { FlightShareContent } from "./FlightShareContent";
import { FlightShareTemplate } from "./FlightShareTemplate";
import { exportFlightShareImage, buildShareFilename } from "@/utils/exportFlightShareImage";

// ── Design tokens ─────────────────────────────────────────────────────────────

const EMERALD   = "#059669";
const DARK_TEAL = "#1A2E2E";
const MUTED     = "#6B7B7B";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = "all" | "gowild" | "nonstop" | "1stop";
type SortKey   = "dep" | "arr" | "dur" | "stops" | "fare";

export interface PublicFlightShareViewProps {
  model:      FlightShareModel;
  createdAt:  string;
  expiresAt?: string | null;
  publicUrl:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortOptions(options: FlightShareOption[], key: SortKey): FlightShareOption[] {
  return [...options].sort((a, b) => {
    switch (key) {
      case "dep":
        return a.departureRaw < b.departureRaw ? -1 : a.departureRaw > b.departureRaw ? 1 : 0;
      case "arr":
        return a.arrivalRaw < b.arrivalRaw ? -1 : a.arrivalRaw > b.arrivalRaw ? 1 : 0;
      case "dur": {
        const da = parseDurationToMinutes(a.formattedDuration);
        const db = parseDurationToMinutes(b.formattedDuration);
        return da - db;
      }
      case "stops":
        return a.stopCount - b.stopCount;
      case "fare": {
        const fa = a.emphasizedFare ?? Infinity;
        const fb = b.emphasizedFare ?? Infinity;
        return fa - fb;
      }
      default:
        return 0;
    }
  });
}

function filterOptions(options: FlightShareOption[], filter: FilterKey): FlightShareOption[] {
  switch (filter) {
    case "gowild":  return options.filter((o) => o.isGoWild);
    case "nonstop": return options.filter((o) => o.isNonstop);
    case "1stop":   return options.filter((o) => o.stopCount >= 1);
    default:        return options;
  }
}

/**
 * Derive a display model for FlightShareContent from interactive state.
 *
 * - Shows only the active section (for round-trip tab selection).
 * - Applies filter and sort to each airport group's options.
 * - Preserves group.optionCount (total) so the count pill can show "M / N options"
 *   when fewer options are visible due to filtering.
 */
function deriveDisplayModel(
  model: FlightShareModel,
  activeSection: number,
  filter: FilterKey,
  sort: SortKey,
): FlightShareModel {
  const section = model.sections[activeSection] ?? model.sections[0];
  const processedGroups = section.airportGroups.map((g) => {
    const filtered = filterOptions(g.options, filter);
    const sorted   = sortOptions(filtered, sort);
    return { ...g, options: sorted };
    // g.optionCount stays as the original total for the count pill
  });
  return {
    ...model,
    sections: [{ ...section, airportGroups: processedGroups }],
  };
}

// ── Main public view ──────────────────────────────────────────────────────────

export function PublicFlightShareView({
  model,
  createdAt,
  expiresAt,
  publicUrl,
}: PublicFlightShareViewProps) {
  const isRoundTrip = model.sections.length > 1;

  // Section tab (round-trip only)
  const [activeSection, setActiveSection] = useState(0);

  // Filter and sort
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort,   setSort]   = useState<SortKey>("dep");

  // Actions
  const [copied,      setCopied]      = useState(false);
  const [downloading, setDownloading] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Bottom sheets
  const [sortSheet,   setSortSheet]   = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);

  // Derived display model (filtered + sorted single section)
  const displayModel = useMemo(
    () => deriveDisplayModel(model, activeSection, filter, sort),
    [model, activeSection, filter, sort],
  );

  // Available filters (across all sections of the original model)
  const hasGoWild  = model.sections.some((s) => s.goWildCount > 0);
  const hasNonstop = model.sections.some((s) => s.nonstopCount > 0);
  const hasStops   = model.sections.some((s) =>
    s.airportGroups.some((g) => g.options.some((o) => o.stopCount >= 1)),
  );

  // Copy public link
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = publicUrl;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
      document.body.removeChild(input);
    }
  }, [publicUrl]);

  // Native share
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;
  const handleNativeShare = useCallback(async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: `${model.originLabel} to ${model.destinationLabel} | Wildfly`,
        text:  `Check out these ${model.originLabel}–${model.destinationLabel} flights on Wildfly`,
        url:   publicUrl,
      });
    } catch {
      /* User dismissed or share failed */
    }
  }, [canNativeShare, model.originLabel, model.destinationLabel, publicUrl]);

  // Download image (uses the off-screen FlightShareTemplate for exact image-mode rendering)
  const handleDownload = useCallback(async () => {
    const node = templateRef.current;
    if (!node || downloading) return;
    setDownloading(true);
    try {
      const filename = buildShareFilename(
        model.originLabel,
        model.destinationLabel,
        model.sections[0]?.dateValue ?? null,
      );
      await exportFlightShareImage(node, filename);
    } catch (err) {
      console.error("[PublicFlightShareView] image export failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [downloading, model]);

  // ── Sheet trigger button style ─────────────────────────────────────────────

  const sheetTriggerStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 14px",
    borderRadius: 999,
    border: active ? `1.5px solid ${EMERALD}` : "1.5px solid #E8EBEB",
    background: active ? "#F0FAF6" : "#FFFFFF",
    color: active ? EMERALD : MUTED,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 3px rgba(53,92,90,0.06)",
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F5" }}>
      {/* ── Content container ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 48px" }}>

        {/* Hero */}
        <FlightShareHero
          originLabel={model.originLabel}
          destinationLabel={model.destinationLabel}
          heroImageUrl={model.heroImageUrl}
          arrivalImageUrl={model.arrivalImageUrl}
          showLogo={false}
          className="w-full"
          style={{ height: "clamp(160px, 25vw, 253px)" } as React.CSSProperties}
        />

        {/* Stats summary strip */}
        <FlightShareSummary model={model} />

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div style={{ padding: "0 12px" }}>

          {/* Sort + Filter trigger row */}
          {model.hasResults && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button
                style={sheetTriggerStyle(sort !== "dep")}
                onClick={() => setSortSheet(true)}
                aria-label="Sort flights"
              >
                <HugeiconsIcon icon={SortByDown02Icon} size={12} color={sort !== "dep" ? EMERALD : MUTED} strokeWidth={2} />
                Sort By
              </button>
              <button
                style={sheetTriggerStyle(filter !== "all")}
                onClick={() => setFilterSheet(true)}
                aria-label="Filter flights"
              >
                <HugeiconsIcon icon={FilterIcon} size={12} color={filter !== "all" ? EMERALD : MUTED} strokeWidth={2} />
                Filter
              </button>
            </div>
          )}

          {/* Round-trip section tabs */}
          {isRoundTrip && (
            <div
              role="tablist"
              aria-label="Flight direction"
              style={{
                display: "flex",
                background: "#E8EBEB",
                borderRadius: 10,
                padding: 3,
                gap: 2,
                marginBottom: 14,
              }}
            >
              {model.sections.map((sec, idx) => (
                <button
                  key={sec.sectionType}
                  role="tab"
                  aria-selected={activeSection === idx}
                  onClick={() => setActiveSection(idx)}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    background: activeSection === idx ? "#FFFFFF" : "transparent",
                    color: activeSection === idx ? DARK_TEAL : MUTED,
                    boxShadow:
                      activeSection === idx ? "0 1px 4px rgba(53,92,90,0.12)" : "none",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {sec.label}
                  {sec.formattedDateLabel ? ` · ${sec.formattedDateLabel}` : ""}
                </button>
              ))}
            </div>
          )}

          {/* Flight results — rendered by FlightShareContent in page mode */}
          {!model.hasResults ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E8EBEB",
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 600, color: DARK_TEAL, margin: "0 0 4px" }}>
                No flight options were returned
              </p>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
                This snapshot had no available flights.
              </p>
            </div>
          ) : (
            <FlightShareContent
              model={displayModel}
              mode="page"
              noPadX
            />
          )}
        </div>
      </div>

      {/* ── Sort Sheet ──────────────────────────────────────────────────────── */}
      <BottomSheet open={sortSheet} onClose={() => setSortSheet(false)}>
        <div className="flex items-center gap-2.5 px-5 pt-2 pb-4 border-b border-[#F0F1F1]">
          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
            <HugeiconsIcon icon={SortByDown02Icon} size={15} color="white" strokeWidth={2} />
          </div>
          <h2 className="text-base font-bold text-[#2E4A4A]">Sort By</h2>
        </div>
        <div className="flex flex-col py-2 pb-8">
          {([
            { key: "dep"   as SortKey, label: "Departure Time",  desc: "Earliest flights first",  icon: Clock01Icon },
            { key: "fare"  as SortKey, label: "Lowest Fare",     desc: "Cheapest fares first",    icon: DollarCircleIcon },
            { key: "dur"   as SortKey, label: "Shortest Flight", desc: "Quickest flights first",  icon: AirplaneTakeOff02Icon },
            { key: "stops" as SortKey, label: "Fewest Stops",    desc: "Nonstop flights first",   icon: CheckmarkCircle02Icon },
          ]).map(({ key, label, desc, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setSort(key); setSortSheet(false); }}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5"
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: sort === key ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "rgba(107,123,123,0.10)" }}
              >
                <HugeiconsIcon icon={icon} size={17} color={sort === key ? "white" : "#6B7B7B"} strokeWidth={2} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-sm font-semibold ${sort === key ? "text-[#059669]" : "text-[#2E4A4A]"}`}>{label}</p>
                <p className="text-xs text-[#9CA3AF]">{desc}</p>
              </div>
              {sort === key && (
                <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} color="white" strokeWidth={2.5} />
                </div>
              )}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── Filter Sheet ─────────────────────────────────────────────────────── */}
      <BottomSheet open={filterSheet} onClose={() => setFilterSheet(false)}>
        <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-[#F0F1F1]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
              <HugeiconsIcon icon={FilterIcon} size={15} color="white" strokeWidth={2} />
            </div>
            <h2 className="text-base font-bold text-[#2E4A4A]">Filter</h2>
          </div>
          {filter !== "all" && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="text-xs font-semibold text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-col py-2">
          {([
            { key: "gowild"  as FilterKey, label: "GoWild Fares",  desc: "Show only flights with GoWild pricing", icon: Rocket01Icon,       show: hasGoWild },
            { key: "nonstop" as FilterKey, label: "Nonstop Only",  desc: "Show only nonstop flights",             icon: AirplaneTakeOff01Icon, show: hasNonstop },
            { key: "1stop"   as FilterKey, label: "1+ Stop",       desc: "Show connecting flights only",          icon: AirplaneTakeOff02Icon, show: hasStops },
          ]).filter(({ show }) => show).map(({ key, label, desc, icon }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(active ? "all" : key)}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5"
              >
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "rgba(107,123,123,0.10)" }}
                >
                  <HugeiconsIcon icon={icon} size={17} color={active ? "white" : "#6B7B7B"} strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-semibold ${active ? "text-[#059669]" : "text-[#2E4A4A]"}`}>{label}</p>
                  <p className="text-xs text-[#9CA3AF]">{desc}</p>
                </div>
                <div
                  className="w-11 h-6 rounded-full flex items-center transition-all flex-shrink-0 px-0.5"
                  style={{ background: active ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "#E5E7EB" }}
                >
                  <motion.div
                    animate={{ x: active ? 20 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    className="h-5 w-5 rounded-full bg-white shadow-sm"
                  />
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-5 pb-8 pt-2">
          <button
            type="button"
            onClick={() => setFilterSheet(false)}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            Apply
          </button>
        </div>
      </BottomSheet>

      {/* ── Off-screen FlightShareTemplate for image export ─────────────────── */}
      {/* Uses mode="image" via FlightShareContent internally — exact template dimensions */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <FlightShareTemplate ref={templateRef} model={model} />
      </div>
    </div>
  );
}

PublicFlightShareView.displayName = "PublicFlightShareView";
