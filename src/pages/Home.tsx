import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpcomingFlightsAccordion } from "@/components/home/UpcomingFlightsAccordion";
import { AlertsAccordion } from "@/components/home/AlertsAccordion";
import { SplitFlapHeader } from "@/components/SplitFlapHeader";

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

export default function Home() {
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFlights() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("user_flights")
        .select("*")
        .eq("user_id", user.id)
        .order("departure_time", { ascending: true })
        .limit(20);

      setFlights((data as UserFlight[]) ?? []);
      setLoading(false);
    }
    fetchFlights();
  }, []);

  return (
    <div className="flex flex-col gap-4 pt-2 pb-8">
      <SplitFlapHeader word="WILDFLY" />
      <UpcomingFlightsAccordion flights={flights} loading={loading} />
      <AlertsAccordion />
    </div>
  );
}
