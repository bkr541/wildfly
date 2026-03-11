import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpcomingFlightsScroll } from "@/components/home/UpcomingFlightsScroll";
import { RecentSearches } from "@/components/home/RecentSearches";

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
}

const HomePage = ({ onNavigate }: { onNavigate?: (page: string) => void }) => {
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [searches, setSearches] = useState<FlightSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchesLoading, setSearchesLoading] = useState(true);

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

      // Fetch upcoming flights and recent searches in parallel
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
          .select("id, departure_airport, arrival_airport, departure_date, return_date, trip_type, all_destinations, search_timestamp")
          .eq("user_id", user.id)
          .order("search_timestamp", { ascending: false })
          .limit(2),
      ]);

      setFlights(flightsResult.data || []);
      setSearches(searchesResult.data || []);
      setLoading(false);
      setSearchesLoading(false);
    };
    load();
  }, []);

  return (
    <div className="flex flex-col pt-6">
      <UpcomingFlightsScroll flights={flights} loading={loading} onNavigate={onNavigate} />
      <RecentSearches searches={searches} loading={searchesLoading} onNavigate={onNavigate} />
    </div>
  );
};

export default HomePage;
