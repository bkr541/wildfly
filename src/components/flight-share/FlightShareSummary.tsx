import React from "react";
import type { FlightShareModel } from "@/utils/flightShareModel";

// Design tokens matching FlightShareTemplate
const DARK_TEAL = "#1A2E2E";
const MUTED     = "#6B7B7B";
const EMERALD   = "#059669";

interface FlightShareSummaryProps {
  model: FlightShareModel;
  /**
   * When true, uses the exact pixel values from FlightShareTemplate for
   * deterministic image export. When false (default), uses responsive
   * sizing suitable for browser rendering.
   */
  imageMode?: boolean;
}

function StatItem({
  label,
  value,
  imageMode,
}: {
  label: string;
  value: string | number;
  imageMode: boolean;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
    >
      <span
        style={{
          fontSize: imageMode ? 10 : 10,
          fontWeight: 600,
          color: MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: imageMode ? 15 : 15,
          fontWeight: 700,
          color: DARK_TEAL,
          lineHeight: 1.1,
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider({ imageMode }: { imageMode: boolean }) {
  return (
    <div
      style={{
        width: 1,
        height: imageMode ? 28 : 24,
        background: "#E8EBEB",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Horizontal stats strip: DATE · TRIP · OPTIONS (highlighted) · NONSTOP · GOWILD.
 *
 * Shared between FlightShareTemplate (imageMode=true) and PublicFlightShareView
 * (imageMode=false, default).
 */
export function FlightShareSummary({ model, imageMode = false }: FlightShareSummaryProps) {
  const dateLabel = model.sections[0]?.formattedDateLabel ?? "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: imageMode ? "14px 52px" : "12px 20px",
        background: "#FFFFFF",
        borderBottom: "1px solid #F0F1F1",
        flexWrap: imageMode ? "nowrap" : "wrap",
        gap: imageMode ? 0 : 8,
      }}
    >
      <StatItem label="DATE" value={dateLabel} imageMode={imageMode} />
      <Divider imageMode={imageMode} />
      <StatItem label="TRIP" value={model.tripTypeLabel} imageMode={imageMode} />
      <Divider imageMode={imageMode} />

      {/* Highlighted OPTIONS badge */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          background: EMERALD,
          borderRadius: 12,
          padding: imageMode ? "7px 20px" : "6px 16px",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          OPTIONS
        </span>
        <span
          style={{
            fontSize: imageMode ? 22 : 20,
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {model.totalOptionCount}
        </span>
      </div>

      <Divider imageMode={imageMode} />
      <StatItem label="NONSTOP" value={model.totalNonstopCount} imageMode={imageMode} />
      <Divider imageMode={imageMode} />
      <StatItem label="GOWILD" value={model.totalGoWildCount} imageMode={imageMode} />
    </div>
  );
}

FlightShareSummary.displayName = "FlightShareSummary";
