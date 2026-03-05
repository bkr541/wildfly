import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpcomingFlightsScroll } from "@/components/home/UpcomingFlightsScroll";
import { HugeiconsIcon } from "@hugeicons/react";
import { TimelineIcon } from "@hugeicons/core-free-icons";

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
    <div className="flex flex-col pt-[24px]">
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={TimelineIcon} className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold tracking-wide">UPCOMING FLIGHTS</h2>
        </div>
      </div>

      <UpcomingFlightsScroll flights={flights} loading={loading} />
    </div>
  );
};

export default HomePage;
