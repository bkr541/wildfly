import React, { useCallback, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Share03Icon,
  ImageDownloadIcon,
  Rocket01Icon,
  SortByDown02Icon,
} from "@hugeicons/core-free-icons";
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

function formatSnapshotDate(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    return `${date} at ${time}`;
  } catch {
    return iso;
  }
}

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

  // ── Button styles ─────────────────────────────────────────────────────────

  const actionBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #E8EBEB",
    background: "#FFFFFF",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    color: DARK_TEAL,
    boxShadow: "0 1px 3px rgba(53,92,90,0.06)",
    whiteSpace: "nowrap",
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    borderRadius: 999,
    border: active ? `1.5px solid ${EMERALD}` : "1.5px solid #E8EBEB",
    background: active ? "#F0FAF6" : "#FFFFFF",
    color: active ? EMERALD : MUTED,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
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
          className="w-full"
          style={{ height: "clamp(160px, 25vw, 253px)" } as React.CSSProperties}
        />

        {/* Stats summary strip */}
        <FlightShareSummary model={model} />

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div style={{ padding: "0 12px" }}>

          {/* Snapshot disclosure */}
          <div
            style={{
              margin: "12px 0 10px",
              padding: "10px 14px",
              background: "#FFF",
              border: "1px solid #E8EBEB",
              borderRadius: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
              📸
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: DARK_TEAL, lineHeight: 1.4 }}>
                Results captured {formatSnapshotDate(createdAt)}.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>
                Prices and availability may have changed. These results are a snapshot — not a live
                search.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <button style={actionBtnStyle} onClick={handleCopy} aria-label="Copy public link">
              <HugeiconsIcon icon={Copy01Icon} size={13} color={DARK_TEAL} strokeWidth={2} />
              {copied ? "Copied!" : "Copy link"}
            </button>

            {canNativeShare && (
              <button
                style={actionBtnStyle}
                onClick={handleNativeShare}
                aria-label="Share via device share sheet"
              >
                <HugeiconsIcon icon={Share03Icon} size={13} color={DARK_TEAL} strokeWidth={2} />
                Share
              </button>
            )}

            <button
              style={{ ...actionBtnStyle, opacity: downloading ? 0.6 : 1 }}
              onClick={handleDownload}
              disabled={downloading}
              aria-label="Download flight results as image"
            >
              <HugeiconsIcon icon={ImageDownloadIcon} size={13} color={DARK_TEAL} strokeWidth={2} />
              {downloading ? "Exporting…" : "Download image"}
            </button>
          </div>

          {/* Filter + Sort bar */}
          {model.hasResults && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  style={filterBtnStyle(filter === "all")}
                  onClick={() => setFilter("all")}
                  aria-label="Show all flights"
                >
                  All
                </button>
                {hasGoWild && (
                  <button
                    style={filterBtnStyle(filter === "gowild")}
                    onClick={() => setFilter("gowild")}
                    aria-label="Show GoWild flights only"
                  >
                    <HugeiconsIcon
                      icon={Rocket01Icon}
                      size={10}
                      color={filter === "gowild" ? EMERALD : MUTED}
                      strokeWidth={2.5}
                      style={{ marginRight: 3 }}
                    />
                    GoWild
                  </button>
                )}
                {hasNonstop && (
                  <button
                    style={filterBtnStyle(filter === "nonstop")}
                    onClick={() => setFilter("nonstop")}
                    aria-label="Show nonstop flights only"
                  >
                    Nonstop
                  </button>
                )}
                {hasStops && (
                  <button
                    style={filterBtnStyle(filter === "1stop")}
                    onClick={() => setFilter("1stop")}
                    aria-label="Show connecting flights only"
                  >
                    1+ Stop
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <HugeiconsIcon icon={SortByDown02Icon} size={13} color={MUTED} strokeWidth={2} />
                <label
                  htmlFor="public-share-sort"
                  style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}
                >
                  Sort:
                </label>
                <select
                  id="public-share-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: DARK_TEAL,
                    border: "1px solid #E8EBEB",
                    borderRadius: 8,
                    padding: "4px 6px",
                    background: "#FFFFFF",
                    cursor: "pointer",
                  }}
                  aria-label="Sort flights by"
                >
                  <option value="dep">Departure</option>
                  <option value="arr">Arrival</option>
                  <option value="dur">Duration</option>
                  <option value="stops">Stops</option>
                  <option value="fare">Fare</option>
                </select>
              </div>
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
