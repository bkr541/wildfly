import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AirportInfo {
  iata_code: string;
  name: string;
  city?: string;
  state?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export type AirportDict = Record<string, AirportInfo>;

export function useAirportDictionary() {
  const [dict, setDict] = useState<AirportDict>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("iata_code, name, latitude, longitude, locations(city, state_code, region, country)");
      if (cancelled) return;
      const map: AirportDict = {};
      if (data) {
        for (const row of data as any[]) {
          const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
          map[row.iata_code] = {
            iata_code: row.iata_code,
            name: row.name,
            city: loc?.city ?? undefined,
            state: loc?.state_code ?? undefined,
            region: loc?.region ?? undefined,
            country: loc?.country ?? undefined,
            latitude: row.latitude ?? undefined,
            longitude: row.longitude ?? undefined,
          };
        }
      }
      setDict(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { dict, loading };
}
