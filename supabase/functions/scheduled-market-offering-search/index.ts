// scheduled-market-offering-search
// Runs quarterly (1st of Jan/Apr/Jul/Oct at 05:00 ET) via pg_cron → SQL wrapper.
// Reads the bundled market_offerings.json and:
//   A. Snapshots the JSON to frontier_market_snapshots
//   B. Upserts airports/locations for each station in marketDetails
//   C. Deactivates airports missing from the JSON (frontier_source scoped)
//   D. Upserts frontier_routes and deactivates stale route pairs
//
// Idempotent: skips if a snapshot was already created this calendar quarter.
//
// market_offerings.json is a copy of src/data/market_offerings.json.
// When the source file is updated, redeploy this function.
// Future: the scraper will deploy updates automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketOfferingStation {
  stationCode: string;
  stationName: string;
  cityAndCode: string;
  countryCode: string;
  countryHeader: string;
  state?: string;
  stateCode?: string;
  imageURL?: string;
}

interface MarketOfferingRoute {
  fromStation: string;
  toStations: string[];
}

interface MarketOfferings {
  marketDetails: MarketOfferingStation[];
  markets: MarketOfferingRoute[];
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getQuarterBounds(now: Date): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3; // 0, 3, 6, or 9
  const start = new Date(Date.UTC(y, quarterStartMonth, 1));
  const end = new Date(Date.UTC(y, quarterStartMonth + 3, 1));
  return { start, end };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Auth gate — same pattern as scheduled-bulk-search-dispatcher
  const auth = req.headers.get("Authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const { data: secretRow } = await admin
    .from("app_config").select("config_value")
    .eq("config_key", "scheduled_job_secret").limit(1).maybeSingle();
  const sharedSecret = secretRow?.config_value ?? "";
  if (!sharedSecret || presented !== sharedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load bundled JSON
  const marketOfferingsText = await Deno.readTextFile(
    new URL("./market_offerings.json", import.meta.url),
  );
  const marketOfferings = JSON.parse(marketOfferingsText) as MarketOfferings;

  // Idempotency: skip if a snapshot already exists for the current calendar quarter
  const now = new Date();
  const { start: quarterStart, end: quarterEnd } = getQuarterBounds(now);
  const { data: existingSnapshot } = await admin
    .from("frontier_market_snapshots")
    .select("id")
    .eq("source_type", "local_market_offerings_json")
    .gte("created_at", quarterStart.toISOString())
    .lt("created_at", quarterEnd.toISOString())
    .limit(1)
    .maybeSingle();

  if (existingSnapshot) {
    await admin.from("market_offering_sync_logs").insert({
      status: "skipped",
      snapshot_id: existingSnapshot.id,
      triggered_by: "cron",
      finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "already_ran_this_quarter",
      existing_snapshot_id: existingSnapshot.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Insert "running" log row — capture its id to finalize at the end
  const { data: logRow } = await admin
    .from("market_offering_sync_logs")
    .insert({ status: "running", triggered_by: "cron", started_at: now.toISOString() })
    .select("id").single();
  const logId = logRow?.id as string | undefined;
  const startMs = Date.now();

  let snapshotId: string | null = null;
  let stationsUpserted = 0;
  let airportsCreated = 0;
  let airportsDeactivated = 0;
  let routesUpserted = 0;
  let routesDeactivated = 0;

  try {
    // Step A: Create snapshot record
    const checksum = await sha256(JSON.stringify(marketOfferings));
    const stationCount = marketOfferings.marketDetails.length;
    const originCount = marketOfferings.markets.length;
    const routePairCount = marketOfferings.markets.reduce(
      (acc, m) => acc + (m.toStations?.length ?? 0),
      0,
    );

    const { data: snapshot, error: snapshotErr } = await admin
      .from("frontier_market_snapshots")
      .insert({
        source_type: "local_market_offerings_json",
        source_path: "supabase/functions/scheduled-market-offering-search/market_offerings.json",
        source_checksum: checksum,
        raw_json: marketOfferings,
        station_count: stationCount,
        origin_count: originCount,
        route_pair_count: routePairCount,
      })
      .select("id, created_at").single();

    if (snapshotErr || !snapshot) {
      throw new Error(`Snapshot insert failed: ${snapshotErr?.message ?? "no data returned"}`);
    }
    snapshotId = snapshot.id as string;
    const snapshotCreatedAt = snapshot.created_at as string;

    // Step B: Upsert airports and locations
    // Bulk-fetch all existing airports for current station codes to minimize queries
    const allCurrentCodes = marketOfferings.marketDetails.map(
      (s) => s.stationCode.trim().toUpperCase(),
    );
    const { data: existingAirports } = await admin
      .from("airports")
      .select("id, iata_code, location_id")
      .in("iata_code", allCurrentCodes);
    const existingMap = new Map(
      (existingAirports ?? []).map((a) => [
        (a.iata_code as string).toUpperCase(),
        a as { id: number; iata_code: string; location_id: number | null },
      ]),
    );

    for (const station of marketOfferings.marketDetails) {
      const iata = station.stationCode.trim().toUpperCase();
      const imageUrl = station.imageURL
        ? station.imageURL.startsWith("//")
          ? "https:" + station.imageURL
          : station.imageURL
        : null;
      const cityName = station.cityAndCode
        .replace(` (${station.stationCode})`, "")
        .replace(` (${station.stationCode.trim()})`, "")
        .trim();

      const existing = existingMap.get(iata);
      if (existing) {
        // Update only frontier metadata — never overwrite manually curated fields
        await admin.from("airports").update({
          is_active: true,
          frontier_source: "market_offerings_json",
          frontier_last_seen_at: snapshotCreatedAt,
          frontier_image_url: imageUrl,
        }).eq("id", existing.id);
      } else {
        // New station: insert location row first, then the airport row
        const { data: loc, error: locErr } = await admin
          .from("locations")
          .insert({
            name: station.stationName,
            city: cityName,
            state: station.state ?? null,
            state_code: station.stateCode ?? null,
            country: station.countryHeader ?? null,
          })
          .select("id").single();

        if (locErr || !loc) {
          console.error(`[market-search] location insert failed for ${iata}: ${locErr?.message}`);
          continue;
        }

        const { error: airportErr } = await admin.from("airports").insert({
          name: station.stationName,
          iata_code: iata,
          location_id: (loc as { id: number }).id,
          is_active: true,
          frontier_source: "market_offerings_json",
          frontier_last_seen_at: snapshotCreatedAt,
          frontier_image_url: imageUrl,
          metadata_status: "auto_created",
        });

        if (airportErr) {
          console.error(`[market-search] airport insert failed for ${iata}: ${airportErr.message}`);
          continue;
        }
        airportsCreated++;
      }
      stationsUpserted++;
    }

    // Step C: Deactivate stations removed from marketDetails
    // Scoped to frontier_source = 'market_offerings_json' — never deactivates curated airports
    const { data: deactivatedAirports } = await admin
      .from("airports")
      .update({ is_active: false })
      .eq("frontier_source", "market_offerings_json")
      .eq("is_active", true)
      .not("iata_code", "in", `(${allCurrentCodes.join(",")})`)
      .select("id");
    airportsDeactivated = deactivatedAirports?.length ?? 0;

    // Step D: Upsert frontier_routes in batches of 500
    const allRoutePairs: Array<{
      origin_iata: string;
      destination_iata: string;
      is_active: boolean;
      last_seen_at: string;
      last_snapshot_id: string;
    }> = [];

    for (const market of marketOfferings.markets) {
      const origin = market.fromStation?.trim().toUpperCase();
      if (!origin || origin.length !== 3) continue;
      for (const dest of market.toStations ?? []) {
        const d = dest?.trim().toUpperCase();
        if (d && d.length === 3) {
          allRoutePairs.push({
            origin_iata: origin,
            destination_iata: d,
            is_active: true,
            last_seen_at: snapshotCreatedAt,
            last_snapshot_id: snapshotId,
          });
        }
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < allRoutePairs.length; i += BATCH_SIZE) {
      const batch = allRoutePairs.slice(i, i + BATCH_SIZE);
      const { error: upsertErr } = await admin
        .from("frontier_routes")
        .upsert(batch, { onConflict: "origin_iata,destination_iata", ignoreDuplicates: false });
      if (upsertErr) {
        throw new Error(
          `Route upsert batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${upsertErr.message}`,
        );
      }
      routesUpserted += batch.length;
    }

    // Deactivate stale routes: any active route not updated to this snapshot was absent from JSON.
    // Routes with last_snapshot_id = NULL are not matched by .neq() and are left untouched.
    const { data: staleRoutes } = await admin
      .from("frontier_routes")
      .update({ is_active: false })
      .eq("is_active", true)
      .neq("last_snapshot_id", snapshotId)
      .select("id");
    routesDeactivated = staleRoutes?.length ?? 0;

    const durationMs = Date.now() - startMs;

    if (logId) {
      await admin.from("market_offering_sync_logs").update({
        status: "success",
        snapshot_id: snapshotId,
        stations_upserted: stationsUpserted,
        airports_created: airportsCreated,
        airports_deactivated: airportsDeactivated,
        routes_upserted: routesUpserted,
        routes_deactivated: routesDeactivated,
        duration_ms: durationMs,
        finished_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    console.log(
      `[market-search] done — stations=${stationsUpserted} new_airports=${airportsCreated}` +
        ` deactivated_airports=${airportsDeactivated} routes=${routesUpserted}` +
        ` stale_routes=${routesDeactivated} ms=${durationMs}`,
    );

    return new Response(JSON.stringify({
      ok: true,
      snapshot_id: snapshotId,
      stations_upserted: stationsUpserted,
      airports_created: airportsCreated,
      airports_deactivated: airportsDeactivated,
      routes_upserted: routesUpserted,
      routes_deactivated: routesDeactivated,
      duration_ms: durationMs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    console.error(`[market-search] failed: ${errorMessage}`);

    if (logId) {
      await admin.from("market_offering_sync_logs").update({
        status: "failed",
        snapshot_id: snapshotId,
        stations_upserted: stationsUpserted,
        airports_created: airportsCreated,
        routes_upserted: routesUpserted,
        error_message: errorMessage,
        duration_ms: durationMs,
        finished_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
