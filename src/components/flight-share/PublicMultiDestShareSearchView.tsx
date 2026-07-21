import React, { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  Calendar03Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { Copy, Download, Share2 } from "lucide-react";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";
import { buildShareFilename, exportFlightShareImage } from "@/utils/exportFlightShareImage";
import { MultiDestShareCard } from "./MultiDestShareCard";
import { MultiDestShareTemplate } from "./MultiDestShareTemplate";

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

function formatHeroDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  });
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function heroActionButtonStyle(disabled = false, active = false): React.CSSProperties {
  return {
    alignItems: "center",
    backdropFilter: "blur(8px)",
    background: disabled
      ? "rgba(255,255,255,0.08)"
      : active
        ? "rgba(255,255,255,0.28)"
        : "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.30)",
    borderRadius: 999,
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    color: disabled ? "rgba(255,255,255,0.48)" : "#FFFFFF",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    flex: "0 0 36px",
    height: 36,
    justifyContent: "center",
    padding: 0,
    width: 36,
  };
}

interface PublicMultiDestHeroProps {
  model: MultiDestShareModelV2;
  copied: boolean;
  downloading: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
}

/**
 * Public all-destinations hero.
 *
 * The two diagonal image panes, divider, and overlays are intentionally kept
 * identical to the original public-share hero. The foreground layout mirrors
 * FlightMultiDestResults: top-right circular actions, stacked route title,
 * date pill, and the four statistics inside the hero.
 */
function PublicMultiDestHero({
  model,
  copied,
  downloading,
  onCopy,
  onDownload,
  onShare,
}: PublicMultiDestHeroProps) {
  const dateLabel = formatHeroDate(model.departureDate);
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
          background: "rgba(8, 18, 32, 0.36)",
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to bottom right, rgba(0,0,0,0.24) 0%, transparent 45%, rgba(0,0,0,0.24) 100%)",
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
        }}
      />

      {/* Download, Copy, and Share are icon-only controls in the hero. */}
      <div className="relative flex h-10 w-full items-center justify-end">
        <div data-public-multi-dest-hero-actions="true" className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Download Image"
            title={downloading ? "Preparing image" : "Download image"}
            disabled={downloading}
            onClick={onDownload}
            style={heroActionButtonStyle(downloading)}
          >
            <Download aria-hidden="true" size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Copy Link"
            title={copied ? "Link copied" : "Copy link"}
            onClick={onCopy}
            style={heroActionButtonStyle(false, copied)}
          >
            <Copy aria-hidden="true" size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Share"
            title="Share"
            onClick={onShare}
            style={heroActionButtonStyle()}
          >
            <Share2 aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Exact route title and date hierarchy from FlightMultiDestResults. */}
      <div data-public-multi-dest-hero-title="true" className="relative mt-0">
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

        {dateLabel && (
          <div className="mt-2 flex items-center gap-2">
            <div
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 backdrop-blur-sm"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)" }}
            >
              <HugeiconsIcon icon={Calendar03Icon} size={13} color="#065F46" strokeWidth={1.5} />
              <span className="whitespace-nowrap text-xs font-semibold leading-none text-[#065F46]">
                {dateLabel}
              </span>
            </div>
          </div>
        )}
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

function getActiveFilterLabels(model: MultiDestShareModelV2): string[] {
  const labels: string[] = [];
  // The destination order already communicates sorting; only active filters
  // belong above the cards.
  if (model.appliedView.nonstopOnly) labels.push("Nonstop Only");
  if (model.appliedView.goWildOnly) labels.push("GoWild Only");
  if (model.appliedView.destinationType === "domestic") labels.push("Domestic Only");
  if (model.appliedView.destinationType === "international") labels.push("International Only");
  return labels;
}

function PublicDestinationContent({ model }: { model: MultiDestShareModelV2 }) {
  const filterLabels = getActiveFilterLabels(model);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 0 0" }}>
        {filterLabels.length > 0 && (
          <div aria-label="Applied filters" style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {filterLabels.map((label) => (
              <span
                key={label}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DDE4E4",
                  borderRadius: 999,
                  color: MUTED,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "4px 8px",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            ))}
          </div>
        )}

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
  publicUrl,
}: PublicMultiDestShareSearchViewProps) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const expired = isExpired(expiresAt);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      downloadInFlightRef.current = false;
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const input = document.createElement("input");
      input.value = publicUrl;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    if (!mountedRef.current) return;
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    setCopied(true);
    copyTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setCopied(false);
      copyTimerRef.current = null;
    }, 2000);
  }, [publicUrl]);

  const handleShare = useCallback(async () => {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: `${model.originLabel} to ${model.destinationLabel} | Wildfly`,
          text: `Explore this Wildfly snapshot with ${model.totals.destinationCount} destinations.`,
          url: publicUrl,
        });
      } catch {
        // Native share dismissal is not an error state for the page.
      }
      return;
    }

    await handleCopy();
  }, [canNativeShare, handleCopy, model.destinationLabel, model.originLabel, model.totals.destinationCount, publicUrl]);

  const handleDownload = useCallback(async () => {
    const node = templateRef.current;
    if (!node || downloadInFlightRef.current) return;
    downloadInFlightRef.current = true;
    setDownloading(true);
    setDownloadError(null);
    try {
      const filename = buildShareFilename(
        model.originLabel,
        model.destinationLabel,
        model.departureDate,
      );
      await exportFlightShareImage(node, filename);
    } catch (error) {
      console.error("[PublicMultiDestShareSearchView] image export failed:", error);
      if (mountedRef.current) setDownloadError("Could not download the destination image. Please try again.");
    } finally {
      downloadInFlightRef.current = false;
      if (mountedRef.current) setDownloading(false);
    }
  }, [model.departureDate, model.destinationLabel, model.originLabel]);

  return (
    <div style={{ background: "#E8ECEC", minHeight: "100vh" }}>
      <main style={{ margin: "0 auto", maxWidth: 1180, paddingBottom: 48 }}>
        <PublicMultiDestHero
          model={model}
          copied={copied}
          downloading={downloading}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onShare={handleShare}
        />

        {downloadError && (
          <div role="alert" style={{ color: "#B42318", fontSize: 12, fontWeight: 700, margin: "12px 14px 0" }}>
            {downloadError}
          </div>
        )}

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

      <div
        aria-hidden="true"
        data-offscreen-multi-dest-template="true"
        style={{
          left: -9999,
          opacity: 0,
          pointerEvents: "none",
          position: "fixed",
          top: -9999,
          zIndex: -1,
        }}
      >
        <MultiDestShareTemplate ref={templateRef} model={model} />
      </div>
    </div>
  );
}

PublicMultiDestShareSearchView.displayName = "PublicMultiDestShareSearchView";
