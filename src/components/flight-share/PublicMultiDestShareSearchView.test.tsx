import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";
import { PublicMultiDestShareSearchView } from "./PublicMultiDestShareSearchView";

function makeModel(overrides: Partial<MultiDestShareModelV2> = {}): MultiDestShareModelV2 {
  const model: MultiDestShareModelV2 = {
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
      destinationCount: 2,
      flightCount: 9,
      nonstopDestinationCount: 2,
      goWildDestinationCount: 1,
    },
    appliedView: {
      sortBy: "fare",
      nonstopOnly: false,
      goWildOnly: false,
      destinationType: "all",
    },
    destinations: [
      {
        destination: "MIA",
        city: "Miami",
        stateCode: "FL",
        country: "United States",
        airportName: "Miami International Airport",
        locationId: null,
        flightCount: 5,
        minFare: 49,
        maxFare: 159,
        isMinFareGoWild: true,
        hasGoWild: true,
        hasNonstop: true,
        nonstopCount: 3,
        avgDurationMin: 190,
        minDurationMin: 175,
        departureWindow: "6:00 AM – 8:00 PM",
        earliestDeparture: "6:00 AM",
      },
      {
        destination: "ATL",
        city: "Atlanta",
        stateCode: "GA",
        country: "United States",
        airportName: "Hartsfield-Jackson Atlanta International Airport",
        locationId: 7,
        flightCount: 4,
        minFare: 79,
        maxFare: 189,
        isMinFareGoWild: false,
        hasGoWild: false,
        hasNonstop: true,
        nonstopCount: 2,
        avgDurationMin: 130,
        minDurationMin: 120,
        departureWindow: "7:00 AM – 9:00 PM",
        earliestDeparture: "7:00 AM",
      },
    ],
    hasResults: true,
  };

  return { ...model, ...overrides };
}

describe("PublicMultiDestShareSearchView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mirrors the FlightMultiDestResults hero while retaining the diagonal image split", () => {
    const { container } = render(
      <PublicMultiDestShareSearchView
        model={makeModel()}
        createdAt="2026-07-14T12:00:00.000Z"
        expiresAt="2099-07-21T12:00:00.000Z"
        publicUrl="https://example.test/share/flights/token"
      />,
    );

    const hero = container.querySelector("[data-public-multi-dest-hero='true']") as HTMLElement;
    const title = hero.querySelector("[data-public-multi-dest-hero-title='true']") as HTMLElement;
    const stats = hero.querySelector("[data-public-multi-dest-hero-stats='true']") as HTMLElement;

    expect(hero.querySelectorAll("img")).toHaveLength(2);
    expect(hero.querySelector("[data-public-multi-dest-hero-tint='true']")).toHaveStyle({
      background: "rgba(8, 18, 32, 0.28)",
    });
    expect(title).toHaveTextContent("Chicago to");
    expect(title).toHaveTextContent("All Destinations");
    expect(stats).toHaveClass("grid-cols-4");
    expect(stats.children).toHaveLength(4);
    expect(Array.from(stats.children).map((item) => item.textContent?.trim())).toEqual([
      "DESTINATIONS2",
      "TOTAL FLIGHTS9",
      "NONSTOP2",
      "GO WILD1",
    ]);

    expect(screen.queryByRole("button", { name: "Download Image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Snapshot created/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available until/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Share details" })).not.toBeInTheDocument();
  });

  it("never renders filter or sorted-by badges above destination cards", () => {
    const { container } = render(
      <PublicMultiDestShareSearchView
        model={makeModel({
          appliedView: {
            sortBy: "duration",
            nonstopOnly: true,
            goWildOnly: true,
            destinationType: "international",
          },
        })}
        createdAt="2026-07-14T12:00:00.000Z"
        expiresAt="2099-07-21T12:00:00.000Z"
        publicUrl="https://example.test/share/flights/token"
      />,
    );

    const main = container.querySelector("main") as HTMLElement;
    expect(within(main).queryByText(/Sorted by/i)).not.toBeInTheDocument();
    expect(within(main).queryByText("Nonstop Only")).not.toBeInTheDocument();
    expect(within(main).queryByText("GoWild Only")).not.toBeInTheDocument();
    expect(within(main).queryByText("International Only")).not.toBeInTheDocument();
  });

  it("renders destination cards when results are present", () => {
    const { container } = render(
      <PublicMultiDestShareSearchView
        model={makeModel()}
        createdAt="2026-07-14T12:00:00.000Z"
        expiresAt="2099-07-21T12:00:00.000Z"
        publicUrl="https://example.test/share/flights/token"
      />,
    );

    const cards = container.querySelectorAll("[data-multi-dest-card]");
    expect(cards).toHaveLength(2);
  });
});
