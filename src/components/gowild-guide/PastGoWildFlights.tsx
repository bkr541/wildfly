import { FormEvent, useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CalendarCheckOut02Icon,
  Clock01Icon,
  GlobalSearchIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { format } from "date-fns";
import FlightDestResults from "@/pages/FlightDestResults";
import FlightMultiDestResults from "@/pages/FlightMultiDestResults";
import { OriginCombobox } from "@/pages/Routes";
import { DatePickerSheet } from "@/components/DatePickerSheet";
import { GuideSectionCard } from "@/components/gowild-guide/GuideSectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";
import { useRouteStats } from "@/hooks/useRouteStats";
import {
  buildHistoricalMultiDestinationPayload,
  fetchHistoricalGoWildSearch,
  type HistoricalGoWildRpcClient,
  isStrictlyPastLocalDate,
  toLocalIsoDate,
} from "@/utils/historicalGoWild";

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

interface PastGoWildFlightsProps {
  onResultsModeChange?: (showingResults: boolean) => void;
}

export function PastGoWildFlights({ onResultsModeChange }: PastGoWildFlightsProps = {}) {
  const { dict: airportDict } = useAirportDictionary();
  const { hubsSorted } = useRouteStats(null);
  const [airport, setAirport] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsPayload, setResultsPayload] = useState<string | null>(null);
  const [detailPayload, setDetailPayload] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState<string | null>(null);

  const maxDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }, []);

  useEffect(() => {
    onResultsModeChange?.(Boolean(resultsPayload));
    return () => onResultsModeChange?.(false);
  }, [onResultsModeChange, resultsPayload]);

  const resetToSearch = () => {
    setResultsPayload(null);
    setDetailPayload(null);
    setObservedAt(null);
    onResultsModeChange?.(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!airport || !hubsSorted.some((hub) => hub.iata === airport)) {
      setError("Choose a valid Frontier airport before searching.");
      return;
    }
    const travelDate = date ? toLocalIsoDate(date) : "";
    if (!travelDate || !isStrictlyPastLocalDate(travelDate)) {
      setError("Choose a date before today. Today and future dates are unavailable here.");
      return;
    }

    setLoading(true);
    try {
      // Historical guide searches are intentionally database-only. This RPC never
      // calls flight-proxy, consumes search credits, or writes a new flight search.
      const result = await fetchHistoricalGoWildSearch(
        supabase as unknown as HistoricalGoWildRpcClient,
        airport,
        travelDate,
      );
      if (!result || result.flights.length === 0) {
        setError(
          `No stored All Destinations results were found for ${airport} on ${travelDate}. Try another airport or earlier date.`,
        );
        return;
      }

      setObservedAt(result.observedAt);
      setResultsPayload(buildHistoricalMultiDestinationPayload(result));
      setDetailPayload(null);
      onResultsModeChange?.(true);
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
    return (
      <div className="h-screen min-h-[680px] w-full bg-[#F1F5F5] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
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
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <GuideSectionCard
        icon={Clock01Icon}
        title="Explore Past GoWild Flights"
        subtitle="Replay a stored All Destinations result without running a live search."
        className="overflow-visible"
        headerClassName="hidden lg:flex"
        bodyClassName="px-4 pt-4 pb-5 lg:px-5"
      >
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="hidden rounded-2xl border border-[#DDE7E4] bg-[#F8FFFB] p-4 lg:block">
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

          <OriginCombobox
            value={airport}
            onChange={(value) => {
              setAirport(value);
              setError(null);
            }}
            hubsSorted={hubsSorted}
            airportDict={airportDict}
            label="Departure Airport"
          />

          <div>
            <DatePickerSheet
              open={dateSheetOpen}
              onClose={() => setDateSheetOpen(false)}
              label="Past Travel Date"
              selected={date}
              onSelect={(selectedDate) => {
                setDate(selectedDate);
                setError(null);
              }}
              maxDate={maxDate}
            />

            <label className="ml-1 mb-0 block cursor-pointer text-sm font-bold text-[#059669]">
              Past Travel Date
            </label>
            <button
              type="button"
              className="app-input-container w-full text-left outline-none"
              style={{ minHeight: 48 }}
              onClick={() => setDateSheetOpen(true)}
            >
              <span className="app-input-icon-btn">
                <HugeiconsIcon
                  icon={CalendarCheckOut02Icon}
                  size={20}
                  color="currentColor"
                  strokeWidth={2}
                />
              </span>
              <span
                className="flex-1 truncate px-[0.8em] py-[0.7em] text-base"
                style={{ color: date ? "#1F2937" : "#6B7280" }}
              >
                {date ? format(date, "MMM d, yyyy") : "Select date"}
              </span>
            </button>
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
