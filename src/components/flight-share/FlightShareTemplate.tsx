import React, { forwardRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { FlightShareModel, FlightShareSection } from "@/utils/flightShareModel";
import { FlightShareAirportGroup } from "./FlightShareAirportGroup";
import { FlightShareOptionRow } from "./FlightShareOptionRow";
import { FlightShareHero } from "./FlightShareHero";
import { FlightShareSummary } from "./FlightShareSummary";

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT_WIDTH = 941;
const HERO_HEIGHT = 253;
const FONT_FAMILY =
  "Quicksand, Montserrat, ui-sans-serif, system-ui, -apple-system, sans-serif";
const PAGE_BG = "#F7F9F8";
const DARK_TEAL = "#1A2E2E";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const EMERALD = "#059669";

/** Section divider used between DEPARTING and RETURN legs. */
function SectionHeader({ section }: { section: FlightShareSection }) {
  const isReturn = section.sectionType === "RETURN";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    }}>
      <div style={{ height: 1, flex: 1, background: "#E8EBEB" }} />
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: EMERALD,
        borderRadius: 20,
        padding: "5px 14px",
      }}>
        <HugeiconsIcon
          icon={AirplaneTakeOff01Icon}
          size={13}
          color="#FFFFFF"
          strokeWidth={2}
          style={isReturn ? { transform: "scaleX(-1)" } : undefined}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {section.label}
        </span>
        {section.formattedDateLabel && (
          <>
            <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.4)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
              {section.formattedDateLabel}
            </span>
          </>
        )}
      </div>
      <div style={{ height: 1, flex: 1, background: "#E8EBEB" }} />
    </div>
  );
}

/**
 * Renders flights for a section.
 * Single airport group → rows rendered directly (no card wrapper).
 * Multiple airport groups → each wrapped in a FlightShareAirportGroup card.
 */
function SectionGroups({ section }: { section: FlightShareSection }) {
  if (section.airportGroups.length === 0) {
    return (
      <p style={{
        textAlign: "center",
        fontSize: 14,
        color: FAINT,
        padding: "20px 0",
      }}>
        No options returned for this leg.
      </p>
    );
  }

  if (section.airportGroups.length === 1) {
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
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {section.airportGroups.map((group) => (
        <FlightShareAirportGroup key={group.iata} group={group} sectionLabel={section.label} />
      ))}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface FlightShareTemplateProps {
  model: FlightShareModel;
}

// ── Main template ────────────────────────────────────────────────────────────

export const FlightShareTemplate = forwardRef<HTMLDivElement, FlightShareTemplateProps>(
  ({ model }, ref) => {
    const isRoundTrip = model.sections.length > 1 ||
      (model.sections[0]?.sectionType !== "ONE-WAY");

    return (
      <div
        ref={ref}
        data-flight-share-root="true"
        style={{
          width: ROOT_WIDTH,
          minHeight: 1200,
          background: PAGE_BG,
          fontFamily: FONT_FAMILY,
          boxSizing: "border-box",
          overflow: "hidden",
          position: "relative",
          contain: "layout",
        }}
      >
        {/* ── Hero ─────────────────────────────────────────────────────────────── */}
        <FlightShareHero
          originLabel={model.originLabel}
          destinationLabel={model.destinationLabel}
          heroImageUrl={model.heroImageUrl}
          arrivalImageUrl={model.arrivalImageUrl}
          fixedHeight={HERO_HEIGHT}
        />

        {/* ── Stats row ────────────────────────────────────────────────────────── */}
        <FlightShareSummary model={model} imageMode />

        {/* ── Body ──────────────────────────────────────────────────────────────── */}
        <div style={{ padding: "28px 52px 40px 52px", display: "flex", flexDirection: "column", gap: 24 }}>

          {!model.hasResults ? (
            /* Empty state */
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              gap: 12,
            }}>
              <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={40} color={FAINT} strokeWidth={1.5} />
              <p style={{ fontSize: 16, fontWeight: 600, color: DARK_TEAL, textAlign: "center" }}>
                No flight options were returned
              </p>
              <p style={{ fontSize: 13, color: MUTED, textAlign: "center", maxWidth: 320 }}>
                Try adjusting your search dates or departure location.
              </p>
            </div>
          ) : isRoundTrip ? (
            model.sections.map((section) => (
              <div key={section.sectionType}>
                <SectionHeader section={section} />
                <SectionGroups section={section} />
              </div>
            ))
          ) : (
            <SectionGroups section={model.sections[0]} />
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div style={{
          margin: "0 52px 40px 52px",
          borderRadius: 16,
          border: "1px solid #E8EBEB",
          background: "#FFFFFF",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 4px 0 rgba(53,92,90,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HugeiconsIcon
              icon={InformationCircleIcon}
              size={15}
              color={FAINT}
              strokeWidth={1.8}
            />
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>
              Fares and availability may change.
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>
              Shared from
            </span>
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              color: EMERALD,
              letterSpacing: "0.02em",
            }}>
              Wildfly
            </span>
          </div>
        </div>
      </div>
    );
  },
);

FlightShareTemplate.displayName = "FlightShareTemplate";
