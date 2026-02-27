import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SplitFlapHeader } from "@/components/SplitFlapHeader";

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

function formatCardDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
}

function formatDuration(depIso: string, arrIso: string) {
  try {
    const dep = new Date(depIso).getTime();
    const arr = new Date(arrIso).getTime();
    let diff = arr - dep;
    if (!Number.isFinite(diff)) return "";
    if (diff < 0) diff = Math.abs(diff);

    let hours = Math.floor(diff / (1000 * 60 * 60));
    let mins = Math.round((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (mins === 60) {
      hours += 1;
      mins = 0;
    }
    return `${hours}h ${mins}m`;
  } catch {
    return "";
  }
}

function extractIata(input: string) {
  if (!input) return "";
  const m = input.match(/\(([A-Z0-9]{3})\)/);
  if (m?.[1]) return m[1];
  const end = input.trim().match(/([A-Z0-9]{3})$/);
  if (end?.[1]) return end[1];
  return input.trim();
}

function extractCity(input: string) {
  if (!input) return "";
  const beforeParen = input.split("(")[0].trim();
  const beforeComma = beforeParen.split(",")[0].trim();
  return beforeComma;
}

function FlightCard({ flight }: { flight: UserFlight }) {
  const depDT = formatCardDateTime(flight.departure_time);
  const arrDT = formatCardDateTime(flight.arrival_time);
  const duration = formatDuration(flight.departure_time, flight.arrival_time);

  const json = typeof flight.flight_json === "string" ? JSON.parse(flight.flight_json) : flight.flight_json;

  const depCode = extractIata(flight.departure_airport);
  const arrCode = extractIata(flight.arrival_airport);

  const jsonDepCity =
    json?.fromCity || json?.originCity || json?.origin_city || json?.from?.city || json?.origin?.city || "";
  const jsonArrCity =
    json?.toCity || json?.destinationCity || json?.destination_city || json?.to?.city || json?.destination?.city || "";

  let depCity = (jsonDepCity || extractCity(flight.departure_airport) || "From").trim();
  let arrCity = (jsonArrCity || extractCity(flight.arrival_airport) || "To").trim();

  if (depCity.toUpperCase() === depCode.toUpperCase()) depCity = "From";
  if (arrCity.toUpperCase() === arrCode.toUpperCase()) arrCity = "To";

  return (
    <div
      className="flex-shrink-0 w-[340px] sm:w-[520px] rounded-[44px] p-6 relative overflow-hidden"
      style={{
        background: "#2F746F",
        boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Frontier Airline</p>

        {/* Chevron */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="mt-1 flex-shrink-0">
          <path d="M9 5l7 7-7 7" stroke="white" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Middle layout */}
      <div className="mt-6 flex items-center gap-4">
        {/* Left */}
        <div className="min-w-[92px] sm:min-w-[120px]">
          <p className="text-lg sm:text-2xl font-medium text-white/90">{depCity}</p>
          <p
            className="text-4xl sm:text-6xl font-black leading-none"
            style={{ color: "#E2B14B", textShadow: "0 2px 0 rgba(0,0,0,0.10)" }}
          >
            {depCode}
          </p>
          <p className="mt-5 text-lg sm:text-2xl font-medium text-white/90">{depDT}</p>
        </div>

        {/* Route graphic */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-full h-[70px] sm:h-[84px]">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 70" fill="none">
              <path
                d="M25 50 Q100 6 175 50"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="4"
                strokeDasharray="10 12"
                strokeLinecap="round"
              />
            </svg>

            {/* Left gold marker */}
            <div
              className="absolute left-[25px] top-[50px] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "#E2B14B" }}
            >
              <div className="w-4 h-4 rounded-full" style={{ background: "#B07B22" }} />
            </div>

            {/* Right white marker */}
            <div
              className="absolute left-[175px] top-[50px] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full"
              style={{ background: "#F4F7F7" }}
            />

            {/* Plane */}
            <div className="absolute left-1/2 top-[18px] -translate-x-1/2 -translate-y-1/2">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="white" style={{ transform: "rotate(12deg)" }}>
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3-1 3 1v-1.5L13 19v-5.5L21 16z" />
              </svg>
            </div>
          </div>

          <p className="mt-1.5 text-xl sm:text-3xl font-semibold text-white">{duration}</p>
        </div>

        {/* Right */}
        <div className="min-w-[92px] sm:min-w-[120px] text-right">
          <p className="text-lg sm:text-2xl font-medium text-white/90">{arrCity}</p>
          <p className="text-4xl sm:text-6xl font-black leading-none text-white">{arrCode}</p>
          <p className="mt-5 text-lg sm:text-2xl font-medium text-white/90">{arrDT}</p>
        </div>
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
        <SplitFlapHeader word="HOME" />
      </div>

      {/* Upcoming flights */}
      <div className="px-6 pb-4 relative z-10">
        <h2 className="text-sm font-semibold text-[#2E4A4A] uppercase tracking-widest mb-3">Upcoming Flights</h2>
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[340px] sm:w-[520px] h-[190px] rounded-[44px] animate-pulse"
                style={{ background: "rgba(47,116,111,0.35)" }}
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

      {/* Alerts */}
      <div className="px-6 pb-4 relative z-10">
        <h2 className="text-sm font-semibold text-[#2E4A4A] uppercase tracking-widest mb-3">Alerts</h2>
        <div className="flex flex-col gap-2">
          {[
            {
              icon: "🔥",
              title: "Go Wild sale ends soon",
              body: "Book by Sunday to lock in $49 fares to Bozeman & Missoula.",
              time: "2h ago",
              color: "#FEF3C7",
              accent: "#D97706",
            },
            {
              icon: "✈️",
              title: "New route: ORD → BZN",
              body: "Frontier just added daily nonstops from Chicago starting June 1.",
              time: "Yesterday",
              color: "#ECFDF5",
              accent: "#059669",
            },
            {
              icon: "⚡",
              title: "Flash deal: ORD → DEN",
              body: "Round-trip from $79. Only 12 seats left.",
              time: "3d ago",
              color: "#EFF6FF",
              accent: "#3B82F6",
            },
          ].map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border px-4 py-3"
              style={{ background: alert.color, borderColor: alert.accent + "33" }}
            >
              <span className="text-xl mt-0.5">{alert.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1a2e2e]">{alert.title}</p>
                  <span className="text-[10px] text-[#6B7B7B] whitespace-nowrap">{alert.time}</span>
                </div>
                <p className="text-xs text-[#345C5A] mt-0.5 leading-snug">{alert.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10" />
    </>
  );
};

export default HomePage;
