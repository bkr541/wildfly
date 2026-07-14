import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  MultiDestShareDestination,
  MultiDestShareModelV2,
} from "@/utils/multiDestShareModel";
import { FlightShareTemplate } from "./FlightShareTemplate";
import { MultiDestShareContent } from "./MultiDestShareContent";
import {
  MULTI_DEST_SHARE_EXPORT_WIDTH,
  MultiDestShareTemplate,
} from "./MultiDestShareTemplate";
import type { FlightShareModel } from "@/utils/flightShareModel";

function makeDestination(
  destination: string,
  overrides: Partial<MultiDestShareDestination> = {},
): MultiDestShareDestination {
  return {
    destination,
    city: destination === "JFK" ? "New York" : destination === "MIA" ? "Miami" : "Cancun",
    stateCode: destination === "CUN" ? "" : destination === "JFK" ? "NY" : "FL",
    country: destination === "CUN" ? "Mexico" : "United States",
    airportName: `${destination} International Airport`,
    locationId: destination === "MIA" ? null : 7,
    flightCount: 4,
    minFare: 79,
    maxFare: 179,
    isMinFareGoWild: false,
    hasGoWild: false,
    hasNonstop: true,
    nonstopCount: 2,
    avgDurationMin: 190,
    minDurationMin: 165,
    departureWindow: "6:10 AM – 8:40 PM",
    earliestDeparture: "6:10 AM",
    ...overrides,
  };
}

function makeModel(overrides: Partial<MultiDestShareModelV2> = {}): MultiDestShareModelV2 {
  const destinations = overrides.destinations ?? [
    makeDestination("JFK"),
    makeDestination("MIA", { hasGoWild: true, isMinFareGoWild: false }),
    makeDestination("CUN", { hasGoWild: true, isMinFareGoWild: true, minFare: 39 }),
  ];
  return {
    kind: "multi-destination",
    originCode: "ORD",
    originLabel: "Chicago",
    destinationLabel: "All Destinations",
    tripTypeLabel: "One-way",
    departureDate: "2026-07-18",
    returnDate: null,
    combinedDateLabel: "Sat, Jul 18, 2026 • One-way",
    heroImageUrl: "/assets/locations/42_background.png",
    totals: {
      destinationCount: destinations.length,
      flightCount: destinations.reduce((total, destination) => total + destination.flightCount, 0),
      nonstopDestinationCount: destinations.filter((destination) => destination.hasNonstop).length,
      goWildDestinationCount: destinations.filter((destination) => destination.hasGoWild).length,
    },
    appliedView: {
      sortBy: "city",
      nonstopOnly: false,
      goWildOnly: false,
      destinationType: "all",
    },
    destinations,
    hasResults: destinations.length > 0,
    ...overrides,
  };
}

const legacyV1Model: FlightShareModel = {
  originLabel: "Chicago",
  destinationLabel: "Atlanta",
  tripTypeLabel: "One-way",
  combinedDateLabel: "Sat, Jul 18, 2026 • One-way",
  heroImageUrl: "/assets/locations/42_background.png",
  arrivalImageUrl: "/assets/locations/7_background.png",
  totalOptionCount: 0,
  totalNonstopCount: 0,
  totalGoWildCount: 0,
  hasResults: false,
  sections: [{
    sectionType: "ONE-WAY",
    label: "One-Way",
    dateValue: "2026-07-18",
    formattedDateLabel: "Sat, Jul 18",
    totalCount: 0,
    nonstopCount: 0,
    goWildCount: 0,
    airportGroups: [],
  }],
};

describe("MultiDestShareContent", () => {
  it("renders every model destination exactly once and preserves model order", () => {
    const model = makeModel();
    const { container } = render(<MultiDestShareContent model={model} mode="image" />);
    const cards = Array.from(container.querySelectorAll("[data-multi-dest-card]"));

    expect(cards).toHaveLength(model.destinations.length);
    expect(cards.map((card) => card.getAttribute("data-multi-dest-card"))).toEqual(["JFK", "MIA", "CUN"]);
  });

  it("does not render individual flight rows or live destination navigation", () => {
    render(<MultiDestShareContent model={makeModel()} mode="image" />);

    expect(screen.queryByText(/View \d+ Flights?/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelector("[data-flight-share-option-row]")).not.toBeInTheDocument();
  });

  it("keeps a safe fallback behind destinations with missing images", () => {
    const { container } = render(<MultiDestShareContent model={makeModel()} mode="image" />);
    const miaCard = container.querySelector("[data-multi-dest-card='MIA']");

    expect(screen.getByTestId("destination-image-fallback-MIA")).toBeInTheDocument();
    expect(miaCard?.querySelector("img[alt*='Miami']")).not.toBeInTheDocument();
  });

  it("distinguishes GoWild availability from a GoWild minimum fare", () => {
    const { container } = render(<MultiDestShareContent model={makeModel()} mode="image" />);
    const miaCard = container.querySelector("[data-multi-dest-card='MIA']");
    const cunCard = container.querySelector("[data-multi-dest-card='CUN']");

    expect(miaCard?.querySelector("[data-gowild-available='true']")).toBeTruthy();
    expect(miaCard?.querySelector("[data-min-fare-gowild='false']")).toBeTruthy();
    expect(cunCard?.querySelector("[data-gowild-available='true']")).toBeTruthy();
    expect(cunCard?.querySelector("[data-min-fare-gowild='true']")).toBeTruthy();
    expect(screen.getAllByText("GoWild Available")).toHaveLength(2);
    expect(screen.getByText("GoWild from")).toBeInTheDocument();
  });

  it("renders only active filters plus the selected sort", () => {
    const model = makeModel({
      appliedView: {
        sortBy: "duration",
        nonstopOnly: true,
        goWildOnly: true,
        destinationType: "international",
      },
    });
    render(<MultiDestShareContent model={model} mode="image" />);

    expect(screen.getByText("Sorted by Shortest Duration")).toBeInTheDocument();
    expect(screen.getByText("Nonstop Only")).toBeInTheDocument();
    expect(screen.getByText("GoWild Only")).toBeInTheDocument();
    expect(screen.getByText("International Only")).toBeInTheDocument();
    expect(screen.queryByText("Domestic Only")).not.toBeInTheDocument();
  });

  it("renders the empty destination state without cards", () => {
    const model = makeModel({
      destinations: [],
      hasResults: false,
      totals: {
        destinationCount: 0,
        flightCount: 0,
        nonstopDestinationCount: 0,
        goWildDestinationCount: 0,
      },
    });
    const { container } = render(<MultiDestShareContent model={model} mode="image" />);

    expect(screen.getByText("No destinations were returned")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-multi-dest-card]")).toHaveLength(0);
  });

  it("renders large destination collections without truncating or duplicating cards", () => {
    const destinations = Array.from({ length: 36 }, (_, index) =>
      makeDestination(`D${String(index).padStart(2, "0")}`, { locationId: null }),
    );
    const { container } = render(
      <MultiDestShareContent model={makeModel({ destinations })} mode="image" />,
    );

    const cards = container.querySelectorAll("[data-multi-dest-card]");
    expect(cards).toHaveLength(36);
    expect(cards[0]?.getAttribute("data-multi-dest-card")).toBe("D00");
    expect(cards[35]?.getAttribute("data-multi-dest-card")).toBe("D35");
  });
});

describe("MultiDestShareTemplate", () => {
  it("uses the fixed 941-pixel export width and a deterministic two-column grid", () => {
    const { container } = render(<MultiDestShareTemplate model={makeModel()} />);
    const root = container.querySelector("[data-multi-dest-share-root='true']") as HTMLElement;
    const grid = container.querySelector("[data-multi-dest-grid='image']") as HTMLElement;

    expect(root).toHaveStyle({ width: `${MULTI_DEST_SHARE_EXPORT_WIDTH}px` });
    expect(root).toHaveAttribute("data-export-width", "941");
    expect(grid.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(container.querySelector("button")).not.toBeInTheDocument();
  });

  it("produces stable markup for the same immutable model", () => {
    const first = render(<MultiDestShareTemplate model={makeModel()} />);
    const firstMarkup = first.container.querySelector("[data-multi-dest-share-root]")?.outerHTML;
    first.unmount();
    const second = render(<MultiDestShareTemplate model={makeModel()} />);
    const secondMarkup = second.container.querySelector("[data-multi-dest-share-root]")?.outerHTML;

    expect(secondMarkup).toBe(firstMarkup);
  });

  it("leaves the existing version-1 share template contract unchanged", () => {
    const { container } = render(<FlightShareTemplate model={legacyV1Model} />);

    expect(container.querySelector("[data-flight-share-root='true']")).toBeInTheDocument();
    expect(container.querySelector("[data-multi-dest-share-root]")).not.toBeInTheDocument();
    expect(screen.getByText("No flight options were returned")).toBeInTheDocument();
  });
});
