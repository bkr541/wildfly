import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AirplaneTakeOff01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface OneWaySearchProps {
  onResults: (data: unknown, origin: string, dest: string, date: string) => void;
}

async function fetchOneWayFares(o: string, d: string, date: string) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `https://${projectId}.supabase.co/functions/v1/quarryMinerOneWay?o=${encodeURIComponent(o)}&d=${encodeURIComponent(d)}&date=${encodeURIComponent(date)}&ftype=GW`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
  });

  const json = await res.json();
  if (!res.ok || json.ok === false) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json;
}

export default function OneWaySearch({ onResults }: OneWaySearchProps) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [calOpen, setCalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const dateStr = date ? format(date, "yyyy-MM-dd") : "";
  const isValid = origin.length === 3 && dest.length === 3 && !!dateStr;

  const handleSearch = async () => {
    if (!isValid) return;
    setLoading(true);
    setInlineError(null);
    try {
      const result = await fetchOneWayFares(origin, dest, dateStr);
      onResults(result, origin, dest, dateStr);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setInlineError(msg);
      toast({ title: "Search failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
      <div className="flex-1 px-5 pt-6 pb-10">
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 32px 0 rgba(0,0,0,0.40)",
          }}
        >
          {/* Origin */}
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

          {/* Destination */}
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

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-emerald-400">Departure Date</label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "bg-transparent border-b border-white/20 focus:border-emerald-400 text-left pb-1 outline-none transition-colors",
                    date ? "text-white text-2xl font-black" : "text-white/20 text-2xl font-black"
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

          {/* Inline error */}
          {inlineError && (
            <div className="rounded-xl px-4 py-3 text-red-300 text-sm font-medium" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              {inlineError}
            </div>
          )}

          {/* Search button */}
          <button
            type="button"
            disabled={!isValid || loading}
            onClick={handleSearch}
            className={cn(
              "mt-2 w-full rounded-full py-4 flex items-center justify-center gap-2.5 font-black text-base tracking-wide transition-all",
              isValid && !loading
                ? "text-white shadow-lg"
                : "text-white/30 cursor-not-allowed"
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
    </div>
  );
}
