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
  "id, source_itinerary_id, leg_index, origin_iata, leg_origin_iata, leg_destination_iata, departure_at, arrival_at, snapshot_at, has_go_wild, go_wild_available_seats, go_wild_total, standard_total, stops, flight_search_id";

type PeriodKey = "24h" | "7d" | "30d" | "all";

const PERIODS: { key: PeriodKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: null },
];

// Supabase per-request response ceiling. We page through the full result set.
const PAGE_SIZE = 1000;
// Defensive ceiling to avoid a runaway loop (= 200k rows).
const MAX_PAGES = 200;

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

  // Current-period cutoff (used to scope analytics for the other cards).
  const currentSinceIso = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)!;
    if (p.hours === null) return null;
    return new Date(Date.now() - p.hours * 3600 * 1000).toISOString();
  }, [period]);

  // Fetch cutoff — double the window so the Snapshot card has the prior
  // equal-length period available for the trend comparison. "All time" stays null.
  const sinceIso = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)!;
    if (p.hours === null) return null;
    return new Date(Date.now() - p.hours * 2 * 3600 * 1000).toISOString();
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSnapshots([]);

    (async () => {
      const all: FlightSnapshot[] = [];
      try {
        for (let page = 0; page < MAX_PAGES; page++) {
          if (cancelled) return;
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;

          let q = (supabase.from("flight_snapshots") as any)
            .select(SELECT_FIELDS)
            .order("snapshot_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to);
          if (sinceIso) q = q.gte("snapshot_at", sinceIso);

          const { data, error } = await q;
          if (cancelled) return;
          if (error) {
            setError(error.message);
            setLoading(false);
            return;
          }

          const rows = (data ?? []) as FlightSnapshot[];
          all.push(...rows);
          if (rows.length < PAGE_SIZE) break;

          if (page === MAX_PAGES - 1) {
            console.warn(
              `[GoWildInsights] Hit MAX_PAGES=${MAX_PAGES} (${all.length} rows). Data may be truncated.`,
            );
          }
        }

        if (cancelled) return;
        setSnapshots(all);
        setLoading(false);

        try {
          const itins = groupLegsIntoItineraries(all as any);
          const uniqueIds = new Set(all.map((r) => r.id)).size;
          console.info(
            `[GoWildInsights] period=${period} rows=${all.length} uniqueIds=${uniqueIds} itineraries=${itins.length}`,
          );
        } catch {
          /* logging only */
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Unknown error loading snapshots");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sinceIso, period]);

  // Snapshots scoped to the currently selected period (excluding the
  // prior-comparison window). Used for every card except GoWildSnapshotCard,
  // which needs the extended set to compute its prior-period trend.
  const currentSnapshots = useMemo<FlightSnapshot[]>(() => {
    if (!currentSinceIso) return snapshots;
    const cutoff = new Date(currentSinceIso).getTime();
    return snapshots.filter((s) => {
      const t = new Date(s.snapshot_at).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }, [snapshots, currentSinceIso]);

  return (
    <div className="px-5 pt-4 pb-8 flex flex-col gap-4">
      <div
        className="rounded-2xl bg-white px-4 py-3 text-xs leading-relaxed text-gray-600"
        style={{ boxShadow: CARD_SHADOW }}
      >
        Insights are calculated from itinerary-level results in the selected period.
        Connecting itineraries count as GoWild-available only when every leg is
        GoWild-available. Seat availability uses the lowest seat count across the
        itinerary.
      </div>

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

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <ErrorCard message={error} />
      ) : (
        <GoWildSnapshotCard
          // Pass the FULL fetched dataset (current + prior equal-length window).
          // computeGoWildSnapshotMetrics filters by snapshotAt internally so
          // headline metrics & chart stay scoped to the current period while
          // the trend delta has prior-period itineraries to compare against.
          itineraries={groupLegsIntoItineraries(snapshots as any)}
          period={period}
        />

      )}

      {!loading && !error && (
        <>
          <AirportGoWildInsightsSection snapshots={currentSnapshots} airportDict={airportDict} />
          <GoWildRouteAnalyticsSection snapshots={currentSnapshots} airportDict={airportDict} />
          <GoWildTimingAnalyticsSection snapshots={currentSnapshots} />
          <SeatAvailabilityIntelligence snapshots={currentSnapshots} airportDict={airportDict} />
        </>
      )}
    </div>
  );
};

export default GoWildInsightsPage;
