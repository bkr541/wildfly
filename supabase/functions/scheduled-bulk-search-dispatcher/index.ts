// scheduled-bulk-search-dispatcher
// Runs every 5 minutes via pg_cron. Checks current time in America/New_York
// and, when it matches one of the configured trigger windows, fires the
// scheduled-bulk-search job for the matching timezone group.
//
// Trigger windows (Eastern wall-clock):
//   00:00–00:09 → ET
//   01:00–01:09 → CT
//   02:00–02:09 → MT
//   03:00–03:09 → PT
// (10-minute window so any single 5-min cron tick inside the hour catches it.)
//
// Idempotent: skips if a non-skipped log row already exists for the
// timezone_group + target_date within the last 2 hours.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type TZ = "ET" | "CT" | "MT" | "PT";

function easternHour(): { hour: number; minute: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

function tomorrowEastern(todayDate: string): string {
  const [y, m, d] = todayDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + 86400000);
  return dt.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Gate: caller must present the configured shared secret as Bearer
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


  const { hour, minute, date: easternToday } = easternHour();

  // Map hour → tz group. Only fire in the first 10 minutes of each hour
  // (covers the requested HH:02 trigger, with slack for cron tick alignment).
  const MAP: Record<number, TZ> = { 0: "ET", 1: "CT", 2: "MT", 3: "PT" };
  const tz = MAP[hour];

  if (!tz || minute >= 10) {
    return new Response(JSON.stringify({
      ok: true, skipped: true, reason: "outside trigger window",
      easternHour: hour, easternMinute: minute,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const targetDate = tomorrowEastern(easternToday);
  // admin client created above


  // Idempotency: skip if we already have a non-skipped log row for this slot
  // in the last 2 hours
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin
    .from("bulk_search_job_logs")
    .select("id, status")
    .eq("timezone_group", tz)
    .eq("target_date", targetDate)
    .neq("status", "skipped")
    .gte("started_at", since)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[dispatcher] tz=${tz} date=${targetDate} already ran (id=${existing[0].id})`);
    return new Response(JSON.stringify({
      ok: true, skipped: true, reason: "already_ran",
      timezone: tz, target_date: targetDate,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Fire scheduled-bulk-search. We do NOT await the response (long-running)
  // — Deno keeps the request alive via EdgeRuntime.waitUntil-style fetch.
  // But invoking with .invoke() blocks; use bare fetch + don't await body.
  const url = `${SUPABASE_URL}/functions/v1/scheduled-bulk-search`;
  console.log(`[dispatcher] firing tz=${tz} date=${targetDate}`);

  // Fire-and-forget: start the request but don't block the cron response.
  // Use a background task so the server stays alive long enough.
  // @ts-ignore EdgeRuntime is provided by Supabase edge runtime
  EdgeRuntime.waitUntil((async () => {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sharedSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timezone: tz, date: targetDate }),
      });
      console.log(`[dispatcher] tz=${tz} returned ${r.status}`);
    } catch (e) {
      console.error(`[dispatcher] tz=${tz} fetch failed: ${(e as Error).message}`);
    }
  })());

  return new Response(JSON.stringify({
    ok: true, fired: true, timezone: tz, target_date: targetDate,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
