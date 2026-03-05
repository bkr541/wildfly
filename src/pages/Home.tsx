import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpcomingFlightsScroll } from "@/components/home/UpcomingFlightsScroll";

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

const HomePage = () => {
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_flights")
        .select("*")
        .eq("user_id", user.id)
        .order("departure_time", { ascending: true })
        .limit(20);
      setFlights(data || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="flex flex-col pt-6">
      <UpcomingFlightsScroll flights={flights} loading={loading} />
    </div>
  );
};

export default HomePage;
