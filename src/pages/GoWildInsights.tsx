import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import GoWildSnapshotCard from "@/components/insights/GoWildSnapshotCard";
import AirportGoWildInsightsSection from "@/components/insights/AirportGoWildInsightsSection";
import GoWildRouteAnalyticsSection from "@/components/insights/GoWildRouteAnalyticsSection";
import GoWildTimingAnalyticsSection from "@/components/insights/GoWildTimingAnalyticsSection";
import SeatAvailabilityIntelligence from "@/components/insights/SeatAvailabilityIntelligence";
import { type FlightSnapshot } from "@/components/insights/airportHelpers";
import { useAirportDictionary, type AirportDict } from "@/hooks/useAirportDictionary";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

const SkeletonCard = () => (
  <div className="rounded-2xl bg-white p-5" style={{ boxShadow: CARD_SHADOW }}>
    <div className="animate-pulse flex flex-col gap-3">
      <div className="h-12 w-32 bg-gray-100 rounded-xl" />
      <div className="h-4 w-52 bg-gray-100 rounded-lg" />
      <div className="h-8 w-44 bg-gray-100 rounded-full mt-1" />
      <div className="border-t border-gray-100 my-1" />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="h-8 w-12 bg-gray-100 rounded-lg" />
          <div className="h-3 w-16 bg-gray-100 rounded" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-3 w-28 bg-gray-100 rounded" />
          <div className="h-8 w-12 bg-gray-100 rounded-lg" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </div>
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
  const { dict: airportDict } = useAirportDictionary();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.from("flight_snapshots") as any)
        .select(
          "id, flight_search_id, snapshot_at, departure_at, leg_origin_iata, leg_destination_iata, origin_iata, has_go_wild, go_wild_available_seats, go_wild_total, standard_total"
        )
        .order("snapshot_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) setError(error.message);
      else setSnapshots(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-5 pt-4 pb-8 flex flex-col gap-4">
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
          <GoWildRouteAnalyticsSection snapshots={snapshots} />
          <GoWildTimingAnalyticsSection snapshots={snapshots} />
          <SeatAvailabilityIntelligence snapshots={snapshots} airportDict={airportDict} />
        </>
      )}
    </div>
  );
};

export default GoWildInsightsPage;
