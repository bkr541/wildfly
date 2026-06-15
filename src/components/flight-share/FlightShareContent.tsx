// ─────────────────────────────────────────────────────────────────────────────
// FlightShareContent — shared presentational body for flight share results.
//
// Accepts a versioned FlightShareModel and renders sections, airport groups,
// option rows, and footer.
//
// Used by:
//   FlightShareTemplate (mode="image") — fixed-width html-to-image export
//   PublicFlightShareView (mode="page") — responsive public web page
//
// Contains no Supabase calls, no route logic, no GetMyData calls, no search
// logic, and no image-download side effects.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { FlightShareModel, FlightShareSection } from "@/utils/flightShareModel";
import { FlightShareAirportGroup } from "./FlightShareAirportGroup";
import { FlightShareOptionRow } from "./FlightShareOptionRow";
import type { FlightShareRenderMode } from "./FlightShareOptionRow";

export type { FlightShareRenderMode };

// ── Design tokens (kept in sync with FlightShareTemplate and FlightShareOptionRow) ─

const DARK_TEAL = "#1A2E2E";
const MUTED     = "#6B7B7B";
const FAINT     = "#9AADAD";
const EMERALD   = "#059669";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FlightShareContentProps {
  model: FlightShareModel;
  mode?: FlightShareRenderMode;
  /**
   * Page mode: when content is inside a container that already has horizontal
   * padding, set this to remove the body's own horizontal padding.
   * Defaults to true (body has no horizontal padding in page mode; outer
   * wrapper provides it).
   */
  noPadX?: boolean;
}

// ── Section divider pill ──────────────────────────────────────────────────────

function SectionHeader({
  section,
  mode,
}: {
  section: FlightShareSection;
  mode: FlightShareRenderMode;
}) {
  const isReturn = section.sectionType === "RETURN";
  return (
    <div
      role="heading"
      aria-level={3}
      style={{
        display: "flex",
        alignItems: "center",
        gap: mode === "image" ? 10 : 8,
        marginBottom: mode === "image" ? 14 : 12,
      }}
    >
      <div style={{ height: 1, flex: 1, background: "#E8EBEB" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: EMERALD,
          borderRadius: 20,
          padding: mode === "image" ? "5px 14px" : "4px 12px",
        }}
      >
        <HugeiconsIcon
          icon={AirplaneTakeOff01Icon}
          size={mode === "image" ? 13 : 12}
          color="#FFFFFF"
          strokeWidth={2}
          style={isReturn ? { transform: "scaleX(-1)" } : undefined}
        />
        <span
          style={{
            fontSize: mode === "image" ? 12 : 11,
            fontWeight: 700,
            color: "#FFFFFF",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {section.label}
        </span>
        {section.formattedDateLabel && (
          <>
            <div
              style={{
                width: 1,
                height: mode === "image" ? 12 : 10,
                background: "rgba(255,255,255,0.4)",
              }}
            />
            <span
              style={{
                fontSize: mode === "image" ? 12 : 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.88)",
              }}
            >
              {section.formattedDateLabel}
            </span>
          </>
        )}
      </div>
      <div style={{ height: 1, flex: 1, background: "#E8EBEB" }} />
    </div>
  );
}

// ── Section content ──────────────────────────────────────────────────────────

function SectionGroups({
  section,
  mode,
  allGroupsOptionCount,
}: {
  section: FlightShareSection;
  mode: FlightShareRenderMode;
  allGroupsOptionCount: number;
}) {
  if (section.airportGroups.length === 0) {
    return (
      <p
        style={{
          textAlign: "center",
          fontSize: mode === "image" ? 14 : 13,
          color: FAINT,
          padding: "20px 0",
        }}
      >
        No options returned for this leg.
      </p>
    );
  }

  // Image mode + single group → rows directly, no card wrapper
  if (mode === "image" && section.airportGroups.length === 1) {
    const group = section.airportGroups[0];
    return (
      <div>
        {group.options.map((option, i) => (
          <FlightShareOptionRow
            key={option.canonicalKey}
            option={option}
            isFirst={i === 0}
            isLast={i === group.options.length - 1}
            sectionLabel={section.label}
            mode="image"
          />
        ))}
      </div>
    );
  }

  // Multiple groups, or page mode (always use group cards)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: mode === "image" ? 16 : 0,
      }}
    >
      {section.airportGroups.map((group, idx) => (
        <FlightShareAirportGroup
          key={group.iata}
          group={group}
          sectionLabel={section.label}
          mode={mode}
          // Auto-open first group or all groups when result set is small
          defaultOpen={
            mode === "page"
              ? allGroupsOptionCount <= 12 || idx === 0
              : true
          }
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Shared body and footer for flight share results.
 *
 * In "image" mode: uses the same padding and dimensions as the original
 * FlightShareTemplate body — suitable for deterministic html-to-image export.
 *
 * In "page" mode: responsive layout, no horizontal padding (outer wrapper
 * provides it), groups are collapsible, content grows vertically without
 * clipping.
 */
export function FlightShareContent({
  model,
  mode = "page",
  noPadX = true,
}: FlightShareContentProps) {
  // Only show section dividers when there are multiple sections (round-trip
  // image export). The public page handles section selection via tabs and
  // always passes a single-section derived model.
  const isMultiSection = model.sections.length > 1;

  const allGroupsOptionCount = model.sections.reduce(
    (total, sec) =>
      total + sec.airportGroups.reduce((s, g) => s + g.optionCount, 0),
    0,
  );

  const bodyStyle: React.CSSProperties =
    mode === "image"
      ? { padding: "28px 52px 40px 52px", display: "flex", flexDirection: "column", gap: 24 }
      : { padding: noPadX ? "16px 0 0 0" : "16px 16px 0 16px", display: "flex", flexDirection: "column", gap: 16 };

  const footerStyle: React.CSSProperties =
    mode === "image"
      ? {
          margin: "0 52px 40px 52px",
          borderRadius: 16,
          border: "1px solid #E8EBEB",
          background: "#FFFFFF",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 4px 0 rgba(53,92,90,0.05)",
        }
      : {
          borderRadius: 12,
          border: "1px solid #E8EBEB",
          background: "#FFFFFF",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap" as const,
          gap: 8,
          marginTop: 4,
        };

  return (
    <>
      {/* Body */}
      <div style={bodyStyle}>
        {!model.hasResults ? (
          /* Empty state */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: mode === "image" ? "60px 20px" : "40px 20px",
              gap: 12,
            }}
          >
            <HugeiconsIcon
              icon={AirplaneTakeOff01Icon}
              size={mode === "image" ? 40 : 36}
              color={FAINT}
              strokeWidth={1.5}
            />
            <p
              style={{
                fontSize: mode === "image" ? 16 : 15,
                fontWeight: 600,
                color: DARK_TEAL,
                textAlign: "center",
                margin: 0,
              }}
            >
              No flight options were returned
            </p>
            <p
              style={{
                fontSize: mode === "image" ? 13 : 12,
                color: MUTED,
                textAlign: "center",
                maxWidth: 320,
                margin: 0,
              }}
            >
              Try adjusting your search dates or departure location.
            </p>
          </div>
        ) : isMultiSection ? (
          model.sections.map((section) => (
            <div key={section.sectionType}>
              <SectionHeader section={section} mode={mode} />
              <SectionGroups
                section={section}
                mode={mode}
                allGroupsOptionCount={allGroupsOptionCount}
              />
            </div>
          ))
        ) : (
          <SectionGroups
            section={model.sections[0]}
            mode={mode}
            allGroupsOptionCount={allGroupsOptionCount}
          />
        )}
      </div>

      {/* Footer */}
      <footer aria-label="Disclaimer" style={footerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={15}
            color={FAINT}
            strokeWidth={1.8}
          />
          <span
            style={{
              fontSize: mode === "image" ? 12 : 11,
              color: MUTED,
              fontWeight: 500,
            }}
          >
            Fares and availability may change.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              fontSize: mode === "image" ? 12 : 11,
              color: MUTED,
              fontWeight: 500,
            }}
          >
            Shared from
          </span>
          <span
            style={{
              fontSize: mode === "image" ? 13 : 12,
              fontWeight: 800,
              color: EMERALD,
              letterSpacing: "0.02em",
            }}
          >
            Wildfly
          </span>
        </div>
      </footer>
    </>
  );
}

FlightShareContent.displayName = "FlightShareContent";
