import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";
import {
  MultiDestShareCard,
  type MultiDestShareRenderMode,
} from "./MultiDestShareCard";

const DARK_TEAL = "#1A2E2E";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const EMERALD = "#059669";

export interface MultiDestShareContentProps {
  model: MultiDestShareModelV2;
  mode?: MultiDestShareRenderMode;
  noPadX?: boolean;
}

function getMultiDestAppliedViewLabels(model: MultiDestShareModelV2): string[] {
  const labels: string[] = [];

  if (model.appliedView.nonstopOnly) labels.push("Nonstop Only");
  if (model.appliedView.goWildOnly) labels.push("GoWild Only");
  if (model.appliedView.destinationType === "domestic") labels.push("Domestic Only");
  if (model.appliedView.destinationType === "international") labels.push("International Only");
  return labels;
}

function AppliedView({ model, mode }: { model: MultiDestShareModelV2; mode: MultiDestShareRenderMode }) {
  const labels = getMultiDestAppliedViewLabels(model);
  if (labels.length === 0) return null;

  return (
    <div
      aria-label="Applied view"
      data-applied-view="true"
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: mode === "image" ? 8 : 6,
      }}
    >
      {labels.map((label) => (
        <span
          key={label}
          style={{
            background: label.startsWith("Sorted") ? "#EAF7F2" : "#FFFFFF",
            border: `1px solid ${label.startsWith("Sorted") ? "#B7E4D2" : "#DDE4E4"}`,
            borderRadius: 999,
            color: label.startsWith("Sorted") ? "#047857" : MUTED,
            fontSize: mode === "image" ? 11 : 10,
            fontWeight: 800,
            padding: mode === "image" ? "5px 10px" : "4px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Authoritative destination collection renderer shared by export and public
 * views. Image mode is a deterministic two-column grid; page mode uses only
 * responsive layout classes and never adds destination-level interactions.
 */
export function MultiDestShareContent({
  model,
  mode = "page",
  noPadX = true,
}: MultiDestShareContentProps) {
  const bodyStyle: React.CSSProperties = mode === "image"
    ? { display: "flex", flexDirection: "column", gap: 16, padding: "24px 40px 30px" }
    : { display: "flex", flexDirection: "column", gap: 14, padding: noPadX ? "16px 0 0" : "16px 12px 0" };

  const footerStyle: React.CSSProperties = mode === "image"
    ? {
        alignItems: "center",
        background: "#FFFFFF",
        border: "1px solid #E8EBEB",
        borderRadius: 16,
        boxShadow: "0 1px 4px rgba(53,92,90,0.05)",
        display: "flex",
        justifyContent: "space-between",
        margin: "0 40px 36px",
        padding: "14px 20px",
      }
    : {
        alignItems: "center",
        background: "#FFFFFF",
        border: "1px solid #E8EBEB",
        borderRadius: 12,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "space-between",
        marginTop: 4,
        padding: "12px 16px",
      };

  return (
    <>
      <div style={bodyStyle}>
        <AppliedView model={model} mode={mode} />

        {!model.hasResults ? (
          <div
            data-multi-dest-empty="true"
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              justifyContent: "center",
              padding: mode === "image" ? "64px 20px" : "44px 20px",
              textAlign: "center",
            }}
          >
            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={mode === "image" ? 42 : 36} color={FAINT} strokeWidth={1.5} />
            <p style={{ color: DARK_TEAL, fontSize: mode === "image" ? 16 : 15, fontWeight: 700, margin: 0 }}>
              No destinations were returned
            </p>
            <p style={{ color: MUTED, fontSize: mode === "image" ? 13 : 12, margin: 0, maxWidth: 360 }}>
              This immutable snapshot did not contain any available destination results.
            </p>
          </div>
        ) : (
          <div
            data-multi-dest-grid={mode}
            className={mode === "page" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : undefined}
            style={{
              display: "grid",
              gap: mode === "image" ? 16 : 14,
              gridTemplateColumns: mode === "image" ? "repeat(2, minmax(0, 1fr))" : undefined,
            }}
          >
            {model.destinations.map((destination) => (
              <MultiDestShareCard
                key={destination.destination}
                destination={destination}
                mode={mode}
              />
            ))}
          </div>
        )}
      </div>

      <footer aria-label="Public share disclosure" style={footerStyle}>
        <span style={{ alignItems: "center", color: MUTED, display: "inline-flex", fontSize: mode === "image" ? 12 : 11, fontWeight: 600, gap: 7 }}>
          <HugeiconsIcon icon={InformationCircleIcon} size={15} color={FAINT} strokeWidth={1.8} />
          Fares and availability may change.
        </span>
        <span style={{ alignItems: "center", display: "inline-flex", fontSize: mode === "image" ? 12 : 11, gap: 4 }}>
          <span style={{ color: MUTED, fontWeight: 600 }}>Shared from</span>
          <span style={{ color: EMERALD, fontSize: mode === "image" ? 13 : 12, fontWeight: 900, letterSpacing: "0.02em" }}>
            Wildfly
          </span>
        </span>
      </footer>
    </>
  );
}

MultiDestShareContent.displayName = "MultiDestShareContent";
