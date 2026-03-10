import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneTakeOff01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NormalizedFlight {
  airline?: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: string;
  fareType?: string;
  price?: number | null;
  currency?: string;
  notes?: string;
}

interface SearchResult {
  ok: boolean;
  flights: NormalizedFlight[];
  provider?: string;
  error?: string;
}

// ─── API helper ───────────────────────────────────────────────────────────────
// Sends the three form values (origin, destination, departureDate) to the
// edge function via POST. All provider/secret logic lives server-side only.
async function fetchOneWayFares(
  origin: string,
  destination: string,
  departureDate: string
): Promise<SearchResult> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // POST body maps directly from form inputs:
  //   origin        ← Origin input field value
  //   destination   ← Destination input field value
  //   departureDate ← Departure Date picker value (YYYY-MM-DD)
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/quarryMinerOneWay`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ origin, destination, departureDate }),
    }
  );

  const json: SearchResult = await res.json();

  if (!res.ok || json.ok === false) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  return json;
}

// ─── Validation helpers ───────────────────────────────────────────────────────
function validateInputs(origin: string, dest: string, dateStr: string): string | null {
  if (origin.length !== 3) return "Origin must be exactly 3 letters.";
  if (dest.length !== 3)   return "Destination must be exactly 3 letters.";
  if (origin === dest)     return "Origin and destination cannot be the same.";
  if (!dateStr)            return "Please select a departure date.";
  return null;
}

// ─── Flight card ──────────────────────────────────────────────────────────────
function FlightCard({ flight }: { flight: NormalizedFlight }) {
  const depTime = flight.departureTime
    ? flight.departureTime.includes("T")
      ? flight.departureTime.split("T")[1].slice(0, 5)
      : flight.departureTime
    : null;
  const arrTime = flight.arrivalTime
    ? flight.arrivalTime.includes("T")
      ? flight.arrivalTime.split("T")[1].slice(0, 5)
      : flight.arrivalTime
    : null;

  const isMock = flight.airline?.includes("mock") || flight.notes?.includes("Mock");

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: flight.fareType === "GoWild"
          ? "rgba(16,185,129,0.08)"
          : "rgba(255,255,255,0.05)",
        border: flight.fareType === "GoWild"
          ? "1px solid rgba(16,185,129,0.28)"
          : "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.28)",
      }}
    >
      {/* Mock badge */}
      {isMock && (
        <div className="mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ background: "rgba(234,179,8,0.18)", color: "#fbbf24", border: "1px solid rgba(234,179,8,0.3)" }}>
          Mock — real upstream not yet connected
        </div>
      )}

      {/* Times row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-white text-xl font-black leading-tight">{depTime ?? "—"}</span>
          <span className="text-white/40 text-xs">{flight.origin}</span>
        </div>

        <div className="flex flex-col items-center gap-1 flex-1 px-3">
          <span className="text-white/40 text-xs">{flight.duration ?? ""}</span>
          <div className="flex items-center gap-1 w-full">
            <div className="h-px flex-1 bg-white/20" />
            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={14} color="rgba(255,255,255,0.35)" strokeWidth={2} />
            <div className="h-px flex-1 bg-white/20" />
          </div>
          <span className="text-white/40 text-xs">{flight.stops ?? "Nonstop"}</span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-white text-xl font-black leading-tight">{arrTime ?? "—"}</span>
          <span className="text-white/40 text-xs">{flight.destination}</span>
        </div>
      </div>

      {/* Flight number + airline */}
      {(flight.flightNumber || flight.airline) && (
        <p className="text-white/40 text-xs mb-3">
          {flight.airline && <span>{flight.airline} </span>}
          {flight.flightNumber && <span>· {flight.flightNumber}</span>}
        </p>
      )}

      {/* Fare + price */}
      <div className="flex items-center gap-2 flex-wrap">
        {flight.price != null && (
          <div
            className="flex flex-col items-center rounded-xl px-3 py-2 flex-1 min-w-0"
            style={
              flight.fareType === "GoWild"
                ? { background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }
            }
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: flight.fareType === "GoWild" ? "#34d399" : "rgba(255,255,255,0.4)" }}
            >
              {flight.fareType ?? "Fare"}
            </span>
            <span
              className="text-lg font-black"
              style={{ color: flight.fareType === "GoWild" ? "#6ee7b7" : "rgba(255,255,255,0.7)" }}
            >
              {flight.price === 0 ? "$0" : `$${flight.price}`}
            </span>
            {flight.currency && flight.currency !== "USD" && (
              <span className="text-white/30 text-[10px]">{flight.currency}</span>
            )}
          </div>
        )}
        {flight.notes && (
          <div
            className="flex flex-col items-center rounded-xl px-3 py-2 flex-1 min-w-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-white/40 text-[10px] font-semibold text-center">{flight.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OneWaySearch() {
  // Form state — these are the exact values submitted to the backend
  const [origin, setOrigin]   = useState("");
  const [dest,   setDest]     = useState("");
  const [date,   setDate]     = useState<Date | undefined>(undefined);
  const [calOpen, setCalOpen] = useState(false);

  // UI state
  const [loading,      setLoading]      = useState(false);
  const [inlineError,  setInlineError]  = useState<string | null>(null);
  const [results,      setResults]      = useState<SearchResult | null>(null);

  // Date string in YYYY-MM-DD format — this is the departureDate sent to the backend
  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  // Validation — button stays disabled until all three inputs are valid
  const validationError = validateInputs(origin, dest, dateStr);
  const isValid = validationError === null;

  const handleSearch = async () => {
    const err = validateInputs(origin, dest, dateStr);
    if (err) { setInlineError(err); return; }

    setLoading(true);
    setInlineError(null);
    setResults(null);

    try {
      // Pass origin, destination, and departureDate from the form inputs to the backend.
      const result = await fetchOneWayFares(origin, dest, dateStr);
      setResults(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setInlineError(msg);
      toast({ title: "Search failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleNewSearch = () => {
    setResults(null);
    setInlineError(null);
    setOrigin("");
    setDest("");
    setDate(undefined);
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col">
      {/* Hero strip */}
      <div
        className="px-6 pt-10 pb-8"
        style={{
          background: "linear-gradient(160deg, #07444a 0%, #0a6b5e 55%, #10b981 100%)",
          borderBottomLeftRadius: "28px",
          borderBottomRightRadius: "28px",
          boxShadow: "0 8px 32px 0 rgba(5,150,105,0.25)",
        }}
      >
        <div className="flex items-center gap-3 mb-1">
          <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={26} color="white" strokeWidth={2} />
          <h1 className="text-2xl font-black text-white tracking-tight">One-Way Search</h1>
        </div>
        <p className="text-emerald-200 text-sm font-medium">Find GoWild fares on Frontier</p>
      </div>

      {/* Form card */}
      <div className="px-5 pt-6 pb-4">
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 32px 0 rgba(0,0,0,0.40)",
          }}
        >
          {/* Origin input — value maps to `origin` param in backend request */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-emerald-400">Origin</label>
            <input
              type="text"
              maxLength={3}
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              placeholder="e.g. ATL"
              className="bg-transparent border-b border-white/20 focus:border-emerald-400 text-white text-2xl font-black tracking-widest uppercase placeholder:text-white/20 outline-none transition-colors pb-1"
            />
          </div>

          {/* Destination input — value maps to `destination` param in backend request */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-emerald-400">Destination</label>
            <input
              type="text"
              maxLength={3}
              value={dest}
              onChange={(e) => setDest(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              placeholder="e.g. LAS"
              className="bg-transparent border-b border-white/20 focus:border-emerald-400 text-white text-2xl font-black tracking-widest uppercase placeholder:text-white/20 outline-none transition-colors pb-1"
            />
          </div>

          {/* Departure Date picker — value maps to `departureDate` (YYYY-MM-DD) in backend request */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-emerald-400">Departure Date</label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "bg-transparent border-b border-white/20 focus:border-emerald-400 text-left pb-1 outline-none transition-colors text-2xl font-black",
                    date ? "text-white" : "text-white/20"
                  )}
                >
                  {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 border-0"
                style={{ background: "#0f2236", borderRadius: "16px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setCalOpen(false); }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto text-white")}
                  classNames={{
                    day_selected: "bg-emerald-500 text-white hover:bg-emerald-500",
                    day_today: "text-emerald-400 font-bold",
                    head_cell: "text-emerald-400 text-xs font-semibold",
                    caption_label: "text-white font-bold",
                    nav_button: "text-white hover:bg-white/10",
                    day: "text-white/80 hover:bg-white/10 rounded-md",
                    day_disabled: "text-white/20",
                    day_outside: "text-white/20",
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Inline validation / error */}
          {inlineError && (
            <div
              className="rounded-xl px-4 py-3 text-red-300 text-sm font-medium"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              {inlineError}
            </div>
          )}

          {/* Search button — disabled until all 3 inputs pass validation */}
          <button
            type="button"
            disabled={!isValid || loading}
            onClick={handleSearch}
            className={cn(
              "mt-2 w-full rounded-full py-4 flex items-center justify-center gap-2.5 font-black text-base tracking-wide transition-all",
              isValid && !loading ? "text-white shadow-lg" : "text-white/30 cursor-not-allowed"
            )}
            style={
              isValid && !loading
                ? { background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 4px 20px rgba(16,185,129,0.35)" }
                : { background: "rgba(255,255,255,0.06)" }
            }
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Searching…
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Search01Icon} size={18} color="currentColor" strokeWidth={2.5} />
                Search One-Way Fares
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Results section — rendered below the form ── */}
      {results && (
        <div className="px-5 pt-2 pb-10 flex flex-col gap-3">

          {/* Summary row */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-white font-black text-lg">
              {origin} → {dest}
            </span>
            <span className="text-emerald-400 text-sm font-bold">
              {results.flights.length} flight{results.flights.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Provider badge */}
          {results.provider && (
            <div className="px-1 mb-1">
              <span className="text-white/30 text-xs">via {results.provider}</span>
            </div>
          )}

          {/* Empty state */}
          {results.flights.length === 0 && (
            <div
              className="rounded-2xl px-6 py-8 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <p className="text-white/60 text-lg font-semibold mb-1">No flights found</p>
              <p className="text-white/30 text-sm">Try a different date or route</p>
            </div>
          )}

          {/* Flight cards */}
          {results.flights.map((flight, idx) => (
            <FlightCard key={idx} flight={flight} />
          ))}

          {/* New Search CTA */}
          <button
            type="button"
            onClick={handleNewSearch}
            className="mt-2 w-full rounded-full py-4 flex items-center justify-center gap-2 font-black text-base text-white"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <HugeiconsIcon icon={Search01Icon} size={18} color="currentColor" strokeWidth={2.5} />
            New Search
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="px-5 pt-2 pb-10 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-4 animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", height: "96px" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
