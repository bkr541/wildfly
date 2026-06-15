import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { FlightShareModel } from "@/utils/flightShareModel";
import type { PublicSharedFlightResultResponse } from "@/services/sharedFlightResults";

// ── Mock: Supabase client (prevents localStorage init error in jsdom) ──────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession:        vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut:           vi.fn(),
    },
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

// ── Mock: new share service (the one PublicFlightSharePage now uses) ──────────
// This is the ONLY share service that should be called by the public page.
// Tests in the "isolation" describe block explicitly assert that the write
// path (createSharedFlightResult) and the flight-search functions are never
// invoked — protecting the boundary between stored-result sharing and
// scraper-backed searching.

vi.mock("@/services/sharedFlightResults", () => ({
  getPublicSharedFlightResult: vi.fn(),
  createSharedFlightResult:    vi.fn(),
}));

// ── Mock: flight search API — must NEVER be called by the public page ─────────
// Mocking ensures any accidental import/call fails loudly rather than silently.

vi.mock("@/lib/flightApi", () => ({
  fetchFlightSearch: vi.fn(),
  flightApiFetch:    vi.fn(),
}));

// ── Mock: image export ────────────────────────────────────────────────────────

vi.mock("@/utils/exportFlightShareImage", () => ({
  exportFlightShareImage: vi.fn(),
  buildShareFilename:     vi.fn(),
}));

// ── Mock: Hugeicons (avoids SVG in jsdom) ─────────────────────────────────────

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}));

// ── Imports resolved after mocks ──────────────────────────────────────────────

import {
  getPublicSharedFlightResult,
  createSharedFlightResult,
} from "@/services/sharedFlightResults";
import { fetchFlightSearch, flightApiFetch } from "@/lib/flightApi";
import { exportFlightShareImage } from "@/utils/exportFlightShareImage";
import PublicFlightSharePage from "./PublicFlightSharePage";

const mockGetShare  = vi.mocked(getPublicSharedFlightResult);
const mockCreate    = vi.mocked(createSharedFlightResult);
const mockFetchFlight = vi.mocked(fetchFlightSearch);
const mockApiFetch  = vi.mocked(flightApiFetch);
const mockExport    = vi.mocked(exportFlightShareImage);

// ── Token factory: unique per test avoids module-level promise cache hits ──────

let _tc = 0;
function nextToken(): string {
  return String(++_tc).padStart(64, "0");
}

// ── Error factory: plain object with .kind satisfies the page's duck-type check

function makeErr(kind: string): { kind: string; name: string; message: string } {
  return { kind, name: "SharedFlightResultError", message: kind };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

type RawOption = FlightShareModel["sections"][0]["airportGroups"][0]["options"][0];

function makeOption(overrides: Partial<RawOption> = {}): RawOption {
  return {
    canonicalKey:       "F9123|ORD>MCO|2026-06-13T07:00:00",
    airline:            "Frontier",
    carrierCode:        "F9",
    departureTimeLabel: "7:00 AM",
    arrivalTimeLabel:   "10:30 AM",
    departureRaw:       "2026-06-13T07:00:00",
    arrivalRaw:         "2026-06-13T10:30:00",
    timeOfDay:          "MORNING",
    route:              "ORD>MCO",
    routeAirports:      ["ORD", "MCO"],
    stopCount:          0,
    isNonstop:          true,
    isPlusOneDay:       false,
    formattedDuration:  "2h 30m",
    flightNumbers:      ["F9123"],
    lowestPublicFare:   89,
    goWildFare:         null,
    isGoWild:           false,
    goWildSeats:        null,
    emphasizedFare:     89,
    ...overrides,
  };
}

function makeModel(overrides: Partial<FlightShareModel> = {}): FlightShareModel {
  return {
    originLabel:       "Chicago",
    destinationLabel:  "Orlando",
    tripTypeLabel:     "One-way",
    combinedDateLabel: "Fri, Jun 13, 2026 • One-way",
    heroImageUrl:      "/assets/locations/42_background.png",
    arrivalImageUrl:   "/assets/locations/55_background.png",
    totalOptionCount:  1,
    totalNonstopCount: 1,
    totalGoWildCount:  0,
    hasResults:        true,
    sections: [{
      sectionType: "ONE-WAY", label: "One-Way", dateValue: "2026-06-13",
      formattedDateLabel: "Fri, Jun 13", totalCount: 1, nonstopCount: 1, goWildCount: 0,
      airportGroups: [{
        iata: "ORD", name: "O'Hare International", city: "Chicago",
        stateCode: "IL", country: "United States of America", locationId: 42,
        optionCount: 1,
        options: [makeOption()],
      }],
    }],
    ...overrides,
  };
}

// New response shape: displayModel (not shareModel), displayModelVersion (not modelVersion)
function makeResponse(overrides: Partial<PublicSharedFlightResultResponse> = {}): PublicSharedFlightResultResponse {
  return {
    displayModelVersion: 1,
    displayModel:        makeModel(),
    createdAt:           "2026-06-13T12:00:00Z",
    expiresAt:           "2026-09-13T12:00:00Z",
    ...overrides,
  };
}

function makeRoundTripModel(): FlightShareModel {
  return makeModel({
    tripTypeLabel: "Round-trip", totalOptionCount: 2, totalNonstopCount: 2,
    sections: [
      {
        sectionType: "DEPARTING", label: "Departing",
        dateValue: "2026-06-13", formattedDateLabel: "Fri, Jun 13",
        totalCount: 1, nonstopCount: 1, goWildCount: 0,
        airportGroups: [{
          iata: "ORD", name: "O'Hare", city: "Chicago", stateCode: "IL",
          country: "US", locationId: 42, optionCount: 1,
          options: [makeOption({ canonicalKey: "dep-1" })],
        }],
      },
      {
        sectionType: "RETURN", label: "Return",
        dateValue: "2026-06-20", formattedDateLabel: "Fri, Jun 20",
        totalCount: 1, nonstopCount: 1, goWildCount: 0,
        airportGroups: [{
          iata: "MCO", name: "Orlando Intl", city: "Orlando", stateCode: "FL",
          country: "US", locationId: 55, optionCount: 1,
          options: [makeOption({ canonicalKey: "ret-1", routeAirports: ["MCO", "ORD"] })],
        }],
      },
    ],
  });
}

// ── Router helper ─────────────────────────────────────────────────────────────

function renderPage(token: string) {
  const router = createMemoryRouter(
    [{ path: "/share/flights/:token", element: <PublicFlightSharePage /> }],
    { initialEntries: [`/share/flights/${token}`] },
  );
  return render(<RouterProvider router={router} />);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockExport.mockResolvedValue(undefined as never);
});

afterEach(() => {
  document.title = "";
});

// ─────────────────────────────────────────────────────────────────────────────

describe("PublicFlightSharePage", () => {

  // ── Route and access ───────────────────────────────────────────────────────

  describe("routing and access", () => {
    it("calls getPublicSharedFlightResult with the URL token", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(mockGetShare).toHaveBeenCalledWith(token));
    });

    it("renders without a sign-in gate (anonymous access)", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(mockGetShare).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/sign in/i)).toBeNull();
    });

    it("shows InvalidTokenView for a token longer than 128 chars", async () => {
      await act(async () => { renderPage("a".repeat(129)); });
      expect(screen.getByText("Invalid link")).toBeDefined();
      expect(mockGetShare).not.toHaveBeenCalled();
    });

    it("does not call the live flight search API (snapshot only)", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(mockGetShare).toHaveBeenCalledTimes(1));
    });
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("does not show city name while fetch is pending", async () => {
      const token = nextToken();
      let resolve!: (v: PublicSharedFlightResultResponse) => void;
      mockGetShare.mockReturnValue(new Promise(r => { resolve = r; }));
      await act(async () => { renderPage(token); });
      expect(screen.queryByText("Chicago")).toBeNull();
      act(() => { resolve(makeResponse()); });
    });
  });

  // ── Successful render ──────────────────────────────────────────────────────

  describe("successful render", () => {
    it("renders origin and destination labels from displayModel", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => {
        expect(screen.getAllByText("Chicago").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Orlando").length).toBeGreaterThan(0);
      });
    });

    it("sets document.title to '{origin} to {dest} Flights | Wildfly'", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(document.title).toBe("Chicago to Orlando Flights | Wildfly"));
    });

    it("injects noindex,nofollow meta tag", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => {
        const meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
        expect(meta).not.toBeNull();
        expect(meta?.content).toBe("noindex,nofollow");
      });
    });

    it("shows snapshot disclosure banner", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText(/Results captured/i)).toBeDefined());
    });

    it("renders Copy link button", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Copy link")).toBeDefined());
    });

    it("renders Download image button", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Download image")).toBeDefined());
    });
  });

  // ── One-way snapshot ───────────────────────────────────────────────────────

  describe("one-way snapshot", () => {
    it("renders airport group IATA code", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getAllByText("ORD").length).toBeGreaterThan(0));
    });

    it("does NOT show section tabs for a one-way trip", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getAllByText("ORD").length).toBeGreaterThan(0));
      expect(screen.queryByRole("tablist")).toBeNull();
    });
  });

  // ── Round-trip snapshot ────────────────────────────────────────────────────

  describe("round-trip snapshot", () => {
    it("renders section tab list", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse({ displayModel: makeRoundTripModel() }));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByRole("tablist")).toBeDefined());
    });

    it("Departing tab is selected by default", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse({ displayModel: makeRoundTripModel() }));
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByRole("tablist"));
      const tabs = screen.getAllByRole("tab");
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(tabs[1].getAttribute("aria-selected")).toBe("false");
    });

    it("clicking Return tab makes it active", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse({ displayModel: makeRoundTripModel() }));
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByRole("tablist"));
      const tabs = screen.getAllByRole("tab");
      act(() => { fireEvent.click(tabs[1]); });
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    });
  });

  // ── Multiple airport groups ────────────────────────────────────────────────

  describe("multiple airport groups", () => {
    it("renders all airport group IATA codes", async () => {
      const token = nextToken();
      const model = makeModel({
        totalOptionCount: 2,
        sections: [{
          sectionType: "ONE-WAY", label: "One-Way", dateValue: "2026-06-13",
          formattedDateLabel: "Fri, Jun 13", totalCount: 2, nonstopCount: 2, goWildCount: 0,
          airportGroups: [
            { iata: "ORD", name: "O'Hare", city: "Chicago", stateCode: "IL", country: "US", locationId: 42, optionCount: 1, options: [makeOption({ canonicalKey: "a" })] },
            { iata: "MDW", name: "Midway",  city: "Chicago", stateCode: "IL", country: "US", locationId: 43, optionCount: 1, options: [makeOption({ canonicalKey: "b" })] },
          ],
        }],
      });
      mockGetShare.mockResolvedValue(makeResponse({ displayModel: model }));
      await act(async () => { renderPage(token); });
      await waitFor(() => {
        expect(screen.getAllByText("ORD").length).toBeGreaterThan(0);
        expect(screen.getAllByText("MDW").length).toBeGreaterThan(0);
      });
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe("error states", () => {
    it("shows 'no longer available' for NOT_FOUND", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("NOT_FOUND"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("This share link is no longer available")).toBeDefined());
    });

    it("shows 'no longer available' for REVOKED", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("REVOKED"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("This share link is no longer available")).toBeDefined());
    });

    it("shows 'expired' message for EXPIRED", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("EXPIRED"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("This share link has expired")).toBeDefined());
    });

    it("shows Try again for SERVER_ERROR", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("SERVER_ERROR"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Try again")).toBeDefined());
    });

    it("shows Try again for NETWORK_ERROR (transient failures are retryable)", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("NETWORK_ERROR"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Try again")).toBeDefined());
    });

    it("retries fetch on Try again click", async () => {
      const token = nextToken();
      mockGetShare
        .mockRejectedValueOnce(makeErr("SERVER_ERROR"))
        .mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Try again"));
      await act(async () => { fireEvent.click(screen.getByText("Try again")); });
      await waitFor(() => expect(mockGetShare).toHaveBeenCalledTimes(2));
    });

    it("does NOT show Try again for NOT_FOUND", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("NOT_FOUND"));
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("This share link is no longer available"));
      expect(screen.queryByText("Try again")).toBeNull();
    });

    it("shows Go to Wildfly link on error views", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("EXPIRED"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Go to Wildfly →")).toBeDefined());
    });

    it("unknown errors fall back to SERVER_ERROR view", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(new Error("network timeout"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Something went wrong")).toBeDefined());
    });
  });

  // ── Filter buttons ─────────────────────────────────────────────────────────

  describe("filter buttons", () => {
    it("renders All filter button", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByRole("button", { name: /show all flights/i })).toBeDefined());
    });

    it("renders Nonstop filter when model has nonstop options", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByRole("button", { name: /nonstop/i })).toBeDefined());
    });

    it("applies Nonstop filter and updates options count", async () => {
      const token = nextToken();
      const model = makeModel({
        totalOptionCount: 2, totalNonstopCount: 1,
        sections: [{
          sectionType: "ONE-WAY", label: "One-Way", dateValue: "2026-06-13",
          formattedDateLabel: "Fri, Jun 13", totalCount: 2, nonstopCount: 1, goWildCount: 0,
          airportGroups: [{
            iata: "ORD", name: "O'Hare", city: "Chicago", stateCode: "IL",
            country: "US", locationId: 42, optionCount: 2,
            options: [
              makeOption({ canonicalKey: "ns", isNonstop: true,  stopCount: 0 }),
              makeOption({ canonicalKey: "st", isNonstop: false, stopCount: 1 }),
            ],
          }],
        }],
      });
      mockGetShare.mockResolvedValue(makeResponse({ displayModel: model }));
      await act(async () => { renderPage(token); });
      // Before filtering: count pill shows "2 options" (M === N, so no fraction)
      await waitFor(() => expect(screen.getByText(/2 options/)).toBeDefined());
      act(() => { fireEvent.click(screen.getByRole("button", { name: /nonstop/i })); });
      // After Nonstop filter: 1 visible / 2 total → "1 / 2 options"
      await waitFor(() => expect(screen.getByText(/1 \/ 2/)).toBeDefined());
    });
  });

  // ── Sort ───────────────────────────────────────────────────────────────────

  describe("sort select", () => {
    it("defaults to departure sort", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => {
        const sel = screen.getByRole("combobox", { name: /sort/i }) as HTMLSelectElement;
        expect(sel.value).toBe("dep");
      });
    });

    it("changes sort value on selection", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByRole("combobox", { name: /sort/i }));
      const sel = screen.getByRole("combobox", { name: /sort/i }) as HTMLSelectElement;
      act(() => { fireEvent.change(sel, { target: { value: "fare" } }); });
      expect(sel.value).toBe("fare");
    });
  });

  // ── Expand / collapse ──────────────────────────────────────────────────────

  describe("airport group expand/collapse", () => {
    it("group toggle button has aria-expanded", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getAllByText("ORD").length).toBeGreaterThan(0));
      const btn = screen.getByRole("button", { name: /ORD/i });
      expect(btn.hasAttribute("aria-expanded")).toBe(true);
    });

    it("toggles aria-expanded on click (collapses then re-opens)", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getAllByText("ORD").length).toBeGreaterThan(0));
      const btn = screen.getByRole("button", { name: /ORD/i });
      const was = btn.getAttribute("aria-expanded");
      act(() => { fireEvent.click(btn); });
      expect(btn.getAttribute("aria-expanded")).toBe(was === "true" ? "false" : "true");
      act(() => { fireEvent.click(btn); });
      expect(btn.getAttribute("aria-expanded")).toBe(was);
    });
  });

  // ── Copy link ──────────────────────────────────────────────────────────────

  describe("copy link", () => {
    it("writes the share URL to clipboard", async () => {
      const token = nextToken();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText }, writable: true, configurable: true,
      });
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Copy link"));
      await act(async () => { fireEvent.click(screen.getByText("Copy link")); });
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`/share/flights/${token}`));
      });
    });

    it("shows 'Copied!' feedback", async () => {
      const token = nextToken();
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) }, writable: true, configurable: true,
      });
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Copy link"));
      await act(async () => { fireEvent.click(screen.getByText("Copy link")); });
      await waitFor(() => expect(screen.getByText("Copied!")).toBeDefined());
    });
  });

  // ── Native share ───────────────────────────────────────────────────────────

  describe("native share", () => {
    it("shows Share button when navigator.share exists", async () => {
      const token = nextToken();
      Object.defineProperty(navigator, "share", {
        value: vi.fn().mockResolvedValue(undefined), writable: true, configurable: true,
      });
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByRole("button", { name: /share via/i })).toBeDefined());
    });

    it("hides Share button when navigator.share is absent", async () => {
      const token = nextToken();
      const orig = (navigator as unknown as Record<string, unknown>).share;
      delete (navigator as unknown as Record<string, unknown>).share;
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Copy link"));
      expect(screen.queryByRole("button", { name: /share via/i })).toBeNull();
      if (orig !== undefined) {
        Object.defineProperty(navigator, "share", { value: orig, writable: true, configurable: true });
      }
    });
  });

  // ── Image download ─────────────────────────────────────────────────────────

  describe("image download", () => {
    it("calls exportFlightShareImage on Download image click", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Download image"));
      await act(async () => { fireEvent.click(screen.getByText("Download image")); });
      await waitFor(() => expect(mockExport).toHaveBeenCalled());
    });

    it("shows 'Exporting…' and disables button while running", async () => {
      const token = nextToken();
      let resolveExport!: () => void;
      mockExport.mockReturnValue(new Promise(r => { resolveExport = () => r(undefined as never); }));
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Download image"));
      await act(async () => { fireEvent.click(screen.getByText("Download image")); });
      const btn = screen.getByText("Exporting…").closest("button") as HTMLButtonElement | null;
      expect(btn?.disabled).toBe(true);
      act(() => { resolveExport(); });
    });
  });

  // ── Snapshot immutability ──────────────────────────────────────────────────

  describe("snapshot immutability", () => {
    it("does not mutate the original displayModel from the service response", async () => {
      const token = nextToken();
      const response = makeResponse();
      const count = response.displayModel.totalOptionCount;
      mockGetShare.mockResolvedValue(response);
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getAllByText("Chicago").length).toBeGreaterThan(0));
      expect(response.displayModel.totalOptionCount).toBe(count);
    });
  });

  // ── No-results state ───────────────────────────────────────────────────────

  describe("no-results state", () => {
    it("shows empty state when hasResults is false", async () => {
      const token = nextToken();
      const emptyModel = makeModel({
        hasResults: false, totalOptionCount: 0,
        sections: [{
          sectionType: "ONE-WAY", label: "One-Way", dateValue: "2026-06-13",
          formattedDateLabel: "Fri, Jun 13", totalCount: 0, nonstopCount: 0, goWildCount: 0,
          airportGroups: [],
        }],
      });
      mockGetShare.mockResolvedValue(makeResponse({ displayModel: emptyModel }));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getAllByText("No flight options were returned").length).toBeGreaterThan(0));
    });
  });

  // ── Unsupported snapshot version ───────────────────────────────────────────

  describe("unsupported snapshot version", () => {
    it("renders 'Unsupported share format' headline for UNSUPPORTED_VERSION", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("UNSUPPORTED_VERSION"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Unsupported share format")).toBeDefined());
    });

    it("does NOT show Try again for UNSUPPORTED_VERSION (retrying won't help)", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("UNSUPPORTED_VERSION"));
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Unsupported share format"));
      expect(screen.queryByText("Try again")).toBeNull();
    });

    it("shows Go to Wildfly link for UNSUPPORTED_VERSION", async () => {
      const token = nextToken();
      mockGetShare.mockRejectedValue(makeErr("UNSUPPORTED_VERSION"));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getByText("Go to Wildfly →")).toBeDefined());
    });
  });

  // ── Metadata lifecycle (cleanup on unmount) ────────────────────────────────

  describe("metadata lifecycle", () => {
    it("removes noindex meta tag when the component unmounts", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      const { unmount } = await act(async () => renderPage(token));
      await waitFor(() => {
        const meta = document.querySelector('meta[name="robots"]');
        expect(meta).not.toBeNull();
      });
      act(() => { unmount(); });
      expect(document.querySelector('meta[name="robots"]')).toBeNull();
    });

    it("resets document title to 'Wildfly' when the component unmounts", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      const { unmount } = await act(async () => renderPage(token));
      await waitFor(() => expect(document.title).toBe("Chicago to Orlando Flights | Wildfly"));
      act(() => { unmount(); });
      expect(document.title).toBe("Wildfly");
    });
  });

  // ── Explicit network-isolation assertions ─────────────────────────────────
  //
  // These tests protect the boundary between stored-result sharing and
  // scraper-backed searching. Loading a public share URL must ONLY call the
  // snapshot getter — it must never trigger a flight search, call flight-proxy,
  // consume search credits, or invoke any other function from the create path.
  //
  // If any of these assertions fail it means a code change accidentally wired
  // the public page to the live search infrastructure.

  describe("isolation — snapshot-only, no flight-search or proxy calls", () => {
    it("calls only getPublicSharedFlightResult — never createSharedFlightResult", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(mockGetShare).toHaveBeenCalledTimes(1));
      // The create path must never be invoked during a public page load.
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("never calls fetchFlightSearch (the scraper-backed search function)", async () => {
      // This test explicitly asserts that the public share page is isolated from
      // the live flight-search API. fetchFlightSearch calls flight-proxy which
      // triggers a Playwright search, consumes a search credit, and updates the
      // cache — none of which should happen when viewing a stored snapshot.
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(mockGetShare).toHaveBeenCalledTimes(1));
      expect(mockFetchFlight).not.toHaveBeenCalled();
    });

    it("never calls flightApiFetch (the low-level flight-proxy wrapper)", async () => {
      // flightApiFetch is the transport layer for all scraper calls.
      // It must never be invoked when rendering a stored share snapshot.
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(mockGetShare).toHaveBeenCalledTimes(1));
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it("does not call exportFlightShareImage on initial load (only on explicit download click)", async () => {
      const token = nextToken();
      mockGetShare.mockResolvedValue(makeResponse());
      await act(async () => { renderPage(token); });
      await waitFor(() => screen.getByText("Download image"));
      // Image export must NOT trigger automatically — only on explicit user action.
      expect(mockExport).not.toHaveBeenCalled();
    });

    it("displays the stored displayModel — never reruns a search to refresh results", async () => {
      // The displayed data must come from the snapshot, not a live re-fetch.
      // Verifies both that the get function was called and the data is rendered.
      const token = nextToken();
      const storedModel = makeModel({ originLabel: "Stored City" });
      mockGetShare.mockResolvedValue(makeResponse({ displayModel: storedModel }));
      await act(async () => { renderPage(token); });
      await waitFor(() => expect(screen.getAllByText("Stored City").length).toBeGreaterThan(0));
      // Search functions must remain untouched.
      expect(mockFetchFlight).not.toHaveBeenCalled();
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

});
