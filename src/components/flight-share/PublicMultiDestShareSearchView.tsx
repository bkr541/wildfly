import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";
import { MultiDestShareCard } from "./MultiDestShareCard";

const DARK_TEAL = "#1A2E2E";
const MUTED = "#6B7B7B";
const FAINT = "#9AADAD";
const EMERALD = "#059669";

export interface PublicMultiDestShareSearchViewProps {
  model: MultiDestShareModelV2;
  createdAt: string;
  expiresAt?: string | null;
  publicUrl: string;
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

/**
 * Public all-destinations hero.
 *
 * The two diagonal image panes, divider, and overlays are intentionally kept
 * identical to the original public-share hero. The foreground layout shows the
 * stacked route title and the four statistics inside the hero without any action
 * buttons or snapshot date.
 */
function PublicMultiDestHero({ model }: { model: MultiDestShareModelV2 }) {
  const stats = [
    { label: "DESTINATIONS", value: model.totals.destinationCount },
    { label: "TOTAL FLIGHTS", value: model.totals.flightCount },
    { label: "NONSTOP", value: model.totals.nonstopDestinationCount },
    { label: "GO WILD", value: model.totals.goWildDestinationCount },
  ] as const;

  return (
    <header
      data-public-multi-dest-hero="true"
      className="relative flex min-h-[248px] w-full flex-col overflow-hidden px-5 pb-4 pt-6"
      style={{ background: "#C8D5D5" }}
    >
      {/* Existing upper-left origin image pane. */}
      <img
        src={model.heroImageUrl}
        alt=""
        aria-hidden="true"
        style={{
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
          display: "block",
          height: "100%",
          inset: 0,
          objectFit: "cover",
          objectPosition: "center",
          position: "absolute",
          width: "100%",
        }}
      />

      {/* Existing lower-right generic destinations image pane. */}
      <img
        src="/assets/locations/init_background.png"
        alt=""
        aria-hidden="true"
        style={{
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
          display: "block",
          height: "100%",
          inset: 0,
          objectFit: "cover",
          objectPosition: "center",
          position: "absolute",
          width: "100%",
        }}
      />

      {/* Existing diagonal divider and readability treatment. */}
      <div
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to top right, transparent calc(50% - 1px), rgba(255,255,255,0.55) calc(50% - 1px), rgba(255,255,255,0.55) calc(50% + 1px), transparent calc(50% + 1px))",
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
        }}
      />
      <div
        aria-hidden="true"
        data-public-multi-dest-hero-tint="true"
        style={{
          background: "rgba(8, 18, 32, 0.28)",
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to bottom right, rgba(0,0,0,0.16) 0%, transparent 45%, rgba(0,0,0,0.16) 100%)",
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
        }}
      />

      {/* Exact route title hierarchy from FlightMultiDestResults. */}
      <div
        data-public-multi-dest-hero-title="true"
        className="relative flex-1"
        style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        <div
          className="flex flex-col gap-0 leading-tight"
          style={{ textShadow: "0 2px 5px rgba(0,0,0,0.4)" }}
        >
          <span
            className="text-[22px] font-light text-white"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}
          >
            {model.originLabel} to
          </span>
          <span className="text-[36px] font-black text-white">
            {model.destinationLabel}
          </span>
        </div>
      </div>

      {/* Four exact-width columns with centered, contained labels and totals. */}
      <div
        data-public-multi-dest-hero-stats="true"
        className="relative mt-4 grid w-full grid-cols-4 gap-2"
      >
        {stats.map(({ label, value }) => (
          <div
            key={label}
            data-public-multi-dest-stat={label}
            className="flex min-w-0 flex-col items-center overflow-hidden text-center"
          >
            <span
              className="max-w-full overflow-hidden whitespace-nowrap text-center font-semibold uppercase leading-tight tracking-wide text-white/80"
              style={{ fontSize: "clamp(8px, 2.5vw, 10px)" }}
            >
              {label}
            </span>
            <span
              className="mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center font-medium leading-tight text-white tabular-nums"
              style={{ fontSize: "clamp(20px, 6vw, 24px)" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </header>
  );
}

function PublicDestinationContent({ model }: { model: MultiDestShareModelV2 }) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 0 0" }}>
        {!model.hasResults ? (
          <div
            data-multi-dest-empty="true"
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              justifyContent: "center",
              padding: "44px 20px",
              textAlign: "center",
            }}
          >
            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={36} color={FAINT} strokeWidth={1.5} />
            <p style={{ color: DARK_TEAL, fontSize: 15, fontWeight: 700, margin: 0 }}>
              No destinations were returned
            </p>
            <p style={{ color: MUTED, fontSize: 12, margin: 0, maxWidth: 360 }}>
              This immutable snapshot did not contain any available destination results.
            </p>
          </div>
        ) : (
          <div
            data-multi-dest-grid="page"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            style={{ display: "grid", gap: 14 }}
          >
            {model.destinations.map((destination) => (
              <MultiDestShareCard
                key={destination.destination}
                destination={destination}
                mode="page"
              />
            ))}
          </div>
        )}
      </div>

      <footer
        aria-label="Public share disclosure"
        style={{
          alignItems: "center",
          background: "#FFFFFF",
          border: "1px solid #E8EBEB",
          borderRadius: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "space-between",
          marginTop: 18,
          padding: "12px 16px",
        }}
      >
        <span style={{ alignItems: "center", color: MUTED, display: "inline-flex", fontSize: 11, fontWeight: 600, gap: 7 }}>
          <HugeiconsIcon icon={InformationCircleIcon} size={15} color={FAINT} strokeWidth={1.8} />
          Fares and availability may change.
        </span>
        <span style={{ alignItems: "center", display: "inline-flex", fontSize: 11, gap: 4 }}>
          <span style={{ color: MUTED, fontWeight: 600 }}>Shared from</span>
          <span style={{ color: EMERALD, fontSize: 12, fontWeight: 900, letterSpacing: "0.02em" }}>
            Wildfly
          </span>
        </span>
      </footer>
    </>
  );
}

/**
 * Corrected public renderer for immutable version-2 destination snapshots.
 * It is intentionally wired directly from PublicFlightSharePage so older
 * public-share presentation components cannot override this layout.
 */
export function PublicMultiDestShareSearchView({
  model,
  expiresAt,
}: PublicMultiDestShareSearchViewProps) {
  const expired = isExpired(expiresAt);

  return (
    <div style={{ background: "#E8ECEC", minHeight: "100vh" }}>
      <main style={{ margin: "0 auto", maxWidth: 1180, paddingBottom: 48 }}>
        <PublicMultiDestHero model={model} />

        {expired && (
          <div
            role="status"
            style={{
              background: "#FFF4F2",
              border: "1px solid #FECDCA",
              borderRadius: 12,
              color: "#912018",
              fontSize: 12,
              fontWeight: 700,
              margin: "14px 14px 0",
              padding: "11px 14px",
            }}
          >
            This shared snapshot has expired. Its immutable results remain visible, but fares and availability are historical.
          </div>
        )}

        <div style={{ padding: "0 14px" }}>
          <PublicDestinationContent model={model} />
        </div>
      </main>
    </div>
  );
}

PublicMultiDestShareSearchView.displayName = "PublicMultiDestShareSearchView";
