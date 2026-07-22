import { describe, expect, it } from "vitest";
import { formatAirportSelectionLabel, type AirportSelectionOption } from "./airportSelection";

const airport = (
  iataCode: string,
  city: string | null,
  stateCode: string | null,
  name = `${iataCode} Airport`,
): AirportSelectionOption => ({
  iata_code: iataCode,
  name,
  locations: { city, state_code: stateCode },
});

describe("formatAirportSelectionLabel", () => {
  it("returns an empty value when no airport is selected", () => {
    expect(formatAirportSelectionLabel([])).toBe("");
  });

  it("shows the airport code for an exact airport selection", () => {
    expect(formatAirportSelectionLabel([airport("ORD", "Chicago", "IL")])).toBe("ORD | Chicago");
  });

  it("shows the city area for multiple airports in the same city and state", () => {
    expect(
      formatAirportSelectionLabel([
        airport("MDW", "Chicago", "IL"),
        airport("ORD", "Chicago", "IL"),
      ]),
    ).toBe("Chicago, IL");
  });

  it("does not collapse unrelated airports into a city area label", () => {
    expect(
      formatAirportSelectionLabel([
        airport("ORD", "Chicago", "IL"),
        airport("MKE", "Milwaukee", "WI"),
      ]),
    ).toBe("ORD | Chicago");
  });

  it("falls back to the airport name when city data is unavailable", () => {
    expect(formatAirportSelectionLabel([airport("XYZ", null, null, "Example International Airport")])).toBe(
      "XYZ | Example International Airport",
    );
  });
});
