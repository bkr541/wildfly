import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  Clock01Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import type { MultiDestShareDestination } from "@/utils/multiDestShareModel";

export type MultiDestShareRenderMode = "image" | "page";

const DARK_TEAL = "#1A2E2E";
const NAVY = "#0F2040";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const EMERALD = "#059669";
const BORDER = "#E8EBEB";

export interface MultiDestShareCardProps {
  destination: MultiDestShareDestination;
  mode?: MultiDestShareRenderMode;
}

function formatFare(value: number | null): string {
  return value == null ? "—" : `$${Math.round(value)}`;
}

function formatFareRange(minFare: number | null, maxFare: number | null): string {
  if (minFare == null && maxFare == null) return "—";
  if (minFare == null) return formatFare(maxFare);
  if (maxFare == null || Math.round(minFare) === Math.round(maxFare)) return formatFare(minFare);
  return `${formatFare(minFare)} – ${formatFare(maxFare)}`;
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function buildLocationLabel(destination: MultiDestShareDestination): string {
  const city = destination.city || destination.destination;
  const stateCode = destination.stateCode && destination.stateCode !== "None"
    ? destination.stateCode
    : "";
  if (stateCode) return `${city}, ${stateCode}`;
  if (destination.country && destination.country !== city) return `${city}, ${destination.country}`;
  return city;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0, textAlign: "center" }}>
      <div
        style={{
          color: MUTED,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.075em",
          lineHeight: 1.2,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: DARK_TEAL,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.25,
          marginTop: 3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Static destination snapshot card used by both PNG exports and public shares.
 * It intentionally contains no motion, scrolling, viewport state, navigation,
 * individual flight rows, or live-search payload data.
 */
export function MultiDestShareCard({
  destination,
  mode = "page",
}: MultiDestShareCardProps) {
  const imageUrl = destination.locationId && destination.locationId > 0
    ? `/assets/locations/${destination.locationId}_background.png`
    : null;
  const locationLabel = buildLocationLabel(destination);
  const cardPadding = mode === "image" ? 16 : 14;

  return (
    <article
      data-multi-dest-card={destination.destination}
      style={{
        background: "#FFFFFF",
        border: destination.hasGoWild ? `1.5px solid ${EMERALD}` : `1px solid ${BORDER}`,
        borderRadius: mode === "image" ? 18 : 16,
        boxShadow: "0 4px 16px rgba(53,92,90,0.09)",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#C8D5D5",
          height: mode === "image" ? 132 : 124,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          data-testid={`destination-image-fallback-${destination.destination}`}
          style={{
            alignItems: "center",
            background: "linear-gradient(135deg, #0F4C45 0%, #0B7664 52%, #10B981 100%)",
            display: "flex",
            inset: 0,
            justifyContent: "center",
            position: "absolute",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              color: "rgba(255,255,255,0.18)",
              fontSize: mode === "image" ? 70 : 62,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            {destination.destination}
          </span>
        </div>

        {imageUrl && (
          <img
            src={imageUrl}
            alt={`${locationLabel} destination`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            style={{
              display: "block",
              height: "100%",
              inset: 0,
              objectFit: "cover",
              position: "absolute",
              width: "100%",
            }}
          />
        )}

        <div
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to bottom, rgba(6,20,32,0.18) 0%, rgba(6,20,32,0.18) 32%, rgba(255,255,255,0.82) 76%, #FFFFFF 100%)",
            inset: 0,
            position: "absolute",
          }}
        />

        {destination.hasGoWild && (
          <div
            data-gowild-available="true"
            style={{
              alignItems: "center",
              background: EMERALD,
              borderRadius: 999,
              color: "#FFFFFF",
              display: "inline-flex",
              fontSize: 10,
              fontWeight: 800,
              gap: 4,
              left: 12,
              padding: "5px 9px",
              position: "absolute",
              top: 11,
            }}
          >
            <HugeiconsIcon icon={Rocket01Icon} size={11} color="#FFFFFF" strokeWidth={2.5} />
            GoWild Available
          </div>
        )}

        <div
          data-min-fare-gowild={destination.isMinFareGoWild ? "true" : "false"}
          aria-label={destination.isMinFareGoWild ? "Minimum fare is a GoWild fare" : "Minimum fare"}
          style={{
            background: destination.isMinFareGoWild ? EMERALD : "#111827",
            borderRadius: 999,
            boxShadow: destination.isMinFareGoWild
              ? "0 2px 8px rgba(5,150,105,0.30)"
              : "0 2px 8px rgba(17,24,39,0.25)",
            color: "#FFFFFF",
            display: "inline-flex",
            flexDirection: "column",
            minWidth: 68,
            padding: "6px 10px",
            position: "absolute",
            right: 12,
            textAlign: "center",
            top: 11,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.82, textTransform: "uppercase" }}>
            {destination.isMinFareGoWild ? "GoWild from" : "From"}
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.05 }}>
            {formatFare(destination.minFare)}
          </span>
        </div>

        <div
          style={{
            bottom: 8,
            display: "flex",
            left: 14,
            minWidth: 0,
            position: "absolute",
            right: 14,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ alignItems: "baseline", display: "flex", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  color: destination.isMinFareGoWild ? "#047857" : NAVY,
                  fontSize: mode === "image" ? 35 : 32,
                  fontWeight: 900,
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                }}
              >
                {destination.destination}
              </span>
              <span
                style={{
                  color: NAVY,
                  fontSize: mode === "image" ? 15 : 14,
                  fontWeight: 800,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {locationLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: `${cardPadding - 4}px ${cardPadding}px ${cardPadding}px` }}>
        {destination.airportName && destination.airportName !== destination.city && (
          <p
            style={{
              color: FAINT,
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1.35,
              margin: "0 0 10px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={destination.airportName}
          >
            {destination.airportName}
          </p>
        )}

        <div
          style={{
            alignItems: "stretch",
            background: "#F7F9F8",
            borderRadius: 12,
            display: "grid",
            gap: 6,
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            padding: "9px 8px",
          }}
        >
          <Stat label="Fare range" value={formatFareRange(destination.minFare, destination.maxFare)} />
          <Stat label="Flights" value={destination.flightCount} />
          <Stat label="Earliest" value={destination.earliestDeparture ?? "—"} />
          <Stat label="Quickest" value={formatDuration(destination.minDurationMin)} />
        </div>

        <div
          style={{
            alignItems: "center",
            borderTop: `1px solid ${BORDER}`,
            color: MUTED,
            display: "flex",
            fontSize: 10,
            fontWeight: 700,
            justifyContent: "space-between",
            marginTop: 10,
            paddingTop: 9,
          }}
        >
          <span style={{ alignItems: "center", display: "inline-flex", gap: 5 }}>
            <HugeiconsIcon icon={Clock01Icon} size={12} color={MUTED} strokeWidth={2} />
            Window {destination.departureWindow ?? "—"}
          </span>
          <span style={{ alignItems: "center", color: destination.nonstopCount > 0 ? EMERALD : MUTED, display: "inline-flex", gap: 5 }}>
            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={12} color="currentColor" strokeWidth={2} />
            {destination.nonstopCount} nonstop
          </span>
        </div>
      </div>
    </article>
  );
}

MultiDestShareCard.displayName = "MultiDestShareCard";
