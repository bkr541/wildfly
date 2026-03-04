import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FlightDestResults from "@/pages/FlightDestResults";

const CACHE_ID = "29a414b6-1a64-48c2-906e-1353b7553322";

interface Props { onBack: () => void }

const FlightResultsV4Screen = ({ onBack }: Props) => {
  const [responseData, setResponseData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error: err } = await supabase
        .from("flight_search_cache")
        .select("payload, canonical_request")
        .eq("id", CACHE_ID)
        .single();
      if (err || !data) {
        setError(err?.message ?? "Not found");
      } else {
        const payload = data.payload as any;
        const canonical = data.canonical_request as any;
        const synthesized = {
          response: payload,
          departureDate: canonical?.departureDate ?? null,
          arrivalDate: canonical?.arrivalDate ?? null,
          tripType: canonical?.tripType ?? "One Way",
          departureAirport: canonical?.origin ?? canonical?.dep_iata ?? "",
          arrivalAirport: canonical?.destination ?? canonical?.arr_iata ?? "",
          fromCache: true,
        };
        setResponseData(JSON.stringify(synthesized));
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center h-full">
      <p className="text-sm text-[#6B7B7B]">Loading cache…</p>
    </div>
  );

  if (error || !responseData) return (
    <div className="flex-1 flex items-center justify-center h-full px-6">
      <p className="text-sm text-red-500 text-center">{error ?? "No data"}</p>
    </div>
  );

  return <FlightDestResults onBack={onBack} responseData={responseData} hideHeader />;
};

export default FlightResultsV4Screen;
