import { FormEvent, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirportIcon,
  Calendar03Icon,
  Clock01Icon,
  GlobalSearchIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import FlightDestResults from "@/pages/FlightDestResults";
import FlightMultiDestResults from "@/pages/FlightMultiDestResults";
import { GuideSectionCard } from "@/components/gowild-guide/GuideSectionCard";
import { supabase } from "@/integrations/supabase/client";
import {
  activeFrontierStationCodes,
  marketDetailsByCode,
} from "@/lib/frontierMarketOfferings";
import {
  buildHistoricalMultiDestinationPayload,
  getYesterdayLocalIso,
  isStrictlyPastLocalDate,
  parseHistoricalGoWildSearchResult,
} from "@/utils/historicalGoWild";

interface HistoricalRpcError {
  message?: string;
}

type HistoricalRpc = (
  functionName: "get_public_historical_gowild_search",
  args: { p_origin_iata: string; p_travel_date: string },
) => Promise<{ data: unknown; error: HistoricalRpcError | null }>;

interface AirportOption {
  code: string;
  name: string;
  stateCode: string;
  searchText: string;
}

const AIRPORT_OPTIONS: AirportOption[] = Array.from(activeFrontierStationCodes)
  .map((code) => {
    const station = marketDetailsByCode.get(code);
    return {
      code,
      name: station?.stationName ?? code,
      stateCode: station?.stateCode ?? "",
      searchText: [
        code,
        station?.stationName,
        station?.cityAndCode,
        station?.state,
        station?.stateCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

function resolveAirport(value: string): AirportOption | null {
  const trimmed = value.trim();
  const exactCode = trimmed.toUpperCase();
  const byCode = AIRPORT_OPTIONS.find((airport) => airport.code === exactCode);
  if (byCode) return byCode;

  const lowered = trimmed.toLowerCase();
  return (
    AIRPORT_OPTIONS.find(
      (airport) =>
        airport.name.toLowerCase() === lowered ||
        `${airport.name}, ${airport.stateCode}`.toLowerCase() === lowered,
    ) ?? null
  );
}

function formatObservedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PastGoWildFlights() {
  const [airportInput, setAirportInput] = useState("");
  const [selectedAirport, setSelectedAirport] = useState<AirportOption | null>(null);
  const [date, setDate] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsPayload, setResultsPayload] = useState<string | null>(null);
  const [detailPayload, setDetailPayload] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState<string | null>(null);

  const maxDate = useMemo(() => getYesterdayLocalIso(), []);

  const suggestions = useMemo(() => {
    const query = airportInput.trim().toLowerCase();
    if (!query) return AIRPORT_OPTIONS.slice(0, 8);
    return AIRPORT_OPTIONS.filter((airport) => airport.searchText.includes(query)).slice(0, 8);
  }, [airportInput]);

  const selectAirport = (airport: AirportOption) => {
    setSelectedAirport(airport);
    setAirportInput(airport.code);
    setShowSuggestions(false);
    setError(null);
  };

  const resetToSearch = () => {
    setResultsPayload(null);
    setDetailPayload(null);
    setObservedAt(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const airport = selectedAirport ?? resolveAirport(airportInput);
    if (!airport) {
      setError("Choose a valid Frontier airport before searching.");
      return;
    }
    if (!date || !isStrictlyPastLocalDate(date)) {
      setError("Choose a date before today. Today and future dates are unavailable here.");
      return;
    }

    setLoading(true);
    try {
      // Historical guide searches are intentionally database-only. This RPC never
      // calls flight-proxy, consumes search credits, or writes a new flight search.
      const historicalRpc = supabase.rpc as unknown as HistoricalRpc;
      const { data, error: rpcError } = await historicalRpc(
        "get_public_historical_gowild_search",
        {
          p_origin_iata: airport.code,
          p_travel_date: date,
        },
      );

      if (rpcError) throw rpcError;

      const result = parseHistoricalGoWildSearchResult(data);
      if (!result || result.flights.length === 0) {
        setError(
          `No stored All Destinations results were found for ${airport.code} on ${date}. Try another airport or earlier date.`,
        );
        return;
      }

      setSelectedAirport(airport);
      setAirportInput(airport.code);
      setObservedAt(result.observedAt);
      setResultsPayload(buildHistoricalMultiDestinationPayload(result));
      setDetailPayload(null);
    } catch (searchError: unknown) {
      const message =
        searchError && typeof searchError === "object" && "message" in searchError
          ? String(searchError.message)
          : null;
      setError(
        message ??
          "Past flight results could not be loaded. Please try another airport or date.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (resultsPayload) {
    const formattedObservedAt = formatObservedAt(observedAt);

    return (
      <div className="px-0 pb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BBF7D0] bg-white/90 px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0FDF4]">
                <HugeiconsIcon icon={Clock01Icon} size={17} color="#059669" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1A2E2E]">Historical snapshot</p>
                <p className="text-xs leading-relaxed text-[#6B7B7B]">
                  These are stored results only. No live Frontier search was started.
                  {formattedObservedAt ? ` Snapshot captured ${formattedObservedAt}.` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetToSearch}
              className="rounded-full border border-[#10B981] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#059669] transition-colors hover:bg-[#F0FDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
            >
              New Search
            </button>
          </div>
        </div>

        <div className="mx-auto h-[calc(100vh-12rem)] min-h-[680px] max-w-6xl overflow-hidden rounded-t-3xl border border-[#DDE7E4] bg-[#F1F5F5] shadow-xl lg:rounded-3xl">
          {detailPayload ? (
            <FlightDestResults
              onBack={() => setDetailPayload(null)}
              responseData={detailPayload}
              onBackOverride={() => setDetailPayload(null)}
            />
          ) : (
            <FlightMultiDestResults
              onBack={resetToSearch}
              responseData={resultsPayload}
              onViewDest={setDetailPayload}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <GuideSectionCard
        icon={Clock01Icon}
        title="Explore Past GoWild Flights"
        subtitle="Replay a stored All Destinations result without running a live search."
      >
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="rounded-2xl border border-[#DDE7E4] bg-[#F8FFFB] p-4">
            <div className="flex items-start gap-2.5">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                size={18}
                color="#059669"
                strokeWidth={2}
                className="mt-0.5 shrink-0"
              />
              <p className="text-xs leading-relaxed text-[#4B6462]">
                Choose the airport the original All Destinations search departed from, then pick a past travel date. Results come only from stored Wildfly records.
              </p>
            </div>
          </div>

          <div className="relative">
            <label htmlFor="past-gowild-airport" className="mb-1.5 block text-sm font-bold text-[#059669]">
              Departure airport
            </label>
            <div className="app-input-container bg-white">
              <span className="app-input-icon-btn pointer-events-none" aria-hidden="true">
                <HugeiconsIcon icon={AirportIcon} size={20} color="currentColor" strokeWidth={2} />
              </span>
              <input
                id="past-gowild-airport"
                type="text"
                value={airportInput}
                onChange={(event) => {
                  setAirportInput(event.target.value);
                  setSelectedAirport(null);
                  setShowSuggestions(true);
                  setError(null);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                placeholder="Search city or airport code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls="past-gowild-airport-options"
                className="app-input bg-white"
              />
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div
                id="past-gowild-airport-options"
                role="listbox"
                className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-[#DDE7E4] bg-white p-2 shadow-[0_18px_45px_rgba(26,46,46,0.16)]"
              >
                {suggestions.map((airport) => (
                  <button
                    key={airport.code}
                    type="button"
                    role="option"
                    aria-selected={selectedAirport?.code === airport.code}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectAirport(airport)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#F0FDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0FDF4] text-xs font-black text-[#047857]">
                      {airport.code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[#1A2E2E]">{airport.name}</span>
                      {airport.stateCode && (
                        <span className="block text-xs text-[#7A8B89]">{airport.stateCode}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="past-gowild-date" className="mb-1.5 block text-sm font-bold text-[#059669]">
              Past travel date
            </label>
            <div className="app-input-container bg-white">
              <span className="app-input-icon-btn pointer-events-none" aria-hidden="true">
                <HugeiconsIcon icon={Calendar03Icon} size={20} color="currentColor" strokeWidth={2} />
              </span>
              <input
                id="past-gowild-date"
                type="date"
                value={date}
                max={maxDate}
                onChange={(event) => {
                  setDate(event.target.value);
                  setError(null);
                }}
                className="app-input bg-white"
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-[#7A8B89]">Today and future dates are disabled.</p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm font-medium text-[#B91C1C]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] px-6 text-sm font-black uppercase tracking-[0.22em] text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#10B981]/35"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Loading History
              </>
            ) : (
              <>
                Search Past Flights
                <HugeiconsIcon icon={GlobalSearchIcon} size={19} color="white" strokeWidth={2} />
              </>
            )}
          </button>
        </form>
      </GuideSectionCard>
    </div>
  );
}
