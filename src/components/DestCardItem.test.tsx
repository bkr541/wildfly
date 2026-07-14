import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DestCardItem, type DestCard } from "./DestCardItem";

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>>(
      ({ children, initial, whileInView, viewport, transition, ...props }, ref) => (
        <div ref={ref} {...props}>{children as React.ReactNode}</div>
      ),
    ),
    img: React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement> & Record<string, unknown>>(
      ({ initial, whileInView, viewport, transition, ...props }, ref) => (
        <img ref={ref} {...props} />
      ),
    ),
  },
  useScroll: () => ({ scrollYProgress: 0 }),
  useTransform: () => 0,
}));

function makeCard(isMinFareGoWild: boolean): DestCard {
  return {
    destination: "MIA",
    city: "Miami",
    stateCode: "FL",
    country: "United States",
    airportName: "Miami International Airport",
    locationId: null,
    flights: [],
    flightCount: 4,
    minFare: 49,
    maxFare: 149,
    isMinFareGoWild,
    hasGoWild: true,
    hasNonstop: true,
    nonstopCount: 2,
    avgDurationMin: 180,
    minDurationMin: 170,
    departureWindow: "6:00 AM – 8:00 PM",
    earliestDeparture: "6:00 AM",
    availableFareTypes: [],
  };
}

describe("DestCardItem minimum fare treatment", () => {
  it("does not color a standard minimum fare green merely because another GoWild fare exists", () => {
    const { container } = render(<DestCardItem card={makeCard(false)} index={0} onViewDest={vi.fn()} />);
    const badge = container.querySelector("[data-min-fare-gowild='false']") as HTMLElement;

    expect(badge).toBeInTheDocument();
    expect(badge.style.background).toBe("rgb(17, 24, 39)");
  });

  it("colors the minimum fare green when that displayed minimum is GoWild", () => {
    const { container } = render(<DestCardItem card={makeCard(true)} index={0} onViewDest={vi.fn()} />);
    const badge = container.querySelector("[data-min-fare-gowild='true']") as HTMLElement;

    expect(badge).toBeInTheDocument();
    expect(badge.style.background).toBe("rgb(5, 150, 105)");
  });
});
