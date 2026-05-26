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


// NOTE: GoWild Insights is a PLATFORM-WIDE analytics dashboard. Every signed-in
// user sees the same metrics for the same period. To avoid widening direct
// access to raw flight_snapshots (which stays scoped to the searching user),
// we read sanitized global data via the SECURITY DEFINER RPC
// `get_global_gowild_insight_snapshots`. The RPC returns a derived
// `source_itinerary_id` value that is globally unique per (search, itinerary)
// observation so identical upstream ids from separate searches never merge.

type PeriodKey = "24h" | "7d" | "30d" | "all";

const PERIODS: { key: PeriodKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: null },
];

// Pagination ceiling per request. The RPC paginates the full matching set;
// we keep fetching until a page returns fewer than PAGE_SIZE rows.
const PAGE_SIZE = 1000;
// Defensive absolute safety valve to prevent a runaway loop in pathological
// cases (e.g. ordering bug). If we ever hit this we surface a VISIBLE error
// instead of silently rendering partial analytics. 5000 pages = 5M rows.
const HARD_SAFETY_PAGE_LIMIT = 5000;


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
    <p className="text-sm text-red-500 font-medium">
      Unable to load complete analytics
    </p>
    <p className="text-xs text-gray-600 mt-1">{message}</p>
    <p className="text-xs text-gray-500 mt-2">
      Metrics are hidden because the full dataset for the selected period could
      not be retrieved. Partial results are not shown to avoid misleading totals.
    </p>
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
      const seenIds = new Set<string>();
      try {
        let page = 0;
        // Unbounded pagination: continue until a page returns < PAGE_SIZE rows.
        // No artificial ceiling — if anything goes catastrophically wrong, the
        // hard safety valve throws and the UI shows a visible error.
        while (true) {
          if (cancelled) return;
          if (page >= HARD_SAFETY_PAGE_LIMIT) {
            throw new Error(
              `Aborted after ${HARD_SAFETY_PAGE_LIMIT} pages (${all.length} rows). Possible pagination issue — analytics not shown to avoid misleading partial data.`,
            );
          }
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;

          let q = (supabase.from("flight_snapshots") as any)
            .select(SELECT_FIELDS)
            .order("snapshot_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to);
          if (sinceIso) q = q.gte("snapshot_at", sinceIso);

          const { data, error: pageError } = await q;
          if (cancelled) return;
          if (pageError) {
            throw new Error(
              `Page ${page + 1} failed: ${pageError.message}. Analytics cannot be considered complete.`,
            );
          }

          const rows = (data ?? []) as FlightSnapshot[];
          // Defensive dedupe by id (guards against any overlap between pages).
          for (const r of rows) {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              all.push(r);
            }
          }
          if (rows.length < PAGE_SIZE) break;
          page += 1;
        }

        if (cancelled) return;
        setSnapshots(all);
        setLoading(false);

        try {
          const itins = groupLegsIntoItineraries(all as any);
          console.info(
            `[GoWildInsights] period=${period} rows=${all.length} uniqueIds=${seenIds.size} itineraries=${itins.length}`,
          );
        } catch {
          /* logging only */
        }
      } catch (e: any) {
        if (cancelled) return;
        setSnapshots([]);
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
