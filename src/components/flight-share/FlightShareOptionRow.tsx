import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneSeatIcon, Rocket01Icon } from "@hugeicons/core-free-icons";
import type { FlightShareOption } from "@/utils/flightShareModel";

// ── Constants ────────────────────────────────────────────────────────────────

const DARK_TEAL = "#1A2E2E";
const EMERALD = "#059669";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const PAGE_BG = "#F7F9F8";
const FRONTIER_FULL_LOGO = "/assets/logo/frontier/frontier_full_logo.png";

// Horizontal padding inside the boarding-pass card (must match notch math)
const CARD_PX = 18;
const NOTCH_SIZE = 26;

// ── Helpers ───────────────────────────────────────────────────────────────────

function PlaneSVG() {
  return (
    <svg
      fill="#2D6A4F"
      style={{ width: 22, height: 22, flexShrink: 0 }}
      viewBox="-3.2 -3.2 38.40 38.40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M30.8,14.2C30.1,13.4,29,13,28,13H8.5L4.8,8.4C4.6,8.1,4.3,8,4,8H1C0.7,8,0.4,8.1,0.2,8.4C0,8.6,0,9,0,9.3l3,11C3.2,20.7,3.6,21,4,21h6.4l-3.3,6.6c-0.2,0.3-0.1,0.7,0,1C7.3,28.8,7.7,29,8,29h4c0.3,0,0.6-0.1,0.7-0.3l6.9-7.7H28c1.1,0,2.1-0.4,2.8-1.2c0.8-0.8,1.2-1.8,1.2-2.8S31.6,14.9,30.8,14.2z" />
      <path d="M10.4,11h8.5l-5.1-5.7C13.6,5.1,13.3,5,13,5H9C8.7,5,8.3,5.2,8.1,5.5C8,5.8,8,6.1,8.1,6.4L10.4,11z" />
    </svg>
  );
}

interface Props {
  option: FlightShareOption;
  isFirst: boolean;
  isLast: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FlightShareOptionRow({ option, isFirst, isLast }: Props) {
  const {
    timeOfDay,
    departureTimeLabel,
    arrivalTimeLabel,
    isPlusOneDay,
    routeAirports,
    stopCount,
    isNonstop,
    isGoWild,
    goWildSeats,
    flightNumbers,
    formattedDuration,
    emphasizedFare,
  } = option;

  const originCode = routeAirports[0] ?? "";
  const destCode = routeAirports[routeAirports.length - 1] ?? "";
  const stopLabel = isNonstop ? "NONSTOP" : stopCount === 1 ? "1 STOP" : `${stopCount} STOPS`;
  const seatsText = goWildSeats != null
    ? `${goWildSeats} ${goWildSeats === 1 ? "seat" : "seats"}`
    : null;
  const flightNumText = flightNumbers.length > 0 ? flightNumbers.join(" + ") : null;
  const fareText = emphasizedFare != null ? `$${emphasizedFare.toFixed(2)}` : "—";

  return (
    <div style={{ display: "flex", alignItems: "stretch", marginBottom: isLast ? 0 : 14 }}>

      {/* ── Left column: time-of-day + departure time ───────────────────────── */}
      <div style={{
        width: 130,
        flexShrink: 0,
        paddingTop: 18,
        paddingRight: 10,
        paddingBottom: 18,
        boxSizing: "border-box",
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: FAINT,
          marginBottom: 4,
          lineHeight: 1,
        }}>
          {timeOfDay}
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: DARK_TEAL,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}>
          {departureTimeLabel}
        </div>
      </div>

      {/* ── Timeline: dot + connecting line ─────────────────────────────────── */}
      <div style={{
        width: 24,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        <div style={{
          marginTop: 18,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: isGoWild ? EMERALD : "#10B981",
          border: "2.5px solid white",
          outline: `2px solid ${isGoWild ? EMERALD : "#10B981"}`,
          flexShrink: 0,
          zIndex: 1,
          boxSizing: "border-box",
        }} />
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: "#D1FAE5", marginTop: 4 }} />
        )}
      </div>

      {/* ── Boarding-pass card ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        marginLeft: 12,
        marginTop: 8,
        marginBottom: 8,
        position: "relative",
        overflow: "hidden",
        background: "#FFFFFF",
        border: isGoWild ? "1.5px solid #A7F3D0" : "1px solid #E8EBEB",
        borderRadius: 18,
        padding: `14px ${CARD_PX}px 18px ${CARD_PX}px`,
        boxSizing: "border-box",
        boxShadow: "0 2px 10px 0 rgba(52,92,90,0.10)",
      }}>

        {/* Header: Frontier logo + GoWild badge ────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <img
            src={FRONTIER_FULL_LOGO}
            alt="Frontier Airlines"
            style={{ height: 16, objectFit: "contain", objectPosition: "left center" }}
          />
          {isGoWild && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              background: EMERALD,
              color: "#FFFFFF",
              borderRadius: 6,
              padding: "3px 8px",
              lineHeight: 1.6,
            }}>
              <HugeiconsIcon icon={Rocket01Icon} size={9} color="#FFFFFF" strokeWidth={2.5} />
              GoWild
            </span>
          )}
        </div>

        {/* Route row: IATA ----[✈]---- IATA ───────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <span style={{
            fontSize: 36,
            fontWeight: 900,
            color: DARK_TEAL,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            flexShrink: 0,
          }}>
            {originCode}
          </span>
          <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 10px" }}>
            <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #B8CECE" }} />
            <div style={{ margin: "0 8px", flexShrink: 0 }}>
              <PlaneSVG />
            </div>
            <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #B8CECE" }} />
          </div>
          <span style={{
            fontSize: 36,
            fontWeight: 900,
            color: DARK_TEAL,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            flexShrink: 0,
          }}>
            {destCode}
          </span>
        </div>

        {/* Times row ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontSize: 15,
            fontWeight: 600,
            color: EMERALD,
            lineHeight: 1.2,
            fontVariantNumeric: "tabular-nums",
          }}>
            {departureTimeLabel}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#065F46",
            background: "#D1FAE5",
            borderRadius: 20,
            padding: "3px 12px",
            lineHeight: 1.5,
            whiteSpace: "nowrap",
          }}>
            {formattedDuration}
          </span>
          <div style={{ textAlign: "right" }}>
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              color: EMERALD,
              lineHeight: 1.2,
              fontVariantNumeric: "tabular-nums",
            }}>
              {arrivalTimeLabel}
            </span>
            {isPlusOneDay && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#3B82F6",
                marginLeft: 3,
                verticalAlign: "super",
                lineHeight: 1,
              }}>
                +1
              </span>
            )}
          </div>
        </div>

        {/* Ticket divider ────────────────────────────────────────────────────── */}
        <div style={{
          position: "relative",
          height: 0,
          marginTop: 14,
          marginBottom: 14,
          marginLeft: -CARD_PX,
          marginRight: -CARD_PX,
        }}>
          <div style={{
            position: "absolute",
            top: 0,
            left: CARD_PX,
            right: CARD_PX,
            height: 0,
            borderTop: "1px dashed #C2CFCF",
          }} />
          <div style={{
            position: "absolute",
            width: NOTCH_SIZE,
            height: NOTCH_SIZE,
            left: -NOTCH_SIZE / 2,
            top: -NOTCH_SIZE / 2,
            borderRadius: "50%",
            background: PAGE_BG,
          }} />
          <div style={{
            position: "absolute",
            width: NOTCH_SIZE,
            height: NOTCH_SIZE,
            right: -NOTCH_SIZE / 2,
            top: -NOTCH_SIZE / 2,
            borderRadius: "50%",
            background: PAGE_BG,
          }} />
        </div>

        {/* Footer: stop/seats badges + fare ──────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "3px 8px",
              borderRadius: 6,
              background: isNonstop ? "#D1FAE5" : "#F1F5F5",
              color: isNonstop ? "#047857" : MUTED,
              lineHeight: 1.5,
              whiteSpace: "nowrap",
            }}>
              {stopLabel}
            </span>
            {flightNumText && (
              <span style={{ fontSize: 10, fontWeight: 600, color: FAINT, lineHeight: 1 }}>
                {flightNumText}
              </span>
            )}
            {seatsText && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10,
                fontWeight: 600,
                color: FAINT,
                lineHeight: 1,
              }}>
                <HugeiconsIcon icon={AirplaneSeatIcon} size={10} color={FAINT} strokeWidth={2} />
                {seatsText}
              </span>
            )}
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontSize: 9,
              color: FAINT,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              lineHeight: 1,
              marginBottom: 2,
            }}>
              From
            </div>
            <div style={{
              fontSize: 19,
              fontWeight: 800,
              color: isGoWild ? "#047857" : DARK_TEAL,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}>
              {fareText}
            </div>
          </div>
        </div>

        {/* Green bottom border ─────────────────────────────────────────────── */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: EMERALD,
        }} />
      </div>
    </div>
  );
}

FlightShareOptionRow.displayName = "FlightShareOptionRow";
