import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const o = url.searchParams.get("o");
    const d = url.searchParams.get("d");
    const date = url.searchParams.get("date");
    const ftype = url.searchParams.get("ftype") ?? "GW";

    if (!o || !d || !date) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required params: o, d, date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("QUARRYMINER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "QUARRYMINER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUrl = `http://localhost:3000/api/v1/data/frontier/oneWayFares?o=${encodeURIComponent(o)}&d=${encodeURIComponent(d)}&date=${encodeURIComponent(date)}&ftype=${encodeURIComponent(ftype)}`;

    const response = await fetch(targetUrl, {
      headers: {
        "X_API_Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ ok: false, error: `Upstream error ${response.status}: ${text}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
