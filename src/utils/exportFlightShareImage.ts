import { toBlob } from "html-to-image";

const TEMPLATE_BG = "#F7F9F8";
const TALL_THRESHOLD = 6500;
const MAX_CANVAS_DIMENSION = 32_000;
const MAX_CANVAS_PIXELS = 80_000_000;
const IMAGE_SETTLE_TIMEOUT_MS = 5000;
const MAX_FILENAME_PART_LENGTH = 64;

/**
 * Select a canvas pixel ratio that remains within conservative browser canvas
 * dimension and memory budgets, including unusually long destination exports.
 */
export function selectPixelRatio(height: number, width = 941): number {
  const safeHeight = Math.max(1, height);
  const safeWidth = Math.max(1, width);
  const preferred =
    safeHeight <= TALL_THRESHOLD
      ? 2
      : Math.max(1.25, Math.min(1.5, (TALL_THRESHOLD * 1.5) / safeHeight));
  const maxByDimension = MAX_CANVAS_DIMENSION / Math.max(safeWidth, safeHeight);
  const maxByPixels = Math.sqrt(MAX_CANVAS_PIXELS / (safeWidth * safeHeight));

  return Math.min(preferred, maxByDimension, maxByPixels);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_FILENAME_PART_LENGTH)
    .replace(/-+$/g, "");
}

/** Build a deterministic, bounded, URL-safe PNG filename from route and date. */
export function buildShareFilename(
  originLabel: string | null | undefined,
  destinationLabel: string | null | undefined,
  departureDate: string | null | undefined,
): string {
  const origin = originLabel ? sanitizeFilenamePart(originLabel) : "";
  const destination = destinationLabel
    ? sanitizeFilenamePart(destinationLabel)
    : "";

  if (!origin || !destination) return "wildfly-flight-search.png";

  const route = `${origin}-to-${destination}`;
  const date = departureDate ? sanitizeFilenamePart(departureDate) : "";
  return date ? `wildfly-${route}-${date}.png` : `wildfly-${route}.png`;
}

async function settleImage(img: HTMLImageElement): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", finish);
      resolve();
    };
    const onLoad = () => {
      if (typeof img.decode === "function") {
        img.decode().then(finish, finish);
      } else {
        finish();
      }
    };
    const timeoutId = window.setTimeout(finish, IMAGE_SETTLE_TIMEOUT_MS);

    if (img.complete) onLoad();
    else {
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", finish, { once: true });
    }
  });
}

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.all(images.map(settleImage));
}

function waitForAnimationFrames(count: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let remaining = count;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const revokeObjectUrl =
    typeof URL.revokeObjectURL === "function"
      ? URL.revokeObjectURL.bind(URL)
      : null;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  if (revokeObjectUrl) setTimeout(() => revokeObjectUrl(url), 2000);
}

/** Render a measurable off-screen template to PNG and trigger a browser download. */
export async function exportFlightShareImage(
  node: HTMLElement,
  filename: string,
): Promise<Blob> {
  if (!node) {
    throw new Error("exportFlightShareImage: node is null or undefined");
  }

  if (typeof document?.fonts?.ready?.then === "function") {
    await document.fonts.ready.catch(() => undefined);
  }

  await waitForImages(node);
  await waitForAnimationFrames(2);

  const width = node.scrollWidth;
  const height = node.scrollHeight;
  if (width === 0 || height === 0) {
    throw new Error(
      `exportFlightShareImage: node has no dimensions (${width}×${height}). ` +
        "Ensure the template is not hidden with display:none or visibility:hidden.",
    );
  }

  const blob = await toBlob(node, {
    backgroundColor: TEMPLATE_BG,
    cacheBust: true,
    width,
    height,
    pixelRatio: selectPixelRatio(height, width),
    style: {
      animation: "none",
      scrollBehavior: "auto",
      transform: "none",
      transition: "none",
    },
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
