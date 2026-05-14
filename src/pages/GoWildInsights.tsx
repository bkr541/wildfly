import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import GoWildSnapshotCard from "@/components/insights/GoWildSnapshotCard";
import AirportGoWildInsightsSection from "@/components/insights/AirportGoWildInsightsSection";
import GoWildRouteAnalyticsSection from "@/components/insights/GoWildRouteAnalyticsSection";
import GoWildTimingAnalyticsSection from "@/components/insights/GoWildTimingAnalyticsSection";
import SeatAvailabilityIntelligence from "@/components/insights/SeatAvailabilityIntelligence";
import { type FlightSnapshot } from "@/components/insights/airportHelpers";
import { groupLegsIntoItineraries } from "@/components/insights/itineraryHelpers";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const SELECT_FIELDS =
  "id, source_itinerary_id, leg_index, origin_iata, destination_iata, leg_origin_iata, leg_destination_iata, departure_at, arrival_at, snapshot_at, has_go_wild, go_wild_available_seats, go_wild_total, standard_total, flight_search_id";

type PeriodKey = "24h" | "7d" | "30d" | "all";

const PERIODS: { key: PeriodKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: null },
];

// Hard safety cap to protect the browser; UI explains when it kicks in.
const HARD_ROW_CAP = 5000;

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

const GoWildInsightsPage = () => {
  const [snapshots, setSnapshots] = useState<FlightSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const { dict: airportDict } = useAirportDictionary();

  const sinceIso = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)!;
    if (p.hours === null) return null;
    return new Date(Date.now() - p.hours * 3600 * 1000).toISOString();
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      let query = (supabase.from("flight_snapshots") as any)
        .select(SELECT_FIELDS)
        .order("snapshot_at", { ascending: false })
        .limit(HARD_ROW_CAP);
      if (sinceIso) query = query.gte("snapshot_at", sinceIso);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) setError(error.message);
      else setSnapshots(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sinceIso]);

  const capReached = snapshots.length >= HARD_ROW_CAP;

  return (
    <div className="px-5 pt-4 pb-8 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              period === p.key
                ? "bg-emerald-600 text-white"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {capReached && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          Showing the most recent {HARD_ROW_CAP.toLocaleString()} snapshots in this period for performance. Narrow the period for complete coverage.
        </div>
      )}

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <ErrorCard message={error} />
      ) : (
        <GoWildSnapshotCard snapshots={snapshots as any} />
      )}

      {!loading && !error && (
        <>
          <AirportGoWildInsightsSection snapshots={snapshots} airportDict={airportDict} />
          <GoWildRouteAnalyticsSection snapshots={snapshots} airportDict={airportDict} />
          <GoWildTimingAnalyticsSection snapshots={snapshots} />
          <SeatAvailabilityIntelligence snapshots={snapshots} airportDict={airportDict} />
        </>
      )}
    </div>
  );
};

export default GoWildInsightsPage;
