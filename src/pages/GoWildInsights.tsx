import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import GoWildSnapshotCard from "@/components/insights/GoWildSnapshotCard";
import AirportGoWildInsightsSection from "@/components/insights/AirportGoWildInsightsSection";
import GoWildRouteAnalyticsSection from "@/components/insights/GoWildRouteAnalyticsSection";
import GoWildTimingAnalyticsSection from "@/components/insights/GoWildTimingAnalyticsSection";
import SeatAvailabilityIntelligence from "@/components/insights/SeatAvailabilityIntelligence";
import { type FlightSnapshot } from "@/components/insights/airportHelpers";
import { groupIntoItineraries } from "@/components/insights/itineraryHelpers";
import type { RawSnapshotRow } from "@/components/insights/insightTypes";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const SkeletonCard = () => (
  <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
    <div className="animate-pulse flex flex-col gap-3">
      <div className="h-12 w-32 bg-gray-100 rounded-xl" />
      <div className="h-4 w-52 bg-gray-100 rounded-lg" />
      <div className="h-8 w-44 bg-gray-100 rounded-full mt-1" />
    </div>
  </div>
);

const ErrorCard = ({ message }: { message: string }) => (
  <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
    <p className="text-sm text-red-500 font-medium">Failed to load data</p>
    <p className="text-xs text-gray-400 mt-1">{message}</p>
  </div>
);

// Default range = last 30 days. We paginate beyond Supabase's 1000 row default.
const DAYS_BACK = 30;
const PAGE_SIZE = 1000;
const MAX_ROWS = 10000;

const COLUMNS =
  "id, source_itinerary_id, leg_index, origin_iata, leg_origin_iata, leg_destination_iata, departure_at, arrival_at, snapshot_at, has_go_wild, go_wild_available_seats, go_wild_total, standard_total, flight_search_id";

const GoWildInsightsPage = () => {
  const [rawRows, setRawRows] = useState<RawSnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dict: airportDict } = useAirportDictionary();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
      const collected: RawSnapshotRow[] = [];
      let from = 0;
      while (from < MAX_ROWS) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await (supabase.from("flight_snapshots") as any)
          .select(COLUMNS)
          .gte("snapshot_at", since)
          .order("snapshot_at", { ascending: false })
          .range(from, to);
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        const batch: RawSnapshotRow[] = data ?? [];
        collected.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      if (cancelled) return;
      setRawRows(collected);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const itineraries = useMemo(() => groupIntoItineraries(rawRows), [rawRows]);

  // Build legacy FlightSnapshot[] for the still-leg-level Availability Heatmap card.
  const legacySnapshots = useMemo<FlightSnapshot[]>(
    () =>
      rawRows.map((r) => ({
        id: r.id,
        flight_search_id: null,
        snapshot_at: r.snapshot_at,
        departure_at: r.departure_at,
        leg_origin_iata: r.leg_origin_iata,
        leg_destination_iata: r.leg_destination_iata,
        origin_iata: r.origin_iata,
        has_go_wild: r.has_go_wild,
        go_wild_total: r.go_wild_total,
        standard_total: r.standard_total,
        go_wild_available_seats: r.go_wild_available_seats,
      })),
    [rawRows]
  );

  return (
    <div className="px-5 pt-4 pb-8 flex flex-col gap-4">
      <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 px-4 py-3">
        <p className="text-xs text-emerald-800">
          Connecting itineraries count as <strong>GoWild-available</strong> only when
          every leg is GoWild-available. Seat availability uses the lowest seat count
          across the itinerary. All metrics below are based on the last {DAYS_BACK} days
          of snapshot data.
        </p>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <ErrorCard message={error} />
      ) : (
        <GoWildSnapshotCard itineraries={itineraries} />
      )}

      {!loading && !error && (
        <>
          <AirportGoWildInsightsSection
            itineraries={itineraries}
            snapshots={legacySnapshots}
            airportDict={airportDict}
          />
          <GoWildRouteAnalyticsSection itineraries={itineraries} airportDict={airportDict} />
          <GoWildTimingAnalyticsSection itineraries={itineraries} />
          <SeatAvailabilityIntelligence itineraries={itineraries} airportDict={airportDict} />
        </>
      )}
    </div>
  );
};

export default GoWildInsightsPage;
