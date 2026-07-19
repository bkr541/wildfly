import React from "react";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";

const DARK_TEAL = "#1A2E2E";
const MUTED = "#6B7B7B";
const EMERALD = "#059669";

export interface MultiDestShareSummaryProps {
  model: MultiDestShareModelV2;
  imageMode?: boolean;
}

function StatItem({
  label,
  value,
  imageMode,
  publicMode = false,
}: {
  label: string;
  value: string | number;
  imageMode: boolean;
  publicMode?: boolean;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        justifyContent: "center",
        minWidth: 0,
        width: "100%",
      }}
    >
      <span
        style={{
          color: MUTED,
          fontSize: imageMode ? 10 : publicMode ? 10 : 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          lineHeight: publicMode ? 1.15 : 1,
          maxWidth: "100%",
          overflowWrap: "anywhere",
          textAlign: "center",
          textTransform: "uppercase",
          whiteSpace: publicMode ? "normal" : "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: DARK_TEAL,
          fontSize: imageMode ? 15 : publicMode ? 24 : 12,
          fontVariantNumeric: "tabular-nums",
          fontWeight: publicMode ? 500 : 800,
          lineHeight: 1.15,
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
  );
}

function Divider({ imageMode }: { imageMode: boolean }) {
  return <div aria-hidden="true" style={{ background: "#E8EBEB", height: imageMode ? 28 : 22, width: 1 }} />;
}

/** Summary strip shared by the fixed export and responsive public view. */
export function MultiDestShareSummary({
  model,
  imageMode = false,
}: MultiDestShareSummaryProps) {
  if (!imageMode) {
    return (
      <div
        data-multi-dest-summary="true"
        style={{
          alignItems: "stretch",
          background: "#FFFFFF",
          borderBottom: "1px solid #F0F1F1",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          padding: "11px 8px 12px",
          width: "100%",
        }}
      >
        <StatItem label="Destinations" value={model.totals.destinationCount} imageMode={false} publicMode />
        <StatItem label="Total Flights" value={model.totals.flightCount} imageMode={false} publicMode />
        <StatItem label="Nonstop" value={model.totals.nonstopDestinationCount} imageMode={false} publicMode />
        <StatItem label="Go Wild" value={model.totals.goWildDestinationCount} imageMode={false} publicMode />
      </div>
    );
  }

  return (
    <div
      data-multi-dest-summary="true"
      style={{
        alignItems: "center",
        background: "#FFFFFF",
        borderBottom: "1px solid #F0F1F1",
        display: "flex",
        gap: 0,
        justifyContent: "space-between",
        padding: "14px 52px",
      }}
    >
      <StatItem label="Date" value={model.combinedDateLabel} imageMode />
      <Divider imageMode />
      <div
        style={{
          alignItems: "center",
          background: EMERALD,
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "7px 18px",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1, textTransform: "uppercase" }}>
          Destinations
        </span>
        <span style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 900, lineHeight: 1.05 }}>
          {model.totals.destinationCount}
        </span>
      </div>
      <Divider imageMode />
      <StatItem label="Flights" value={model.totals.flightCount} imageMode />
      <Divider imageMode />
      <StatItem label="Nonstop cities" value={model.totals.nonstopDestinationCount} imageMode />
      <Divider imageMode />
      <StatItem label="GoWild cities" value={model.totals.goWildDestinationCount} imageMode />
    </div>
  );
}

MultiDestShareSummary.displayName = "MultiDestShareSummary";
