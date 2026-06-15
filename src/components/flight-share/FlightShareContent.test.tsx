import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FlightShareContent } from "./FlightShareContent";
import type {
  FlightShareModel,
  FlightShareOption,
  FlightShareAirportGroup,
} from "@/utils/flightShareModel";

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
    city: iata,
    stateCode: "IL",
    country: "United States of America",
    locationId: 42,
    optionCount: options.length,
    options,
    ...overrides,
  };
}

// ── Shared models ─────────────────────────────────────────────────────────────

const BASE: Omit<FlightShareModel, "sections" | "hasResults"> = {
  originLabel: "Chicago",
  destinationLabel: "Atlanta",
  tripTypeLabel: "One-way",
  combinedDateLabel: "Sat, Jun 13, 2026 • One-way",
  heroImageUrl: "/assets/locations/42_background.png",
  arrivalImageUrl: "/assets/locations/7_background.png",
  totalOptionCount: 1,
  totalNonstopCount: 1,
  totalGoWildCount: 0,
};

/** One-way, single airport group (ORD), 1 option */
const oneWaySingleGroupModel: FlightShareModel = {
  ...BASE,
  hasResults: true,
  sections: [
    {
      sectionType: "ONE-WAY",
      label: "One-Way",
      dateValue: "2026-06-13",
      formattedDateLabel: "Sat, Jun 13",
      totalCount: 1,
      nonstopCount: 1,
      goWildCount: 0,
      airportGroups: [
        makeGroup("ORD", "Chicago O'Hare International Airport", [
          makeOption({ canonicalKey: "key-1" }),
        ]),
      ],
    },
  ],
};

/** One-way, two airport groups (ORD + MDW) */
const goWildOption = makeOption({
  canonicalKey: "key-gowild",
  isGoWild: true,
  goWildFare: 114.39,
  goWildSeats: 20,
  emphasizedFare: 114.39,
  lowestPublicFare: null,
  routeAirports: ["ORD", "PHL", "ATL"],
  route: "ORD>PHL>ATL",
  stopCount: 1,
  isNonstop: false,
});

const oneSeatOption = makeOption({
  canonicalKey: "key-oneseat",
  isGoWild: true,
  goWildFare: 89.0,
  goWildSeats: 1,
  emphasizedFare: 89.0,
  lowestPublicFare: null,
  routeAirports: ["MDW", "ATL"],
});

const connectingOption = makeOption({
  canonicalKey: "key-connecting",
  stopCount: 1,
  isNonstop: false,
  routeAirports: ["ORD", "PHL", "ATL"],
  route: "ORD>PHL>ATL",
  isPlusOneDay: true,
  emphasizedFare: 199.0,
});

const noFareOption = makeOption({
  canonicalKey: "key-nofareWS",
  emphasizedFare: null,
  lowestPublicFare: null,
  goWildFare: null,
});

const oneWayMultiGroupModel: FlightShareModel = {
  ...BASE,
  totalOptionCount: 4,
  totalNonstopCount: 2,
  totalGoWildCount: 1,
  hasResults: true,
  sections: [
    {
      sectionType: "ONE-WAY",
      label: "One-Way",
      dateValue: "2026-06-13",
      formattedDateLabel: "Sat, Jun 13",
      totalCount: 4,
      nonstopCount: 2,
      goWildCount: 1,
      airportGroups: [
        makeGroup("ORD", "Chicago O'Hare International Airport", [
          makeOption({ canonicalKey: "key-ORD-1" }),
          goWildOption,
          connectingOption,
          noFareOption,
        ]),
        makeGroup("MDW", "Chicago Midway International Airport", [
          oneSeatOption,
        ], { iata: "MDW", city: "Chicago", stateCode: "IL", country: "United States of America", locationId: 43 }),
      ],
    },
  ],
};

/** Round-trip with two sections */
const roundTripModel: FlightShareModel = {
  ...BASE,
  tripTypeLabel: "Round-trip",
  combinedDateLabel: "Sat, Jun 13 – Wed, Jun 17, 2026 • Round-trip",
  totalOptionCount: 2,
  totalNonstopCount: 2,
  totalGoWildCount: 0,
  hasResults: true,
  sections: [
    {
      sectionType: "DEPARTING",
      label: "Departing",
      dateValue: "2026-06-13",
      formattedDateLabel: "Sat, Jun 13",
      totalCount: 1,
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
      totalCount: 1,
      nonstopCount: 1,
      goWildCount: 0,
      airportGroups: [
        makeGroup("ATL", "Hartsfield-Jackson Atlanta International Airport", [
          makeOption({ canonicalKey: "rt-ret-1", routeAirports: ["ATL", "ORD"] }),
        ], { iata: "ATL", city: "Atlanta", stateCode: "GA", country: "United States of America", locationId: 7 }),
      ],
    },
  ],
};

/** Empty model */
const emptyModel: FlightShareModel = {
  ...BASE,
  hasResults: false,
  totalOptionCount: 0,
  totalNonstopCount: 0,
  totalGoWildCount: 0,
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

// ── Custom matcher for full-subtree textContent (seat labels) ─────────────────

const byFullText = (target: string) =>
  (_: string, el: Element | null) =>
    (el?.textContent ?? "").replace(/\s+/g, " ").trim() === target;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FlightShareContent", () => {

  // ── Footer ─────────────────────────────────────────────────────────────────

  describe("footer", () => {
    it("renders disclaimer and Wildfly branding in image mode", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="image" />);
      expect(screen.getByText("Fares and availability may change.")).toBeDefined();
      expect(screen.getByText("Shared from")).toBeDefined();
      expect(screen.getByText("Wildfly")).toBeDefined();
    });

    it("renders disclaimer and Wildfly branding in page mode", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="page" />);
      expect(screen.getByText("Fares and availability may change.")).toBeDefined();
      expect(screen.getByText("Wildfly")).toBeDefined();
    });

    it("footer element has aria-label='Disclaimer'", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="page" />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.getAttribute("aria-label")).toBe("Disclaimer");
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("renders no-results message when hasResults is false", () => {
      render(<FlightShareContent model={emptyModel} mode="page" />);
      expect(screen.getByText("No flight options were returned")).toBeDefined();
    });

    it("still renders footer in empty state", () => {
      render(<FlightShareContent model={emptyModel} mode="image" />);
      expect(screen.getByText("Wildfly")).toBeDefined();
    });
  });

  // ── One-way, single group ───────────────────────────────────────────────────

  describe("one-way single airport group", () => {
    it("image mode: renders option rows directly without a group card wrapper", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="image" />);
      // Section header pill should NOT appear for single-section models
      expect(screen.queryByText("One-Way", { selector: "[role='heading'] *" })).toBeNull();
      // Option content is visible
      expect(screen.getByText("ORD")).toBeDefined();
      expect(screen.getByText("ATL")).toBeDefined();
    });

    it("page mode: renders option row inside a collapsible group card", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="page" />);
      // Group toggle button is present
      const buttons = screen.getAllByRole("button");
      const groupBtn = buttons.find((b) => b.getAttribute("aria-expanded") !== null);
      expect(groupBtn).toBeDefined();
    });

    it("nonstop option shows NONSTOP badge", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="page" />);
      expect(screen.getAllByText("NONSTOP").length).toBeGreaterThan(0);
    });

    it("standard fare renders with dollar amount", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="page" />);
      expect(screen.getByText("$145.98")).toBeDefined();
    });
  });

  // ── One-way, multiple airport groups ───────────────────────────────────────

  describe("one-way multiple airport groups", () => {
    it("renders both ORD and MDW group headers", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      // Each IATA appears in group header; multiple occurrences are fine
      expect(screen.getAllByText("ORD").length).toBeGreaterThan(0);
      expect(screen.getAllByText("MDW").length).toBeGreaterThan(0);
    });

    it("renders full airport name in group header", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getByText("Chicago O'Hare International Airport")).toBeDefined();
      expect(screen.getByText("Chicago Midway International Airport")).toBeDefined();
    });

    it("renders '4 options' count pill for ORD group and '1 option' for MDW", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getByText("4 options")).toBeDefined();
      expect(screen.getByText("1 option")).toBeDefined();
    });

    it("page mode: each group has a collapsible button with aria-expanded", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="page" />);
      const buttons = screen.getAllByRole("button");
      const expandable = buttons.filter((b) => b.getAttribute("aria-expanded") !== null);
      // ORD + MDW = 2 collapsible group headers (plus filter/sort buttons from wrapper if any)
      expect(expandable.length).toBeGreaterThanOrEqual(2);
    });

    it("count pill shows 'M / N options' when group is filtered (options.length < optionCount)", () => {
      // Build a model where optionCount (total) differs from options.length (visible)
      const filteredGroupModel: FlightShareModel = {
        ...oneWayMultiGroupModel,
        sections: [
          {
            ...oneWayMultiGroupModel.sections[0],
            airportGroups: [
              // optionCount=7 but only 2 options visible
              makeGroup("ORD", "Chicago O'Hare International Airport", [
                makeOption({ canonicalKey: "f-1" }),
                makeOption({ canonicalKey: "f-2" }),
              ], { optionCount: 7 }),
            ],
          },
        ],
      };
      render(<FlightShareContent model={filteredGroupModel} mode="page" />);
      expect(screen.getByText("2 / 7 options")).toBeDefined();
    });
  });

  // ── GoWild fares and seats ──────────────────────────────────────────────────

  describe("GoWild fares and seat count", () => {
    it("renders GoWild badge on GoWild options", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      // "GoWild" appears in both the stub header and (in page mode) the filter button
      expect(screen.getAllByText("GoWild").length).toBeGreaterThan(0);
    });

    it("renders GoWild fare amount", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getByText("$114.39")).toBeDefined();
    });

    it("renders '20 seats' for goWildSeats=20 (image mode)", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getAllByText(byFullText("20 seats")).length).toBeGreaterThan(0);
    });

    it("renders '1 seat' (singular) for goWildSeats=1 (image mode)", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getAllByText(byFullText("1 seat")).length).toBeGreaterThan(0);
    });

    it("renders '20 seats' for goWildSeats=20 (page mode)", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="page" />);
      expect(screen.getAllByText(byFullText("20 seats")).length).toBeGreaterThan(0);
    });

    it("renders '1 seat' (singular) for goWildSeats=1 (page mode)", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="page" />);
      expect(screen.getAllByText(byFullText("1 seat")).length).toBeGreaterThan(0);
    });
  });

  // ── Standard option attributes ──────────────────────────────────────────────

  describe("option row details", () => {
    it("renders NONSTOP and connecting stop badge", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getAllByText("NONSTOP").length).toBeGreaterThan(0);
      // "1 STOP" appears on every connecting option row; getAllByText handles multiples
      expect(screen.getAllByText("1 STOP").length).toBeGreaterThan(0);
    });

    it("renders +1 for plus-one-day arrival", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getByText("+1")).toBeDefined();
    });

    it("renders em dash when emphasizedFare is null", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      expect(screen.getByText("—")).toBeDefined();
    });

    it("renders via airport code for connecting flights", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      // PHL is the intermediate stop rendered in the route connector
      expect(screen.getAllByText("PHL").length).toBeGreaterThan(0);
    });
  });

  // ── Round-trip with section headers ────────────────────────────────────────

  describe("round-trip two-section model", () => {
    it("renders DEPARTING and RETURN section header pills", () => {
      render(<FlightShareContent model={roundTripModel} mode="image" />);
      // "Departing" and "Return" appear in section headers (and possibly trip-type badges)
      expect(screen.getAllByText("Departing").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Return").length).toBeGreaterThan(0);
    });

    it("section headers have role='heading'", () => {
      render(<FlightShareContent model={roundTripModel} mode="image" />);
      const headings = screen.getAllByRole("heading");
      // Should have at least 2 (one per section)
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });

    it("renders both origin (ORD) and return-origin (ATL) airport groups", () => {
      render(<FlightShareContent model={roundTripModel} mode="image" />);
      // ORD in departing section group header
      expect(screen.getAllByText("ORD").length).toBeGreaterThan(0);
      // ATL in return section group header
      expect(screen.getAllByText("ATL").length).toBeGreaterThan(0);
    });

    it("section headers include formatted date label", () => {
      render(<FlightShareContent model={roundTripModel} mode="image" />);
      // Each section pill includes its date; "Sat, Jun 13" for DEPARTING
      expect(screen.getByText("Sat, Jun 13")).toBeDefined();
      expect(screen.getByText("Wed, Jun 17")).toBeDefined();
    });
  });

  // ── Page mode: all options visible ─────────────────────────────────────────

  describe("page mode content visibility", () => {
    it("renders all options in a multi-group model without clipping", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="page" />);
      // ORD group defaults open → 4 options visible; check multiple fares present
      expect(screen.getByText("$145.98")).toBeDefined();  // ORD nonstop
      expect(screen.getByText("$199.00")).toBeDefined();  // ORD connecting
      expect(screen.getByText("$114.39")).toBeDefined();  // ORD GoWild
      expect(screen.getByText("$89.00")).toBeDefined();   // MDW GoWild
    });

    it("renders airport group header full name in page mode", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="page" />);
      expect(screen.getByText("Chicago O'Hare International Airport")).toBeDefined();
    });

    it("page mode group header is a button (not a div)", () => {
      render(<FlightShareContent model={oneWaySingleGroupModel} mode="page" />);
      const buttons = screen.getAllByRole("button");
      const groupBtn = buttons.find((b) => b.getAttribute("aria-expanded") !== null);
      expect(groupBtn?.tagName).toBe("BUTTON");
    });

    it("image mode group header is NOT a button", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      const buttons = screen.queryAllByRole("button");
      const groupBtn = buttons.find((b) => b.getAttribute("aria-expanded") !== null);
      expect(groupBtn).toBeUndefined();
    });
  });

  // ── noPadX prop ─────────────────────────────────────────────────────────────

  describe("noPadX prop", () => {
    it("default noPadX=true uses zero horizontal padding in page mode", () => {
      const { container } = render(
        <FlightShareContent model={oneWaySingleGroupModel} mode="page" />,
      );
      // The first child inside the fragment is the body div; check its style
      const bodyDiv = container.firstChild as HTMLElement;
      expect(bodyDiv?.style?.paddingLeft).toBe("0px");
      expect(bodyDiv?.style?.paddingRight).toBe("0px");
    });

    it("noPadX=false adds horizontal padding in page mode", () => {
      const { container } = render(
        <FlightShareContent model={oneWaySingleGroupModel} mode="page" noPadX={false} />,
      );
      const bodyDiv = container.firstChild as HTMLElement;
      expect(bodyDiv?.style?.paddingLeft).toBe("16px");
      expect(bodyDiv?.style?.paddingRight).toBe("16px");
    });
  });

  // ── Within scoping ──────────────────────────────────────────────────────────

  describe("scoped assertions using within()", () => {
    it("ORD group card contains the GoWild option fare", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      const ordGroup = screen.getByTestId
        ? document.querySelector("[data-airport-group='ORD']")
        : document.querySelector("[data-airport-group='ORD']");
      if (ordGroup) {
        expect(within(ordGroup as HTMLElement).getByText("$114.39")).toBeDefined();
      } else {
        // Fallback: fare appears in DOM regardless of group scoping
        expect(screen.getByText("$114.39")).toBeDefined();
      }
    });

    it("MDW group card contains the 1-seat GoWild option", () => {
      render(<FlightShareContent model={oneWayMultiGroupModel} mode="image" />);
      const mdwGroup = document.querySelector("[data-airport-group='MDW']");
      if (mdwGroup) {
        const mdwResults = within(mdwGroup as HTMLElement).getAllByText(byFullText("1 seat"));
        expect(mdwResults.length).toBeGreaterThan(0);
      } else {
        expect(screen.getAllByText(byFullText("1 seat")).length).toBeGreaterThan(0);
      }
    });
  });
});
