import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UpcomingFlightsScroll } from "@/components/home/UpcomingFlightsScroll";
import { RecentSearches } from "@/components/home/RecentSearches";
import { format } from "date-fns";

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

    // 1. Get user's home_location_id
    const { data: info } = await supabase
      .from("user_info")
      .select("home_location_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!info?.home_location_id) return;

    // 2. Get the first airport IATA for that location
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

    // 3. Build cache key — use "__DAYTRIPS__" as the virtual destination
    const cacheKey = await sha256(`${originIATA}|__DAYTRIPS__|${today}`);

    // 4. Check cache first (within 6 hours, status = 'ready')
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await (supabase.from("flight_search_cache") as any)
      .select("payload, updated_at")
      .eq("cache_key", cacheKey)
      .eq("status", "ready")
      .gte("updated_at", sixHoursAgo)
      .maybeSingle();

    // Cache hit within 6 hours (ready) OR already being fetched — skip entirely
    if (cached?.payload) return;

    // Also skip if another tab/session is already fetching
    const { data: inFlight } = await (supabase.from("flight_search_cache") as any)
      .select("status")
      .eq("cache_key", cacheKey)
      .eq("status", "fetching")
      .gte("updated_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // within last 5 min
      .maybeSingle();

    if (inFlight) return;

    // 5. Reserve cache slot (status = 'fetching') to prevent duplicate calls
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

    // 6. Call the dayTrips endpoint
    const url = `https://getmydata.fly.dev/api/flights/dayTrips?origin=${originIATA}&date=${today}&nonstop=true&layovertime=6`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      // Mark cache as error
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

    // 7. Write to flight_search_cache (status = 'ready')
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

    // 8. Write to flight_searches
    await supabase.from("flight_searches").insert({
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
    });
  } catch {
    // Non-blocking — silently ignore errors
  }
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

      // Fetch upcoming flights, recent searches, and trigger dayTrips in parallel
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
        // Fire-and-forget: fetch today's day trips from home airport
        fetchAndLogDayTrips(),
      ]);

      setFlights(flightsResult.data || []);
      setSearches(searchesResult.data || []);
      setLoading(false);
      setSearchesLoading(false);
    };
    load();
  }, []);

  return (
    <div className="flex flex-col pt-3">
      <UpcomingFlightsScroll flights={flights} loading={loading} onNavigate={onNavigate} />
      <RecentSearches searches={searches} loading={searchesLoading} onNavigate={onNavigate} />
    </div>
  );
};

export default HomePage;
