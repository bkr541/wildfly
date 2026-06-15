import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneTakeOff01Icon, ChevronDown, ChevronUp } from "@hugeicons/core-free-icons";
import type { FlightShareAirportGroup as FlightShareAirportGroupData } from "@/utils/flightShareModel";
import { FlightShareOptionRow } from "./FlightShareOptionRow";
import type { FlightShareRenderMode } from "./FlightShareOptionRow";

interface FlightShareAirportGroupProps {
  group: FlightShareAirportGroupData;
  sectionLabel?: string;
  mode?: FlightShareRenderMode;
  /**
   * Page mode only: whether the group starts open.
   * Defaults to true so all options are visible by default.
   */
  defaultOpen?: boolean;
}

export function FlightShareAirportGroup({
  group,
  sectionLabel,
  mode = "image",
  defaultOpen = true,
}: FlightShareAirportGroupProps) {
  const { iata, name, city, options, optionCount } = group;
  const [open, setOpen] = useState(defaultOpen);

  // Graceful name display: prefer name, fall back to city, then iata code
  const displayName =
    name && name !== iata
      ? name
      : city && city !== iata
      ? city
      : null;

  // Count pill label — shows filtered/total when they differ (page mode with filter applied)
  const visibleCount = options.length;
  const countLabel =
    visibleCount !== optionCount
      ? `${visibleCount} / ${optionCount} ${optionCount === 1 ? "option" : "options"}`
      : `${optionCount} ${optionCount === 1 ? "option" : "options"}`;

  const headerIconSize = mode === "image" ? 17 : 15;
  const headerContainerSize = mode === "image" ? 36 : 32;
  const iataFontSize = mode === "image" ? 22 : 20;

  // ── Image mode header (static div) ──────────────────────────────────────────
  const groupHeader =
    mode === "image" ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 24px",
          borderBottom: "1px solid #F0F1F1",
        }}
      >
        <div
          style={{
            width: headerContainerSize,
            height: headerContainerSize,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <HugeiconsIcon
            icon={AirplaneTakeOff01Icon}
            size={headerIconSize}
            color="#FFFFFF"
            strokeWidth={2}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontSize: iataFontSize,
              fontWeight: 900,
              color: "#1A2E2E",
              letterSpacing: "-0.01em",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {iata}
          </span>
          {displayName && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#6B7B7B",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </span>
          )}
        </div>

        <div
          style={{
            flexShrink: 0,
            background: "#F0FAF6",
            border: "1px solid #A7F3D0",
            borderRadius: 20,
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 700,
            color: "#047857",
            whiteSpace: "nowrap",
          }}
        >
          {countLabel}
        </div>
      </div>
    ) : (
      // ── Page mode header (interactive button with aria-expanded) ──────────
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          borderBottom: open ? "1px solid #F0F1F1" : "none",
        }}
      >
        <div
          style={{
            width: headerContainerSize,
            height: headerContainerSize,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <HugeiconsIcon
            icon={AirplaneTakeOff01Icon}
            size={headerIconSize}
            color="#FFFFFF"
            strokeWidth={2}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: iataFontSize,
                fontWeight: 900,
                color: "#1A2E2E",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {iata}
            </span>
            {displayName && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#6B7B7B",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {displayName}
              </span>
            )}
          </div>
        </div>

        <span
          style={{
            flexShrink: 0,
            background: "#F0FAF6",
            border: "1px solid #A7F3D0",
            borderRadius: 20,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#047857",
            whiteSpace: "nowrap",
          }}
        >
          {countLabel}
        </span>

        <HugeiconsIcon
          icon={open ? ChevronUp : ChevronDown}
          size={16}
          color="#6B7B7B"
          strokeWidth={2}
        />
      </button>
    );

  // ── Option rows body ──────────────────────────────────────────────────────────

  const bodyPadding = mode === "image" ? "16px 16px 20px 16px" : "12px 12px 8px";

  const optionBody =
    mode === "page" && !open ? null : (
      <div style={{ padding: bodyPadding }}>
        {options.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "#9AADAD",
              padding: "12px 0",
            }}
          >
            {mode === "page"
              ? "No options match the current filter."
              : "No options returned for this group."}
          </p>
        ) : (
          options.map((option, i) => (
            <FlightShareOptionRow
              key={option.canonicalKey}
              option={option}
              isFirst={i === 0}
              isLast={i === options.length - 1}
              sectionLabel={sectionLabel}
              mode={mode}
            />
          ))
        )}
      </div>
    );

  return (
    <div
      data-airport-group={iata}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8EBEB",
        borderRadius: mode === "image" ? 20 : 18,
        boxShadow:
          mode === "image"
            ? "0 2px 12px 0 rgba(53,92,90,0.08)"
            : "0 2px 8px 0 rgba(53,92,90,0.06)",
        overflow: "hidden",
        boxSizing: "border-box",
        marginBottom: mode === "page" ? 12 : 0,
      }}
    >
      {groupHeader}
      {optionBody}
    </div>
  );
}

FlightShareAirportGroup.displayName = "FlightShareAirportGroup";
