import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneSeatIcon, Rocket01Icon } from "@hugeicons/core-free-icons";
import type { FlightShareOption } from "@/utils/flightShareModel";

interface FlightShareOptionRowProps {
  option: FlightShareOption;
  isFirst: boolean;
  isLast: boolean;
}

// Inline-SVG arrow used in the route so it always renders in the capture.
function ArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: "inline", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M2 6h8M7 3l3 3-3 3" stroke="#6B7B7B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FlightShareOptionRow({ option, isFirst, isLast }: FlightShareOptionRowProps) {
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

  const stopLabel = isNonstop ? "NONSTOP" : stopCount === 1 ? "1 STOP" : `${stopCount} STOPS`;
  const seatsText = goWildSeats != null
    ? `${goWildSeats} ${goWildSeats === 1 ? "seat" : "seats"}`
    : null;
  const flightNumText = flightNumbers.length > 0 ? flightNumbers.join(" + ") : null;
  const fareText = emphasizedFare != null ? `$${emphasizedFare.toFixed(2)}` : "—";

  return (
    // stretch so the timeline line can fill the full row height
    <div style={{ display: "flex", alignItems: "stretch", marginBottom: isLast ? 0 : 8 }}>

      {/* ── Left column: time-of-day label + departure time ──────────────────── */}
      <div style={{
        width: 110,
        flexShrink: 0,
        paddingTop: 16,
        paddingRight: 8,
        paddingBottom: 16,
        boxSizing: "border-box",
      }}>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "#9AADAD",
          marginBottom: 3,
          lineHeight: 1,
        }}>
          {timeOfDay}
        </div>
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#1A2E2E",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}>
          {departureTimeLabel}
        </div>
      </div>

      {/* ── Timeline column: dot + connecting line ────────────────────────────── */}
      <div style={{
        width: 22,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {/* dot — offset from top to align with departure time */}
        <div style={{
          marginTop: 16,
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: isGoWild ? "#059669" : "#10B981",
          border: "2px solid white",
          outline: "2px solid " + (isGoWild ? "#059669" : "#10B981"),
          flexShrink: 0,
          zIndex: 1,
          boxSizing: "border-box",
        }} />
        {/* connecting line to next row */}
        {!isLast && (
          <div style={{
            width: 2,
            flex: 1,
            background: "#D1FAE5",
            marginTop: 4,
          }} />
        )}
      </div>

      {/* ── Flight card ───────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        marginLeft: 10,
        marginTop: 8,
        marginBottom: 8,
        background: "#FFFFFF",
        border: isGoWild ? "1px solid #A7F3D0" : "1px solid #E8EBEB",
        borderRadius: 12,
        padding: "10px 14px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>

        {/* 1. Airline tile */}
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          flexShrink: 0,
          background: isGoWild ? "#D1FAE5" : "#F0FAF6",
          border: "1px solid " + (isGoWild ? "#A7F3D0" : "#D1FAE5"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: isGoWild ? "#047857" : "#059669",
            letterSpacing: "0.04em",
          }}>
            F9
          </span>
        </div>

        {/* 2. Route + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* airport sequence */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
            marginBottom: 5,
          }}>
            {routeAirports.map((code, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1 5h8M6.5 2l2.5 3-2.5 3" stroke="#9AADAD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A2E2E",
                  lineHeight: 1,
                }}>
                  {code}
                </span>
              </React.Fragment>
            ))}
          </div>
          {/* badges */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "2px 7px",
              borderRadius: 4,
              background: isNonstop ? "#D1FAE5" : "#F1F5F5",
              color: isNonstop ? "#047857" : "#6B7B7B",
              lineHeight: 1.6,
              whiteSpace: "nowrap",
            }}>
              {stopLabel}
            </span>
            {isGoWild && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "2px 7px",
                borderRadius: 4,
                background: "#059669",
                color: "#FFFFFF",
                lineHeight: 1.6,
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}>
                <HugeiconsIcon icon={Rocket01Icon} size={9} color="#FFFFFF" strokeWidth={2.5} />
                GoWild
              </span>
            )}
          </div>
        </div>

        {/* 3. Arrival + duration + flight number */}
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 88 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 3 }}>
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#1A2E2E",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.2,
            }}>
              {arrivalTimeLabel}
            </span>
            {isPlusOneDay && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#3B82F6",
                lineHeight: 1,
              }}>
                +1
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: "#9AADAD", marginTop: 3, lineHeight: 1.3 }}>
            {formattedDuration}
          </div>
          {flightNumText && (
            <div style={{
              fontSize: 10,
              color: "#9AADAD",
              marginTop: 2,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 90,
              marginLeft: "auto",
            }}>
              {flightNumText}
            </div>
          )}
        </div>

        {/* vertical separator */}
        <div style={{ width: 1, alignSelf: "stretch", background: "#E8EBEB", marginLeft: 4, marginRight: 4, flexShrink: 0 }} />

        {/* 4. Fare block */}
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 78 }}>
          <div style={{
            fontSize: 9,
            color: "#9AADAD",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            lineHeight: 1,
            marginBottom: 3,
          }}>
            From
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: 800,
            color: isGoWild ? "#047857" : "#1A2E2E",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}>
            {fareText}
          </div>
          {seatsText && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 3,
              marginTop: 4,
            }}>
              <HugeiconsIcon icon={AirplaneSeatIcon} size={10} color="#9AADAD" strokeWidth={2} />
              <span style={{ fontSize: 10, color: "#9AADAD", lineHeight: 1 }}>{seatsText}</span>
            </div>
          )}
        </div>

        {/* 5. GoWild indicator block (GoWild rows only) */}
        {isGoWild && (
          <div style={{
            flexShrink: 0,
            marginLeft: 6,
            width: 42,
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#059669",
            borderRadius: 8,
            gap: 3,
          }}>
            <HugeiconsIcon icon={Rocket01Icon} size={14} color="#FFFFFF" strokeWidth={2} />
            <span style={{
              fontSize: 7,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#FFFFFF",
              lineHeight: 1,
            }}>
              GoWild
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

FlightShareOptionRow.displayName = "FlightShareOptionRow";
