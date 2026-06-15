import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Rocket01Icon, ArrowRight04Icon, CircleArrowReload01Icon } from "@hugeicons/core-free-icons";
import type { FlightShareOption } from "@/utils/flightShareModel";

// ── Constants ────────────────────────────────────────────────────────────────

const DARK_TEAL = "#1A2E2E";
const EMERALD = "#059669";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const FRONTIER_FULL_LOGO = "/assets/logo/frontier/frontier_full_logo.png";

const NOTCH_SIZE = 26;
const NOTCH_BG = "#F7F9F8";
const STUB_WIDTH_IMAGE = 152;
const STUB_WIDTH_PAGE  = 120;

export type FlightShareRenderMode = "image" | "page";

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

function daysUntilDeparture(depRaw: string): number | null {
  if (!depRaw) return null;
  const d = new Date(depRaw);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

function formatDateFromRaw(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  option: FlightShareOption;
  isFirst: boolean;
  isLast: boolean;
  sectionLabel?: string;
  mode?: FlightShareRenderMode;
}

// ── Boarding-pass card (shared inner component) ───────────────────────────────

interface BoardingPassCardProps {
  option: FlightShareOption;
  sectionLabel?: string;
  stubWidth: number;
  cardPx: number;
}

function BoardingPassCard({ option, sectionLabel, stubWidth, cardPx }: BoardingPassCardProps) {
  const {
    departureTimeLabel,
    arrivalTimeLabel,
    isPlusOneDay,
    routeAirports,
    stopCount,
    isNonstop,
    isGoWild,
    goWildSeats,
    formattedDuration,
    emphasizedFare,
    flightNumbers,
    departureRaw,
    arrivalRaw,
  } = option;

  const originCode = routeAirports[0] ?? "";
  const destCode = routeAirports[routeAirports.length - 1] ?? "";
  const stopLabel = isNonstop ? "NONSTOP" : stopCount === 1 ? "1 STOP" : `${stopCount} STOPS`;
  const fareText = emphasizedFare != null ? `$${emphasizedFare.toFixed(2)}` : "—";
  const depDateLabel = formatDateFromRaw(departureRaw);
  const arrDateLabel = formatDateFromRaw(arrivalRaw);
  const daysUntil = daysUntilDeparture(departureRaw);

  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "#FFFFFF",
        border: isGoWild ? "1.5px solid #A7F3D0" : "1px solid #E8EBEB",
        borderRadius: 18,
        boxSizing: "border-box",
        boxShadow: "0 2px 10px 0 rgba(52,92,90,0.10)",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* ── Main section ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          padding: `14px ${cardPx}px 20px ${cardPx}px`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Frontier logo */}
        <div style={{ marginBottom: 12 }}>
          <img
            src={FRONTIER_FULL_LOGO}
            alt="Frontier Airlines"
            style={{ height: 16, objectFit: "contain", objectPosition: "left center" }}
          />
        </div>

        {/* Route: IATA ----[✈ or via]---- IATA */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: DARK_TEAL,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            {originCode}
          </span>
          <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 10px", minWidth: 0 }}>
            {isNonstop ? (
              <>
                <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #B8CECE" }} />
                <div style={{ margin: "0 8px", flexShrink: 0 }}>
                  <PlaneSVG />
                </div>
                <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #B8CECE" }} />
              </>
            ) : (
              <>
                <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #B8CECE" }} />
                {routeAirports.slice(1, -1).map((via) => (
                  <React.Fragment key={via}>
                    <span
                      style={{
                        margin: "0 7px",
                        fontSize: 18,
                        fontWeight: 500,
                        color: MUTED,
                        letterSpacing: "-0.01em",
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      {via}
                    </span>
                    <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #B8CECE" }} />
                  </React.Fragment>
                ))}
              </>
            )}
          </div>
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: DARK_TEAL,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            {destCode}
          </span>
        </div>

        {/* Times + dates row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: EMERALD,
                lineHeight: 1.2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {departureTimeLabel}
            </div>
            {depDateLabel && (
              <div style={{ fontSize: 11, fontWeight: 500, color: MUTED, lineHeight: 1.3, marginTop: 2 }}>
                {depDateLabel}
              </div>
            )}
          </div>

          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#065F46",
              background: "#D1FAE5",
              borderRadius: 20,
              padding: "3px 12px",
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              alignSelf: "center",
              flexShrink: 0,
            }}
          >
            {formattedDuration}
          </span>

          <div style={{ textAlign: "right" }}>
            <div>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: EMERALD,
                  lineHeight: 1.2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {arrivalTimeLabel}
              </span>
              {isPlusOneDay && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#3B82F6",
                    marginLeft: 3,
                    verticalAlign: "super",
                    lineHeight: 1,
                  }}
                >
                  +1
                </span>
              )}
            </div>
            {arrDateLabel && (
              <div style={{ fontSize: 11, fontWeight: 500, color: MUTED, lineHeight: 1.3, marginTop: 2 }}>
                {arrDateLabel}
              </div>
            )}
          </div>
        </div>

        {/* Bottom badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Stop badge */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 24,
              padding: "0 10px",
              borderRadius: 9999,
              background: isNonstop ? "#D1FAE5" : "#F1F5F5",
              color: isNonstop ? "#047857" : MUTED,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {stopLabel}
          </span>

          {/* Departs in Xd */}
          {daysUntil !== null && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 24,
                padding: "0 10px",
                borderRadius: 9999,
                background: "#F0FDF4",
                border: "1.5px solid #6EE7B7",
                color: "#047857",
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Departs in {daysUntil}d
            </span>
          )}

          {/* Trip type badge */}
          {sectionLabel && (() => {
            const isOneWay = sectionLabel === "One-Way";
            const icon = isOneWay ? ArrowRight04Icon : CircleArrowReload01Icon;
            const label = isOneWay ? "One Way" : sectionLabel;
            return (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                  padding: "0 10px",
                  borderRadius: 9999,
                  background: "#1D4ED8",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                <HugeiconsIcon icon={icon} size={11} color="#FFFFFF" strokeWidth={2.5} />
                {label}
              </span>
            );
          })()}

          {/* Flight numbers (page mode shows here; image shows in stub) */}
          {flightNumbers.length > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 24,
                padding: "0 10px",
                borderRadius: 9999,
                background: "#F1F5F5",
                color: MUTED,
                fontSize: 10,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {flightNumbers.join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* ── Vertical tear divider with notches ──────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: NOTCH_SIZE,
          flexShrink: 0,
          alignSelf: "stretch",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: NOTCH_SIZE / 2,
            width: 0,
            borderLeft: "1px dashed #C2CFCF",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: NOTCH_SIZE,
            height: NOTCH_SIZE,
            top: -NOTCH_SIZE / 2,
            left: 0,
            borderRadius: "50%",
            background: NOTCH_BG,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: NOTCH_SIZE,
            height: NOTCH_SIZE,
            bottom: -NOTCH_SIZE / 2,
            left: 0,
            borderRadius: "50%",
            background: NOTCH_BG,
          }}
        />
      </div>

      {/* ── Right stub: GoWild header + fare + seats ─────────────────────────── */}
      <div
        style={{
          width: stubWidth,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {/* GoWild header bar */}
        {isGoWild ? (
          <div
            style={{
              width: "100%",
              background: EMERALD,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "10px 0 9px 0",
            }}
          >
            <HugeiconsIcon icon={Rocket01Icon} size={12} color="#FFFFFF" strokeWidth={2.5} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.04em" }}>
              GoWild
            </span>
          </div>
        ) : (
          <div style={{ height: 14 }} />
        )}

        {/* Price */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 10px 10px 10px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: FAINT,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            From
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: isGoWild ? "#047857" : DARK_TEAL,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            {fareText}
          </div>
        </div>

        {/* Seats (GoWild only) — rendered so "20 seats" / "1 seat" is accessible */}
        {goWildSeats != null && (
          <>
            <div
              style={{
                width: "72%",
                height: 0,
                borderTop: "1px dashed #C2CFCF",
                marginBottom: 10,
              }}
            />
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingBottom: 22,
              }}
            >
              {/*
               * The outer div's textContent becomes "{n} {seat|seats}" because of the
               * literal space text node, making screen readers and RTL getByText work.
               */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    color: EMERALD,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {goWildSeats}
                </div>
                {" "}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: MUTED,
                    marginTop: 3,
                  }}
                >
                  {goWildSeats === 1 ? "seat" : "seats"}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FlightShareOptionRow({
  option,
  isFirst,
  isLast,
  sectionLabel,
  mode = "image",
}: Props) {
  const { timeOfDay, departureTimeLabel, isGoWild } = option;

  // Page mode: card fills full width, no left column or timeline
  if (mode === "page") {
    return (
      <div style={{ marginBottom: isLast ? 0 : 10 }}>
        <BoardingPassCard
          option={option}
          sectionLabel={sectionLabel}
          stubWidth={STUB_WIDTH_PAGE}
          cardPx={16}
        />
      </div>
    );
  }

  // Image mode: left column + timeline dot/line + card (original layout)
  return (
    <div style={{ display: "flex", alignItems: "stretch", marginBottom: isLast ? 0 : 14 }}>
      {/* ── Left column: time-of-day + departure time ──────────────────────── */}
      <div
        style={{
          width: 130,
          flexShrink: 0,
          paddingTop: 18,
          paddingRight: 10,
          paddingBottom: 18,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: FAINT,
            marginBottom: 4,
            lineHeight: 1,
          }}
        >
          {timeOfDay}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: DARK_TEAL,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
          }}
        >
          {departureTimeLabel}
        </div>
      </div>

      {/* ── Timeline: dot + connecting line ─────────────────────────────────── */}
      <div
        style={{
          width: 24,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
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
          }}
        />
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: "#D1FAE5", marginTop: 4 }} />
        )}
      </div>

      {/* ── Boarding-pass card ───────────────────────────────────────────────── */}
      <BoardingPassCard
        option={option}
        sectionLabel={sectionLabel}
        stubWidth={STUB_WIDTH_IMAGE}
        cardPx={20}
      />
    </div>
  );
}

FlightShareOptionRow.displayName = "FlightShareOptionRow";
