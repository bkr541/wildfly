import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, AirplaneTakeOff01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface Leg {
  flightNumber: string;
  departureDateFormatted?: string;
  arrivalDateFormatted?: string;
}

interface Flight {
  legs: Leg[];
  stopsText?: string;
  duration?: string;
  durationFormatted?: string;
  goWildFare?: number | null;
  goWildFareSeatsRemaining?: number | null;
  standardFare?: number | null;
  discountDenFare?: number | null;
}

interface FrontierResultsProps {
  responseData: unknown;
  origin: string;
  dest: string;
  date: string;
  onBack: () => void;
  onNewSearch: () => void;
}

function formatFare(val?: number | null) {
  if (val == null) return null;
  return `$${val}`;
}

export default function FrontierResults({ responseData, origin, dest, date, onBack, onNewSearch }: FrontierResultsProps) {
  const flights: Flight[] = useMemo(() => {
    try {
      const d = (responseData as any)?.data?.lowFareData?.[0]?.flights ?? [];
      return [...d].sort((a: Flight, b: Flight) => {
        const aVal = a.goWildFare ?? a.standardFare ?? Infinity;
        const bVal = b.goWildFare ?? b.standardFare ?? Infinity;
        return aVal - bVal;
      });
    } catch {
      return [];
    }
  }, [responseData]);

  const isEmpty = flights.length === 0;

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col">
      {/* Header */}
      <div
        className="px-5 pt-10 pb-6"
        style={{
          background: "linear-gradient(160deg, #07444a 0%, #0a6b5e 55%, #10b981 100%)",
          borderBottomLeftRadius: "28px",
          borderBottomRightRadius: "28px",
          boxShadow: "0 8px 32px 0 rgba(5,150,105,0.25)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <button type="button" onClick={onBack} className="text-white/80 hover:text-white transition-colors p-1">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color="currentColor" strokeWidth={2} />
          </button>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={22} color="white" strokeWidth={2} />
            <h1 className="text-xl font-black text-white tracking-tight">
              {origin} → {dest}
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-emerald-200 text-sm font-semibold">{date}</span>
          {!isEmpty && (
            <span className="text-emerald-300 text-sm font-bold">{flights.length} flight{flights.length !== 1 ? "s" : ""} found</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-5 pb-10 flex flex-col gap-3">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 pt-16">
            <div className="rounded-2xl px-8 py-8 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <p className="text-white/60 text-lg font-semibold mb-1">No flights found</p>
              <p className="text-white/30 text-sm">Try a different date or route</p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full px-8 py-3 font-bold text-white"
              style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
            >
              Back to Search
            </button>
          </div>
        ) : (
          <>
            {flights.map((flight, idx) => {
              const firstLeg = flight.legs?.[0];
              const lastLeg = flight.legs?.[flight.legs.length - 1];
              const flightNums = flight.legs?.map((l) => l.flightNumber).filter(Boolean).join(", ");
              const depTime = firstLeg?.departureDateFormatted;
              const arrTime = lastLeg?.arrivalDateFormatted;
              const dur = flight.durationFormatted ?? flight.duration;
              const gwFare = formatFare(flight.goWildFare);
              const stdFare = formatFare(flight.standardFare);
              const denFare = formatFare(flight.discountDenFare);
              const seatsLeft = flight.goWildFareSeatsRemaining;

              return (
                <div
                  key={idx}
                  className="rounded-2xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: gwFare ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
                  }}
                >
                  {/* Times row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-white text-xl font-black leading-tight">{depTime ?? "—"}</span>
                      <span className="text-white/40 text-xs">Depart</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 flex-1 px-3">
                      <span className="text-white/40 text-xs">{dur ?? ""}</span>
                      <div className="flex items-center gap-1 w-full">
                        <div className="h-px flex-1 bg-white/20" />
                        <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={14} color="rgba(255,255,255,0.35)" strokeWidth={2} />
                        <div className="h-px flex-1 bg-white/20" />
                      </div>
                      <span className="text-white/40 text-xs">{flight.stopsText ?? "Nonstop"}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-white text-xl font-black leading-tight">{arrTime ?? "—"}</span>
                      <span className="text-white/40 text-xs">Arrive</span>
                    </div>
                  </div>

                  {/* Flight number */}
                  {flightNums && (
                    <p className="text-white/40 text-xs mb-3">Flight {flightNums}</p>
                  )}

                  {/* Fares row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {gwFare && (
                      <div
                        className="flex flex-col items-center rounded-xl px-3 py-2 flex-1 min-w-0"
                        style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }}
                      >
                        <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">GoWild</span>
                        <span className="text-emerald-300 text-lg font-black">{gwFare}</span>
                        {seatsLeft != null && (
                          <span className="text-emerald-500 text-[10px] font-semibold">{seatsLeft} left</span>
                        )}
                      </div>
                    )}
                    {stdFare && (
                      <div
                        className="flex flex-col items-center rounded-xl px-3 py-2 flex-1 min-w-0"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                      >
                        <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Standard</span>
                        <span className="text-white/70 text-lg font-black">{stdFare}</span>
                      </div>
                    )}
                    {denFare && (
                      <div
                        className="flex flex-col items-center rounded-xl px-3 py-2 flex-1 min-w-0"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                      >
                        <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Den Discount</span>
                        <span className="text-white/70 text-lg font-black">{denFare}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* New search CTA */}
            <button
              type="button"
              onClick={onNewSearch}
              className="mt-2 w-full rounded-full py-4 flex items-center justify-center gap-2 font-black text-base text-white"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <HugeiconsIcon icon={Search01Icon} size={18} color="currentColor" strokeWidth={2.5} />
              New Search
            </button>
          </>
        )}
      </div>
    </div>
  );
}
