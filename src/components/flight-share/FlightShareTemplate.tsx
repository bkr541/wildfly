import React, { forwardRef } from "react";
import type { FlightShareModel } from "@/utils/flightShareModel";
import { FlightShareHero } from "./FlightShareHero";
import { FlightShareSummary } from "./FlightShareSummary";
import { FlightShareContent } from "./FlightShareContent";

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT_WIDTH  = 941;
const HERO_HEIGHT = 253;
const FONT_FAMILY =
  "Quicksand, Montserrat, ui-sans-serif, system-ui, -apple-system, sans-serif";
const PAGE_BG = "#F7F9F8";

// ── Props ────────────────────────────────────────────────────────────────────

interface FlightShareTemplateProps {
  model: FlightShareModel;
}

// ── Main template ────────────────────────────────────────────────────────────

/**
 * Off-screen container for html-to-image export.
 *
 * Fixed 941 px width and deterministic layout. FlightShareContent renders
 * in "image" mode so dimensions and spacing match the export output exactly.
 * Passes ref to the root div so exportFlightShareImage can target it.
 */
export const FlightShareTemplate = forwardRef<HTMLDivElement, FlightShareTemplateProps>(
  ({ model }, ref) => (
    <div
      ref={ref}
      data-flight-share-root="true"
      style={{
        width: ROOT_WIDTH,
        minHeight: 1200,
        background: PAGE_BG,
        fontFamily: FONT_FAMILY,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        contain: "layout",
      }}
    >
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <FlightShareHero
        originLabel={model.originLabel}
        destinationLabel={model.destinationLabel}
        heroImageUrl={model.heroImageUrl}
        arrivalImageUrl={model.arrivalImageUrl}
        fixedHeight={HERO_HEIGHT}
      />

      {/* ── Stats strip ───────────────────────────────────────────────────────── */}
      <FlightShareSummary model={model} imageMode />

      {/* ── Body + footer (shared with public page) ───────────────────────────── */}
      <FlightShareContent model={model} mode="image" />
    </div>
  ),
);

FlightShareTemplate.displayName = "FlightShareTemplate";
