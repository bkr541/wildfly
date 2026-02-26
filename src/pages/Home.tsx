import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Split-flap tile (reusable, self-contained) ──────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

function SplitFlapTile({ char, green }: { char: string; green?: boolean }) {
  const displayChar = char === "_" || char === " " ? "" : char;
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-lg shadow-md border overflow-hidden flex-1 min-w-0"
      style={{
        height: 34,
        background: green ? "linear-gradient(160deg,#059669 0%,#065F46 100%)" : "#e8eaed",
        borderColor: green ? "#064E3B" : "#d1d5db",
      }}
    >
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
        style={{ background: green ? "#064E3Baa" : "#b0b5bdaa" }}
      />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: green ? "#10B981" : "#e8eaed", borderColor: green ? "#064E3B" : "#d1d5db" }}
      />
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: green ? "#10B981" : "#e8eaed", borderColor: green ? "#064E3B" : "#d1d5db" }}
      />
      {displayChar && (
        <span
          className="font-black text-lg leading-none select-none"
          style={{ color: green ? "#fff" : "#1f2937", letterSpacing: "0.04em" }}
        >
          {displayChar}
        </span>
      )}
    </div>
  );
}

function HomeSplitFlap() {
  // "HOME_____" — 9 tiles, HOME green, rest blank
  const TARGET = "HOME_____";
  const GREEN_END = 3; // indices 0-3 are green (H,O,M,E)
  const [displayChars, setDisplayChars] = useState<string[]>(Array(9).fill(" "));
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    TARGET.split("").forEach((finalChar, idx) => {
      const to = setTimeout(() => {
        const steps = 5;
        let step = 0;
        const iv = setInterval(() => {
          step++;
          if (step >= steps) {
            clearInterval(iv);
            setDisplayChars((prev) => {
              const n = [...prev];
              n[idx] = finalChar;
              return n;
            });
          } else {
            const r = CHARS[Math.floor(Math.random() * CHARS.length)];
            setDisplayChars((prev) => {
              const n = [...prev];
              n[idx] = r;
              return n;
            });
          }
        }, 40);
        intervals.push(iv);
      }, idx * 55);
      timeouts.push(to);
    });
    return () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5 w-full">
      {displayChars.map((char, i) => {
        const isBlank = TARGET[i] === "_";
        if (isBlank) {
          return (
            <div
              key={i}
              className="relative flex flex-col items-center justify-center rounded-lg border overflow-hidden flex-1 min-w-0"
              style={{ height: 34, background: "#e8eaed", borderColor: "#d1d5db", opacity: 0.3 }}
            >
              <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px" style={{ background: "#b0b5bdaa" }} />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border"
                style={{ background: "#e8eaed", borderColor: "#d1d5db" }}
              />
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border"
                style={{ background: "#e8eaed", borderColor: "#d1d5db" }}
              />
            </div>
          );
        }
        return <SplitFlapTile key={i} char={char} green={i <= GREEN_END} />;
      })}
    </div>
  );
}

// ── Flight card ─────────────────────────────────────────────────────────────
interface UserFlight {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  type: string;
  flight_json: any;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDateLabel(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", d: "numeric" } as any);
  } catch {
    return "";
  }
}

function FlightCard({ flight }: { flight: UserFlight }) {
  const depTime = formatTime(flight.departure_time);
  const arrTime = formatTime(flight.arrival_time);
  const dateLabel = formatDateLabel(flight.departure_time);
  // Try to get airline from flight_json
  const json = typeof flight.flight_json === "string" ? JSON.parse(flight.flight_json) : flight.flight_json;
  const airline = json?.airline || json?.carrier || null;

  return (
    <div className="flex-shrink-0 w-72 bg-white rounded-2xl border border-[#e3e6e6] shadow-sm p-4 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[#6B7B7B] uppercase tracking-wide mb-0.5">Upcoming flight</p>
          {airline && <p className="text-xs text-[#345C5A] font-medium">{airline}</p>}
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#e8f5f1] text-[#10B981] uppercase tracking-wide">
          {flight.type}
        </span>
      </div>

      {/* Airports row */}
      <div className="border-t border-b border-[#f0f2f2] py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-black text-[#1a2e2e] tracking-tight leading-none">{flight.departure_airport}</p>
          </div>
          {/* Arrow */}
          <div className="flex-1 flex items-center px-3">
            <div className="flex-1 h-px bg-[#1a2e2e]" />
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
              <path
                d="M1 5h8M5 1l4 4-4 4"
                stroke="#1a2e2e"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[#1a2e2e] tracking-tight leading-none">{flight.arrival_airport}</p>
          </div>
        </div>
      </div>

      {/* Times row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#345C5A]">{depTime}</p>
        <p className="text-sm font-semibold text-[#345C5A]">
          {arrTime} <span className="text-[#6B7B7B] font-normal">{dateLabel}</span>
        </p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
const HomePage = () => {
  const [flights, setFlights] = useState<UserFlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("user_flights")
        .select("*")
        .eq("user_id", user.id)
        .gte("departure_time", now)
        .order("departure_time", { ascending: true })
        .limit(20);
      setFlights(data || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <>
      {/* HOME split-flap header */}
      <div className="px-6 pt-4 pb-4 relative z-10 animate-fade-in">
        <HomeSplitFlap />
      </div>

      {/* Upcoming flights */}
      <div className="px-6 pb-4 relative z-10">
        <h2 className="text-sm font-semibold text-[#2E4A4A] uppercase tracking-widest mb-3">Upcoming Flights</h2>
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-72 h-36 bg-white/60 rounded-2xl border border-[#e3e6e6] animate-pulse"
              />
            ))}
          </div>
        ) : flights.length === 0 ? (
          <div className="w-full bg-white/60 rounded-2xl border border-[#e3e6e6] px-5 py-6 text-center">
            <p className="text-[#6B7B7B] text-sm">No upcoming flights scheduled.</p>
          </div>
        ) : (
          <div
            className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6"
            style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
          >
            {flights.map((f) => (
              <div key={f.id} style={{ scrollSnapAlign: "start" }}>
                <FlightCard flight={f} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10" />
    </>
  );
};

export default HomePage;
