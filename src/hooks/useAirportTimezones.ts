import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AirportTimezoneMap = Record<string, string | null>;

/**
 * Fetch only the IANA timezones needed by the supplied airport codes.
 *
 * Saved flight timestamps are UTC instants. Display components must format each
 * instant in the relevant airport's timezone rather than the browser/device
 * timezone. Keeping this lookup small avoids loading the entire airports table
 * just to render a handful of saved-flight cards.
 */
export function useAirportTimezones(codes: Array<string | null | undefined>): AirportTimezoneMap {
  const key = Array.from(
    new Set(
      codes
        .filter((code): code is string => typeof code === "string" && code.trim().length > 0)
        .map((code) => code.trim().toUpperCase()),
    ),
  )
    .sort()
    .join("|");

  const [timezones, setTimezones] = useState<AirportTimezoneMap>({});

  useEffect(() => {
    let cancelled = false;
    const airportCodes = key ? key.split("|") : [];

    if (airportCodes.length === 0) {
      setTimezones({});
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const { data, error } = await supabase
        .from("airports")
        .select("iata_code, timezone")
        .in("iata_code", airportCodes);

      if (cancelled) return;
      if (error) {
        console.warn("[Wildfly] Unable to load airport timezones", error);
        setTimezones({});
        return;
      }

      const next: AirportTimezoneMap = {};
      for (const row of data ?? []) {
        next[row.iata_code] = row.timezone ?? null;
      }
      setTimezones(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return timezones;
}
