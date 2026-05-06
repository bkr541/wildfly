import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UpcomingFlightsScroll } from "@/components/home/UpcomingFlightsScroll";
import { WatchedFlightsScroll } from "@/components/home/WatchedFlightsScroll";
import { RecentSearches } from "@/components/home/RecentSearches";
import { QuickSearches } from "@/components/home/QuickSearches";
import { DayTrips } from "@/components/home/DayTrips";
import { TokenExpirationCard } from "@/components/home/TokenExpirationCard";
import { useDayTripAutoFetch } from "@/hooks/useDayTripAutoFetch";
import { Skeleton } from "@/components/ui/skeleton";

// Module-level flag: only show initial skeleton once per app session (i.e. after login),
// not when re-mounting from side-menu navigation.
let initialSkeletonShown = false;


interface UserFlight {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  type: string;
  flight_json: any;
  created_at: string;
  status: string | null;
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


interface HomepageComponent {
  component_name: string;
  order: number;
  status: string;
}

const COMPONENT_MAP: Record<
  string,
  (props: {
    flights: UserFlight[];
    watchedFlights: UserFlight[];
    searches: FlightSearch[];
    loading: boolean;
    searchesLoading: boolean;
    onNavigate?: (page: string) => void;
    isCollapsed: boolean;
    onToggle: () => void;
    onFlightRemoved?: (flightId: string) => void;
    onWatchedFlightRemoved?: (flightId: string) => void;
    onSearchRemoved?: (id: string) => void;
    onFlightClick?: (flight: UserFlight) => void;
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
      onFlightRemoved={props.onFlightRemoved}
      onFlightClick={props.onFlightClick}
    />
  ),
  watched_flights: (props) => (
    <WatchedFlightsScroll
      key="watched_flights"
      flights={props.watchedFlights}
      loading={props.loading}
      onNavigate={props.onNavigate}
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle}
      onFlightRemoved={props.onWatchedFlightRemoved}
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
      onSearchRemoved={props.onSearchRemoved}
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
  token_expiration: (props) => (
    <TokenExpirationCard
      key="token_expiration"
      isCollapsed={props.isCollapsed}
      onToggle={props.onToggle}
    />
  ),
};

interface HomePageProps {
  onNavigate?: (page: string) => void;
  refreshTrigger?: number;
  onFlightClick?: (flight: UserFlight) => void;
}

const HomePage = ({ onNavigate, refreshTrigger, onFlightClick }: HomePageProps) => {
  const { user } = useAuth();
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [watchedFlights, setWatchedFlights] = useState<UserFlight[]>([]);
  const [searches, setSearches] = useState<FlightSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchesLoading, setSearchesLoading] = useState(true);
  const [homepageComponents, setHomepageComponents] = useState<HomepageComponent[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(!initialSkeletonShown);

  useEffect(() => {
    if (initialSkeletonShown) return;
    const t = setTimeout(() => {
      initialSkeletonShown = true;
      setShowInitialSkeleton(false);
    }, 2000);
    return () => clearTimeout(t);
  }, []);



  // Background-fetch day trips for today + tomorrow on login
  useDayTripAutoFetch();

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
      if (!user) {
        setLoading(false);
        setSearchesLoading(false);
        return;
      }

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const todayCutoff = startOfToday.toISOString();

      const [flightsResult, watchedResult, searchesResult] = await Promise.all([
        supabase
          .from("user_flights")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "Current")
          .eq("type", "going")
          .gte("departure_time", todayCutoff)
          .order("departure_time", { ascending: true })
          .limit(20),
        supabase
          .from("user_flights")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "Current")
          .eq("type", "alert")
          .gte("departure_time", todayCutoff)
          .order("departure_time", { ascending: true })
          .limit(20),
        supabase
          .from("flight_searches")
          .select("id, departure_airport, arrival_airport, departure_date, return_date, trip_type, all_destinations, search_timestamp, gowild_found")
          .eq("user_id", user.id)
          .or("triggered_by.is.null,triggered_by.neq.admin_bulk_search")
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
      setWatchedFlights(watchedResult.data || []);
      setSearches(uniqueSearches);
      setLoading(false);
      setSearchesLoading(false);
    };
    load();
  }, [user, loadHomepageConfig]);

  // Re-fetch homepage config whenever refreshTrigger increments (e.g. after Appearance save)
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    if (user) loadHomepageConfig(user.id);
  }, [refreshTrigger, loadHomepageConfig, user]);

  const toggleSection = useCallback((name: string) => {
    setCollapsedSections((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const handleFlightRemoved = useCallback((flightId: string) => {
    setFlights((prev) => prev.filter((f) => f.id !== flightId));
  }, []);

  const handleWatchedFlightRemoved = useCallback((flightId: string) => {
    setWatchedFlights((prev) => prev.filter((f) => f.id !== flightId));
  }, []);

  const handleSearchRemoved = useCallback((id: string) => {
    setSearches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  if (showInitialSkeleton) {
    return (
      <div className="flex flex-col pt-3 px-3 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col pt-3">
      {homepageComponents.map((item) => {
        const renderer = COMPONENT_MAP[item.component_name];
        if (!renderer) return null;
        return renderer({
          flights,
          watchedFlights,
          searches,
          loading,
          searchesLoading,
          onNavigate,
          isCollapsed: !!collapsedSections[item.component_name],
          onToggle: () => toggleSection(item.component_name),
          onFlightRemoved: handleFlightRemoved,
          onWatchedFlightRemoved: handleWatchedFlightRemoved,
          onSearchRemoved: handleSearchRemoved,
          onFlightClick,
        });
      })}
    </div>
  );
};

export default HomePage;
