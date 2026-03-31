import { useEffect } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDayTrips } from "@/lib/flightApi";

/** SHA-256 hex – same algorithm used in Flights.tsx & DayTrips.tsx */
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 12:01 AM UTC on the departure date – GoWild reset boundary */
function resetBucket(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 1, 0)).toISOString();
}

/**
 * Fires once after login.
 * For today and tomorrow:
 *   1. Check flight_search_cache for an existing "ready" entry.
 *   2. If missing, call the dayTrips API and write results to:
 *      - flight_search_cache (so DayTrips component can read it)
 *      - flight_searches     (for history / deduplication)
 */
export function useDayTripAutoFetch() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const run = async () => {
      // ── 1. Resolve home airport ───────────────────────────────────────────
      const { data: info } = await supabase
        .from("user_info")
        .select("home_airport")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const homeIata = info?.home_airport ?? null;
      if (!homeIata || cancelled) return;

      const today = format(new Date(), "yyyy-MM-dd");
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

      // Process both dates in parallel
      await Promise.all([today, tomorrow].map((dateStr) => fetchIfMissing(user.id, homeIata, dateStr, cancelled)));
    };

    run().catch(() => { /* silently fail – background task */ });

    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

async function fetchIfMissing(
  userId: string,
  homeIata: string,
  dateStr: string,
  cancelled: boolean,
) {
  if (cancelled) return;

  // ── Check cache ───────────────────────────────────────────────────────────
  const cacheKey = await sha256(`${homeIata}|__DAYTRIPS__|${dateStr}`);
  const bucket = resetBucket(dateStr);

  const { data: cached } = await (supabase.from("flight_search_cache") as any)
    .select("id, status")
    .eq("cache_key", cacheKey)
    .in("status", ["ready", "fetching"])
    .maybeSingle();

  if (cached || cancelled) return; // already fetched or in flight

  // ── Write a "fetching" placeholder so concurrent runs don't double-call ──
  try {
    const canonicalRequest = { origin: homeIata, date: dateStr, nonstop: "true", layovertime: "6" };
    await (supabase.from("flight_search_cache") as any).insert({
      cache_key: cacheKey,
      reset_bucket: bucket,
      canonical_request: canonicalRequest,
      provider: "frontier",
      status: "fetching",
      dep_iata: homeIata,
      arr_iata: "__DAYTRIPS__",
    });
  } catch {
    // If insert fails (duplicate), another process beat us to it — bail
    return;
  }

  if (cancelled) return;

  // ── Call the API ──────────────────────────────────────────────────────────
  try {
    const params = new URLSearchParams({
      origin: homeIata,
      date: dateStr,
      nonstop: "true",
      layovertime: "6",
    });

    const res = await fetch(`https://getmydata.fly.dev/api/flights/dayTrips?${params}`);
    if (!res.ok) {
      // Mark cache as error so we don't endlessly retry in the same session
      await (supabase.from("flight_search_cache") as any)
        .update({ status: "error", error: `HTTP ${res.status}` })
        .eq("cache_key", cacheKey)
        .eq("reset_bucket", bucket);
      return;
    }

    const json = await res.json();
    if (cancelled) return;

    // ── Write normalized payload to cache ─────────────────────────────────
    await (supabase.from("flight_search_cache") as any)
      .update({ status: "ready", payload: json })
      .eq("cache_key", cacheKey)
      .eq("reset_bucket", bucket);

    // ── Log to flight_searches ─────────────────────────────────────────────
    const goWildFound =
      (json?.dayTrips ?? []).some(
        (f: any) =>
          f.outbound?.cabin?.toLowerCase().includes("wild") ||
          f.return?.cabin?.toLowerCase().includes("wild"),
      ) ||
      (json?.flights ?? []).some(
        (f: any) =>
          f.fares?.go_wild != null ||
          f.rawPayload?.fares?.go_wild?.total != null,
      );

    await (supabase.from("flight_searches") as any).insert({
      user_id: userId,
      departure_airport: homeIata,
      arrival_airport: null,
      departure_date: dateStr,
      return_date: null,
      trip_type: "day_trip",
      all_destinations: "Yes",
      json_body: json,
      request_body: {
        endpoint: "GET https://getmydata.fly.dev/api/flights/dayTrips",
        params: { origin: homeIata, date: dateStr, nonstop: "true", layovertime: "6" },
        source: "auto_background",
      },
      gowild_found: goWildFound,
      flight_results_count: (json?.dayTrips ?? json?.flights ?? []).length,
    });
  } catch {
    // If API call fails, mark cache entry as error
    try {
      await (supabase.from("flight_search_cache") as any)
        .update({ status: "error", error: "fetch_failed" })
        .eq("cache_key", cacheKey)
        .eq("reset_bucket", bucket);
    } catch { /* ignore */ }
  }
}
