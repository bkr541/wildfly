import { useState, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchFlightSearch } from "@/lib/flightApi";
import { normalizeAllDestinationsResponse } from "@/utils/normalizeFlights";
import { writeFlightSnapshots } from "@/utils/flightSnapshotWriter";

type OriginResult = {
  origin: string;
  name: string;
  destinations: string[];
  status: "ok" | "retried" | "error";
  attempts?: number;
  errorMessage?: string;
};

const DELAY_MS = 750;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function searchWithRetry(
  iata: string,
  date: string,
  onBackoff: (iata: string, attempt: number, waitMs: number) => void,
  abortRef: React.MutableRefObject<boolean>,
): Promise<{ data: any; attempts: number }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fetchFlightSearch({ origin: iata, departureDate: date });
      return { data: result.data, attempts: attempt };
    } catch (err: any) {
      if (!isRateLimit(err) || attempt === MAX_RETRIES) throw err;
      const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      onBackoff(iata, attempt, waitMs);
      const chunks = Math.ceil(waitMs / 500);
      for (let c = 0; c < chunks; c++) {
        if (abortRef.current) throw new Error("Aborted by user");
        await sleep(500);
      }
    }
  }
  throw new Error("Unreachable");
}

export default function AdminBulkSearch() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [running, setRunning] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const [results, setResults] = useState<OriginResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  const pushResult = (r: OriginResult) => setResults((prev) => [...prev, r]);

  const runBulkSearch = async () => {
    setRunning(true);
    setResults([]);
    setStatusLine("");
    setProgress({ current: 0, total: 0 });
    abortRef.current = false;

    const { data: { user } } = await supabase.auth.getUser();

    const { data: airports, error } = await supabase
      .from("airports")
      .select("iata_code, name")
      .order("iata_code");

    if (error || !airports?.length) {
      pushResult({ origin: "—", name: error?.message ?? "No airports found", destinations: [], status: "error" });
      setRunning(false);
      return;
    }

    setProgress({ current: 0, total: airports.length });
    const bucket = resetBucket(date);

    for (let i = 0; i < airports.length; i++) {
      if (abortRef.current) break;

      const { iata_code, name } = airports[i];
      setProgress({ current: i + 1, total: airports.length });
      setStatusLine(`Searching ${iata_code}…`);

      try {
        const { data: raw, attempts } = await searchWithRetry(
          iata_code,
          date,
          (iata, attempt, waitMs) => {
            setStatusLine(`${iata} rate limited — waiting ${waitMs / 1000}s (retry ${attempt}/${MAX_RETRIES})…`);
          },
          abortRef,
        );

        const normalized = normalizeAllDestinationsResponse(raw);

        // Unique, sorted destination IATAs
        const destinations = [
          ...new Set(
            normalized.flights
              .map((f: any) => f.destination ?? f.arrival_airport)
              .filter(Boolean) as string[]
          ),
        ].sort();

        const cacheKey = await sha256(`${iata_code}|__ALL__|${date}`);

        await (supabase.from("flight_search_cache") as any).upsert(
          {
            cache_key: cacheKey,
            reset_bucket: bucket,
            canonical_request: { origin: iata_code, destination: "__ALL__", departureDate: date },
            provider: "frontier",
            status: "ready",
            payload: normalized,
            dep_iata: iata_code,
            arr_iata: "__ALL__",
          },
          { onConflict: "cache_key,reset_bucket" },
        );

        if (user) {
          const goWildFound = normalized.flights.some(
            (f: any) => f.fares?.go_wild != null || f.rawPayload?.fares?.go_wild?.total != null,
          );

          const { data: fsRow } = await (supabase.from("flight_searches") as any)
            .insert({
              user_id: user.id,
              departure_airport: iata_code,
              arrival_airport: null,
              departure_date: date,
              return_date: null,
              trip_type: "one_way",
              all_destinations: "Yes",
              json_body: normalized,
              request_body: {
                endpoint: "POST https://getmydata.fly.dev/api/flights/search",
                headers: { "Content-Type": "application/json" },
                body: { origin: iata_code, departureDate: date },
              },
              credits_cost: 0,
              arrival_airports_count: 0,
              gowild_found: goWildFound,
              flight_results_count: normalized.flights.length,
            } as any)
            .select("id")
            .single();

          if (fsRow?.id) {
            writeFlightSnapshots(fsRow.id, normalized.flights, iata_code).catch(() => {});
          }
        }

        pushResult({
          origin: iata_code,
          name,
          destinations,
          status: attempts > 1 ? "retried" : "ok",
          attempts,
        });
      } catch (err: any) {
        pushResult({
          origin: iata_code,
          name,
          destinations: [],
          status: "error",
          errorMessage: err?.message ?? "Unknown error",
        });
      }

      if (i < airports.length - 1 && !abortRef.current) await sleep(DELAY_MS);
    }

    setStatusLine("");
    setRunning(false);
  };

  const okCount = results.filter((r) => r.status !== "error").length;
  const errCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Admin – Bulk All-Destinations Search</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Fires an All Destinations search for every origin airport. Writes results to the cache,
        flight_searches, and flight_snapshots. Rate-limited requests retry up to {MAX_RETRIES}× with
        exponential backoff (5s → 10s → 20s).
      </p>

      <div className="flex flex-wrap gap-4 items-end mb-8">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Departure Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={running}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground disabled:opacity-50"
          />
        </div>

        {!running ? (
          <button
            onClick={runBulkSearch}
            className="px-6 py-2 rounded-lg bg-foreground text-background font-bold text-sm tracking-widest uppercase"
          >
            Run Bulk Search
          </button>
        ) : (
          <button
            onClick={() => { abortRef.current = true; }}
            className="px-6 py-2 rounded-lg bg-destructive text-destructive-foreground font-bold text-sm tracking-widest uppercase"
          >
            Stop
          </button>
        )}
      </div>

      {progress.total > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>
              {running
                ? statusLine || `Processing ${progress.current} / ${progress.total}`
                : `Done — ${okCount} succeeded, ${errCount} failed`}
            </span>
            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 ${
                r.status === "error" ? "border-destructive/40 bg-destructive/5" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono font-bold text-sm w-10">{r.origin}</span>
                <span className="text-xs text-muted-foreground flex-1">{r.name}</span>
                <span className="text-xs">
                  {r.status === "ok" && <span className="text-accent-blue">✓ {r.destinations.length} destinations</span>}
                  {r.status === "retried" && <span className="text-accent-yellow">↻ {r.destinations.length} destinations ({r.attempts} tries)</span>}
                  {r.status === "error" && <span className="text-destructive">✗ {r.errorMessage}</span>}
                </span>
              </div>

              {r.destinations.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-13">
                  {r.destinations.map((dest) => (
                    <span
                      key={dest}
                      className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                    >
                      {dest}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
