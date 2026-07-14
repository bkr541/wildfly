import React, { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";
import { buildShareFilename, exportFlightShareImage } from "@/utils/exportFlightShareImage";
import { FlightShareHero } from "./FlightShareHero";
import { MultiDestShareContent } from "./MultiDestShareContent";
import { MultiDestShareSummary } from "./MultiDestShareSummary";
import { MultiDestShareTemplate } from "./MultiDestShareTemplate";

const DARK_TEAL = "#1A2E2E";
const MUTED = "#6B7B7B";
const EMERALD = "#059669";

export interface PublicMultiDestShareViewProps {
  model: MultiDestShareModelV2;
  createdAt: string;
  expiresAt?: string | null;
  publicUrl: string;
}

function formatPublicDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function actionButtonStyle(disabled = false): React.CSSProperties {
  return {
    alignItems: "center",
    background: disabled ? "#E5E7EB" : "#FFFFFF",
    border: "1px solid #DDE4E4",
    borderRadius: 999,
    color: disabled ? "#9CA3AF" : DARK_TEAL,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    fontSize: 12,
    fontWeight: 800,
    gap: 7,
    padding: "9px 14px",
  };
}

/** Responsive public renderer for immutable version-2 destination snapshots. */
export function PublicMultiDestShareView({
  model,
  createdAt,
  expiresAt,
  publicUrl,
}: PublicMultiDestShareViewProps) {
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
    copyTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setCopied(false);
      copyTimerRef.current = null;
    }, 2000);
  }, [publicUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: `${model.originLabel} to ${model.destinationLabel} | Wildfly`,
        text: `Explore this Wildfly snapshot with ${model.totals.destinationCount} destinations.`,
        url: publicUrl,
      });
    } catch {
      // Native share dismissal is not an error state for the page.
    }
  }, [canNativeShare, model.destinationLabel, model.originLabel, model.totals.destinationCount, publicUrl]);

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
      console.error("[PublicMultiDestShareView] image export failed:", error);
      if (mountedRef.current) setDownloadError("Could not download the destination image. Please try again.");
    } finally {
      downloadInFlightRef.current = false;
      if (mountedRef.current) setDownloading(false);
    }
  }, [model.departureDate, model.destinationLabel, model.originLabel]);

  return (
    <div style={{ background: "#E8ECEC", minHeight: "100vh" }}>
      <main style={{ margin: "0 auto", maxWidth: 1180, paddingBottom: 48 }}>
        <FlightShareHero
          originLabel={model.originLabel}
          destinationLabel={model.destinationLabel}
          heroImageUrl={model.heroImageUrl}
          arrivalImageUrl="/assets/locations/init_background.png"
          showLogo={false}
          className="w-full"
          style={{ height: "clamp(170px, 25vw, 270px)" }}
        />

        <MultiDestShareSummary model={model} />

        <section
          aria-label="Share details and actions"
          style={{
            alignItems: "center",
            background: "#F7F9F8",
            borderBottom: "1px solid #DDE4E4",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "space-between",
            padding: "12px 14px",
          }}
        >
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, lineHeight: 1.45 }}>
            <div>Snapshot created {formatPublicDate(createdAt)}</div>
            {expiresAt && (
              <div data-expiration-state={expired ? "expired" : "active"} style={{ color: expired ? "#B42318" : MUTED }}>
                {expired ? "Expired" : "Available until"} {formatPublicDate(expiresAt)}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={handleDownload} disabled={downloading} style={actionButtonStyle(downloading)}>
              <Download aria-hidden="true" size={15} />
              {downloading ? "Preparing Image" : "Download Image"}
            </button>
            {canNativeShare && (
              <button type="button" onClick={handleNativeShare} style={actionButtonStyle()}>
                <Share2 aria-hidden="true" size={15} />
                Share
              </button>
            )}
            <button type="button" onClick={handleCopy} style={actionButtonStyle()}>
              <Copy aria-hidden="true" size={15} />
              {copied ? "Link Copied" : "Copy Link"}
            </button>
          </div>
        </section>

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
          <MultiDestShareContent model={model} mode="page" noPadX />
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

PublicMultiDestShareView.displayName = "PublicMultiDestShareView";
