import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  AirplaneLanding01Icon,
  CalendarCheckOut02Icon,
  Location01Icon,
  Building04Icon,
  Cancel01Icon,
  PlaneIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay } from "date-fns";

interface Airport {
  id: number;
  name: string;
  iata_code: string;
  locations?: { city: string; state_code: string; region: string };
}

/* ── Single Airport Searchbox (same styling as Flights page) ── */
const AirportSearchbox = ({
  label,
  icon,
  selected,
  onChange,
  airports,
  placeholder = "Search airport or city...",
}: {
  label: string;
  icon: any;
  selected: Airport | null;
  onChange: (a: Airport | null) => void;
  airports: Airport[];
  placeholder?: string;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shouldShow = query.trim().length > 1;

  const groupedAirports = useMemo(() => {
    if (!shouldShow) return {};
    const q = query.toLowerCase();
    const filteredList = airports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q) ||
          (a.locations?.city && a.locations.city.toLowerCase().includes(q))
      )
      .slice(0, 30);

    const grouped = filteredList.reduce((acc, airport) => {
      const city = airport.locations?.city;
      const state = airport.locations?.state_code;
      const groupKey = city && state ? `${city}, ${state}` : "Other Locations";
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(airport);
      return acc;
    }, {} as Record<string, Airport[]>);

    return Object.fromEntries(
      Object.entries(grouped).map(([key, airports]) => [
        airports.length > 1 ? key : `__single__${key}`,
        airports,
      ])
    );
  }, [query, airports, shouldShow]);

  const displayValue = selected && !query
    ? `${selected.iata_code} | ${selected.locations?.city ?? selected.name}`
    : query;

  return (
    <div className="relative">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#059669] ml-1 mb-1 block">{label}</label>
      <div
        className="app-input-container cursor-text"
        style={{ minHeight: 44 }}
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
      >
        <button type="button" tabIndex={-1} className="app-input-icon-btn">
          <HugeiconsIcon icon={icon} size={20} color="currentColor" strokeWidth={2} />
        </button>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            if (selected) onChange(null);
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (selected) setQuery(`${selected.iata_code} | ${selected.locations?.city ?? ""}`);
            setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 200);
            if (!selected) setQuery("");
          }}
          className="app-input font-semibold truncate"
          style={{ fontSize: 16 }}
        />
        {selected && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); onChange(null); setQuery(""); }}
            className="app-input-reset app-input-reset--visible"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
          </button>
        )}
      </div>

      {open && shouldShow && Object.keys(groupedAirports).length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-[#E3E6E6] max-h-64 overflow-y-auto z-50 py-2">
          {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => {
            const isSingle = cityGroup.startsWith("__single__");
            const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
            return (
              <div key={cityGroup} className="mb-2 last:mb-0">
                {!isSingle && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(cityAirports[0]); setQuery(""); }}
                    className="w-full px-4 py-1.5 text-xs font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2 hover:bg-[#F2F3F3] transition-colors cursor-pointer"
                  >
                    <HugeiconsIcon icon={Building04Icon} size={12} color="currentColor" strokeWidth={2} className="opacity-60" />
                    {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                  </button>
                )}
                {cityAirports.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(a); setQuery(""); setOpen(false); }}
                    className={cn(
                      "w-full text-left pr-4 py-2 text-sm hover:bg-[#F2F3F3] transition-colors flex flex-col gap-0.5 overflow-hidden",
                      isSingle ? "pl-4" : "pl-11"
                    )}
                  >
                    <div className="flex items-center text-[#2E4A4A] w-full min-w-0">
                      <HugeiconsIcon icon={Location01Icon} size={12} color="#9CA3AF" strokeWidth={2} className="mr-2 shrink-0" />
                      <span className="font-semibold text-[#345C5A] shrink-0">{a.iata_code}</span>
                      <span className="ml-2 truncate">{a.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Quick Search Page ── */
const QuickSearchPage = () => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [departure, setDeparture] = useState<Airport | null>(null);
  const [arrival, setArrival] = useState<Airport | null>(null);
  const [departureDate, setDepartureDate] = useState<Date>();
  const [depDateOpen, setDepDateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string>("");
  const [error, setError] = useState<string>("");

  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    supabase
      .from("airports")
      .select("id, name, iata_code, locations(city, state_code, region)")
      .order("name")
      .then(({ data }) => { if (data) setAirports(data as unknown as Airport[]); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departure || !departureDate) return;

    setLoading(true);
    setError("");
    setResponse("");

    const body: Record<string, string> = {
      origin: departure.iata_code,
      departureDate: format(departureDate, "yyyy-MM-dd"),
    };
    if (arrival) body.destination = arrival.iata_code;

    try {
      const res = await fetch("https://getmydata.fly.dev/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      setResponse(text);
    } catch (err: any) {
      setError(err?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!departure && !!departureDate && !loading;

  return (
    <div className="px-6 pt-6 pb-8 flex flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-black tracking-widest uppercase text-[#345C5A]">QUICK SEARCH</h2>
        <p className="text-xs text-[#9CA3AF] mt-0.5">Search flights via external data source</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <AirportSearchbox
          label="Departure Airport"
          icon={AirplaneTakeOff01Icon}
          selected={departure}
          onChange={setDeparture}
          airports={airports}
          placeholder="Search departure airport..."
        />

        <AirportSearchbox
          label="Arrival Airport (optional)"
          icon={AirplaneLanding01Icon}
          selected={arrival}
          onChange={setArrival}
          airports={airports}
          placeholder="Search arrival airport..."
        />

        {/* Date picker */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#059669] ml-1 mb-1 block">
            Departure Date
          </label>
          <Popover open={depDateOpen} onOpenChange={setDepDateOpen}>
            <PopoverTrigger asChild>
              <div
                className="app-input-container cursor-pointer"
                style={{ minHeight: 44 }}
                onClick={() => setDepDateOpen(true)}
              >
                <button type="button" tabIndex={-1} className="app-input-icon-btn">
                  <HugeiconsIcon icon={CalendarCheckOut02Icon} size={20} color="currentColor" strokeWidth={2} />
                </button>
                <span
                  className={cn(
                    "app-input font-semibold pointer-events-none select-none flex items-center",
                    !departureDate && "text-[#9CA3AF]"
                  )}
                  style={{ fontSize: 16 }}
                >
                  {departureDate ? format(departureDate, "EEE, MMM d, yyyy") : "Select date"}
                </span>
                {departureDate && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => { e.stopPropagation(); setDepartureDate(undefined); }}
                    className="app-input-reset app-input-reset--visible"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
                  </button>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <Calendar
                mode="single"
                selected={departureDate}
                onSelect={(d) => { setDepartureDate(d); setDepDateOpen(false); }}
                disabled={(d) => startOfDay(d) < today}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Submit button — same style as Flights search button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "mt-2 w-full flex items-center justify-center gap-2 rounded-full py-3.5 transition-all",
            "text-white font-black text-[11px] uppercase tracking-[0.45em]",
            canSubmit
              ? "bg-gradient-to-r from-[#059669] to-[#10B981] shadow-lg hover:opacity-90 active:scale-[0.98]"
              : "bg-[#E3E6E6] text-[#9CA3AF] cursor-not-allowed"
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              SEARCHING…
            </span>
          ) : (
            <>
              Search Flights
              <HugeiconsIcon icon={PlaneIcon} size={14} color="currentColor" strokeWidth={2} />
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Response output */}
      {response && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#059669] ml-1">
            Response
          </label>
          <textarea
            readOnly
            value={response}
            rows={14}
            className="w-full rounded-2xl border border-[#E3E6E6] bg-white px-4 py-3 text-xs font-mono text-[#2E4A4A] resize-y focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
          />
        </div>
      )}
    </div>
  );
};

export default QuickSearchPage;
