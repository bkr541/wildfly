import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  normalizeFlightCacheRequest,
  readFlightCache,
} from "../_shared/flightCache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ ok: false, error: "Unauthorized" }, 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    if (body?.purpose === "home_day_trips") {
      const requestedDates = Array.isArray(body.dates) ? body.dates : [];
      if (requestedDates.length < 1 || requestedDates.length > 2) {
        return json({ ok: false, error: "One or two dates are required" }, 400);
      }

      const now = new Date();
      const allowedDates = new Set([
        dateOnly(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
        dateOnly(now),
        dateOnly(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
        dateOnly(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)),
      ]);
      if (requestedDates.some((value: unknown) => typeof value !== "string" || !allowedDates.has(value))) {
        return json({ ok: false, error: "Unsupported day-trip date" }, 400);
      }

      const { data: info, error } = await admin
        .from("user_info")
        .select("home_airport")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!info?.home_airport) return json({ ok: true, data: [] });

      const results = [];
      for (const date of requestedDates) {
        const canonical = normalizeFlightCacheRequest({
          path: "/dayTrips",
          method: "GET",
          params: {
            origin: info.home_airport,
            date,
            nonstop: "true",
            layovertime: "6",
          },
        });
        const hit = await readFlightCache(admin, canonical);
        results.push({ date, data: hit?.response ?? null, hit: Boolean(hit), observedAt: hit?.observedAt ?? null });
      }
      return json({ ok: true, data: results });
    }

    return json({ ok: false, error: "Unsupported cache purpose" }, 400);
  } catch (error) {
    console.error("[flight-cache] request failed", (error as Error).message);
    return json({ ok: false, error: "Could not read cached flight data" }, 500);
  }
});
