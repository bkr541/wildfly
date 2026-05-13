import { useState, useRef, useMemo } from "react";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  CalendarCheckOut02Icon,
  AirportIcon,
  City01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  Search01Icon,
  Refresh01Icon,
  Analytics01Icon,
  Settings01Icon,
  Alert01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { fetchFlightSearch } from "@/lib/flightApi";
import { normalizeAllDestinationsResponse } from "@/utils/normalizeFlights";
import { writeFlightSnapshots } from "@/utils/flightSnapshotWriter";
import { isBlackoutDate } from "@/utils/blackoutDates";

// ── Types ────────────────────────────────────────────────────────────────────

type DestinationInfo = {
  iata: string;
  locationName: string;
  airportName: string;
};

type OriginResult = {
  origin: string;
  name: string;
  destinations: DestinationInfo[];
  status: "ok" | "retried" | "error";
  attempts?: number;
  errorMessage?: string;
};

type ResultFilter   = "all" | "success" | "failed";
type ResultSort     = "az" | "za" | "most" | "fewest";
type TimezoneGroup  = "ET" | "CT" | "MT" | "PT";

// ── Constants ────────────────────────────────────────────────────────────────

const DELAY_MS        = 750;
const MAX_RETRIES     = 3;
const BACKOFF_BASE_MS = 5000;

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

const TIMEZONE_LABELS: Record<TimezoneGroup, { abbr: string; name: string; offset: string }> = {
  ET: { abbr: "ET",  name: "Eastern",  offset: "UTC−5/4" },
  CT: { abbr: "CT",  name: "Central",  offset: "UTC−6/5" },
  MT: { abbr: "MT",  name: "Mountain", offset: "UTC−7/6" },
  PT: { abbr: "PT",  name: "Pacific",  offset: "UTC−8/7" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

type AirportLookup = Record<string, { airportName: string; locationName: string }>;

function enrichDestinations(iatas: string[], lookup: AirportLookup): DestinationInfo[] {
  return iatas.map((iata) => ({
    iata,
    airportName: lookup[iata]?.airportName ?? iata,
    locationName: lookup[iata]?.locationName ?? "",
  }));
}

// ── Ring Chart ───────────────────────────────────────────────────────────────

function RingChart({
  value,
  total,
  color,
  label,
}: {
  value: number;
  total: number;
  color: string;
  label: string;
}) {
  const r = 44;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.min(value / total, 1) : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="relative" style={{ width: 112, height: 112 }}>
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8EEEE" strokeWidth={10} />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-[#6B7280]">{value}/{total}</span>
        </div>
      </div>
      <span className="text-sm text-[#9CA3AF] font-medium">{label}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBulkSearch() {
  const [date, setDate]                     = useState(format(new Date(), "yyyy-MM-dd"));
  const [domesticOnly, setDomesticOnly]     = useState(false);
  const [optimizeByTz, setOptimizeByTz]     = useState(true);
  const [selectedTz, setSelectedTz]         = useState<TimezoneGroup | null>(null);
  const [running, setRunning]               = useState(false);
  const [statusLine, setStatusLine]       = useState("");
  const [results, setResults]             = useState<OriginResult[]>([]);
  const [progress, setProgress]           = useState({ current: 0, total: 0 });

  // per-origin expand (default collapsed — empty set = all collapsed)
  const [expanded, setExpanded]                           = useState<Set<string>>(new Set());
  // group collapse
  const [allDestCollapsed, setAllDestCollapsed]           = useState(false);
  const [conditionsCollapsed, setConditionsCollapsed]     = useState(false);
  const [breakdownCollapsed, setBreakdownCollapsed]       = useState(false);
  const [failedCollapsed, setFailedCollapsed]             = useState(false);

  // toolbar state
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [resultSort, setResultSort]     = useState<ResultSort>("az");
  const [resultSearch, setResultSearch] = useState("");

  const isBlackout = isBlackoutDate(date);
  const abortRef   = useRef(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const okCount  = results.filter((r) => r.status !== "error").length;
  const errCount = results.filter((r) => r.status === "error").length;
  const pct      = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const hasRun   = progress.total > 0;

  const filteredResults = useMemo(() => {
    let list = results.slice();
    if (resultFilter === "success") list = list.filter((r) => r.status !== "error");
    if (resultFilter === "failed")  list = list.filter((r) => r.status === "error");
    if (resultSearch.trim()) {
      const q = resultSearch.toLowerCase();
      list = list.filter(
        (r) => r.origin.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (resultSort === "az")     return a.origin.localeCompare(b.origin);
      if (resultSort === "za")     return b.origin.localeCompare(a.origin);
      if (resultSort === "most")   return b.destinations.length - a.destinations.length;
      if (resultSort === "fewest") return a.destinations.length - b.destinations.length;
      return 0;
    });
    return list;
  }, [results, resultFilter, resultSort, resultSearch]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const pushResult = (r: OriginResult) => setResults((prev) => [...prev, r]);

  const toggleCollapse = (origin: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(origin) ? next.delete(origin) : next.add(origin);
      return next;
    });

  const handleStartNew = () => {
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setExpanded(new Set());
    setAllDestCollapsed(false);
    setStatusLine("");
    setResultFilter("all");
    setResultSort("az");
    setResultSearch("");
  };

  const runBulkSearch = async () => {
    setRunning(true);
    setResults([]);
    setExpanded(new Set());
    setStatusLine("");
    setProgress({ current: 0, total: 0 });
    abortRef.current = false;

    const { data: { user } } = await supabase.auth.getUser();
    const { data: airports, error } = await supabase
      .from("airports")
      .select("iata_code, name, timezone, locations(country, name)")
      .eq("is_active", true)
      .order("iata_code");

    if (error || !airports?.length) {
      pushResult({ origin: "—", name: error?.message ?? "No airports found", destinations: [], status: "error" });
      setRunning(false);
      return;
    }

    const airportLookup: AirportLookup = {};
    for (const row of airports as any[]) {
      airportLookup[row.iata_code] = {
        airportName: row.name ?? row.iata_code,
        locationName: row.locations?.name ?? "",
      };
    }

    let filtered = airports as any[];
    if (domesticOnly) {
      filtered = filtered.filter((a) => (a.locations as any)?.country === "United States of America");
    }
    if (optimizeByTz && selectedTz) {
      const tzSet = new Set(TIMEZONE_GROUPS[selectedTz]);
      filtered = filtered.filter((a) => tzSet.has(a.timezone));
    }

    setProgress({ current: 0, total: filtered.length });
    const bucket = resetBucket(date);

    for (let i = 0; i < filtered.length; i++) {
      if (abortRef.current) break;

      const { iata_code, name } = filtered[i];
      setProgress({ current: i + 1, total: filtered.length });
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

        const normalized = normalizeAllDestinationsResponse(raw, date);

        const destIatas = [
          ...new Set(
            normalized.flights
              .map((f: any) => f.destination ?? f.arrival_airport)
              .filter(Boolean) as string[]
          ),
        ].sort();

        const destinations = enrichDestinations(destIatas, airportLookup);

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

        const goWildFound = normalized.flights.some(
          (f: any) => f.fares?.go_wild != null || f.rawPayload?.fares?.go_wild?.total != null,
        );

        const { data: fsRow } = await (supabase.from("flight_searches") as any)
          .insert({
            user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
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
            triggered_by: "admin_bulk_search",
          } as any)
          .select("id")
          .single();

        if (fsRow?.id) {
          writeFlightSnapshots(fsRow.id, normalized.flights, iata_code).catch((e) =>
            console.warn("[bulk-search] snapshot write failed", iata_code, e),
          );
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

      if (i < filtered.length - 1 && !abortRef.current) await sleep(DELAY_MS);
    }

    setStatusLine("");
    setRunning(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const cardStyle = {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
    >
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-8 pb-10 gap-4">

        {/* Header */}
        <div className="px-1 mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5 select-none">
              <span className="text-[22px] font-medium text-[#6B7280]">Bulk</span>
              <span className="text-[22px] font-black tracking-widest uppercase text-[#10B981]">Search</span>
            </div>
            <p className="text-sm text-[#6B7B7B] mt-0.5">
              Take a snapshot of all destinations from all airports.
            </p>
          </div>

          {hasRun && !running && (
            <button
              onClick={handleStartNew}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#059669] transition-opacity hover:opacity-70"
              style={{ background: "rgba(209,250,229,0.7)", border: "1px solid #6EE7B7" }}
            >
              <HugeiconsIcon icon={Refresh01Icon} size={13} color="#059669" strokeWidth={2.5} />
              Start New Search
            </button>
          )}
        </div>

        {/* Controls card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07)",
          }}
        >
          <button
            type="button"
            onClick={() => setConditionsCollapsed((v) => !v)}
            className="w-full flex items-center gap-2 px-5 py-4 text-left border-b border-[#F0F1F1]"
          >
            <HugeiconsIcon icon={Settings01Icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
            <div className="flex-1">
              <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Search Conditions</p>
              <p className="text-xs text-[#6B7B7B]">Configure the date and scope of the bulk run</p>
            </div>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              color="#9CA3AF"
              strokeWidth={2}
              className="shrink-0 transition-transform duration-200 mt-0.5"
              style={{ transform: conditionsCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
            />
          </button>
          {!conditionsCollapsed && <div className="px-5 pt-4 pb-5">
            <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">
              Departure Date
            </label>
            <div className="app-input-container" style={{ minHeight: 48 }}>
              <button type="button" tabIndex={-1} className="app-input-icon-btn">
                <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={running}
                className="app-input disabled:opacity-50"
              />
            </div>

            {/* Optimize by Timezone toggle */}
            <button
              type="button"
              onClick={() => !running && setOptimizeByTz((v) => !v)}
              className="mt-4 flex items-center justify-end gap-3 w-full"
              disabled={running}
            >
              <span className="text-sm font-semibold text-[#2E4A4A]">Optimize by Timezone</span>
              <span
                className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
                style={{
                  background: optimizeByTz
                    ? "linear-gradient(90deg, #059669 0%, #10b981 100%)"
                    : "#D1D5DB",
                }}
              >
                <span
                  className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 m-0.5"
                  style={{ transform: optimizeByTz ? "translateX(20px)" : "translateX(0)" }}
                />
              </span>
            </button>

            {/* Domestic Only toggle */}
            <button
              type="button"
              onClick={() => !running && setDomesticOnly((v) => !v)}
              className="mt-3 flex items-center justify-end gap-3 w-full"
              disabled={running}
            >
              <span className="text-sm font-semibold text-[#2E4A4A]">Domestic Only</span>
              <span
                className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
                style={{
                  background: domesticOnly
                    ? "linear-gradient(90deg, #059669 0%, #10b981 100%)"
                    : "#D1D5DB",
                }}
              >
                <span
                  className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 m-0.5"
                  style={{ transform: domesticOnly ? "translateX(20px)" : "translateX(0)" }}
                />
              </span>
            </button>

            {/* Timezone picker */}
            {optimizeByTz && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {(["ET", "CT", "MT", "PT"] as TimezoneGroup[]).map((tz) => {
                  const { abbr, name, offset } = TIMEZONE_LABELS[tz];
                  const isSelected = selectedTz === tz;
                  return (
                    <button
                      key={tz}
                      type="button"
                      disabled={running}
                      onClick={() => setSelectedTz((prev) => prev === tz ? null : tz)}
                      className="flex flex-col items-center py-2.5 px-1 rounded-xl transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: isSelected
                          ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                          : "#F0F4F4",
                        border: isSelected ? "1.5px solid #059669" : "1.5px solid #E0E9E9",
                      }}
                    >
                      <span
                        className="text-base font-black tracking-widest"
                        style={{ color: isSelected ? "white" : "#2E4A4A" }}
                      >
                        {abbr}
                      </span>
                      <span
                        className="text-[10px] font-semibold mt-0.5"
                        style={{ color: isSelected ? "rgba(255,255,255,0.85)" : "#6B7B7B" }}
                      >
                        {name}
                      </span>
                      <span
                        className="text-[9px] mt-0.5"
                        style={{ color: isSelected ? "rgba(255,255,255,0.65)" : "#9CA3AF" }}
                      >
                        {offset}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Blackout error */}
            {isBlackout && (
              <p className="mt-3 text-xs font-semibold text-[#ef4444]">
                Selected search date is a blackout date.
              </p>
            )}

            {/* Action button */}
            <div className="mt-4">
              {!running ? (
                <button
                  onClick={runBulkSearch}
                  disabled={isBlackout || (optimizeByTz && !selectedTz)}
                  className="w-full h-12 rounded-full font-bold text-sm tracking-widest uppercase text-white transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(90deg, #059669 0%, #10b981 100%)" }}
                >
                  Run Bulk Search
                </button>
              ) : (
                <button
                  onClick={() => { abortRef.current = true; }}
                  className="w-full h-12 rounded-full font-bold text-sm tracking-widest uppercase text-white transition-opacity hover:opacity-90 active:opacity-75"
                  style={{ background: "linear-gradient(90deg, #dc2626 0%, #ef4444 100%)" }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <HugeiconsIcon icon={Cancel01Icon} size={16} color="white" strokeWidth={2.5} />
                    Stop
                  </div>
                </button>
              )}
            </div>
          </div>}
        </div>

        {/* Empty state */}
        {results.length === 0 && !running && !hasRun && (
          <div
            className="rounded-2xl px-5 py-10 flex flex-col items-center gap-3 text-center"
            style={cardStyle}
          >
            <div className="h-14 w-14 rounded-full bg-[#F0FDF4] flex items-center justify-center">
              <HugeiconsIcon icon={AirportIcon} size={26} color="#059669" strokeWidth={1.5} />
            </div>
            <p className="text-[#2E4A4A] font-bold text-base">Ready to search</p>
            <p className="text-[#9CA3AF] text-sm">
              Pick a date and hit Run to fire All Destinations<br />searches for all{" "}
              <span className="font-semibold text-[#6B7B7B]">72 airports</span>.
            </p>
          </div>
        )}

        {/* Stats ring charts */}
        {hasRun && (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <button
              type="button"
              onClick={() => setBreakdownCollapsed((v) => !v)}
              className="w-full flex items-center gap-2 px-5 py-4 text-left border-b border-[#F0F1F1]"
            >
              <HugeiconsIcon icon={Analytics01Icon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
              <div className="flex-1">
                <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">Results Breakdown</p>
                <p className="text-xs text-[#6B7B7B]">Success and failure summary for this bulk run</p>
              </div>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                color="#9CA3AF"
                strokeWidth={2}
                className="shrink-0 transition-transform duration-200 mt-0.5"
                style={{ transform: breakdownCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              />
            </button>
            {!breakdownCollapsed && (
              <div className="flex flex-col">
                <div className="px-6 pt-5 pb-5 flex items-center justify-around">
                  <RingChart value={okCount}  total={progress.total} color="#059669" label="Success" />
                  <div className="w-px h-20 bg-[#F0F1F1]" />
                  <RingChart value={errCount} total={progress.total} color="#ef4444" label="Failed"  />
                </div>
                <div className="px-6 pb-5">
                  <div className="flex justify-between text-xs text-[#6B7B7B] mb-1.5">
                    <span>
                      {running
                        ? statusLine || `Processing ${progress.current} / ${progress.total}`
                        : `Done — ${okCount} succeeded${errCount > 0 ? `, ${errCount} failed` : ""}`}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E8EEEE] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, #059669 0%, #10b981 100%)",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Failed Searches group */}
        {errCount > 0 && (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <button
              type="button"
              onClick={() => setFailedCollapsed((v) => !v)}
              className="w-full flex items-center gap-2 px-5 py-4 text-left border-b border-[#FEE2E2]"
            >
              <HugeiconsIcon icon={Alert01Icon} size={28} color="#ef4444" strokeWidth={1.5} className="shrink-0" />
              <div className="flex-1">
                <p className="text-base font-semibold text-[#ef4444] uppercase tracking-wider">Failed Searches</p>
                <p className="text-xs text-[#6B7B7B]">{errCount} airport{errCount !== 1 ? "s" : ""} could not be searched</p>
              </div>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                color="#9CA3AF"
                strokeWidth={2}
                className="shrink-0 transition-transform duration-200 mt-0.5"
                style={{ transform: failedCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              />
            </button>
            {!failedCollapsed && (
              <div className="divide-y divide-[#FEE2E2]">
                {results.filter((r) => r.status === "error").map((r) => (
                  <div key={r.origin} className="flex items-center px-5 py-3" style={{ background: "rgba(254,242,242,0.5)" }}>
                    <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={28} color="#ef4444" strokeWidth={1.5} className="shrink-0" />
                    <div className="flex-1 ml-2 min-w-0">
                      <p className="text-base font-semibold uppercase tracking-wider leading-tight text-[#ef4444]">{r.origin}</p>
                      <p className="text-xs text-[#6B7B7B] truncate">{r.name}{r.errorMessage ? ` · ${r.errorMessage}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Destinations results group */}
        {results.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>

            {/* Parent header */}
            <button
              type="button"
              onClick={() => setAllDestCollapsed((v) => !v)}
              className="w-full flex items-center gap-2 px-5 py-4 text-left border-b border-[#F0F1F1]"
            >
              <HugeiconsIcon icon={AirportIcon} size={28} color="#059669" strokeWidth={1.5} className="shrink-0" />
              <div className="flex-1">
                <p className="text-base font-semibold text-[#059669] uppercase tracking-wider">All Destinations</p>
                <p className="text-xs text-[#6B7B7B]">Destinations found per origin airport</p>
              </div>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                color="#9CA3AF"
                strokeWidth={2}
                className="shrink-0 transition-transform duration-200 mt-0.5"
                style={{ transform: allDestCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              />
            </button>

            {!allDestCollapsed && (
              <>
                {/* Toolbar */}
                <div className="px-4 pt-3 pb-2 flex flex-col gap-2 border-b border-[#F0F1F1]">
                  {/* Search input */}
                  <div className="app-input-container" style={{ minHeight: 44 }}>
                    <button type="button" tabIndex={-1} className="app-input-icon-btn">
                      <HugeiconsIcon icon={Search01Icon} size={18} color="currentColor" strokeWidth={2} />
                    </button>
                    <input
                      type="text"
                      value={resultSearch}
                      onChange={(e) => setResultSearch(e.target.value)}
                      placeholder="Search by IATA or airport name…"
                      className="app-input"
                    />
                    {resultSearch && (
                      <button onClick={() => setResultSearch("")} tabIndex={-1} className="app-input-icon-btn">
                        <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  {/* Filter + Sort row */}
                  <div className="flex items-center gap-2">
                    {/* Filter pills */}
                    <div
                      className="relative rounded-full p-[2px] flex"
                      style={{
                        width: 260,
                        background: "#E8EEEE",
                        border: "1px solid #D1DADA",
                      }}
                    >
                      <div
                        className="absolute top-[2px] bottom-[2px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out"
                        style={{
                          background: "#10B981",
                          width: "calc((100% - 4px) / 3)",
                          left: `calc(2px + (100% - 4px) * ${["all", "success", "failed"].indexOf(resultFilter)} / 3)`,
                        }}
                      />
                      {(["all", "success", "failed"] as ResultFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setResultFilter(f)}
                          className="flex-1 py-1 text-base font-semibold capitalize rounded-full transition-all duration-300 relative z-10"
                          style={{ color: resultFilter === f ? "white" : "#9CA3AF" }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    {/* Sort select */}
                    <div className="app-input-container ml-auto" style={{ minHeight: 36, width: 172 }}>
                      <select
                        value={resultSort}
                        onChange={(e) => setResultSort(e.target.value as ResultSort)}
                        className="app-input text-xs cursor-pointer"
                        style={{ paddingInline: "0.4em" }}
                      >
                        <option value="az">A → Z</option>
                        <option value="za">Z → A</option>
                        <option value="most">Most destinations</option>
                        <option value="fewest">Fewest destinations</option>
                      </select>
                    </div>
                  </div>

                  {/* Collapse All row */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setExpanded(new Set())}
                      className="text-xs font-semibold text-[#9CA3AF] hover:text-[#059669] transition-colors"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Origin rows */}
                <div className="divide-y divide-[#F0F1F1]">
                  {filteredResults.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-[#9CA3AF]">No results match your filter.</p>
                  ) : (
                    filteredResults.map((r) => {
                      const isCollapsed = !expanded.has(r.origin);
                      const isError     = r.status === "error";
                      const originColor = isError ? "#ef4444" : "#059669";
                      return (
                        <div key={r.origin} style={{ background: isError ? "rgba(254,242,242,0.6)" : undefined }}>
                          {/* Origin header */}
                          <button
                            type="button"
                            onClick={() => toggleCollapse(r.origin)}
                            className="w-full flex items-center px-4 py-3 text-left"
                          >
                            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={28} color={originColor} strokeWidth={1.5} className="shrink-0" />
                            <div className="flex-1 ml-2 min-w-0">
                              <p className="text-base font-semibold uppercase tracking-wider leading-tight" style={{ color: originColor }}>{r.origin}</p>
                              <p className="text-xs text-[#6B7B7B] truncate">
                                {isError
                                  ? r.errorMessage ?? "Error"
                                  : r.status === "retried"
                                    ? `${r.name} · ${r.destinations.length} dest. (${r.attempts} tries)`
                                    : `${r.name} · ${r.destinations.length} destinations`
                                }
                              </p>
                            </div>
                            <HugeiconsIcon
                              icon={ArrowDown01Icon}
                              size={14}
                              color="#9CA3AF"
                              strokeWidth={1.5}
                              className="shrink-0 transition-transform duration-200 ml-2"
                              style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                            />
                          </button>

                          {/* Destination list */}
                          {!isCollapsed && (
                            <>
                              {r.destinations.length > 0 && (
                                <div className="border-t border-[#F0F1F1] divide-y divide-[#F0F1F1]">
                                  {r.destinations.map((dest) => (
                                    <div key={dest.iata} className="flex items-center px-4 py-2.5 pl-14">
                                      <HugeiconsIcon icon={City01Icon} size={20} color="#059669" strokeWidth={1.5} className="shrink-0" />
                                      <div className="flex-1 ml-2 min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-base font-bold text-[#2E4A4A] uppercase tracking-wider shrink-0">{dest.iata}</span>
                                          {dest.locationName && <span className="text-sm text-[#6B7B7B] font-normal truncate">{dest.locationName}</span>}
                                        </div>
                                        {dest.airportName && dest.airportName !== dest.iata && (
                                          <p className="text-xs text-[#9CA3AF] truncate">{dest.airportName}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
