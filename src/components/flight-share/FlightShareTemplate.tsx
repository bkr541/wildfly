import React, { forwardRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  Rocket01Icon,
  TicketStarIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { FlightShareModel, FlightShareSection } from "@/utils/flightShareModel";
import { FlightShareAirportGroup } from "./FlightShareAirportGroup";

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT_WIDTH = 941;
const FONT_FAMILY =
  "Quicksand, Montserrat, ui-sans-serif, system-ui, -apple-system, sans-serif";
const PAGE_BG = "#F7F9F8";
const NAVY = "#0F2040";
const DARK_TEAL = "#1A2E2E";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const EMERALD = "#059669";
const EMERALD_LIGHT = "#10B981";

// ── Sub-components ────────────────────────────────────────────────────────────

/** Three summary chips rendered below the hero. */
function SummaryChips({ model }: { model: FlightShareModel }) {
  const chips = [
    {
      icon: TicketStarIcon,
      count: model.totalOptionCount,
      label: model.totalOptionCount === 1 ? "option" : "options",
      color: EMERALD,
      bg: "#F0FAF6",
      border: "#A7F3D0",
    },
    {
      icon: AirplaneTakeOff01Icon,
      count: model.totalNonstopCount,
      label: model.totalNonstopCount === 1 ? "nonstop" : "nonstop",
      color: DARK_TEAL,
      bg: "#FFFFFF",
      border: "#E8EBEB",
    },
    {
      icon: Rocket01Icon,
      count: model.totalGoWildCount,
      label: "Go Wild",
      color: EMERALD,
      bg: "#F0FAF6",
      border: "#A7F3D0",
    },
  ] as const;

  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "18px 32px",
      background: "#FFFFFF",
      borderBottom: "1px solid #F0F1F1",
    }}>
      {chips.map(({ icon, count, label, color, bg, border }) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 18,
            padding: "10px 18px",
            boxShadow: "0 1px 4px 0 rgba(53,92,90,0.07)",
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <HugeiconsIcon icon={icon} size={14} color="#FFFFFF" strokeWidth={2} />
          </div>
          <div>
            <span style={{
              fontSize: 18,
              fontWeight: 900,
              color: DARK_TEAL,
              marginRight: 4,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>
              {count}
            </span>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: MUTED,
              lineHeight: 1,
            }}>
              {label}
            </span>
          </div>
        </div>
      ))}
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
      <div style={{
        height: 1,
        flex: 1,
        background: "#E8EBEB",
      }} />
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

/** Body rendered for a single section's airport groups. */
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
          // Ensure the root is not affected by any parent scroll containers
          contain: "layout",
        }}
      >

        {/* ── Hero section ────────────────────────────────────────────────────── */}
        <div style={{ position: "relative", height: 380, overflow: "hidden", background: "#C8D5D5" }}>

          {/* City/airport hero image */}
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
            }}
          />

          {/* Translucent white scrim for readability */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.28)",
            pointerEvents: "none",
          }} />

          {/* Soft bottom gradient — blends hero into the white chip row */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 160,
            background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 60%, rgba(255,255,255,1) 100%)",
            pointerEvents: "none",
          }} />

          {/* Hero text content */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            padding: "40px 40px 0 40px",
            boxSizing: "border-box",
            zIndex: 1,
          }}>
            {/* Eyebrow */}
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 10,
            }}>
              Shared flight search
            </div>

            {/* Route heading */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "nowrap",
            }}>
              <span style={{
                fontSize: 52,
                fontWeight: 900,
                color: NAVY,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}>
                {model.originLabel}
              </span>
              {/* Inline SVG arrow — always renders in capture */}
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                <path
                  d="M6 18h24M22 10l8 8-8 8"
                  stroke={NAVY}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{
                fontSize: 52,
                fontWeight: 900,
                color: NAVY,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}>
                {model.destinationLabel}
              </span>
            </div>

            {/* Date + trip type */}
            <div style={{
              fontSize: 16,
              fontWeight: 500,
              color: MUTED,
              marginTop: 10,
            }}>
              {model.combinedDateLabel}
            </div>
          </div>
        </div>

        {/* ── Summary chips ────────────────────────────────────────────────────── */}
        <SummaryChips model={model} />

        {/* ── Body ──────────────────────────────────────────────────────────────── */}
        <div style={{ padding: "28px 32px 40px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

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
            /* Round-trip: render each section with its header */
            model.sections.map((section, i) => (
              <div key={section.sectionType}>
                <SectionHeader section={section} />
                <SectionGroups section={section} />
              </div>
            ))
          ) : (
            /* One-way: render groups directly */
            <SectionGroups section={model.sections[0]} />
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div style={{
          margin: "0 32px 32px 32px",
          borderRadius: 16,
          border: "1px solid #E8EBEB",
          background: "#FFFFFF",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 4px 0 rgba(53,92,90,0.05)",
        }}>
          {/* Left: disclaimer */}
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

          {/* Right: branding */}
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
