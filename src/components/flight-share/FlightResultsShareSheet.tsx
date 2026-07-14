import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsSpin,
  faDownload,
  faLink,
  faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Copy01Icon,
  Share03Icon,
} from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";

export interface FlightResultsShareSheetProps {
  open: boolean;
  onClose: () => void;
  onDownloadImage: () => void | Promise<void>;
  onCreatePublicLink: () => void | Promise<void>;
  onResetPublicLink: () => void;

  isGeneratingImage: boolean;
  isCreatingPublicLink: boolean;
  imageError: string | null;
  publicLinkError: string | null;
  publicUrl: string | null;

  title?: string;
  description?: string;
  nativeShareTitle?: string;
}

/**
 * Model-agnostic presentation for flight-result sharing.
 *
 * Model construction, image rendering, persistence, and error classification
 * remain with the owning page. This component owns only share-sheet UI and the
 * browser-level copy/native-share interactions common to every result type.
 */
export function FlightResultsShareSheet({
  open,
  onClose,
  onDownloadImage,
  onCreatePublicLink,
  onResetPublicLink,
  isGeneratingImage,
  isCreatingPublicLink,
  imageError,
  publicLinkError,
  publicUrl,
  title = "Share flight results",
  description = "Download an image or create a public link anyone can open.",
  nativeShareTitle = "Flight results",
}: FlightResultsShareSheetProps) {
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const copiedResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCopiedResetTimer = useCallback(() => {
    if (copiedResetTimer.current !== null) {
      clearTimeout(copiedResetTimer.current);
      copiedResetTimer.current = null;
    }
  }, []);

  const showCopiedFeedback = useCallback(() => {
    clearCopiedResetTimer();
    setPublicLinkCopied(true);
    copiedResetTimer.current = setTimeout(() => {
      setPublicLinkCopied(false);
      copiedResetTimer.current = null;
    }, 2000);
  }, [clearCopiedResetTimer]);

  useEffect(() => {
    setPublicLinkCopied(false);
    clearCopiedResetTimer();
  }, [publicUrl, clearCopiedResetTimer]);

  useEffect(() => clearCopiedResetTimer, [clearCopiedResetTimer]);

  const handleCopyPublicLink = useCallback(async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      showCopiedFeedback();
      return;
    } catch {
      const input = document.createElement("input");
      input.value = publicUrl;
      input.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      try {
        document.execCommand("copy");
        showCopiedFeedback();
      } catch {
        // Preserve the existing silent fallback failure behavior.
      } finally {
        document.body.removeChild(input);
      }
    }
  }, [publicUrl, showCopiedFeedback]);

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center gap-2.5 px-5 pt-2 pb-4 border-b border-[#F0F1F1]">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
        >
          <HugeiconsIcon icon={Share03Icon} size={15} color="white" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-[#2E4A4A]">{title}</h2>
          <p className="text-xs text-[#9CA3AF] leading-tight">{description}</p>
        </div>
      </div>

      {publicUrl ? (
        <div className="flex flex-col gap-3 px-5 py-4 pb-8">
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#D1FAE5" }}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} color="#059669" strokeWidth={2} />
            </div>
            <p className="text-sm font-semibold text-[#059669]">Public link created</p>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E8EBEB] bg-[#F8FAFA]">
            <p className="flex-1 text-xs font-medium text-[#4B6060] truncate min-w-0 select-all">
              {publicUrl}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95"
              style={{
                borderColor: publicLinkCopied ? "#059669" : "#E8EBEB",
                background: publicLinkCopied ? "#F0FDF4" : "#FAFAFA",
              }}
              aria-label="Copy public link"
            >
              <HugeiconsIcon
                icon={publicLinkCopied ? CheckmarkCircle02Icon : Copy01Icon}
                size={18}
                color={publicLinkCopied ? "#059669" : "#4B6060"}
                strokeWidth={2}
              />
              <span
                className="text-xs font-semibold"
                style={{ color: publicLinkCopied ? "#059669" : "#4B6060" }}
              >
                {publicLinkCopied ? "Copied!" : "Copy"}
              </span>
            </button>

            {canNativeShare && (
              <button
                type="button"
                onClick={() => {
                  navigator.share({ url: publicUrl, title: nativeShareTitle }).catch(() => {});
                }}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[#E8EBEB] bg-[#FAFAFA] transition-all active:scale-95"
                aria-label="Share link via system share sheet"
              >
                <HugeiconsIcon icon={Share03Icon} size={18} color="#4B6060" strokeWidth={2} />
                <span className="text-xs font-semibold text-[#4B6060]">Share</span>
              </button>
            )}

            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[#E8EBEB] bg-[#FAFAFA] transition-all active:scale-95"
              aria-label="Open public link in new tab"
            >
              <FontAwesomeIcon icon={faUpRightFromSquare} className="w-4 h-4 text-[#4B6060]" />
              <span className="text-xs font-semibold text-[#4B6060]">Open</span>
            </a>
          </div>

          <button
            type="button"
            onClick={onResetPublicLink}
            className="text-xs font-medium text-[#9CA3AF] hover:text-[#4B6060] transition-colors text-center py-2"
          >
            Create another link
          </button>
        </div>
      ) : (
        <div className="flex flex-col py-2 pb-8">
          <button
            type="button"
            onClick={onDownloadImage}
            disabled={isGeneratingImage}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5 disabled:opacity-70 disabled:cursor-wait text-left w-full"
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(107,123,123,0.10)" }}
            >
              {isGeneratingImage ? (
                <FontAwesomeIcon icon={faArrowsSpin} className="w-4 h-4 text-[#6B7B7B] animate-spin" />
              ) : (
                <FontAwesomeIcon icon={faDownload} className="w-4 h-4 text-[#6B7B7B]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#2E4A4A]">Download Image</p>
              <p className="text-xs text-[#9CA3AF]">
                {isGeneratingImage ? "Generating image…" : "Save as PNG to share anywhere"}
              </p>
              {imageError && <p className="text-xs text-red-500 mt-0.5">{imageError}</p>}
            </div>
          </button>

          <div className="mx-5 border-t border-[#F0F1F1]" />

          <button
            type="button"
            onClick={onCreatePublicLink}
            disabled={isCreatingPublicLink}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-black/5 disabled:opacity-70 disabled:cursor-wait text-left w-full"
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(107,123,123,0.10)" }}
            >
              {isCreatingPublicLink ? (
                <FontAwesomeIcon icon={faArrowsSpin} className="w-4 h-4 text-[#6B7B7B] animate-spin" />
              ) : (
                <FontAwesomeIcon icon={faLink} className="w-4 h-4 text-[#6B7B7B]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#2E4A4A]">Share URL</p>
              <p className="text-xs text-[#9CA3AF]">
                {isCreatingPublicLink
                  ? "Creating link…"
                  : "Anyone with the link can view these exact results"}
              </p>
              {publicLinkError && (
                <p className="text-xs text-red-500 mt-0.5">{publicLinkError}</p>
              )}
            </div>
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
