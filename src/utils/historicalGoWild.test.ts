import { describe, expect, it } from "vitest";
import {
  buildHistoricalMultiDestinationPayload,
  fetchHistoricalGoWildSearch,
  getYesterdayLocalIso,
  type HistoricalGoWildRpcClient,
  isStrictlyPastLocalDate,
  parseHistoricalGoWildSearchResult,
} from "./historicalGoWild";

describe("historical GoWild helpers", () => {
  const now = new Date(2026, 6, 1, 12, 0, 0);

  it("caps searches at yesterday in the user's local calendar", () => {
    expect(getYesterdayLocalIso(now)).toBe("2026-06-30");
    expect(isStrictlyPastLocalDate("2026-06-30", now)).toBe(true);
    expect(isStrictlyPastLocalDate("2026-07-01", now)).toBe(false);
    expect(isStrictlyPastLocalDate("2026-07-02", now)).toBe(false);
  });

  it("parses the sanitized RPC response and builds the existing results payload", () => {
    const parsed = parseHistoricalGoWildSearchResult({
      origin: "atl",
      travelDate: "2026-06-30",
      observedAt: "2026-06-29T23:00:00Z",
      source: "stored_search",
      flights: [{ id: "flight-1" }],
    });

    expect(parsed).not.toBeNull();
    const payload = JSON.parse(buildHistoricalMultiDestinationPayload(parsed!));
    expect(payload).toMatchObject({
      departureAirport: "ATL",
      departureDate: "2026-06-30",
      arrivalAirport: "All",
      historical: true,
      response: { flights: [{ id: "flight-1" }] },
    });
  });

  it("rejects malformed RPC payloads", () => {
    expect(parseHistoricalGoWildSearchResult(null)).toBeNull();
    expect(parseHistoricalGoWildSearchResult({ origin: "ATL", travelDate: "today" })).toBeNull();
    expect(parseHistoricalGoWildSearchResult({ origin: "ATLANTA", travelDate: "2026-06-30" })).toBeNull();
  });

  it("invokes the Supabase RPC with its client receiver intact", async () => {
    const client = {
      rest: { called: false },
      async rpc(
        this: { rest: { called: boolean } },
        functionName: "get_public_historical_gowild_search",
        args: { p_origin_iata: string; p_travel_date: string },
      ) {
        this.rest.called = true;
        return {
          data: {
            origin: args.p_origin_iata,
            travelDate: args.p_travel_date,
            observedAt: null,
            source: "stored_search",
            flights: [{ id: functionName }],
          },
          error: null,
        };
      },
    };

    const result = await fetchHistoricalGoWildSearch(
      client as HistoricalGoWildRpcClient,
      "ATL",
      "2026-06-30",
    );

    expect(client.rest.called).toBe(true);
    expect(result?.flights).toEqual([{ id: "get_public_historical_gowild_search" }]);
  });
});
