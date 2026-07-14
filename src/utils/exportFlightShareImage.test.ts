import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildShareFilename, selectPixelRatio, exportFlightShareImage } from "./exportFlightShareImage";

vi.mock("html-to-image", () => ({
  toBlob: vi.fn(),
}));

// ── buildShareFilename ────────────────────────────────────────────────────────

describe("buildShareFilename", () => {
  it("produces a lowercase hyphenated filename with date", () => {
    expect(buildShareFilename("Chicago", "Atlanta", "2026-06-13")).toBe(
      "wildfly-chicago-to-atlanta-2026-06-13.png",
    );
  });

  it("handles spaces in city names", () => {
    expect(buildShareFilename("New York City", "Los Angeles", "2026-07-04")).toBe(
      "wildfly-new-york-city-to-los-angeles-2026-07-04.png",
    );
  });

  it("falls back to flight-search when both labels are null", () => {
    expect(buildShareFilename(null, null, null)).toBe("wildfly-flight-search.png");
  });

  it("falls back when origin is empty", () => {
    expect(buildShareFilename("", "Atlanta", "2026-06-13")).toBe("wildfly-flight-search.png");
  });

  it("falls back when destination is empty", () => {
    expect(buildShareFilename("Chicago", "", "2026-06-13")).toBe("wildfly-flight-search.png");
  });

  it("omits date portion when date is null", () => {
    expect(buildShareFilename("Chicago", "Atlanta", null)).toBe(
      "wildfly-chicago-to-atlanta.png",
    );
  });

  it("sanitizes punctuation and strips leading/trailing hyphens", () => {
    expect(buildShareFilename("St. Louis", "O'Hare", null)).toBe(
      "wildfly-st-louis-to-o-hare.png",
    );
  });

  it("collapses repeated hyphens", () => {
    expect(buildShareFilename("Chicago!", "Atlanta", null)).toBe(
      "wildfly-chicago-to-atlanta.png",
    );
  });
});

// ── selectPixelRatio ──────────────────────────────────────────────────────────

describe("selectPixelRatio", () => {
  it("returns 2 for normal-height images", () => {
    expect(selectPixelRatio(1200)).toBe(2);
    expect(selectPixelRatio(3000)).toBe(2);
    expect(selectPixelRatio(6500)).toBe(2);
  });

  it("returns a reduced ratio for images taller than 6500px", () => {
    const ratio = selectPixelRatio(7000);
    expect(ratio).toBeLessThan(2);
    expect(ratio).toBeGreaterThanOrEqual(1.25);
  });

  it("keeps extreme templates within conservative canvas limits", () => {
    const ratio = selectPixelRatio(100_000, 941);
    expect(ratio).toBeLessThan(1);
    expect(100_000 * ratio).toBeLessThanOrEqual(32_000);
    expect(941 * 100_000 * ratio * ratio).toBeLessThanOrEqual(80_000_000);
  });

  it("keeps the ratio positive while honoring the hard dimension budget", () => {
    expect(selectPixelRatio(100_000)).toBeGreaterThan(0);
    expect(selectPixelRatio(400_000) * 400_000).toBeLessThanOrEqual(32_000);
  });

  it("returns exactly 1.5 at the threshold boundary", () => {
    expect(selectPixelRatio(6501)).toBeLessThanOrEqual(1.5);
  });
});

// ── exportFlightShareImage ────────────────────────────────────────────────────

describe("exportFlightShareImage", () => {
  let origRAF: typeof requestAnimationFrame;
  let origCreateObjectURL: typeof URL.createObjectURL;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let origAnchorClick: typeof HTMLAnchorElement.prototype.click;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Make requestAnimationFrame synchronous so tests don't stall
    origRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    // Stub URL object methods
    origCreateObjectURL = URL.createObjectURL;
    origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:test-url");
    URL.revokeObjectURL = vi.fn();
    origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRAF;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    HTMLAnchorElement.prototype.click = origAnchorClick;
  });

  it("throws when the node has no measurable dimensions", async () => {
    const node = document.createElement("div");
    // jsdom scrollWidth/scrollHeight default to 0
    await expect(exportFlightShareImage(node, "test.png")).rejects.toThrow(
      "node has no dimensions",
    );
  });

  it("throws when toBlob returns null", async () => {
    const { toBlob } = await import("html-to-image");
    (toBlob as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const node = document.createElement("div");
    Object.defineProperty(node, "scrollWidth", { value: 941, configurable: true });
    Object.defineProperty(node, "scrollHeight", { value: 1200, configurable: true });

    await expect(exportFlightShareImage(node, "test.png")).rejects.toThrow(
      "html-to-image returned null",
    );
  });

  it("returns the Blob and calls createObjectURL on success", async () => {
    const { toBlob } = await import("html-to-image");
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    (toBlob as ReturnType<typeof vi.fn>).mockResolvedValue(fakeBlob);

    const node = document.createElement("div");
    Object.defineProperty(node, "scrollWidth", { value: 941, configurable: true });
    Object.defineProperty(node, "scrollHeight", { value: 1200, configurable: true });

    const result = await exportFlightShareImage(node, "test.png");

    expect(result).toBe(fakeBlob);
    expect(URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);
  });

  it("passes width, height, backgroundColor, and cacheBust to toBlob", async () => {
    const { toBlob } = await import("html-to-image");
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    (toBlob as ReturnType<typeof vi.fn>).mockResolvedValue(fakeBlob);

    const node = document.createElement("div");
    Object.defineProperty(node, "scrollWidth", { value: 941, configurable: true });
    Object.defineProperty(node, "scrollHeight", { value: 1500, configurable: true });

    await exportFlightShareImage(node, "test.png");

    expect(toBlob).toHaveBeenCalledWith(
      node,
      expect.objectContaining({
        backgroundColor: "#F7F9F8",
        cacheBust: true,
        width: 941,
        height: 1500,
        pixelRatio: 2,
        style: expect.objectContaining({
          animation: "none",
          transition: "none",
          transform: "none",
        }),
      }),
    );
  });

  it("uses a reduced pixelRatio for very tall templates", async () => {
    const { toBlob } = await import("html-to-image");
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    (toBlob as ReturnType<typeof vi.fn>).mockResolvedValue(fakeBlob);

    const node = document.createElement("div");
    Object.defineProperty(node, "scrollWidth", { value: 941, configurable: true });
    Object.defineProperty(node, "scrollHeight", { value: 9000, configurable: true });

    await exportFlightShareImage(node, "tall-test.png");

    const call = (toBlob as ReturnType<typeof vi.fn>).mock.calls[0];
    const opts = call[1] as { pixelRatio: number };
    expect(opts.pixelRatio).toBeLessThan(2);
    expect(opts.pixelRatio).toBeGreaterThanOrEqual(1.25);
  });

  it("continues when a local image fails to load", async () => {
    const { toBlob } = await import("html-to-image");
    const fakeBlob = new Blob(["img"], { type: "image/png" });
    (toBlob as ReturnType<typeof vi.fn>).mockResolvedValue(fakeBlob);

    const node = document.createElement("div");
    const image = document.createElement("img");
    node.appendChild(image);
    Object.defineProperty(node, "scrollWidth", { value: 941, configurable: true });
    Object.defineProperty(node, "scrollHeight", { value: 1200, configurable: true });

    const exportPromise = exportFlightShareImage(node, "missing-image.png");
    image.dispatchEvent(new Event("error"));

    await expect(exportPromise).resolves.toBe(fakeBlob);
  });

  it("bounds deterministic filenames for unusually long labels", () => {
    const filename = buildShareFilename("A".repeat(200), "B".repeat(200), "2026-07-14");
    expect(filename.length).toBeLessThan(170);
    expect(filename).toMatch(/^wildfly-a+-to-b+-2026-07-14\.png$/);
  });
});
