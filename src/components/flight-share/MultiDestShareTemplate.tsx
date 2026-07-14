import React, { forwardRef } from "react";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";
import { FlightShareHero } from "./FlightShareHero";
import { MultiDestShareSummary } from "./MultiDestShareSummary";
import { MultiDestShareContent } from "./MultiDestShareContent";

export const MULTI_DEST_SHARE_EXPORT_WIDTH = 941;
const HERO_HEIGHT = 253;
const FONT_FAMILY = "Quicksand, Montserrat, ui-sans-serif, system-ui, -apple-system, sans-serif";
const PAGE_BG = "#F7F9F8";

export interface MultiDestShareTemplateProps {
  model: MultiDestShareModelV2;
}

/** Fixed-width, off-screen-ready PNG template for version-2 destination shares. */
export const MultiDestShareTemplate = forwardRef<HTMLDivElement, MultiDestShareTemplateProps>(
  ({ model }, ref) => (
    <div
      ref={ref}
      data-multi-dest-share-root="true"
      data-export-width={MULTI_DEST_SHARE_EXPORT_WIDTH}
      style={{
        background: PAGE_BG,
        boxSizing: "border-box",
        contain: "layout",
        fontFamily: FONT_FAMILY,
        minHeight: 900,
        overflow: "hidden",
        position: "relative",
        width: MULTI_DEST_SHARE_EXPORT_WIDTH,
      }}
    >
      <FlightShareHero
        originLabel={model.originLabel}
        destinationLabel={model.destinationLabel}
        heroImageUrl={model.heroImageUrl}
        arrivalImageUrl="/assets/locations/init_background.png"
        fixedHeight={HERO_HEIGHT}
      />
      <MultiDestShareSummary model={model} imageMode />
      <MultiDestShareContent model={model} mode="image" />
    </div>
  ),
);

MultiDestShareTemplate.displayName = "MultiDestShareTemplate";
