import React, { forwardRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { FlightShareModel, FlightShareSection } from "@/utils/flightShareModel";
import { FlightShareAirportGroup } from "./FlightShareAirportGroup";
import { FlightShareOptionRow } from "./FlightShareOptionRow";

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT_WIDTH = 941;
const HERO_HEIGHT = 253;
const FONT_FAMILY =
  "Quicksand, Montserrat, ui-sans-serif, system-ui, -apple-system, sans-serif";
const PAGE_BG = "#F7F9F8";
const NAVY = "#0F2040";
const DARK_TEAL = "#1A2E2E";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const EMERALD = "#059669";

// ── Sub-components ────────────────────────────────────────────────────────────

/** Stats strip below the hero: date, trip type, options (highlighted), nonstop, gowild. */
function StatsRow({ model }: { model: FlightShareModel }) {
  const dateLabel = model.sections[0]?.formattedDateLabel ?? "";

  const statItem = (label: string, value: string | number) => (
    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        color: MUTED,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        lineHeight: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 15,
        fontWeight: 700,
        color: DARK_TEAL,
        lineHeight: 1.1,
        textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </span>
    </div>
  );

  const divider = (key: string) => (
    <div key={key} style={{ width: 1, height: 28, background: "#E8EBEB", flexShrink: 0 }} />
  );

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 52px",
      background: "#FFFFFF",
      borderBottom: "1px solid #F0F1F1",
    }}>
      {statItem("DATE", dateLabel)}
      {divider("d1")}
      {statItem("TRIP", model.tripTypeLabel)}
      {divider("d2")}

      {/* Highlighted OPTIONS badge */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        background: EMERALD,
        borderRadius: 12,
        padding: "7px 20px",
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          lineHeight: 1,
        }}>
          OPTIONS
        </span>
        <span style={{
          fontSize: 22,
          fontWeight: 900,
          color: "#FFFFFF",
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}>
          {model.totalOptionCount}
        </span>
      </div>

      {divider("d3")}
      {statItem("NONSTOP", model.totalNonstopCount)}
      {divider("d4")}
      {statItem("GOWILD", model.totalGoWildCount)}
    </div>
  );
}

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
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {section.airportGroups.map((group) => (
        <FlightShareAirportGroup key={group.iata} group={group} />
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

    const textShadow = "0 1px 6px rgba(0,0,0,0.90), 0 2px 14px rgba(0,0,0,0.65)";

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

        {/* ── Hero section ────────────────────────────────────────────────────── */}
        <div style={{ position: "relative", height: HERO_HEIGHT, overflow: "hidden", background: "#C8D5D5" }}>

          {/* Departure city image — upper-left triangle */}
          <img
            src={model.heroImageUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
            }}
          />

          {/* Arrival city image — lower-right triangle */}
          <img
            src={model.arrivalImageUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            }}
          />

          {/* Diagonal divider line */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top right, transparent calc(50% - 1px), rgba(255,255,255,0.55) calc(50% - 1px), rgba(255,255,255,0.55) calc(50% + 1px), transparent calc(50% + 1px))",
              pointerEvents: "none",
            }}
          />

          {/* Dark overlay for readability */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(8, 18, 32, 0.42)",
            pointerEvents: "none",
          }} />

          {/* Corner vignettes — darken the text areas */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom right, rgba(0,0,0,0.28) 0%, transparent 45%, rgba(0,0,0,0.28) 100%)",
            pointerEvents: "none",
          }} />

          {/* ── Content layer ─────────────────────────────────────────────────── */}
          <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>

            {/* Logo — top-left */}
            <img
              src="/assets/logo/logo_horizontal.png"
              alt="Wildfly"
              style={{
                position: "absolute",
                top: 20,
                left: 28,
                height: 26,
                objectFit: "contain",
                objectPosition: "left center",
              }}
            />

            {/* Departure city — top-left */}
            <span style={{
              position: "absolute",
              top: 56,
              left: 28,
              fontSize: 44,
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              textShadow,
            }}>
              {model.originLabel}
            </span>

            {/* Arrow — centered */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(10, 22, 40, 0.65)",
              border: "1.5px solid rgba(255,255,255,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Arrival city — bottom-right */}
            <span style={{
              position: "absolute",
              bottom: 20,
              right: 28,
              fontSize: 44,
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              textShadow,
              textAlign: "right",
            }}>
              {model.destinationLabel}
            </span>
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────────── */}
        <StatsRow model={model} />

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
