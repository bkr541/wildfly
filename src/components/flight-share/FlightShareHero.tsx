import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight04Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons";

interface FlightShareHeroProps {
  originLabel:      string;
  destinationLabel: string;
  heroImageUrl:     string;
  arrivalImageUrl:  string;
  /**
   * When provided, the root element is given this exact height in px via
   * an inline style — used by FlightShareTemplate for deterministic
   * image-export dimensions.
   * When omitted, the component fills its parent; callers control height
   * with className or style.
   */
  fixedHeight?: number;
  className?: string;
  /** Additional inline styles merged onto the root element. */
  style?: React.CSSProperties;
  /** When false, hides the Wildfly logo overlay. Defaults to true. */
  showLogo?: boolean;
  /**
   * Keeps the shared diagonal artwork while switching the route typography to
   * the same stacked treatment used by FlightMultiDestResults.
   */
  contentLayout?: "diagonal" | "multi-destination";
  /** Optional compact date shown beneath the multi-destination route title. */
  dateLabel?: string;
  /** Optional controls rendered in the hero's upper-right corner. */
  actions?: React.ReactNode;
  /** Equal-width statistics rendered inside the multi-destination hero. */
  stats?: ReadonlyArray<{ label: string; value: string | number }>;
}

/**
 * Diagonal split hero: origin image (upper-left triangle) and arrival image
 * (lower-right triangle) with city labels, center arrow, and Wildfly logo.
 *
 * Used by FlightShareTemplate (fixed 253px height) and PublicFlightShareView
 * (responsive height via className).
 */
export function FlightShareHero({
  originLabel,
  destinationLabel,
  heroImageUrl,
  arrivalImageUrl,
  fixedHeight,
  className = "",
  style: styleProp,
  showLogo = true,
  contentLayout = "diagonal",
  dateLabel,
  actions,
  stats,
}: FlightShareHeroProps) {
  const textShadow = "0 1px 6px rgba(0,0,0,0.90), 0 2px 14px rgba(0,0,0,0.65)";

  const rootStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    background: "#C8D5D5",
    ...(fixedHeight != null ? { height: fixedHeight } : {}),
    ...styleProp,
  };

  return (
    <div style={rootStyle} className={className}>
      {/* Departure city image — upper-left triangle */}
      <img
        src={heroImageUrl}
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
        src={arrivalImageUrl}
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
          background:
            "linear-gradient(to top right, transparent calc(50% - 1px), rgba(255,255,255,0.55) calc(50% - 1px), rgba(255,255,255,0.55) calc(50% + 1px), transparent calc(50% + 1px))",
          pointerEvents: "none",
        }}
      />

      {/* Dark overlay for readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(8, 18, 32, 0.42)",
          pointerEvents: "none",
        }}
      />

      {/* Corner vignettes */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom right, rgba(0,0,0,0.28) 0%, transparent 45%, rgba(0,0,0,0.28) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content layer */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {/* Logo — top-left (hidden on public share page, shown in image export) */}
        {showLogo && (
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
        )}

        {contentLayout === "multi-destination" ? (
          <div
            data-flight-share-hero-route="multi-destination"
            style={{
              display: "flex",
              flexDirection: "column",
              inset: 0,
              padding: "24px 20px 16px",
              position: "absolute",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                height: 40,
                justifyContent: "flex-end",
                width: "100%",
              }}
            >
              {actions && (
                <div
                  data-flight-share-hero-actions="true"
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  {actions}
                </div>
              )}
            </div>

            <div style={{ marginTop: 0 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  lineHeight: 1.25,
                  textShadow: "0 2px 5px rgba(0,0,0,0.4)",
                }}
              >
                <span
                  style={{
                    color: "#FFFFFF",
                    fontSize: 22,
                    fontWeight: 300,
                    textShadow: "0 2px 8px rgba(0,0,0,0.55)",
                  }}
                >
                  {originLabel} to
                </span>
                <span
                  style={{
                    color: "#FFFFFF",
                    fontSize: 36,
                    fontWeight: 900,
                  }}
                >
                  {destinationLabel}
                </span>
              </div>

              {dateLabel && (
                <div style={{ alignItems: "center", display: "flex", gap: 8, marginTop: 8 }}>
                  <div
                    style={{
                      alignItems: "center",
                      backdropFilter: "blur(4px)",
                      background: "rgba(255,255,255,0.90)",
                      borderRadius: 999,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)",
                      display: "inline-flex",
                      flexShrink: 0,
                      gap: 6,
                      padding: "6px 12px",
                    }}
                  >
                    <HugeiconsIcon icon={Calendar03Icon} size={13} color="#065F46" strokeWidth={1.5} />
                    <span
                      style={{
                        color: "#065F46",
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dateLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {stats && stats.length > 0 && (
              <div
                data-flight-share-hero-stats="true"
                style={{
                  alignItems: "stretch",
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
                  marginTop: 16,
                  width: "100%",
                }}
              >
                {stats.map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      alignItems: "center",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      minWidth: 0,
                      textAlign: "center",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(255,255,255,0.80)",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.025em",
                        lineHeight: 1.25,
                        maxWidth: "100%",
                        overflowWrap: "anywhere",
                        textAlign: "center",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        color: "#FFFFFF",
                        fontSize: 24,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 500,
                        lineHeight: 1.25,
                        marginTop: 2,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textAlign: "center",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Origin city — top-left */}
            <span
              style={{
                position: "absolute",
                top: showLogo ? 56 : 10,
                left: showLogo ? 28 : 14,
                fontSize: 44,
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                textShadow,
              }}
            >
              {originLabel}
            </span>

            {/* Center arrow */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.55))",
              }}
            >
              <HugeiconsIcon icon={ArrowRight04Icon} size={26} color="#FFFFFF" strokeWidth={2.5} />
            </div>

            {/* Destination city — bottom-right */}
            <span
              style={{
                position: "absolute",
                bottom: showLogo ? 20 : 10,
                right: showLogo ? 28 : 14,
                fontSize: 44,
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                textShadow,
                textAlign: "right",
              }}
            >
              {destinationLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

FlightShareHero.displayName = "FlightShareHero";
