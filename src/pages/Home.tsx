import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SplitFlapHeader } from "@/components/SplitFlapHeader";
import { AlertsAccordion } from "@/components/home/AlertsAccordion";
import { UpcomingFlightsAccordion } from "@/components/home/UpcomingFlightsAccordion";

interface UserFlight {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  type: string;
  flight_json: any;
}

const HomePage = () => {
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
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
    <>
      <div className="px-6 pt-4 pb-4 relative z-10 animate-fade-in">
        <SplitFlapHeader word="HOME" />
      </div>

      <UpcomingFlightsAccordion flights={flights} loading={loading} />

      <AlertsAccordion />

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10" />
    </>
  );
};

export default HomePage;
