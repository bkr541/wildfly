import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneTakeOff01Icon } from "@hugeicons/core-free-icons";
import type { FlightShareAirportGroup as FlightShareAirportGroupData } from "@/utils/flightShareModel";
import { FlightShareOptionRow } from "./FlightShareOptionRow";

interface FlightShareAirportGroupProps {
  group: FlightShareAirportGroupData;
  sectionLabel?: string;
}

export function FlightShareAirportGroup({ group, sectionLabel }: FlightShareAirportGroupProps) {
  const { iata, name, city, optionCount, options } = group;

  // Graceful name display: prefer name, fall back to city, then iata code
  const displayName = name && name !== iata
    ? name
    : city && city !== iata
    ? city
    : null;

  const optionLabel = optionCount === 1 ? "1 option" : `${optionCount} options`;

  return (
    <div
      data-airport-group={iata}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8EBEB",
        borderRadius: 20,
        boxShadow: "0 2px 12px 0 rgba(53,92,90,0.08)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* ── Group header ───────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "18px 24px",
        borderBottom: "1px solid #F0F1F1",
      }}>
        {/* Airplane icon in green circle */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <HugeiconsIcon
            icon={AirplaneTakeOff01Icon}
            size={17}
            color="#FFFFFF"
            strokeWidth={2}
          />
        </div>

        {/* Airport code + name */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#1A2E2E",
            letterSpacing: "-0.01em",
            lineHeight: 1,
            flexShrink: 0,
          }}>
            {iata}
          </span>
          {displayName && (
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#6B7B7B",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {displayName}
            </span>
          )}
        </div>

        {/* Option count pill */}
        <div style={{
          flexShrink: 0,
          background: "#F0FAF6",
          border: "1px solid #A7F3D0",
          borderRadius: 20,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 700,
          color: "#047857",
          whiteSpace: "nowrap",
        }}>
          {optionLabel}
        </div>
      </div>

      {/* ── Flight option rows ─────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 16px 20px 16px" }}>
        {options.length === 0 ? (
          <p style={{
            textAlign: "center",
            fontSize: 13,
            color: "#9AADAD",
            padding: "12px 0",
          }}>
            No options returned for this group.
          </p>
        ) : (
          options.map((option, i) => (
            <FlightShareOptionRow
              key={option.canonicalKey}
              option={option}
              isFirst={i === 0}
              isLast={i === options.length - 1}
              sectionLabel={sectionLabel}
            />
          ))
        )}
      </div>
    </div>
  );
}

FlightShareAirportGroup.displayName = "FlightShareAirportGroup";
