import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FlightShareTemplate } from "./FlightShareTemplate";
import type { FlightShareModel, FlightShareOption, FlightShareAirportGroup } from "@/utils/flightShareModel";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeOption(overrides: Partial<FlightShareOption> = {}): FlightShareOption {
  return {
    canonicalKey: "F9001|ORD>ATL|2026-06-13T06:55:00",
    airline: "Frontier",
    carrierCode: "F9",
    departureTimeLabel: "06:55 AM",
    arrivalTimeLabel: "10:27 AM",
    departureRaw: "2026-06-13T06:55:00",
    arrivalRaw: "2026-06-13T10:27:00",
    timeOfDay: "MORNING",
    route: "ORD>ATL",
    routeAirports: ["ORD", "ATL"],
    stopCount: 0,
    isNonstop: true,
    isPlusOneDay: false,
    formattedDuration: "2h 32m",
    flightNumbers: ["F91596"],
    lowestPublicFare: 145.98,
    goWildFare: null,
    isGoWild: false,
    goWildSeats: null,
    emphasizedFare: 145.98,
    ...overrides,
  };
}

function makeGroup(
  iata: string,
  name: string,
  options: FlightShareOption[],
  overrides: Partial<FlightShareAirportGroup> = {},
): FlightShareAirportGroup {
  return {
    iata,
    name,
    city: iata === "ORD" ? "Chicago" : iata === "MDW" ? "Chicago" : iata,
    stateCode: "IL",
    country: "United States of America",
    locationId: 42,
    optionCount: options.length,
    options,
    ...overrides,
  };
}

/** Representative one-way model: ORD (7 options incl. GoWild + connecting) + MDW (1 option) */
const oneWayModel: FlightShareModel = {
  originLabel: "Chicago",
  destinationLabel: "Atlanta",
  tripTypeLabel: "One-way",
  combinedDateLabel: "Sat, Jun 13, 2026 • One-way",
  heroImageUrl: "/assets/locations/42_background.png",
  totalOptionCount: 8,
  totalNonstopCount: 3,
  totalGoWildCount: 1,
  hasResults: true,
  sections: [
    {
      sectionType: "ONE-WAY",
      label: "One-Way",
      dateValue: "2026-06-13",
      formattedDateLabel: "Sat, Jun 13",
      totalCount: 8,
      nonstopCount: 3,
      goWildCount: 1,
      airportGroups: [
        makeGroup("ORD", "Chicago O'Hare International Airport", [
          // nonstop, standard fare
          makeOption({
            canonicalKey: "key-1",
            routeAirports: ["ORD", "ATL"],
            isNonstop: true,
            stopCount: 0,
            emphasizedFare: 145.98,
            lowestPublicFare: 145.98,
          }),
          // connecting, GoWild, plus-one-day, seats
          makeOption({
            canonicalKey: "key-2",
            departureTimeLabel: "08:00 PM",
            arrivalTimeLabel: "09:05 AM",
            timeOfDay: "EVENING",
            routeAirports: ["ORD", "PHL", "ATL"],
            route: "ORD>PHL>ATL",
            stopCount: 1,
            isNonstop: false,
            isPlusOneDay: true,
            isGoWild: true,
            goWildFare: 114.39,
            goWildSeats: 20,
            emphasizedFare: 114.39,
            lowestPublicFare: null,
            flightNumbers: ["F92112"],
            formattedDuration: "12h 05m",
          }),
          // missing fare
          makeOption({
            canonicalKey: "key-3",
            emphasizedFare: null,
            lowestPublicFare: null,
            goWildFare: null,
            flightNumbers: [],
          }),
          makeOption({ canonicalKey: "key-4", routeAirports: ["ORD", "ATL"], emphasizedFare: 199 }),
          makeOption({ canonicalKey: "key-5", routeAirports: ["ORD", "ATL"], emphasizedFare: 249 }),
          makeOption({ canonicalKey: "key-6", routeAirports: ["ORD", "ATL"], emphasizedFare: 299 }),
          makeOption({ canonicalKey: "key-7", routeAirports: ["ORD", "ATL"], emphasizedFare: 349 }),
        ]),
        makeGroup("MDW", "Chicago Midway International Airport", [
          makeOption({
            canonicalKey: "key-4",
            departureTimeLabel: "11:59 AM",
            arrivalTimeLabel: "03:11 PM",
            timeOfDay: "MIDDAY",
            routeAirports: ["MDW", "ATL"],
            route: "MDW>ATL",
            isNonstop: true,
            stopCount: 0,
            emphasizedFare: 165.98,
            flightNumbers: ["F92144"],
            goWildSeats: 1,
          }),
        ]),
      ],
    },
  ],
};

/** Round-trip model */
const roundTripModel: FlightShareModel = {
  originLabel: "Chicago",
  destinationLabel: "Atlanta",
  tripTypeLabel: "Round-trip",
  combinedDateLabel: "Sat, Jun 13 – Wed, Jun 17, 2026 • Round-trip",
  heroImageUrl: "/assets/locations/42_background.png",
  totalOptionCount: 6,
  totalNonstopCount: 2,
  totalGoWildCount: 0,
  hasResults: true,
  sections: [
    {
      sectionType: "DEPARTING",
      label: "Departing",
      dateValue: "2026-06-13",
      formattedDateLabel: "Sat, Jun 13",
      totalCount: 3,
      nonstopCount: 1,
      goWildCount: 0,
      airportGroups: [
        makeGroup("ORD", "Chicago O'Hare International Airport", [
          makeOption({ canonicalKey: "rt-dep-1" }),
        ]),
      ],
    },
    {
      sectionType: "RETURN",
      label: "Return",
      dateValue: "2026-06-17",
      formattedDateLabel: "Wed, Jun 17",
      totalCount: 3,
      nonstopCount: 1,
      goWildCount: 0,
      airportGroups: [
        makeGroup("ATL", "Hartsfield-Jackson Atlanta International Airport", [
          makeOption({
            canonicalKey: "rt-ret-1",
            routeAirports: ["ATL", "ORD"],
          }),
        ], { iata: "ATL", city: "Atlanta", locationId: 7 }),
      ],
    },
  ],
};

/** Empty model */
const emptyModel: FlightShareModel = {
  originLabel: "Chicago",
  destinationLabel: "Atlanta",
  tripTypeLabel: "One-way",
  combinedDateLabel: "Sat, Jun 13, 2026 • One-way",
  heroImageUrl: "/assets/locations/init_background.png",
  totalOptionCount: 0,
  totalNonstopCount: 0,
  totalGoWildCount: 0,
  hasResults: false,
  sections: [
    {
      sectionType: "ONE-WAY",
      label: "One-Way",
      dateValue: "2026-06-13",
      formattedDateLabel: "Sat, Jun 13",
      totalCount: 0,
      nonstopCount: 0,
      goWildCount: 0,
      airportGroups: [],
    },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FlightShareTemplate", () => {

  // 1. Route labels render
  it("renders origin and destination route labels", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("Chicago")).toBeDefined();
    expect(screen.getByText("Atlanta")).toBeDefined();
  });

  // 2. Summary counts render
  it("renders summary chip counts", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
  });

  // 3. ORD and MDW group headers render
  it("renders both ORD and MDW airport group headers", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    // ORD appears in both the group header and flight route spans; MDW similarly
    expect(screen.getAllByText("ORD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MDW").length).toBeGreaterThan(0);
  });

  // 4. Full airport names render
  it("renders full airport names in group headers", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("Chicago O'Hare International Airport")).toBeDefined();
    expect(screen.getByText("Chicago Midway International Airport")).toBeDefined();
  });

  // 5. Nonstop and stop badges render
  it("renders NONSTOP and 1 STOP badges", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    const nonstopBadges = screen.getAllByText("NONSTOP");
    expect(nonstopBadges.length).toBeGreaterThan(0);
    expect(screen.getByText("1 STOP")).toBeDefined();
  });

  // 6. GoWild label renders
  it("renders GoWild badge on GoWild option", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    const gwBadges = screen.getAllByText("GoWild");
    expect(gwBadges.length).toBeGreaterThan(0);
  });

  // 7. Plus-one-day renders
  it("renders the +1 indicator for plus-one-day arrivals", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("+1")).toBeDefined();
  });

  // 8. Seat grammar renders correctly
  it("renders '20 seats' for 20 GoWild seats and '1 seat' for 1 seat", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("20 seats")).toBeDefined();
    expect(screen.getByText("1 seat")).toBeDefined();
  });

  // 9. Footer text renders
  it("renders footer disclaimer and Wildfly branding", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("Fares and availability may change.")).toBeDefined();
    expect(screen.getByText("Wildfly")).toBeDefined();
    expect(screen.getByText("Shared from")).toBeDefined();
  });

  // 10. Empty model renders without crashing and shows no-results message
  it("renders safely with an empty model (no results)", () => {
    render(<FlightShareTemplate model={emptyModel} />);
    // Hero and route still render
    expect(screen.getAllByText("Chicago").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Atlanta").length).toBeGreaterThan(0);
    // No-results message
    expect(screen.getByText("No flight options were returned")).toBeDefined();
    // Footer still renders
    expect(screen.getByText("Wildfly")).toBeDefined();
  });

  // Round-trip: DEPARTING and RETURN section labels
  it("renders DEPARTING and RETURN section headers for round-trip searches", () => {
    render(<FlightShareTemplate model={roundTripModel} />);
    expect(screen.getByText("Departing")).toBeDefined();
    expect(screen.getByText("Return")).toBeDefined();
  });

  // Option count pills use correct grammar
  it("renders '7 options' for ORD group and '1 option' for MDW group", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("7 options")).toBeDefined();
    expect(screen.getByText("1 option")).toBeDefined();
  });

  // Missing fare renders as em dash
  it("renders an em dash when emphasizedFare is null", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("—")).toBeDefined();
  });

  // Date label renders in hero
  it("renders the combined date label in the hero", () => {
    render(<FlightShareTemplate model={oneWayModel} />);
    expect(screen.getByText("Sat, Jun 13, 2026 • One-way")).toBeDefined();
  });

  // Root has correct data attribute
  it("root element has data-flight-share-root attribute", () => {
    const { container } = render(<FlightShareTemplate model={oneWayModel} />);
    const root = container.querySelector("[data-flight-share-root='true']");
    expect(root).toBeTruthy();
  });

  // forwardRef: ref is attached to root div
  it("forwards ref to the root div", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<FlightShareTemplate model={oneWayModel} ref={ref} />);
    expect(ref.current).toBeTruthy();
    expect(ref.current?.tagName).toBe("DIV");
    expect(ref.current?.getAttribute("data-flight-share-root")).toBe("true");
  });
});
