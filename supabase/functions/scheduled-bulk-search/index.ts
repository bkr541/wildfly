// scheduled-bulk-search
// Server-side port of /admin/bulk-search. Runs the bulk search for a single
// US timezone group, for "tomorrow" in America/New_York, domestic only.
// Logs success/failure to public.bulk_search_job_logs.
//
// Auth: callers (pg_cron via pg_net) must pass the SUPABASE_SERVICE_ROLE_KEY
// as Bearer in the Authorization header. verify_jwt is disabled in config.toml.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Constants (mirror src/pages/AdminBulkSearch.tsx) ────────────────────────

const DELAY_MS = 750;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 5000;
const CHUNK_SIZE = 1;
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

type TimezoneGroup = "ET" | "CT" | "MT" | "PT";

const TIMEZONE_GROUPS: Record<TimezoneGroup, string[]> = {
  ET: [
    "America/New_York", "America/Detroit",
    "America/Indiana/Indianapolis", "America/Indiana/Marengo",
    "America/Indiana/Petersburg", "America/Indiana/Vevay",
    "America/Indiana/Vincennes", "America/Indiana/Winamac",
    "America/Kentucky/Louisville", "America/Kentucky/Monticello",
    "America/Toronto", "America/Nassau", "America/Port-au-Prince",
    "America/Jamaica", "America/Cancun", "America/Panama",
  ],
  CT: [
    "America/Chicago", "America/Indiana/Knox", "America/Indiana/Tell_City",
    "America/Menominee", "America/North_Dakota/Center",
    "America/North_Dakota/New_Salem", "America/North_Dakota/Beulah",
    "America/Winnipeg", "America/Mexico_City", "America/Monterrey",
    "America/Merida", "America/Matamoros", "America/Tegucigalpa",
    "America/Belize", "America/Costa_Rica", "America/El_Salvador",
    "America/Guatemala", "America/Managua",
  ],
  MT: [
    "America/Denver", "America/Boise", "America/Phoenix",
    "America/Ojinaga", "America/Chihuahua", "America/Mazatlan",
  ],
  PT: [
    "America/Los_Angeles", "America/Vancouver", "America/Tijuana",
    "America/Anchorage", "America/Juneau", "America/Sitka",
    "America/Nome", "Pacific/Honolulu",
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function resetBucket(departureDateStr: string): string {
  const [y, m, d] = departureDateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 1, 0)).toISOString();
}

function isRateLimit(err: any): boolean {
  const msg: string = (err?.message ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("too many");
}

/** YYYY-MM-DD for "tomorrow" in America/New_York. */
function tomorrowEastern(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

const cleanNum = (v: any): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const cleanInt = (v: any): number | null => {
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const fareField = (fare: any, snake: string, camel: string): any =>
  !fare ? null : fare[snake] ?? fare[camel] ?? null;

// ── Normalize getmydata.fly.dev /search response (ported) ───────────────────

function hhmmssToLabel(duration: string): string {
  const match = duration.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!match) return duration;
  const h = parseInt(match[1], 10);
  const mi = parseInt(match[2], 10);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hrs`);
  if (mi > 0) parts.push(`${mi} min`);
  return parts.join(" ") || "0 min";
}
function isPlusOneDay(depIso: string, arrIso: string): boolean {
  try {
    const dep = new Date(depIso), arr = new Date(arrIso);
    if (isNaN(dep.getTime()) || isNaN(arr.getTime())) return false;
    return new Date(arr.getFullYear(), arr.getMonth(), arr.getDate()).getTime() >
           new Date(dep.getFullYear(), dep.getMonth(), dep.getDate()).getTime();
  } catch { return false; }
}
function lowestNonNull(...nums: (number | null | undefined)[]): number | null {
  let min: number | null = null;
  for (const n of nums) if (n != null && isFinite(n)) if (min === null || n < min) min = n;
  return min;
}
function toTimestamp(t: string, date: string): string {
  if (!t) return "";
  if (t.includes("T")) return t;
  return `${date}T${t}`;
}

function normalizeAllDestinationsResponse(raw: any, date: string): { flights: any[] } {
  const rawFlights: any[] = raw?.data?.json?.flights ?? raw?.flights ?? [];
  const seen = new Set<string>(); const unique: any[] = [];
  for (const f of rawFlights) {
    const k = `${f.origin}|${f.destination}|${f.depart_time}|${f.arrive_time}|${f.duration}|${f.stops}`;
    if (!seen.has(k)) { seen.add(k); unique.push(f); }
  }
  const cf = (v: any) => v == null || v === -1 ? null : Number(v);
  const flights = unique.map((f: any) => {
    const standard = cf(f.fares?.standard);
    const discountDen = cf(f.fares?.discount_den);
    const goWild = cf(f.fares?.go_wild);
    return {
      ...f,
      total_duration: hhmmssToLabel(String(f.duration ?? "")),
      is_plus_one_day: isPlusOneDay(f.depart_time ?? "", f.arrive_time ?? ""),
      fares: {
        basic: lowestNonNull(goWild, discountDen, standard),
        economy: discountDen, premium: standard, business: null,
        go_wild: goWild, discount_den: discountDen, standard,
      },
      legs: (Array.isArray(f.rawPayload?.segments) && f.rawPayload.segments.length > 0)
        ? f.rawPayload.segments.map((s: any) => ({
            origin: s.departure_airport ?? "",
            destination: s.arrival_airport ?? "",
            departure_time: s.departure_time ?? "",
            arrival_time: s.arrival_time ?? "",
          }))
        : [{
            origin: f.origin ?? "", destination: f.destination ?? "",
            departure_time: toTimestamp(f.depart_time ?? "", date),
            arrival_time: toTimestamp(f.arrive_time ?? "", date),
          }],
    };
  });
  return { flights };
}

// ── Stable itinerary key builder (must match src/utils/flightSnapshotWriter.ts) ─

function _normIso(s: any): string {
  if (!s) return "?";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toISOString().slice(0, 19);
}
const _up = (v: any) => (v ? String(v).toUpperCase() : "?");
const _tok = (v: any) => (v == null || v === "" ? "?" : String(v));

function buildStableItineraryKey(f: any): string | null {
  const segments: any[] = Array.isArray(f?.rawPayload?.segments) ? f.rawPayload.segments : [];
  const topCarrier = f?.airline ?? f?.carrier ?? null;
  const topNum = f?.flightNumber ?? f?.flight_number ?? null;

  if (segments.length > 1) {
    const parts = segments.map((s: any) => {
      const o = _up(s.departure_airport ?? s.origin);
      const d = _up(s.arrival_airport ?? s.destination);
      const c = _up(s.airline ?? s.carrier ?? topCarrier);
      const n = _tok(s.flight_number ?? s.flightNumber ?? "");
      const dep = _normIso(s.departure_time);
      const arr = _normIso(s.arrival_time);
      if (o === "?" || d === "?" || dep === "?" || arr === "?") return null;
      return `${o}|${d}|${c}|${n}|${dep}|${arr}`;
    });
    if (parts.some((p) => p === null)) return null;
    return parts.join(">");
  }

  const legs: any[] = Array.isArray(f?.legs) ? f.legs : [];
  const first = segments[0] ?? legs[0];
  const last = segments[segments.length - 1] ?? legs[legs.length - 1];
  const o = _up(first?.departure_airport ?? first?.origin ?? f?.origin);
  const d = _up(last?.arrival_airport ?? last?.destination ?? f?.destination);
  const dep = _normIso(first?.departure_time ?? f?.departureTime ?? f?.depart_time);
  const arr = _normIso(last?.arrival_time ?? f?.arrivalTime ?? f?.arrive_time);
  if (o === "?" || d === "?" || dep === "?" || arr === "?") return null;
  return `${o}|${d}|${_up(topCarrier)}|${_tok(topNum)}|${dep}|${arr}`;
}

// ── Snapshot writer (ported, one row per itinerary) ─────────────────────────

function buildSnapshotRows(
  flightSearchId: string,
  flights: any[],
  originIata: string,
): { rows: any[]; stableKeys: string[] } {
  const snapshotAt = new Date().toISOString();
  const rows: any[] = [];
  const stableKeySet = new Set<string>();
  for (const f of flights) {
    const legs: any[] = Array.isArray(f.legs) ? f.legs : [];
    const first = legs[0], last = legs[legs.length - 1];
    const itinOrigin = first?.origin || f.origin || originIata;
    const itinDest = last?.destination || f.destination || "";
    const depAt = first?.departure_time || f.departureTime || f.depart_time || "";
    const arrAt = last?.arrival_time || f.arrivalTime || f.arrive_time || "";
    if (!depAt || !arrAt) continue;
    const stops = cleanInt(f.stops) ?? Math.max(0, legs.length - 1);
    const flightType = f.flightType ?? f.flight_type ?? (stops > 0 ? "Connect" : "NonStop");
    const itinId: string = f.id?.toString() ?? f.itinerary_id?.toString() ??
      [itinOrigin, itinDest, depAt].join("|");
    const rp = f.rawPayload ?? {}; const rpFares = rp.fares ?? {};
    const gw = rpFares.go_wild ?? {}, st = rpFares.standard ?? {},
          dd = rpFares.discount_den ?? {}, mi = rpFares.miles ?? {};
    const gwTotal = cleanNum(gw.total ?? f.fares?.go_wild);
    const gwSeats = cleanInt(fareField(gw, "available_seats", "availableSeats"));
    const hasGoWild = gwTotal != null;
    const stableKey = buildStableItineraryKey(f);
    if (stableKey) stableKeySet.add(stableKey);
    rows.push({
      flight_search_id: flightSearchId, snapshot_at: snapshotAt,
      source_itinerary_id: itinId,
      airline: f.airline ?? f.carrier ?? null,
      origin_iata: itinOrigin,
      display_cabin: f.cabin ?? f.displayCabin ?? null,
      display_price: cleanNum(f.price ?? f.display_price),
      currency: f.currency ?? "USD", notes: f.notes ?? null,
      flight_type: flightType, stops,
      total_duration_display: f.total_duration ?? f.duration ?? null,
      leg_index: 1,
      flight_number: f.flightNumber ?? f.flight_number ?? `${f.airline ?? "XX"}1`,
      leg_origin_iata: itinOrigin, leg_destination_iata: itinDest,
      // leg_route is a GENERATED ALWAYS column — do not insert.
      departure_at: depAt, arrival_at: arrAt,
      stable_itinerary_key: stableKey,
      availability_status: hasGoWild ? "returned" : "no_gowild_fare",
      has_go_wild: hasGoWild,
      go_wild_available_seats: hasGoWild ? gwSeats : 0,
      go_wild_fare_status: cleanInt(fareField(gw, "fare_status", "fareStatus")),
      go_wild_total: gwTotal,
      go_wild_loyalty_points: cleanInt(fareField(gw, "loyalty_points", "loyaltyPoints")),
      standard_available_seats: cleanInt(fareField(st, "available_seats", "availableSeats")),
      standard_fare_status: cleanInt(fareField(st, "fare_status", "fareStatus")),
      standard_total: cleanNum(st.total ?? f.fares?.standard),
      standard_loyalty_points: cleanInt(fareField(st, "loyalty_points", "loyaltyPoints")),
      discount_den_available_seats: cleanInt(fareField(dd, "available_seats", "availableSeats")),
      discount_den_fare_status: cleanInt(fareField(dd, "fare_status", "fareStatus")),
      discount_den_total: cleanNum(dd.total ?? f.fares?.discount_den),
      discount_den_loyalty_points: cleanInt(fareField(dd, "loyalty_points", "loyaltyPoints")),
      miles_available_seats: cleanInt(fareField(mi, "available_seats", "availableSeats")),
      miles_fare_status: cleanInt(fareField(mi, "fare_status", "fareStatus")),
      miles_total: cleanNum(mi.total ?? f.fares?.miles),
      miles_loyalty_points: cleanInt(fareField(mi, "loyalty_points", "loyaltyPoints")),
    });
  }
  return { rows, stableKeys: Array.from(stableKeySet) };
}


// ── Upstream flight API call (replicates flight-proxy) ──────────────────────

async function callFlightSearch(
  origin: string,
  departureDate: string,
  gowilderToken: string,
): Promise<any> {
  const r = await fetch("https://getmydata.fly.dev/api/flights/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${gowilderToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ origin, departureDate }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`upstream ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

async function searchWithRetry(
  iata: string, date: string, token: string,
): Promise<{ data: any; attempts: number }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await callFlightSearch(iata, date, token);
      return { data, attempts: attempt };
    } catch (err: any) {
      if (!isRateLimit(err) || attempt === MAX_RETRIES) throw err;
      await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt - 1));
    }
  }
  throw new Error("Unreachable");
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GOWILDER = Deno.env.get("GOWILDER_TOKEN") ?? "";

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const logAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Gate: caller must present the configured shared secret as Bearer
  const auth = req.headers.get("Authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const { data: secretRow } = await admin
    .from("app_config").select("config_value")
    .eq("config_key", "scheduled_job_secret").limit(1).maybeSingle();
  const expected = secretRow?.config_value ?? "";
  if (!expected || presented !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  let body: {
    timezone?: TimezoneGroup;
    date?: string;
    cursor?: number;
    logId?: string;
    succeeded?: number;
    failed?: number;
    gowildCount?: number;
  } = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const tzGroup = body.timezone;
  if (!tzGroup || !(tzGroup in TIMEZONE_GROUPS)) {
    return new Response(JSON.stringify({ error: "timezone must be ET/CT/MT/PT" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetDate = body.date ?? tomorrowEastern();
  const startedAt = new Date();
  const cursor = Math.max(0, Number(body.cursor ?? 0));

  // admin client created above for the auth check


  // Pre-flight: gowilder token from app_config (mirrors flight-proxy behavior)
  let token = GOWILDER;
  try {
    const { data: cfg } = await admin
      .from("app_config").select("config_value")
      .eq("config_key", "gowilder_token").limit(1).maybeSingle();
    if (cfg?.config_value) token = cfg.config_value;
  } catch { /* keep env fallback */ }
  if (!token) {
    return new Response(JSON.stringify({ error: "gowilder_token not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Insert one log row for the first chunk, then reuse it for continuation chunks.
  let logId = body.logId;
  if (!logId) {
    const { data: logRow } = await admin
      .from("bulk_search_job_logs")
      .insert({
        timezone_group: tzGroup, target_date: targetDate, status: "running",
        airports_total: 0, started_at: startedAt.toISOString(),
      })
      .select("id").single();
    logId = logRow?.id;
  }

  const finalize = async (patch: Record<string, unknown>) => {
    if (!logId) return;
    await logAdmin.from("bulk_search_job_logs")
      .update({ ...patch, finished_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt.getTime() })
      .eq("id", logId);
  };

  const checkpoint = async (succeeded: number, failed: number, gowildCount: number) => {
    if (!logId) return;
    const { error: logErr } = await logAdmin.from("bulk_search_job_logs").update({
      airports_succeeded: succeeded,
      airports_failed: failed,
      gowild_found_count: gowildCount,
    }).eq("id", logId);
    if (logErr) console.error(`[scheduled-bulk-search] log checkpoint failed id=${logId}: ${logErr.message}`);
  };

  try {
    // Load airports for this tz group, domestic only, active
    const { data: airports, error } = await admin
      .from("airports")
      .select("iata_code, name, timezone, locations(country, name)")
      .eq("is_active", true)
      .order("iata_code");
    if (error) throw new Error(`airports query: ${error.message}`);

    const tzSet = new Set(TIMEZONE_GROUPS[tzGroup]);
    const filtered = (airports ?? []).filter((a: any) =>
      a.locations?.country === "United States of America" && tzSet.has(a.timezone)
    );

    console.log(`[scheduled-bulk-search] tz=${tzGroup} date=${targetDate} airports=${filtered.length} cursor=${cursor}`);
    await admin.from("bulk_search_job_logs")
      .update({ airports_total: filtered.length }).eq("id", logId);

    const bucket = resetBucket(targetDate);
    let succeeded = Math.max(0, Number(body.succeeded ?? 0));
    let failed = Math.max(0, Number(body.failed ?? 0));
    let gowildCount = Math.max(0, Number(body.gowildCount ?? 0));
    const chunk = filtered.slice(cursor, cursor + CHUNK_SIZE);

    for (let i = 0; i < chunk.length; i++) {
      const { iata_code, name } = chunk[i] as any;
      try {
        const { data: raw } = await searchWithRetry(iata_code, targetDate, token);
        const normalized = normalizeAllDestinationsResponse(raw, targetDate);

        const cacheKey = await sha256(`${iata_code}|__ALL__|${targetDate}`);
        await admin.from("flight_search_cache").upsert({
          cache_key: cacheKey, reset_bucket: bucket,
          canonical_request: { origin: iata_code, destination: "__ALL__", departureDate: targetDate },
          provider: "frontier", status: "ready", payload: normalized,
          dep_iata: iata_code, arr_iata: "__ALL__",
        }, { onConflict: "cache_key,reset_bucket" });

        const goWildFound = normalized.flights.some(
          (f: any) => f.fares?.go_wild != null || f.rawPayload?.fares?.go_wild?.total != null,
        );
        if (goWildFound) gowildCount++;

        const { data: fsRow } = await admin.from("flight_searches").insert({
          user_id: SYSTEM_USER_ID,
          departure_airport: iata_code, arrival_airport: null,
          departure_date: targetDate, return_date: null,
          trip_type: "one_way", all_destinations: "Yes",
          json_body: normalized,
          request_body: {
            endpoint: "POST https://getmydata.fly.dev/api/flights/search",
            headers: { "Content-Type": "application/json" },
            body: { origin: iata_code, departureDate: targetDate },
          },
          credits_cost: 0, arrival_airports_count: 0,
          gowild_found: goWildFound,
          flight_results_count: normalized.flights.length,
          triggered_by: "scheduled_bulk_search",
          result_source: "scheduled_bulk_search",
          provider_observed_at: new Date().toISOString(),
        }).select("id").single();

        if (fsRow?.id) {
          const { rows, stableKeys } = buildSnapshotRows(fsRow.id, normalized.flights, iata_code);
          const BATCH = 100;
          for (let k = 0; k < rows.length; k += BATCH) {
            const { error: insErr } = await admin
              .from("flight_snapshots").insert(rows.slice(k, k + BATCH));
            if (insErr) console.warn(`[snapshots] ${iata_code} batch ${k}: ${insErr.message}`);
          }
          // Mark previously-available GoWild itineraries that did not return
          // in this fresh provider observation as 'not_returned'. Scope is the
          // entire origin (all destinations) for the target travel date.
          try {
            const { error: rpcErr } = await admin.rpc(
              "mark_disappeared_gowild_observations_admin",
              {
                p_flight_search_id: fsRow.id,
                p_origin_iata: iata_code,
                p_destination_iata: null,
                p_travel_date: targetDate,
                p_returned_stable_keys: stableKeys,
              },
            );
            if (rpcErr) console.warn(`[disappearance] ${iata_code}: ${rpcErr.message}`);
          } catch (e: any) {
            console.warn(`[disappearance] ${iata_code} threw: ${e?.message ?? e}`);
          }
        }
        succeeded++;
        await checkpoint(succeeded, failed, gowildCount);
        console.log(`[scheduled-bulk-search] ${iata_code} ok flights=${normalized.flights.length} gw=${goWildFound}`);
      } catch (err: any) {
        failed++;
        await checkpoint(succeeded, failed, gowildCount);
        console.error(`[scheduled-bulk-search] ${iata_code} failed: ${err?.message ?? err}`);
      }
      if (i < chunk.length - 1) await sleep(DELAY_MS);
    }

    await checkpoint(succeeded, failed, gowildCount);

    const nextCursor = cursor + chunk.length;
    if (nextCursor < filtered.length) {
      const url = `${SUPABASE_URL}/functions/v1/scheduled-bulk-search`;
      // Continue in a fresh invocation so larger timezone groups do not exceed
      // edge runtime limits and remain stuck as "running".
      // @ts-ignore EdgeRuntime is provided by Supabase edge runtime
      EdgeRuntime.waitUntil(fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${expected}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timezone: tzGroup,
          date: targetDate,
          cursor: nextCursor,
          logId,
          succeeded,
          failed,
          gowildCount,
        }),
      }).catch((e) => console.error(`[scheduled-bulk-search] continuation failed: ${e?.message ?? e}`)));

      return new Response(JSON.stringify({
        ok: true, timezone: tzGroup, target_date: targetDate,
        airports_total: filtered.length, succeeded, failed, gowildCount,
        status: "running", cursor: nextCursor,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const status = failed === 0 ? "success" : (succeeded === 0 ? "failed" : "partial");
    await finalize({
      status, airports_succeeded: succeeded, airports_failed: failed,
      gowild_found_count: gowildCount,
      error_message: failed > 0 && succeeded === 0 ? "all airports failed" : null,
    });

    return new Response(JSON.stringify({
      ok: true, timezone: tzGroup, target_date: targetDate,
      airports_total: filtered.length, succeeded, failed, gowildCount, status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[scheduled-bulk-search] fatal: ${msg}`);
    await finalize({ status: "failed", error_message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
