import { toBlob } from "html-to-image";

const TEMPLATE_BG = "#F7F9F8";
const TALL_THRESHOLD = 6500;

/**
 * Select canvas pixel ratio based on template height.
 *
 * 2× for normal-height exports; backs off toward 1.25 for very tall
 * templates to avoid catastrophic canvas memory use.
 */
export function selectPixelRatio(height: number): number {
  if (height <= TALL_THRESHOLD) return 2;
  // Scale from 1.5 at the threshold down to a floor of 1.25
  return Math.max(1.25, Math.min(1.5, (TALL_THRESHOLD * 1.5) / height));
}

function sanitizeFilenamePart(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a readable, URL-safe PNG filename from route and date.
 *
 * Example: "wildfly-chicago-to-atlanta-2026-06-13.png"
 * Falls back to "wildfly-flight-search.png" when route data is missing.
 */
export function buildShareFilename(
  originLabel: string | null | undefined,
  destinationLabel: string | null | undefined,
  departureDate: string | null | undefined,
): string {
  const origin = originLabel ? sanitizeFilenamePart(originLabel) : "";
  const dest = destinationLabel ? sanitizeFilenamePart(destinationLabel) : "";

  if (!origin || !dest) return "wildfly-flight-search.png";

  const route = `${origin}-to-${dest}`;
  const date = departureDate ? sanitizeFilenamePart(departureDate) : null;
  return date ? `wildfly-${route}-${date}.png` : `wildfly-${route}.png`;
}

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          const afterLoad = () => {
            img.decode?.().then(resolve, resolve);
          };
          if (img.complete) {
            afterLoad();
            return;
          }
          const onLoad = () => {
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onError);
            afterLoad();
          };
          const onError = () => {
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onError);
            resolve();
          };
          img.addEventListener("load", onLoad, { once: true });
          img.addEventListener("error", onError, { once: true });
        }),
    ),
  );
}

function waitForAnimationFrames(count: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let remaining = count;
    const tick = () => {
      if (--remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Render `node` to a PNG using html-to-image, trigger a browser download,
 * and return the generated Blob.
 *
 * Waits for fonts, images, and two animation frames before capturing so
 * the template is fully laid out and all images are decoded.
 */
export async function exportFlightShareImage(
  node: HTMLElement,
  filename: string,
): Promise<Blob> {
  if (!node) {
    throw new Error("exportFlightShareImage: node is null or undefined");
  }

  // Wait for font load
  if (typeof document?.fonts?.ready?.then === "function") {
    await document.fonts.ready;
  }

  // Wait for every <img> to load and decode
  await waitForImages(node);

  // Two rAF cycles let React flush layout and image intrinsic sizes settle
  await waitForAnimationFrames(2);

  const width = node.scrollWidth;
  const height = node.scrollHeight;

  if (width === 0 || height === 0) {
    throw new Error(
      `exportFlightShareImage: node has no dimensions (${width}×${height}). ` +
        "Ensure the template is not hidden with display:none or visibility:hidden.",
    );
  }

  const pixelRatio = selectPixelRatio(height);

  const blob = await toBlob(node, {
    backgroundColor: TEMPLATE_BG,
    cacheBust: true,
    width,
    height,
    pixelRatio,
  });

  if (!blob) {
    throw new Error(
      "exportFlightShareImage: html-to-image returned null — " +
        "the node may be empty or cross-origin resources blocked serialization.",
    );
  }

  triggerDownload(blob, filename);
  return blob;
}
