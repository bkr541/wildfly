import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FlightDestResults from "./FlightDestResults";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(() => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        in:     vi.fn().mockResolvedValue({ data: [] }),
        eq:     vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };
      return chain;
    }),
  },
}));

vi.mock("@/utils/blackoutDates", () => ({
  isBlackoutDate: vi.fn().mockReturnValue(false),
}));

vi.mock("@/utils/airportTime", () => ({
  toAirportUTC: vi.fn().mockReturnValue("2026-07-01T10:00:00Z"),
}));

vi.mock("@/lib/logSettings", () => ({
  fetchDeveloperSettings: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/FlightLegTimeline", () => ({
  default: () => null,
}));

// Minimal framer-motion stub — strips motion-specific props so they don't
// appear as unknown DOM attributes in jsdom.
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(
      (
        { children, initial: _i, animate: _a, exit: _e, transition: _t, drag: _d,
          dragControls: _dc, dragListener: _dl, dragConstraints: _dcons,
          dragElastic: _de, onDragEnd: _ode, ...rest }:
          Record<string, unknown> & { children?: React.ReactNode },
        ref: React.Ref<HTMLDivElement>,
      ) => <div ref={ref} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>,
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDragControls: () => ({ start: vi.fn() }),
}));

vi.mock("@/components/BottomSheet", () => ({
  BottomSheet: ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) =>
    open ? (
      <div data-testid="bottom-sheet" role="dialog">
        <button type="button" onClick={onClose} aria-label="Close dialog">Close</button>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/flight-share/FlightShareTemplate", () => ({
  FlightShareTemplate: React.forwardRef(
    (_props: unknown, ref: React.Ref<HTMLDivElement>) => <div ref={ref} data-testid="share-template" />,
  ),
}));

vi.mock("@/utils/exportFlightShareImage", () => ({
  exportFlightShareImage: vi.fn(),
  buildShareFilename: vi.fn().mockReturnValue("BOS-LAX-2026-07-01.png"),
}));

// Use the new sharedFlightResults service (not the old flightSearchShares).
vi.mock("@/services/sharedFlightResults", () => ({
  createSharedFlightResult:    vi.fn(),
  getPublicSharedFlightResult: vi.fn(),
}));

// Mock flight-search API — must NEVER be called from the share dialog.
// FlightDestResults.tsx does not import flightApi directly (those calls live in
// Flights.tsx), but we mock the module so any accidental import fails loudly.
vi.mock("@/lib/flightApi", () => ({
  fetchFlightSearch: vi.fn(),
  flightApiFetch:    vi.fn(),
}));

vi.mock("@/utils/flightShareModel", () => ({
  buildFlightShareModel: vi.fn(),
  getGoWildInfo: vi.fn().mockReturnValue({ available: false }),
}));

// ── Typed mock helpers ─────────────────────────────────────────────────────────

import { createSharedFlightResult } from "@/services/sharedFlightResults";
import { exportFlightShareImage } from "@/utils/exportFlightShareImage";
import { buildFlightShareModel } from "@/utils/flightShareModel";
import { fetchFlightSearch, flightApiFetch } from "@/lib/flightApi";

const mockCreateShare  = vi.mocked(createSharedFlightResult);
const mockExportImage  = vi.mocked(exportFlightShareImage);
const mockBuildModel   = vi.mocked(buildFlightShareModel);
const mockFetchFlight  = vi.mocked(fetchFlightSearch);
const mockApiFetch     = vi.mocked(flightApiFetch);

// ── Shared test data ───────────────────────────────────────────────────────────

const MOCK_MODEL = {
  originLabel:       "Boston",
  destinationLabel:  "Los Angeles",
  heroImageUrl:      "/hero.jpg",
  arrivalImageUrl:   "/arrival.jpg",
  tripTypeLabel:     "One Way",
  combinedDateLabel: "Jul 1",
  sections:          [],
  totalOptionCount:  3,
  totalNonstopCount: 2,
  totalGoWildCount:  1,
  hasResults:        true,
};

const RESPONSE_DATA = JSON.stringify({
  departureAirport: "BOS",
  arrivalAirport:   "LAX",
  departureDate:    "2026-07-01",
  tripType:         "One Way",
  response:         { flights: [] },
});

const RESPONSE_DATA_ALT = JSON.stringify({
  departureAirport: "ORD",
  arrivalAirport:   "SEA",
  departureDate:    "2026-08-15",
  tripType:         "One Way",
  response:         { flights: [] },
});

const SHARE_RESPONSE = {
  shareId:   "abc123",
  publicUrl: "https://wildfly.app/share/flights/abc123",
  createdAt: "2026-06-13T12:00:00Z",
  expiresAt: null,
};

// ── Render helper ──────────────────────────────────────────────────────────────

function renderFDR(override: { responseData?: string; hideHeader?: boolean } = {}) {
  return render(
    <FlightDestResults
      onBack={vi.fn()}
      responseData={RESPONSE_DATA}
      {...override}
    />,
  );
}

// Gets the first share button in the DOM (compact header or full hero header).
function getShareBtn() {
  return screen.getAllByRole("button", { name: "Share flight results" })[0];
}

// Opens the share dialog and waits for it to appear.
// Must wait for airportLookupComplete to become true first — the effect sets it
// to false synchronously on mount (before async supabase query resolves), which
// disables the button and causes React to suppress the click event.
async function openDialog() {
  const btn = getShareBtn();
  await waitFor(() => expect(btn).not.toBeDisabled());
  fireEvent.click(btn);
  await waitFor(() => expect(screen.getByTestId("bottom-sheet")).toBeInTheDocument());
}

// Opens dialog, creates a public link, and waits for the result panel.
async function showResultPanel() {
  await openDialog();
  fireEvent.click(screen.getByRole("button", { name: /share url/i }));
  await waitFor(() => expect(screen.getByText("Public link created")).toBeInTheDocument());
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockBuildModel.mockReturnValue(MOCK_MODEL as ReturnType<typeof mockBuildModel>);
  mockExportImage.mockResolvedValue(undefined as never);
  mockCreateShare.mockResolvedValue(SHARE_RESPONSE);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Share dialog — open / close", () => {
  it("share button opens the dialog", async () => {
    renderFDR();
    await openDialog();
    expect(screen.getByTestId("bottom-sheet")).toBeInTheDocument();
  });

  it('dialog header shows "Share flight results" title', async () => {
    renderFDR();
    await openDialog();
    expect(screen.getByRole("heading", { name: "Share flight results" })).toBeInTheDocument();
  });

  it("dialog shows both action options", async () => {
    renderFDR();
    await openDialog();
    expect(screen.getByRole("button", { name: /download image/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  it("dialog closes when BottomSheet onClose is called", async () => {
    renderFDR();
    await openDialog();
    // BottomSheet mock renders a Close button that triggers onClose
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => expect(screen.queryByTestId("bottom-sheet")).not.toBeInTheDocument());
  });

  it("shows toast and does NOT open dialog when hasResults is false", async () => {
    mockBuildModel.mockReturnValue({ ...MOCK_MODEL, hasResults: false } as ReturnType<typeof mockBuildModel>);
    renderFDR();
    const btn = getShareBtn();
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    expect(screen.queryByTestId("bottom-sheet")).not.toBeInTheDocument();
  });

  it("opening the popup makes no network request", async () => {
    renderFDR();
    await openDialog();
    // Neither the share service nor the image exporter should have been invoked
    // just by opening the dialog.
    expect(mockCreateShare).not.toHaveBeenCalled();
    expect(mockExportImage).not.toHaveBeenCalled();
  });
});

describe("Download Image", () => {
  it("calls exportFlightShareImage on click", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    await waitFor(() => expect(mockExportImage).toHaveBeenCalledOnce());
  });

  it("passes filename from buildShareFilename to exportFlightShareImage", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    await waitFor(() =>
      expect(mockExportImage).toHaveBeenCalledWith(expect.anything(), "BOS-LAX-2026-07-01.png"),
    );
  });

  it("shows loading text while exporting", async () => {
    let settle!: () => void;
    mockExportImage.mockReturnValue(new Promise<never>(r => { settle = r as () => void; }));
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    await waitFor(() => expect(screen.getByText("Generating image…")).toBeInTheDocument());
    act(() => settle());
  });

  it("Download Image button is disabled while exporting", async () => {
    let settle!: () => void;
    mockExportImage.mockReturnValue(new Promise<never>(r => { settle = r as () => void; }));
    renderFDR();
    await openDialog();
    const btn = screen.getByRole("button", { name: /download image/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    act(() => settle());
  });

  it("closes dialog on successful export", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    await waitFor(() => expect(screen.queryByTestId("bottom-sheet")).not.toBeInTheDocument());
  });

  it("shows inline error on export failure", async () => {
    mockExportImage.mockRejectedValue(new Error("canvas error"));
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    await waitFor(() => expect(screen.getByText("Export failed — try again")).toBeInTheDocument());
  });

  it("re-enables button after export failure so the user can retry", async () => {
    mockExportImage.mockRejectedValueOnce(new Error("fail")).mockResolvedValue(undefined as never);
    renderFDR();
    await openDialog();
    const btn = screen.getByRole("button", { name: /download image/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).not.toBeDisabled());
    // Second attempt succeeds
    fireEvent.click(btn);
    await waitFor(() => expect(mockExportImage).toHaveBeenCalledTimes(2));
  });

  it("Download Image does not call createSharedFlightResult", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    await waitFor(() => expect(mockExportImage).toHaveBeenCalledOnce());
    expect(mockCreateShare).not.toHaveBeenCalled();
  });
});

describe("Share URL", () => {
  it("calls createSharedFlightResult on click", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(mockCreateShare).toHaveBeenCalledOnce());
  });

  it("passes entire parsed responseData as rawSearchPayload", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() =>
      expect(mockCreateShare).toHaveBeenCalledWith(
        expect.objectContaining({
          rawSearchPayload: JSON.parse(RESPONSE_DATA),
        }),
      ),
    );
  });

  it("passes correct full request shape to createSharedFlightResult", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() =>
      expect(mockCreateShare).toHaveBeenCalledWith({
        payloadVersion:      1,
        displayModelVersion: 1,
        rawSearchPayload:    JSON.parse(RESPONSE_DATA),
        displayModel:        MOCK_MODEL,
      }),
    );
  });

  it("passes displayModel separately from rawSearchPayload", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => {
      const call = mockCreateShare.mock.calls[0]?.[0];
      // rawSearchPayload is the full API response, displayModel is the built share model
      expect(call?.rawSearchPayload).toEqual(JSON.parse(RESPONSE_DATA));
      expect(call?.displayModel).toEqual(MOCK_MODEL);
      // They must be separate fields (displayModel is NOT inside rawSearchPayload)
      expect(call?.rawSearchPayload).not.toHaveProperty("originLabel");
      expect(call?.displayModel).toHaveProperty("originLabel", "Boston");
    });
  });

  it("does not call exportFlightShareImage (no image generated for URL share)", async () => {
    renderFDR();
    await showResultPanel();
    expect(mockExportImage).not.toHaveBeenCalled();
  });

  it("shows loading text while creating", async () => {
    let settle!: (v: typeof SHARE_RESPONSE) => void;
    mockCreateShare.mockReturnValue(new Promise(r => { settle = r; }));
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(screen.getByText("Creating link…")).toBeInTheDocument());
    act(() => settle(SHARE_RESPONSE));
  });

  it("Share URL button is disabled while creating", async () => {
    let settle!: (v: typeof SHARE_RESPONSE) => void;
    mockCreateShare.mockReturnValue(new Promise(r => { settle = r; }));
    renderFDR();
    await openDialog();
    const btn = screen.getByRole("button", { name: /share url/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    act(() => settle(SHARE_RESPONSE));
  });

  it("double-clicking Share URL does not submit twice (loading guard)", async () => {
    let settle!: (v: typeof SHARE_RESPONSE) => void;
    mockCreateShare.mockReturnValue(new Promise(r => { settle = r; }));
    renderFDR();
    await openDialog();
    const btn = screen.getByRole("button", { name: /share url/i });
    fireEvent.click(btn);
    fireEvent.click(btn); // second click while loading
    act(() => settle(SHARE_RESPONSE));
    await waitFor(() => expect(screen.getByText("Public link created")).toBeInTheDocument());
    expect(mockCreateShare).toHaveBeenCalledTimes(1);
  });

  it("shows result panel with public URL on success", async () => {
    renderFDR();
    await showResultPanel();
    expect(screen.getByText("https://wildfly.app/share/flights/abc123")).toBeInTheDocument();
  });

  it("shows UNAUTHENTICATED error with sign-in message", async () => {
    mockCreateShare.mockRejectedValue({ kind: "UNAUTHENTICATED", name: "SharedFlightResultError", message: "Unauthenticated" });
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() =>
      expect(screen.getByText("Sign in to create a shareable link")).toBeInTheDocument(),
    );
  });

  it("shows VALIDATION error with specific message", async () => {
    mockCreateShare.mockRejectedValue({ kind: "VALIDATION", name: "SharedFlightResultError", message: "Validation" });
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() =>
      expect(screen.getByText("Could not process these flight results")).toBeInTheDocument(),
    );
  });

  it("shows PAYLOAD_TOO_LARGE error explaining results are too large", async () => {
    mockCreateShare.mockRejectedValue({ kind: "PAYLOAD_TOO_LARGE", name: "SharedFlightResultError", message: "Too large" });
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() =>
      expect(screen.getByText("These results are too large to share as a URL")).toBeInTheDocument(),
    );
  });

  it("shows generic error for SERVER_ERROR", async () => {
    mockCreateShare.mockRejectedValue({ kind: "SERVER_ERROR", name: "SharedFlightResultError", message: "Server" });
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() =>
      expect(screen.getByText("Failed to create link — try again")).toBeInTheDocument(),
    );
  });

  it("shows generic error for plain Error (unknown thrown value)", async () => {
    mockCreateShare.mockRejectedValue(new Error("network failure"));
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() =>
      expect(screen.getByText("Failed to create link — try again")).toBeInTheDocument(),
    );
  });

  it("re-enables button after error so the user can retry", async () => {
    mockCreateShare.mockRejectedValueOnce(new Error("fail")).mockResolvedValue(SHARE_RESPONSE);
    renderFDR();
    await openDialog();
    const btn = screen.getByRole("button", { name: /share url/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => expect(mockCreateShare).toHaveBeenCalledTimes(2));
  });
});

describe("Result panel", () => {
  it("shows Copy and Open actions", async () => {
    renderFDR();
    await showResultPanel();
    expect(screen.getByRole("button", { name: "Copy public link" })).toBeInTheDocument();
    expect(screen.getByRole("link",   { name: "Open public link in new tab" })).toBeInTheDocument();
  });

  it("copy button writes URL to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderFDR();
    await showResultPanel();
    fireEvent.click(screen.getByRole("button", { name: "Copy public link" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("https://wildfly.app/share/flights/abc123"),
    );
  });

  it('copy button shows "Copied!" feedback after success', async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    renderFDR();
    await showResultPanel();
    fireEvent.click(screen.getByRole("button", { name: "Copy public link" }));
    await waitFor(() => expect(screen.getByText("Copied!")).toBeInTheDocument());
  });

  it("Open link has correct href, target, and rel", async () => {
    renderFDR();
    await showResultPanel();
    const link = screen.getByRole("link", { name: "Open public link in new tab" });
    expect(link).toHaveAttribute("href", "https://wildfly.app/share/flights/abc123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it('"Create another link" resets to the options panel', async () => {
    renderFDR();
    await showResultPanel();
    fireEvent.click(screen.getByText("Create another link"));
    await waitFor(() => expect(screen.getByRole("button", { name: /download image/i })).toBeInTheDocument());
    expect(screen.queryByText("Public link created")).not.toBeInTheDocument();
  });

  it("Share button appears only when navigator.share is available", async () => {
    Object.defineProperty(window.navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
    });
    renderFDR();
    await showResultPanel();
    expect(screen.getByRole("button", { name: "Share link via system share sheet" })).toBeInTheDocument();
    // Cleanup
    Object.defineProperty(window.navigator, "share", { value: undefined, configurable: true });
  });

  it("native Share button calls navigator.share with URL and title", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", { value: mockShare, configurable: true });
    renderFDR();
    await showResultPanel();
    fireEvent.click(screen.getByRole("button", { name: "Share link via system share sheet" }));
    await waitFor(() =>
      expect(mockShare).toHaveBeenCalledWith({
        url:   "https://wildfly.app/share/flights/abc123",
        title: "Boston → Los Angeles Flights",
      }),
    );
    Object.defineProperty(window.navigator, "share", { value: undefined, configurable: true });
  });
});

// ── Explicit network-isolation assertions ─────────────────────────────────────
//
// These tests protect the boundary between stored-result sharing and
// scraper-backed searching. Creating a share URL must ONLY call
// createSharedFlightResult — it must never trigger a flight search, call
// flight-proxy, consume search credits, or rerun a Playwright session.
//
// If any of these assertions fail it means a code change accidentally wired
// the share action to the live search infrastructure.

describe("Network isolation — share creation never calls flight search", () => {
  it("Share URL calls createSharedFlightResult and not fetchFlightSearch", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(mockCreateShare).toHaveBeenCalledOnce());
    // fetchFlightSearch drives the scraper-backed live search; it must never fire
    // as a side-effect of creating a share URL.
    expect(mockFetchFlight).not.toHaveBeenCalled();
  });

  it("Share URL calls createSharedFlightResult and not flightApiFetch", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(mockCreateShare).toHaveBeenCalledOnce());
    // flightApiFetch is the low-level transport for all scraper/proxy calls; must be silent.
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("Download Image calls exportFlightShareImage and not fetchFlightSearch", async () => {
    renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));
    await waitFor(() => expect(mockExportImage).toHaveBeenCalledOnce());
    expect(mockFetchFlight).not.toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(mockCreateShare).not.toHaveBeenCalled();
  });

  it("opening the share popup makes no network calls at all", async () => {
    renderFDR();
    await openDialog();
    // Just opening the dialog — no button clicked yet.
    expect(mockCreateShare).not.toHaveBeenCalled();
    expect(mockFetchFlight).not.toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(mockExportImage).not.toHaveBeenCalled();
  });
});

describe("Fingerprint-based cache invalidation", () => {
  it("clears cached public share result when flight data changes", async () => {
    const { rerender } = renderFDR();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(screen.getByText("Public link created")).toBeInTheDocument());

    // Simulate new search results: buildFlightShareModel now returns a different model
    mockBuildModel.mockReturnValue({ ...MOCK_MODEL, originLabel: "Chicago" } as ReturnType<typeof mockBuildModel>);
    rerender(
      <FlightDestResults onBack={vi.fn()} responseData={RESPONSE_DATA_ALT} />,
    );

    // The fingerprint useEffect should clear the result
    await waitFor(() =>
      expect(screen.queryByText("Public link created")).not.toBeInTheDocument(),
    );
  });

  it("preserves the generated link when component re-renders with identical flight data", async () => {
    const { rerender } = renderFDR();
    await showResultPanel();
    expect(screen.getByText("Public link created")).toBeInTheDocument();

    // Re-render with same responseData — fingerprint unchanged
    rerender(<FlightDestResults onBack={vi.fn()} responseData={RESPONSE_DATA} />);

    // Link should still be visible (no reset)
    expect(screen.getByText("Public link created")).toBeInTheDocument();
    // And the service was only called once (no second creation)
    expect(mockCreateShare).toHaveBeenCalledTimes(1);
  });
});
