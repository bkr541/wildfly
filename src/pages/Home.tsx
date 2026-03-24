import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpcomingFlightsScroll } from "@/components/home/UpcomingFlightsScroll";
import { RecentSearches } from "@/components/home/RecentSearches";
import { QuickSearches } from "@/components/home/QuickSearches";
import { DayTrips } from "@/components/home/DayTrips";
import { format } from "date-fns";
import { writeFlightSnapshots } from "@/utils/flightSnapshotWriter";


interface UserFlight {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  type: string;
  flight_json: any;
  created_at: string;
}

interface FlightSearch {
  id: string;
  departure_airport: string;
  arrival_airport: string | null;
  departure_date: string;
  return_date: string | null;
  trip_type: string;
  all_destinations: string;
  search_timestamp: string;
  gowild_found: boolean | null;
}

/** SHA-256 hex hash via Web Crypto (mirrors Flights.tsx) */
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 12:01 AM on the given date in UTC — reset boundary (mirrors Flights.tsx) */
function resetBucket(departureDateStr: string): string {
  const [y, m, d] = departureDateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 1, 0)).toISOString();
}

async function fetchAndLogDayTrips(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: info } = await supabase
      .from("user_info")
      .select("home_location_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!info?.home_location_id) return;

    const { data: airport } = await supabase
      .from("airports")
      .select("iata_code")
      .eq("location_id", info.home_location_id)
      .limit(1)
      .maybeSingle();

    if (!airport?.iata_code) return;

    const originIATA = airport.iata_code;
    const today = format(new Date(), "yyyy-MM-dd");
    const bucket = resetBucket(today);

    const cacheKey = await sha256(`${originIATA}|__DAYTRIPS__|${today}`);

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await (supabase.from("flight_search_cache") as any)
      .select("payload, updated_at")
      .eq("cache_key", cacheKey)
      .eq("status", "ready")
      .gte("updated_at", sixHoursAgo)
      .maybeSingle();

    if (cached?.payload) return;

    const { data: inFlight } = await (supabase.from("flight_search_cache") as any)
      .select("status")
      .eq("cache_key", cacheKey)
      .eq("status", "fetching")
      .gte("updated_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .maybeSingle();

    if (inFlight) return;

    await (supabase.from("flight_search_cache") as any).upsert(
      {
        cache_key: cacheKey,
        reset_bucket: bucket,
        canonical_request: { origin: originIATA, date: today, layovertime: 6 },
        provider: "frontier",
        status: "fetching",
        dep_iata: originIATA,
        arr_iata: "__DAYTRIPS__",
      },
      { onConflict: "cache_key,reset_bucket" },
    );

    const url = `https://getmydata.fly.dev/api/flights/dayTrips?origin=${originIATA}&date=${today}&nonstop=true&layovertime=6`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      await (supabase.from("flight_search_cache") as any).upsert(
        {
          cache_key: cacheKey,
          reset_bucket: bucket,
          canonical_request: { origin: originIATA, date: today, layovertime: 6 },
          provider: "frontier",
          status: "error",
          error: `HTTP ${res.status}`,
          dep_iata: originIATA,
          arr_iata: "__DAYTRIPS__",
        },
        { onConflict: "cache_key,reset_bucket" },
      );
      return;
    }

    const payload = await res.json();

    await (supabase.from("flight_search_cache") as any).upsert(
      {
        cache_key: cacheKey,
        reset_bucket: bucket,
        canonical_request: { origin: originIATA, date: today, layovertime: 6 },
        provider: "frontier",
        status: "ready",
        payload,
        dep_iata: originIATA,
        arr_iata: "__DAYTRIPS__",
      },
      { onConflict: "cache_key,reset_bucket" },
    );

    const dayTripFlights: any[] = payload?.flights ?? [];
    const dayTripGoWild = dayTripFlights.some(
      (f: any) =>
        f.fares?.go_wild != null ||
        f.rawPayload?.fares?.go_wild?.total != null,
    );
    const { data: fsRow } = await (supabase.from("flight_searches") as any).insert({
      user_id: user.id,
      departure_airport: originIATA,
      arrival_airport: null,
      departure_date: today,
      return_date: null,
      trip_type: "day-trip",
      all_destinations: "Yes",
      json_body: payload,
      credits_cost: 0,
      arrival_airports_count: null,
      gowild_found: dayTripGoWild,
      flight_results_count: dayTripFlights.length,
    }).select("id").single();
    // Write flight_snapshots non-blockingly
    if (fsRow?.id) {
      writeFlightSnapshots(fsRow.id, dayTripFlights, originIATA).catch(() => {
        // silently ignore
      });
    }

    // Non-blocking — silently ignore errors
  }
}

interface HomepageComponent {
  component_name: string;
  order: number;
  status: string;
}

const COMPONENT_MAP: Record<
  string,
  (props: {
    flights: UserFlight[];
    searches: FlightSearch[];
    loading: boolean;
    searchesLoading: boolean;
    onNavigate?: (page: string) => void;
    isCollapsed: boolean;
    onToggle: () => void;
  }) => JSX.Element | null
> = {
  upcoming_flights: (props) => (
    <UpcomingFlightsScroll
      key="upcoming_flights"
      flights={props.flights}
      loading={props.loading}
      onNavigate={props.onNavigate}
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle}
    />
  ),
  recent_searches: (props) => (
    <RecentSearches
      key="recent_searches"
      searches={props.searches}
      loading={props.searchesLoading}
      onNavigate={props.onNavigate}
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle}
    />
  ),
  quick_searches: (props) => (
    <QuickSearches
      key="quick_searches"
      onNavigate={props.onNavigate}
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle}
    />
  ),
  day_trips: (props) => (
    <DayTrips
      key="day_trips"
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle}
      onNavigate={props.onNavigate}
    />
  ),
};

interface HomePageProps {
  onNavigate?: (page: string) => void;
  refreshTrigger?: number;
}

const HomePage = ({ onNavigate, refreshTrigger }: HomePageProps) => {
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [searches, setSearches] = useState<FlightSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchesLoading, setSearchesLoading] = useState(true);
  const [homepageComponents, setHomepageComponents] = useState<HomepageComponent[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const loadHomepageConfig = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_homepage")
      .select("component_name, order, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("order", { ascending: true });
    setHomepageComponents(data || []);
  }, []);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setSearchesLoading(false);
        return;
      }

      fetchAndLogDayTrips();

      const [flightsResult, searchesResult] = await Promise.all([
        supabase
          .from("user_flights")
          .select("*")
          .eq("user_id", user.id)
          .gte("departure_time", new Date().toISOString())
          .order("departure_time", { ascending: true })
          .limit(20),
        supabase
          .from("flight_searches")
          .select("id, departure_airport, arrival_airport, departure_date, return_date, trip_type, all_destinations, search_timestamp, gowild_found")
          .eq("user_id", user.id)
          .order("search_timestamp", { ascending: false })
          .limit(30),
      ]);

      await loadHomepageConfig(user.id);
      // Deduplicate searches by (departure + arrival + trip_type + departure_date)
      const seen = new Set<string>();
      const uniqueSearches = (searchesResult.data ?? []).filter((s) => {
        const key = `${s.departure_airport}|${s.arrival_airport ?? ""}|${s.trip_type}|${s.departure_date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 7);
      setFlights(flightsResult.data || []);
      setSearches(uniqueSearches);
      setLoading(false);
      setSearchesLoading(false);
    };
    load();
  }, [loadHomepageConfig]);

  // Re-fetch homepage config whenever refreshTrigger increments (e.g. after Appearance save)
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) loadHomepageConfig(user.id);
    });
  }, [refreshTrigger, loadHomepageConfig]);

  const toggleSection = useCallback((name: string) => {
    setCollapsedSections((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  return (
    <div className="flex flex-col pt-3">
      {homepageComponents.map((item) => {
        const renderer = COMPONENT_MAP[item.component_name];
        if (!renderer) return null;
        return renderer({
          flights,
          searches,
          loading,
          searchesLoading,
          onNavigate,
          isCollapsed: !!collapsedSections[item.component_name],
          onToggle: () => toggleSection(item.component_name),
        });
      })}
    </div>
  );
};

export default HomePage;
