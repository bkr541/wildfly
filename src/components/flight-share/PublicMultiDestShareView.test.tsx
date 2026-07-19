import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MultiDestShareModelV2 } from "@/utils/multiDestShareModel";
import { PublicMultiDestShareView } from "./PublicMultiDestShareView";
import { exportFlightShareImage } from "@/utils/exportFlightShareImage";

vi.mock("@/utils/exportFlightShareImage", () => ({
  buildShareFilename: vi.fn(() => "wildfly-chicago-to-all-destinations-2026-07-18.png"),
  exportFlightShareImage: vi.fn(() => Promise.resolve(new Blob(["png"], { type: "image/png" }))),
}));

function makeModel(): MultiDestShareModelV2 {
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
      destinationCount: 2,
      flightCount: 9,
      nonstopDestinationCount: 2,
      goWildDestinationCount: 1,
    },
    appliedView: {
      sortBy: "fare",
      nonstopOnly: true,
      goWildOnly: false,
      destinationType: "domestic",
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
}

describe("PublicMultiDestShareView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses responsive one, two, and three-column public content", () => {
    const { container } = render(
      <PublicMultiDestShareView
        model={makeModel()}
        createdAt="2026-07-14T12:00:00.000Z"
        expiresAt="2099-07-21T12:00:00.000Z"
        publicUrl="https://example.test/share/flights/token"
      />,
    );
    const publicGrid = container.querySelector("[data-multi-dest-grid='page']");
    const summary = container.querySelector("[data-multi-dest-summary='true']") as HTMLElement;
    const heroActions = container.querySelector("[data-flight-share-hero-actions='true']");
    const downloadButton = screen.getByRole("button", { name: "Download Image" });
    const copyButton = screen.getByRole("button", { name: "Copy Link" });
    const shareButton = screen.getByRole("button", { name: "Share" });

    expect(publicGrid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "xl:grid-cols-3");
    expect(summary.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
    expect(summary.children).toHaveLength(4);
    expect(screen.getByText("Snapshot created Jul 14, 2026")).toBeInTheDocument();
    expect(screen.getByText("Available until Jul 21, 2099")).toBeInTheDocument();
    expect(screen.getByText("Chicago to")).toBeInTheDocument();
    expect(screen.getByText("Sat, Jul 18")).toBeInTheDocument();
    expect(screen.queryByText("Sorted by Lowest Price")).not.toBeInTheDocument();
    expect(heroActions).toContainElement(downloadButton);
    expect(heroActions).toContainElement(copyButton);
    expect(heroActions).toContainElement(shareButton);
    expect(downloadButton.textContent).toBe("");
    expect(copyButton.textContent).toBe("");
    expect(shareButton.textContent).toBe("");
    expect(container.querySelector("a[href]")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("raw_search_payload");
  });

  it("renders expiration state while keeping the immutable snapshot visible", () => {
    render(
      <PublicMultiDestShareView
        model={makeModel()}
        createdAt="2026-07-14T12:00:00.000Z"
        expiresAt="2000-01-01T12:00:00.000Z"
        publicUrl="https://example.test/share/flights/token"
      />,
    );

    expect(screen.getByText("Expired Jan 1, 2000")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("immutable results remain visible");
    expect(screen.getAllByText("MIA").length).toBeGreaterThan(0);
  });

  it("downloads through the off-screen MultiDestShareTemplate", async () => {
    const { container } = render(
      <PublicMultiDestShareView
        model={makeModel()}
        createdAt="2026-07-14T12:00:00.000Z"
        expiresAt={null}
        publicUrl="https://example.test/share/flights/token"
      />,
    );

    expect(container.querySelector("[data-offscreen-multi-dest-template='true'] [data-multi-dest-share-root='true']")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download Image" }));

    await waitFor(() => {
      expect(exportFlightShareImage).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        "wildfly-chicago-to-all-destinations-2026-07-18.png",
      );
    });
  });

  it("offers URL copying without exposing destination-level navigation", () => {
    render(
      <PublicMultiDestShareView
        model={makeModel()}
        createdAt="2026-07-14T12:00:00.000Z"
        publicUrl="https://example.test/share/flights/token"
      />,
    );

    expect(screen.getByRole("button", { name: "Copy Link" })).toBeInTheDocument();
    expect(screen.queryByText(/View \d+ Flights?/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
