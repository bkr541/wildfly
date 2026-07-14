/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FlightMultiDestResults from "./FlightMultiDestResults";

const mocks = vi.hoisted(() => ({
  airportLookup: vi.fn(),
  buildDestCards: vi.fn(),
  createSharedFlightResult: vi.fn(),
  exportFlightShareImage: vi.fn(),
  buildShareFilename: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: (...args: unknown[]) => mocks.airportLookup(...args),
    })),
  },
}));

vi.mock("@/components/DestCardItem", () => ({
  buildDestCards: mocks.buildDestCards,
  DestCardItem: ({ card, onViewDest }: { card: any; onViewDest: (card: any) => void }) => (
    <button type="button" aria-label={`View ${card.destination} flights`} onClick={() => onViewDest(card)}>
      {card.city}
    </button>
  ),
}));

vi.mock("@/components/MultiDestMap", () => ({
  default: () => <div data-testid="destination-map" />,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(
      (
        { children, initial: _initial, animate: _animate, transition: _transition, ...rest }:
          React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>,
        ref: React.Ref<HTMLDivElement>,
      ) => <div ref={ref} {...rest}>{children}</div>,
    ),
  },
}));

vi.mock("@/components/BottomSheet", () => ({
  BottomSheet: ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) =>
    open ? (
      <div role="dialog" data-testid="bottom-sheet">
        <button type="button" aria-label="Close dialog" onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/flight-share/MultiDestShareTemplate", () => ({
  MULTI_DEST_SHARE_EXPORT_WIDTH: 941,
  MultiDestShareTemplate: React.forwardRef(
    ({ model }: { model: any }, ref: React.Ref<HTMLDivElement>) => (
      <div
        ref={ref}
        data-testid="multi-dest-share-template"
        data-order={model.destinations.map((destination: any) => destination.destination).join(",")}
      />
    ),
  ),
}));

vi.mock("@/utils/exportFlightShareImage", () => ({
  exportFlightShareImage: mocks.exportFlightShareImage,
  buildShareFilename: mocks.buildShareFilename,
}));

vi.mock("@/services/sharedFlightResults", () => ({
  createSharedFlightResult: mocks.createSharedFlightResult,
}));

const SOURCE_SEARCH_ID = "11111111-1111-4111-8111-111111111111";
const PUBLIC_URL = "https://wildfly.app/share/flights/share-token";

function makeFlight(destination: string, index: number) {
  return {
    total_duration: "02:30:00",
    is_plus_one_day: false,
    fares: {
      basic: 99 + index,
      economy: null,
      premium: null,
      business: null,
    },
    legs: [{
      origin: "ORD",
      destination,
      departure_time: `2026-07-14T0${index + 6}:00:00`,
      arrival_time: `2026-07-14T${index + 9}:00:00`,
    }],
    rawPayload: {
      source: `raw-${destination}-${index}`,
      fares: { standard: { total: 99 + index } },
    },
  };
}

const PRIMARY_CARDS = [
  {
    destination: "MCO",
    city: "Orlando",
    stateCode: "FL",
    country: "United States of America",
    airportName: "Orlando International Airport",
    locationId: 3,
    flights: [makeFlight("MCO", 0), makeFlight("MCO", 1), makeFlight("MCO", 2)],
    flightCount: 3,
    minFare: 129,
    maxFare: 209,
    isMinFareGoWild: false,
    hasGoWild: false,
    hasNonstop: true,
    nonstopCount: 2,
    avgDurationMin: 150,
    minDurationMin: 140,
    departureWindow: "6:00 AM – 8:00 PM",
    earliestDeparture: "6:00 AM",
    availableFareTypes: [],
  },
  {
    destination: "MIA",
    city: "Miami",
    stateCode: "FL",
    country: "United States of America",
    airportName: "Miami International Airport",
    locationId: 2,
    flights: [makeFlight("MIA", 0), makeFlight("MIA", 1)],
    flightCount: 2,
    minFare: 49,
    maxFare: 149,
    isMinFareGoWild: true,
    hasGoWild: true,
    hasNonstop: true,
    nonstopCount: 2,
    avgDurationMin: 180,
    minDurationMin: 170,
    departureWindow: "7:00 AM – 6:00 PM",
    earliestDeparture: "7:00 AM",
    availableFareTypes: [],
  },
  {
    destination: "CUN",
    city: "Cancun",
    stateCode: "",
    country: "Mexico",
    airportName: "Cancun International Airport",
    locationId: 4,
    flights: [
      makeFlight("CUN", 0),
      makeFlight("CUN", 1),
      makeFlight("CUN", 2),
      makeFlight("CUN", 3),
      makeFlight("CUN", 4),
    ],
    flightCount: 5,
    minFare: 89,
    maxFare: 249,
    isMinFareGoWild: false,
    hasGoWild: true,
    hasNonstop: false,
    nonstopCount: 0,
    avgDurationMin: 210,
    minDurationMin: 195,
    departureWindow: "8:00 AM – 9:00 PM",
    earliestDeparture: "8:00 AM",
    availableFareTypes: [],
  },
];

const ALTERNATE_CARDS = [{
  ...PRIMARY_CARDS[0],
  destination: "SEA",
  city: "Seattle",
  stateCode: "WA",
  airportName: "Seattle-Tacoma International Airport",
  flights: [makeFlight("SEA", 0)],
  flightCount: 1,
  minFare: 79,
}];

const RESPONSE = JSON.stringify({
  sourceFlightSearchId: SOURCE_SEARCH_ID,
  departureAirport: "ORD",
  arrivalAirport: "All",
  departureDate: "2026-07-14",
  arrivalDate: null,
  tripType: "One Way",
  response: { flights: [{ fixture: "primary", rawPayload: { secret: "raw-search-only" } }] },
});

const RESPONSE_ALT = JSON.stringify({
  departureAirport: "ORD",
  arrivalAirport: "All",
  departureDate: "2026-07-21",
  arrivalDate: null,
  tripType: "One Way",
  response: { flights: [{ fixture: "alternate" }] },
});

const AIRPORT_ROWS = [
  { iata_code: "ORD", name: "O'Hare", location_id: 1, latitude: 41.9, longitude: -87.9, locations: { city: "Chicago", state_code: "IL", country: "United States of America" } },
  { iata_code: "MCO", name: "Orlando", location_id: 3, latitude: 28.4, longitude: -81.3, locations: { city: "Orlando", state_code: "FL", country: "United States of America" } },
  { iata_code: "MIA", name: "Miami", location_id: 2, latitude: 25.8, longitude: -80.3, locations: { city: "Miami", state_code: "FL", country: "United States of America" } },
  { iata_code: "CUN", name: "Cancun", location_id: 4, latitude: 21.0, longitude: -86.8, locations: { city: "Cancun", state_code: "", country: "Mexico" } },
  { iata_code: "SEA", name: "Seattle", location_id: 5, latitude: 47.4, longitude: -122.3, locations: { city: "Seattle", state_code: "WA", country: "United States of America" } },
];

function renderPage(responseData = RESPONSE) {
  const onBack = vi.fn();
  const onViewDest = vi.fn();
  const rendered = render(
    <FlightMultiDestResults onBack={onBack} responseData={responseData} onViewDest={onViewDest} />,
  );
  return { ...rendered, onBack, onViewDest };
}

async function waitForShareReady() {
  await waitFor(() => {
    for (const button of screen.getAllByRole("button", { name: "Share destination results" })) {
      expect(button).not.toBeDisabled();
    }
  });
}

async function openShareSheet() {
  await waitForShareReady();
  fireEvent.click(screen.getByTestId("hero-share-destination-results"));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Share destination results" })).toBeInTheDocument());
}

async function createLink() {
  await openShareSheet();
  fireEvent.click(screen.getByRole("button", { name: /share url/i }));
  await waitFor(() => expect(screen.getByText("Public link created")).toBeInTheDocument());
}

function toggleFilter(label: string) {
  const labelNode = screen.getByText(label);
  const row = labelNode.parentElement?.parentElement;
  const button = row?.querySelector("button");
  if (!button) throw new Error(`Missing toggle for ${label}`);
  fireEvent.click(button);
}

beforeEach(() => {
  mocks.airportLookup.mockReset().mockResolvedValue({ data: AIRPORT_ROWS, error: null });
  mocks.buildDestCards.mockReset().mockImplementation((rawFlights: any[]) =>
    rawFlights[0]?.fixture === "alternate" ? ALTERNATE_CARDS : PRIMARY_CARDS,
  );
  mocks.createSharedFlightResult.mockReset().mockResolvedValue({
    shareId: "share-id",
    publicUrl: PUBLIC_URL,
    createdAt: "2026-07-14T12:00:00Z",
    expiresAt: null,
  });
  mocks.exportFlightShareImage.mockReset().mockResolvedValue(new Blob());
  mocks.buildShareFilename.mockReset().mockReturnValue("wildfly-chicago-to-all-destinations-2026-07-14.png");
});

describe("FlightMultiDestResults sharing integration", () => {
  it("renders accessible share controls in the hero and compact header", async () => {
    renderPage();
    expect(screen.getByTestId("hero-share-destination-results")).toBeInTheDocument();
    expect(screen.getByTestId("compact-share-destination-results")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Share destination results" })).toHaveLength(2);
    await waitForShareReady();
  });

  it("disables both share controls until airport metadata settles", async () => {
    let resolveLookup!: (value: any) => void;
    mocks.airportLookup.mockReturnValueOnce(new Promise((resolve) => { resolveLookup = resolve; }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("hero-share-destination-results")).toBeDisabled();
      expect(screen.getByTestId("compact-share-destination-results")).toBeDisabled();
    });

    await act(async () => {
      resolveLookup({ data: AIRPORT_ROWS, error: null });
    });
    await waitForShareReady();
  });

  it("opens and closes the reusable share sheet", async () => {
    renderPage();
    await openShareSheet();
    expect(screen.getByRole("button", { name: /download image/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Share destination results" })).not.toBeInTheDocument());
  });

  it("exports the measurable multi-destination template with a deterministic filename", async () => {
    renderPage();
    await openShareSheet();
    fireEvent.click(screen.getByRole("button", { name: /download image/i }));

    await waitFor(() => expect(mocks.exportFlightShareImage).toHaveBeenCalledTimes(1));
    const [node, filename] = mocks.exportFlightShareImage.mock.calls[0];
    expect(node).toBe(screen.getByTestId("multi-dest-share-template"));
    expect(filename).toBe("wildfly-chicago-to-all-destinations-2026-07-14.png");
    expect(mocks.buildShareFilename).toHaveBeenCalledWith("Chicago", "All Destinations", "2026-07-14");
  });

  it("creates a version-2 URL from exact sortedCards order and keeps raw flights out of displayModel", async () => {
    renderPage();
    await createLink();

    expect(mocks.createSharedFlightResult).toHaveBeenCalledTimes(1);
    const request = mocks.createSharedFlightResult.mock.calls[0][0];
    expect(request).toMatchObject({
      payloadVersion: 1,
      displayModelVersion: 2,
      sourceFlightSearchId: SOURCE_SEARCH_ID,
    });
    expect(request.displayModel.destinations.map((destination: any) => destination.destination)).toEqual(["CUN", "MIA", "MCO"]);
    expect(request.displayModel.appliedView).toEqual({
      sortBy: "city",
      nonstopOnly: false,
      goWildOnly: false,
      destinationType: "all",
    });
    expect(request.displayModel.destinations.every((destination: any) => !("flights" in destination))).toBe(true);
    expect(request.displayModel.destinations.every((destination: any) => !("rawPayload" in destination))).toBe(true);
    expect(request.rawSearchPayload).toEqual(JSON.parse(RESPONSE));
    expect(request.rawSearchPayload.response.flights[0].rawPayload.secret).toBe("raw-search-only");
    expect(request.displayModel).not.toHaveProperty("response");
  });

  it("reflects sort changes in the shared model and invalidates an existing URL", async () => {
    renderPage();
    await createLink();
    expect(screen.getByText("Public link created")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sort destination results" }));
    fireEvent.click(screen.getByRole("button", { name: /lowest price/i }));

    await waitFor(() => expect(screen.queryByText("Public link created")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(mocks.createSharedFlightResult).toHaveBeenCalledTimes(2));

    const request = mocks.createSharedFlightResult.mock.calls[1][0];
    expect(request.displayModel.appliedView.sortBy).toBe("fare");
    expect(request.displayModel.destinations.map((destination: any) => destination.destination)).toEqual(["MIA", "CUN", "MCO"]);
  });

  it("shares only destinations that survive the active filters", async () => {
    renderPage();
    await waitForShareReady();
    fireEvent.click(screen.getByRole("button", { name: "Filter destination results" }));
    toggleFilter("Go Wild! Fares");
    fireEvent.click(screen.getByRole("button", { name: "Domestic" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));

    await openShareSheet();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(mocks.createSharedFlightResult).toHaveBeenCalledTimes(1));

    const request = mocks.createSharedFlightResult.mock.calls[0][0];
    expect(request.displayModel.appliedView).toEqual({
      sortBy: "city",
      nonstopOnly: false,
      goWildOnly: true,
      destinationType: "domestic",
    });
    expect(request.displayModel.destinations.map((destination: any) => destination.destination)).toEqual(["MIA"]);
    expect(request.displayModel.totals).toMatchObject({ destinationCount: 1, flightCount: 2 });
  });

  it("invalidates a generated URL after a new response arrives", async () => {
    const view = renderPage();
    await createLink();
    expect(screen.getByText("Public link created")).toBeInTheDocument();

    view.rerender(
      <FlightMultiDestResults onBack={view.onBack} responseData={RESPONSE_ALT} onViewDest={view.onViewDest} />,
    );

    await waitFor(() => expect(screen.queryByText("Public link created")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("multi-dest-share-template")).toHaveAttribute("data-order", "SEA"));
  });

  it("drops a URL response if the snapshot changes while creation is in flight", async () => {
    let resolveCreate!: (value: any) => void;
    mocks.createSharedFlightResult.mockReturnValueOnce(new Promise((resolve) => { resolveCreate = resolve; }));
    renderPage();
    await openShareSheet();
    fireEvent.click(screen.getByRole("button", { name: /share url/i }));
    await waitFor(() => expect(mocks.createSharedFlightResult).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Sort destination results" }));
    fireEvent.click(screen.getByRole("button", { name: /lowest price/i }));

    await act(async () => {
      resolveCreate({ shareId: "stale-id", publicUrl: PUBLIC_URL, createdAt: "now", expiresAt: null });
    });
    await waitFor(() => expect(screen.queryByText("Public link created")).not.toBeInTheDocument());
  });

  it("guards public URL creation against rapid double-clicks", async () => {
    let resolveCreate!: (value: any) => void;
    mocks.createSharedFlightResult.mockReturnValueOnce(new Promise((resolve) => { resolveCreate = resolve; }));
    renderPage();
    await openShareSheet();
    const button = screen.getByRole("button", { name: /share url/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.createSharedFlightResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({ shareId: "id", publicUrl: PUBLIC_URL, createdAt: "now", expiresAt: null });
    });
    await waitFor(() => expect(screen.getByText("Public link created")).toBeInTheDocument());
  });

  it("does not open sharing or create snapshots when no destinations are visible", async () => {
    renderPage();
    await waitForShareReady();
    fireEvent.click(screen.getByRole("button", { name: "Filter destination results" }));
    toggleFilter("Nonstop Only");
    fireEvent.click(screen.getByRole("button", { name: "Intl" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));

    expect(screen.getByText("No destinations found.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("hero-share-destination-results"));
    expect(await screen.findByRole("status")).toHaveTextContent("No destinations are currently visible to share.");
    expect(screen.queryByRole("heading", { name: "Share destination results" })).not.toBeInTheDocument();
    expect(mocks.exportFlightShareImage).not.toHaveBeenCalled();
    expect(mocks.createSharedFlightResult).not.toHaveBeenCalled();
  });

  it("preserves map, sorting, filtering, back navigation, and destination drill-in behavior", async () => {
    const view = renderPage();
    await waitForShareReady();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View destination map" }));
    });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Route Map" })).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "Close dialog" })[0]);

    fireEvent.click(screen.getByRole("button", { name: "Sort destination results" }));
    fireEvent.click(screen.getByRole("button", { name: /most flights/i }));
    expect(screen.getByTestId("multi-dest-share-template")).toHaveAttribute("data-order", "CUN,MCO,MIA");

    fireEvent.click(screen.getByRole("button", { name: "Filter destination results" }));
    toggleFilter("Nonstop Only");
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(screen.getByTestId("multi-dest-share-template")).toHaveAttribute("data-order", "MCO,MIA");

    fireEvent.click(screen.getByRole("button", { name: "View MCO flights" }));
    expect(view.onViewDest).toHaveBeenCalledTimes(1);
    const drilledPayload = JSON.parse(view.onViewDest.mock.calls[0][0]);
    expect(drilledPayload.arrivalAirport).toBe("MCO");

    fireEvent.click(screen.getAllByRole("button", { name: "Back to flight search" })[1]);
    expect(view.onBack).toHaveBeenCalledTimes(1);
  });
});
