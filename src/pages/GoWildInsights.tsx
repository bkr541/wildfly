import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import GoWildSnapshotCard from "@/components/insights/GoWildSnapshotCard";
import AirportGoWildInsightsSection from "@/components/insights/AirportGoWildInsightsSection";
import GoWildRouteAnalyticsSection from "@/components/insights/GoWildRouteAnalyticsSection";
import GoWildTimingAnalyticsSection from "@/components/insights/GoWildTimingAnalyticsSection";
import SeatAvailabilityIntelligence from "@/components/insights/SeatAvailabilityIntelligence";
import RouteAvailabilityCalendarCard from "@/components/insights/RouteAvailabilityCalendarCard";
import { type FlightSnapshot } from "@/components/insights/airportHelpers";
import { groupLegsIntoItineraries } from "@/components/insights/itineraryHelpers";
import { useAirportDictionary } from "@/hooks/useAirportDictionary";
import { SplitFlapOverlay } from "@/components/SplitFlapOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";


// NOTE: GoWild Insights is a PLATFORM-WIDE analytics dashboard. Every signed-in
// user sees the same metrics for the same period. To avoid widening direct
// access to raw flight_snapshots (which stays scoped to the searching user),
// we read sanitized global data via the SECURITY DEFINER RPC
// `get_global_gowild_insight_snapshots`. The RPC returns a derived
// `source_itinerary_id` value that is globally unique per (search, itinerary)
// observation so identical upstream ids from separate searches never merge.

export type PeriodKey = "24h" | "7d" | "30d" | "all";

export const PERIODS: { key: PeriodKey; label: string; hours: number | null }[] = [
  { key: "24h", label: "24 hours", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "30d", label: "30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: null },
];

export function InsightsPeriodPicker({ period, onChange }: { period: PeriodKey; onChange: (p: PeriodKey) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500">Search Last:</span>
      <div className="relative">
        <select
          value={period}
          onChange={(e) => onChange(e.target.value as PeriodKey)}
          className="appearance-none rounded-full bg-white border border-gray-200 pl-3 pr-8 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer"
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <FontAwesomeIcon
          icon={faChevronDown}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none"
        />
      </div>
    </div>
  );
}

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
export type InsightsScope = "all" | "home";

function InsightsScopeToggle({
  scope,
  onChange,
  homeIata,
}: {
  scope: InsightsScope;
  onChange: (s: InsightsScope) => void;
  homeIata: string | null;
}) {
  const options: { key: InsightsScope; label: string }[] = [
    { key: "all", label: "All" },
    { key: "home", label: homeIata ?? "Home" },
  ];
  const activeIndex = options.findIndex((o) => o.key === scope);
  return (
    <div className="rounded-full p-[2px] flex relative bg-[#F2F3F3]" style={{ width: 180 }}>
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out"
        style={{
          background: "#10B981",
          width: "calc(50% - 2px)",
          left: `calc(2px + ${activeIndex * 50}%)`,
        }}
      />
      {options.map((opt) => {
        const isActive = scope === opt.key;
        const disabled = opt.key === "home" && !homeIata;
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            style={{ flex: 1 }}
            className={cn(
              "py-2 text-sm font-semibold rounded-full transition-all duration-300 relative z-10 flex items-center justify-center",
              isActive ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
              disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const GoWildInsightsPage = ({ period, setPeriod }: { period: PeriodKey; setPeriod: (p: PeriodKey) => void }) => {
  const [snapshots, setSnapshots] = useState<FlightSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<InsightsScope>("all");
  const [homeIata, setHomeIata] = useState<string | null>(null);
  const { dict: airportDict } = useAirportDictionary();
  const { userId } = useAuth();

  // Load user's home airport
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_info")
        .select("home_airport, home_location_id")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      let code = (data?.home_airport ?? "").toString().trim().toUpperCase();
      if (!code && data?.home_location_id != null) {
        const { data: ap } = await supabase
          .from("airports")
          .select("iata_code")
          .eq("location_id", data.home_location_id)
          .eq("is_active", true)
          .order("is_hub", { ascending: false })
          .limit(1)
          .maybeSingle();
        code = (ap?.iata_code ?? "").toString().trim().toUpperCase();
      }
      setHomeIata(code || null);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Auto-revert to "all" if user has no home airport
  useEffect(() => {
    if (!homeIata && scope === "home") setScope("all");
  }, [homeIata, scope]);

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
        while (true) {
          if (cancelled) return;
          if (page >= HARD_SAFETY_PAGE_LIMIT) {
            throw new Error(
              `Aborted after ${HARD_SAFETY_PAGE_LIMIT} pages (${all.length} rows). Possible pagination issue — analytics not shown to avoid misleading partial data.`,
            );
          }
          const offset = page * PAGE_SIZE;

          const { data, error: pageError } = await (supabase.rpc as any)(
            "get_global_gowild_insight_snapshots",
            {
              p_since: sinceIso,
              p_limit: PAGE_SIZE,
              p_offset: offset,
            },
          );
          if (cancelled) return;
          if (pageError) {
            throw new Error(
              `Page ${page + 1} failed: ${pageError.message}. Analytics cannot be considered complete.`,
            );
          }

          const rows = (data ?? []) as FlightSnapshot[];
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

  // Snapshots scoped to the currently selected period.
  const currentSnapshots = useMemo<FlightSnapshot[]>(() => {
    const base = !currentSinceIso
      ? snapshots
      : snapshots.filter((s) => {
          const cutoff = new Date(currentSinceIso).getTime();
          const t = new Date(s.snapshot_at).getTime();
          return !isNaN(t) && t >= cutoff;
        });
    if (scope === "home" && homeIata) {
      return base.filter(
        (s) =>
          (s.leg_origin_iata ?? "").toUpperCase() === homeIata ||
          (s.leg_destination_iata ?? "").toUpperCase() === homeIata,
      );
    }
    return base;
  }, [snapshots, currentSinceIso, scope, homeIata]);

  // Snapshot card needs current + prior window. Apply home filter there too.
  const snapshotCardSnapshots = useMemo<FlightSnapshot[]>(() => {
    if (scope === "home" && homeIata) {
      return snapshots.filter(
        (s) =>
          (s.leg_origin_iata ?? "").toUpperCase() === homeIata ||
          (s.leg_destination_iata ?? "").toUpperCase() === homeIata,
      );
    }
    return snapshots;
  }, [snapshots, scope, homeIata]);

  if (loading) {
    return <SplitFlapOverlay topWord="LOADING" bottomWord="INSIGHTS" />;
  }

  const homeMode = scope === "home" && !!homeIata;

  return (
    <div className="px-5 pt-4 pb-8 flex flex-col gap-4">
      {/* Controls row below the header */}
      <div className="flex items-center justify-between gap-3">
        <InsightsScopeToggle scope={scope} onChange={setScope} homeIata={homeIata} />
        <InsightsPeriodPicker period={period} onChange={setPeriod} />
      </div>

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <ErrorCard message={error} />
      ) : (
        <GoWildSnapshotCard
          itineraries={groupLegsIntoItineraries(snapshotCardSnapshots as any)}
          period={period}
        />
      )}

      {!loading && !error && (
        <>
          <AirportGoWildInsightsSection
            snapshots={currentSnapshots}
            airportDict={airportDict}
          />
          <GoWildRouteAnalyticsSection snapshots={currentSnapshots} airportDict={airportDict} />
          <RouteAvailabilityCalendarCard snapshots={currentSnapshots} />
          <GoWildTimingAnalyticsSection snapshots={currentSnapshots} />
          <SeatAvailabilityIntelligence snapshots={currentSnapshots} airportDict={airportDict} />
        </>
      )}
    </div>
  );
};

export default GoWildInsightsPage;
