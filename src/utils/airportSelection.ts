export interface AirportSelectionOption {
  name: string;
  iata_code: string;
  locations?: {
    city?: string | null;
    state_code?: string | null;
  } | null;
}

/**
 * Formats the value shown in an airport search field.
 *
 * A multi-airport selection represents a city area when every selected airport
 * belongs to the same city and state. Single-airport selections continue to
 * show the airport code so the user can distinguish an exact airport choice.
 */
export function formatAirportSelectionLabel(
  selected: readonly AirportSelectionOption[],
): string {
  const first = selected[0];
  if (!first) return "";

  const city = first.locations?.city?.trim();
  const stateCode = first.locations?.state_code?.trim();
  const isCityArea =
    selected.length > 1 &&
    Boolean(city) &&
    selected.every(
      (airport) =>
        airport.locations?.city?.trim() === city &&
        airport.locations?.state_code?.trim() === stateCode,
    );

  if (isCityArea) {
    return stateCode ? `${city}, ${stateCode}` : city!;
  }

  return `${first.iata_code} | ${city || first.name}`;
}
