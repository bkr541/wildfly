import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodaysGoWildFlights } from "./TodaysGoWildFlights";
import { useTodaysGoWildFlights } from "@/hooks/useTodaysGoWildFlights";

vi.mock("framer-motion", () => ({
  motion: {
    article: React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & Record<string, unknown>>(
      ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...rest }, ref) => (
        <article ref={ref} {...rest}>{children}</article>
      ),
    ),
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>>(
      ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...rest }, ref) => (
        <div ref={ref} {...rest}>{children}</div>
      ),
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useTodaysGoWildFlights", () => ({
  useTodaysGoWildFlights: vi.fn(),
}));

const mockUseTodaysGoWildFlights = vi.mocked(useTodaysGoWildFlights);

beforeEach(() => {
  mockUseTodaysGoWildFlights.mockReturnValue({
    feed: {
      status: "ready",
      homeAirport: "ATL",
      flights: [
        {
          id: "flight-1",
          itineraryKey: "ATL-AUS-1",
          airline: "Frontier",
          flightNumber: "F91242",
          originIata: "ATL",
          destinationIata: "AUS",
          destinationCity: "Austin",
          destinationState: "TX",
          destinationTimezone: "America/Chicago",
          departureDate: "2026-07-10",
          departureTime: "5:01 AM",
          arrivalDate: "2026-07-10",
          arrivalTime: "9:32 AM",
          flightType: "Connect",
          stops: 1,
          duration: "5 hrs 31 min",
          cabin: "Economy",
          goWildPrice: 25.21,
          standardPrice: 89,
          availableSeats: 18,
          currency: "USD",
        },
      ],
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe("TodaysGoWildFlights", () => {
  it("uses the compact watched-flight card language without duplicate route metadata", () => {
    render(<TodaysGoWildFlights />);

    expect(screen.getByText("Today's GoWild From ATL")).toBeInTheDocument();
    expect(screen.getByText("F91242")).toBeInTheDocument();
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
    expect(screen.getByText("ATL")).toBeInTheDocument();
    expect(screen.getByText("AUS")).toBeInTheDocument();
    expect(screen.getByText("5:01 AM")).toBeInTheDocument();
    expect(screen.getByText("9:32 AM")).toBeInTheDocument();
    expect(screen.getAllByText("Fri, Jul 10, 2026")).toHaveLength(2);

    expect(screen.getAllByTestId("flight-route-plane")).toHaveLength(1);
    expect(screen.getByLabelText("18 GoWild seats available")).toHaveTextContent("18");
    expect(screen.getByText("GoWild")).toBeInTheDocument();
    expect(screen.getByText("One Way")).toBeInTheDocument();
    expect(screen.getByText("$25.21")).toBeInTheDocument();

    expect(screen.queryByText("Connect")).not.toBeInTheDocument();
    expect(screen.queryByText("1 stop")).not.toBeInTheDocument();
    expect(screen.queryByText("5 hrs 31 min")).not.toBeInTheDocument();
    expect(screen.queryByText(/seats seen/i)).not.toBeInTheDocument();
  });
});
