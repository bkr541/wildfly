import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight04Icon } from "@hugeicons/core-free-icons";

// Shared constants (kept in sync with FlightShareTemplate)
const NAVY = "#0F2040";

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

        {/* Center arrow circle */}
        <div
          style={{
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
          }}
        >
          <HugeiconsIcon icon={ArrowRight04Icon} size={20} color="#FFFFFF" strokeWidth={2.5} />
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
      </div>
    </div>
  );
}

FlightShareHero.displayName = "FlightShareHero";
