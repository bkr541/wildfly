import React, { useCallback, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  Copy01Icon,
  Share03Icon,
  ImageDownloadIcon,
  ChevronDown,
  ChevronUp,
  Rocket01Icon,
  SortByDown02Icon,
} from "@hugeicons/core-free-icons";
import type { FlightShareModel, FlightShareSection, FlightShareAirportGroup, FlightShareOption } from "@/utils/flightShareModel";
import { parseDurationToMinutes } from "@/utils/flightShareModel";
import { FlightShareHero } from "./FlightShareHero";
import { FlightShareSummary } from "./FlightShareSummary";
import { FlightShareTemplate } from "./FlightShareTemplate";
import { exportFlightShareImage, buildShareFilename } from "@/utils/exportFlightShareImage";

// ── Design tokens ─────────────────────────────────────────────────────────────

const EMERALD   = "#059669";
const DARK_TEAL = "#1A2E2E";
const MUTED     = "#6B7B7B";
const FAINT     = "#9AADAD";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = "all" | "gowild" | "nonstop" | "1stop";
type SortKey   = "dep" | "arr" | "dur" | "stops" | "fare";

export interface PublicFlightShareViewProps {
  model:         FlightShareModel;
  createdAt:     string;
  expiresAt?:    string | null;
  publicUrl:     string;
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

function formatFare(fare: number | null): string {
  if (fare == null) return "—";
  return `$${fare.toFixed(0)}`;
}

function stopLabel(option: FlightShareOption): string {
  if (option.isNonstop) return "NONSTOP";
  return option.stopCount === 1 ? "1 STOP" : `${option.stopCount} STOPS`;
}

function sortOptions(options: FlightShareOption[], key: SortKey): FlightShareOption[] {
  return [...options].sort((a, b) => {
    switch (key) {
      case "dep":
        return (a.departureRaw < b.departureRaw ? -1 : a.departureRaw > b.departureRaw ? 1 : 0);
      case "arr":
        return (a.arrivalRaw < b.arrivalRaw ? -1 : a.arrivalRaw > b.arrivalRaw ? 1 : 0);
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
    case "gowild":  return options.filter(o => o.isGoWild);
    case "nonstop": return options.filter(o => o.isNonstop);
    case "1stop":   return options.filter(o => o.stopCount >= 1);
    default:        return options;
  }
}

// ── PublicFlightOptionCard — responsive boarding-pass card ────────────────────

function PublicFlightOptionCard({ option }: { option: FlightShareOption }) {
  const [expanded, setExpanded] = useState(false);
  const origin = option.routeAirports[0] ?? "";
  const dest   = option.routeAirports[option.routeAirports.length - 1] ?? "";
  const vias   = option.routeAirports.slice(1, -1);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: option.isGoWild ? "1.5px solid #A7F3D0" : "1px solid #E8EBEB",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 2px 10px 0 rgba(52,92,90,0.07)",
        marginBottom: 10,
      }}
    >
      {/* GoWild banner */}
      {option.isGoWild && (
        <div style={{
          background: EMERALD,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          padding: "6px 0",
        }}>
          <HugeiconsIcon icon={Rocket01Icon} size={12} color="#fff" strokeWidth={2.5} />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.04em" }}>GoWild</span>
          {option.goWildSeats != null && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginLeft: 4 }}>
              · {option.goWildSeats} {option.goWildSeats === 1 ? "seat" : "seats"} left
            </span>
          )}
        </div>
      )}

      {/* Main card body */}
      <div style={{ padding: "14px 16px 12px" }}>
        {/* Frontier logo */}
        <img
          src="/assets/logo/frontier/frontier_full_logo.png"
          alt="Frontier Airlines"
          style={{ height: 14, objectFit: "contain", objectPosition: "left", display: "block", marginBottom: 10 }}
        />

        {/* Route row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: DARK_TEAL, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {origin}
          </span>
          {vias.length > 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
              <div style={{ flex: 1, height: 1, borderTop: "1.5px dashed #B8CECE" }} />
              {vias.map(v => (
                <span key={v} style={{ fontSize: 13, fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>
                  via {v}
                </span>
              ))}
              <div style={{ flex: 1, height: 1, borderTop: "1.5px dashed #B8CECE" }} />
            </div>
          ) : (
            <div style={{ flex: 1, height: 1, borderTop: "1.5px dashed #B8CECE" }} />
          )}
          <span style={{ fontSize: 28, fontWeight: 900, color: DARK_TEAL, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {dest}
          </span>
        </div>

        {/* Times row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: EMERALD, fontVariantNumeric: "tabular-nums" }}>
              {option.departureTimeLabel}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {option.timeOfDay}
            </div>
          </div>

          <div style={{
            background: "#D1FAE5",
            borderRadius: 20,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#065F46",
          }}>
            {option.formattedDuration}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: EMERALD, fontVariantNumeric: "tabular-nums" }}>
              {option.arrivalTimeLabel}
              {option.isPlusOneDay && (
                <sup style={{ fontSize: 9, color: "#3B82F6", marginLeft: 2 }}>+1</sup>
              )}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Arrival
            </div>
          </div>
        </div>

        {/* Badges + fare row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "3px 8px",
              borderRadius: 999,
              background: option.isNonstop ? "#D1FAE5" : "#F1F5F5",
              color: option.isNonstop ? "#047857" : MUTED,
            }}>
              {stopLabel(option)}
            </span>
            {option.flightNumbers.length > 0 && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 999,
                background: "#F1F5F5",
                color: MUTED,
              }}>
                {option.flightNumbers.join(", ")}
              </span>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>From</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: option.isGoWild ? EMERALD : DARK_TEAL, fontVariantNumeric: "tabular-nums" }}>
              {formatFare(option.emphasizedFare)}
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide flight details" : "Show flight details"}
          style={{
            marginTop: 10,
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "4px 0",
            color: MUTED,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <span>{expanded ? "Hide details" : "Show details"}</span>
          <HugeiconsIcon
            icon={expanded ? ChevronUp : ChevronDown}
            size={12}
            color={MUTED}
            strokeWidth={2}
          />
        </button>

        {/* Expanded detail panel */}
        {expanded && (
          <div style={{
            marginTop: 8,
            paddingTop: 12,
            borderTop: "1px dashed #E8EBEB",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 16px",
          }}>
            {[
              ["Route",       option.route],
              ["Flight #",    option.flightNumbers.join(", ") || "—"],
              ["Departure",   option.departureTimeLabel],
              ["Arrival",     option.arrivalTimeLabel + (option.isPlusOneDay ? " +1d" : "")],
              ["Duration",    option.formattedDuration],
              ["Stops",       option.isNonstop ? "Nonstop" : `${option.stopCount} stop${option.stopCount !== 1 ? "s" : ""}`],
              ...(option.lowestPublicFare != null ? [["Lowest fare", formatFare(option.lowestPublicFare)]] : []),
              ...(option.isGoWild ? [["GoWild fare", formatFare(option.goWildFare)]] : []),
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 9, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK_TEAL }}>{v}</div>
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1" }}>
              <p style={{ fontSize: 10, color: FAINT, margin: 0, marginTop: 4 }}>
                Fares and availability shown at time of capture only.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PublicAirportGroupCard ─────────────────────────────────────────────────────

function PublicAirportGroupCard({
  group,
  defaultOpen,
  filter,
  sort,
}: {
  group:       FlightShareAirportGroup;
  defaultOpen: boolean;
  filter:      FilterKey;
  sort:        SortKey;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const displayedOptions = useMemo(() => {
    const filtered = filterOptions(group.options, filter);
    return sortOptions(filtered, sort);
  }, [group.options, filter, sort]);

  const displayName = (group.name && group.name !== group.iata)
    ? group.name
    : group.city !== group.iata
    ? group.city
    : null;

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E8EBEB",
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 2px 8px 0 rgba(53,92,90,0.06)",
      marginBottom: 12,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          borderBottom: open ? "1px solid #F0F1F1" : "none",
        }}
      >
        {/* Green airplane icon */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={15} color="#fff" strokeWidth={2} />
        </div>

        {/* IATA + name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: DARK_TEAL, letterSpacing: "-0.01em" }}>
            {group.iata}
          </span>
          {displayName && (
            <span style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginLeft: 8 }}>
              {displayName}
            </span>
          )}
        </div>

        {/* Count pill */}
        <span style={{
          flexShrink: 0,
          background: "#F0FAF6",
          border: "1px solid #A7F3D0",
          borderRadius: 20,
          padding: "3px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: "#047857",
          whiteSpace: "nowrap",
        }}>
          {displayedOptions.length} / {group.optionCount} {group.optionCount === 1 ? "option" : "options"}
        </span>

        <HugeiconsIcon
          icon={open ? ChevronUp : ChevronDown}
          size={16}
          color={MUTED}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div style={{ padding: "12px 12px 8px" }}>
          {displayedOptions.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: 13, color: FAINT, padding: "16px 0" }}>
              No options match the current filter.
            </p>
          ) : (
            displayedOptions.map(option => (
              <PublicFlightOptionCard key={option.canonicalKey} option={option} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Section display ───────────────────────────────────────────────────────────

function SectionDivider({ section }: { section: FlightShareSection }) {
  const isReturn = section.sectionType === "RETURN";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 12px" }}>
      <div style={{ flex: 1, height: 1, background: "#E8EBEB" }} />
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: EMERALD,
        borderRadius: 20,
        padding: "4px 12px",
      }}>
        <HugeiconsIcon
          icon={AirplaneTakeOff01Icon}
          size={12}
          color="#fff"
          strokeWidth={2}
          style={isReturn ? { transform: "scaleX(-1)" } : undefined}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {section.label}
        </span>
        {section.formattedDateLabel && (
          <>
            <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.4)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
              {section.formattedDateLabel}
            </span>
          </>
        )}
      </div>
      <div style={{ flex: 1, height: 1, background: "#E8EBEB" }} />
    </div>
  );
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
  const [copied,       setCopied]       = useState(false);
  const [downloading,  setDownloading]  = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Determine available filters across ALL sections
  const hasGoWild  = model.sections.some(s => s.goWildCount > 0);
  const hasNonstop = model.sections.some(s => s.nonstopCount > 0);
  const hasStops   = model.sections.some(s =>
    s.airportGroups.some(g => g.options.some(o => o.stopCount >= 1))
  );

  // Copy public link
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — prompt user to copy manually
      const input = document.createElement("input");
      input.value = publicUrl;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
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
      // User dismissed or share failed — fall through silently
    }
  }, [canNativeShare, model.originLabel, model.destinationLabel, publicUrl]);

  // Download image (uses the off-screen FlightShareTemplate)
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

  const currentSection = model.sections[activeSection] ?? model.sections[0];

  const allGroupsCount = model.sections.reduce((s, sec) =>
    s + sec.airportGroups.reduce((gs, g) => gs + g.optionCount, 0), 0);
  const defaultOpen = (g: FlightShareAirportGroup) => allGroupsCount <= 12 || g === currentSection.airportGroups[0];

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

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F5" }}>
      {/* ── Content container ─────────────────────────────────────────── */}
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

        {/* Stats summary */}
        <FlightShareSummary model={model} />

        {/* ── Content card ──────────────────────────────────────────── */}
        <div style={{ padding: "0 12px" }}>

          {/* Snapshot disclosure */}
          <div style={{
            margin: "12px 0 10px",
            padding: "10px 14px",
            background: "#FFF",
            border: "1px solid #E8EBEB",
            borderRadius: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}>
            <span aria-hidden="true" style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📸</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: DARK_TEAL, lineHeight: 1.4 }}>
                Results captured {formatSnapshotDate(createdAt)}.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>
                Prices and availability may have changed. These results are a snapshot — not a live search.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}>
            <button style={actionBtnStyle} onClick={handleCopy} aria-label="Copy public link">
              <HugeiconsIcon icon={Copy01Icon} size={13} color={DARK_TEAL} strokeWidth={2} />
              {copied ? "Copied!" : "Copy link"}
            </button>

            {canNativeShare && (
              <button style={actionBtnStyle} onClick={handleNativeShare} aria-label="Share via device share sheet">
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
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 10,
            }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button style={filterBtnStyle(filter === "all")}  onClick={() => setFilter("all")}  aria-label="Show all flights">All</button>
                {hasGoWild  && <button style={filterBtnStyle(filter === "gowild")}  onClick={() => setFilter("gowild")}  aria-label="Show GoWild flights only"><HugeiconsIcon icon={Rocket01Icon} size={10} color={filter === "gowild" ? EMERALD : MUTED} strokeWidth={2.5} style={{ marginRight: 3 }} />GoWild</button>}
                {hasNonstop && <button style={filterBtnStyle(filter === "nonstop")} onClick={() => setFilter("nonstop")} aria-label="Show nonstop flights only">Nonstop</button>}
                {hasStops   && <button style={filterBtnStyle(filter === "1stop")}   onClick={() => setFilter("1stop")}   aria-label="Show connecting flights only">1+ Stop</button>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <HugeiconsIcon icon={SortByDown02Icon} size={13} color={MUTED} strokeWidth={2} />
                <label htmlFor="public-share-sort" style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Sort:</label>
                <select
                  id="public-share-sort"
                  value={sort}
                  onChange={e => setSort(e.target.value as SortKey)}
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

          {/* Section tabs — round trip only */}
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
                    boxShadow: activeSection === idx ? "0 1px 4px rgba(53,92,90,0.12)" : "none",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {sec.label}
                  {sec.formattedDateLabel ? ` · ${sec.formattedDateLabel}` : ""}
                </button>
              ))}
            </div>
          )}

          {/* Flight groups */}
          {!model.hasResults ? (
            <div style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E8EBEB",
            }}>
              <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={36} color={FAINT} strokeWidth={1.5} />
              <p style={{ fontSize: 15, fontWeight: 600, color: DARK_TEAL, marginTop: 12 }}>
                No flight options were returned
              </p>
              <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                This snapshot had no available flights.
              </p>
            </div>
          ) : (
            <>
              {!isRoundTrip && currentSection.airportGroups.length === 0 && (
                <p style={{ textAlign: "center", color: FAINT, fontSize: 13 }}>No options in this section.</p>
              )}

              {currentSection.airportGroups.map(group => (
                <PublicAirportGroupCard
                  key={group.iata}
                  group={group}
                  defaultOpen={defaultOpen(group)}
                  filter={filter}
                  sort={sort}
                />
              ))}
            </>
          )}

          {/* Footer */}
          <div style={{
            marginTop: 20,
            padding: "12px 16px",
            background: "#FFFFFF",
            border: "1px solid #E8EBEB",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
              Fares and availability may change. Snapshot taken {formatSnapshotDate(createdAt)}.
            </p>
            <span style={{ fontSize: 12, fontWeight: 800, color: EMERALD, letterSpacing: "0.02em" }}>
              Wildfly
            </span>
          </div>
        </div>
      </div>

      {/* ── Off-screen FlightShareTemplate for image export ───────────── */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, pointerEvents: "none", zIndex: -1 }}
      >
        <FlightShareTemplate ref={templateRef} model={model} />
      </div>
    </div>
  );
}

PublicFlightShareView.displayName = "PublicFlightShareView";
