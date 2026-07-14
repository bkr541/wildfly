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
}: {
  label: string;
  value: string | number;
  imageMode: boolean;
}) {
  return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span
        style={{
          color: MUTED,
          fontSize: imageMode ? 10 : 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          lineHeight: 1,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: DARK_TEAL,
          fontSize: imageMode ? 15 : 12,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 800,
          lineHeight: 1.15,
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
        padding: imageMode ? "14px 52px" : "9px 12px",
      }}
    >
      <StatItem label="Date" value={model.combinedDateLabel} imageMode={imageMode} />
      <Divider imageMode={imageMode} />
      <div
        style={{
          alignItems: "center",
          background: EMERALD,
          borderRadius: imageMode ? 12 : 10,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: imageMode ? "7px 18px" : "5px 10px",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: imageMode ? 10 : 9, fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1, textTransform: "uppercase" }}>
          Destinations
        </span>
        <span style={{ color: "#FFFFFF", fontSize: imageMode ? 22 : 16, fontWeight: 900, lineHeight: 1.05 }}>
          {model.totals.destinationCount}
        </span>
      </div>
      <Divider imageMode={imageMode} />
      <StatItem label="Flights" value={model.totals.flightCount} imageMode={imageMode} />
      <Divider imageMode={imageMode} />
      <StatItem label="Nonstop cities" value={model.totals.nonstopDestinationCount} imageMode={imageMode} />
      <Divider imageMode={imageMode} />
      <StatItem label="GoWild cities" value={model.totals.goWildDestinationCount} imageMode={imageMode} />
    </div>
  );
}

MultiDestShareSummary.displayName = "MultiDestShareSummary";
