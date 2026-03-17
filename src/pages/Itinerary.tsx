import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, subDays, isSameDay, parseISO } from "date-fns";

interface FlightEntry {
  id: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  flight_json: any;
}

const DAYS_PAST = 10;
const DAYS_FUTURE = 30;
const TOTAL_DAYS = DAYS_PAST + 1 + DAYS_FUTURE;

const ItineraryPage = () => {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [flights, setFlights] = useState<FlightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(subDays(today, DAYS_PAST), i));
  }, [today]);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const todayEl = container.children[DAYS_PAST] as HTMLElement;
      if (todayEl) {
        const offset = todayEl.offsetLeft - container.offsetWidth / 2 + todayEl.offsetWidth / 2;
        container.scrollLeft = offset;
      }
    }
  }, []);

  // Fetch flights for selected date
  useEffect(() => {
    const fetchFlights = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const dayStart = format(selectedDate, "yyyy-MM-dd");
      const dayEnd = format(addDays(selectedDate, 1), "yyyy-MM-dd");

      const { data } = await supabase
        .from("user_flights")
        .select("id, departure_airport, arrival_airport, departure_time, arrival_time, flight_json")
        .eq("user_id", user.id)
        .gte("departure_time", dayStart)
        .lt("departure_time", dayEnd)
        .order("departure_time", { ascending: true });

      setFlights((data as FlightEntry[]) ?? []);
      setLoading(false);
    };
    fetchFlights();
  }, [selectedDate]);

  const formatHour = (iso: string) => {
    try {
      const d = new Date(iso);
      return format(d, "hh:mm a");
    } catch { return iso; }
  };

  const dayLabel = format(selectedDate, "EEE");
  const dateLabel = format(selectedDate, "MMMM do yyyy");

  return (
    <>

      {/* Horizontal Date Scroller */}
      <div
        ref={scrollRef}
        className="flex gap-2 px-6 pt-6 pb-4 overflow-x-auto scrollbar-hide relative z-10"
        style={{ scrollBehavior: "smooth" }}
      >
        {dates.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center justify-center min-w-[52px] h-[68px] rounded-2xl transition-all duration-200 shrink-0
                ${isSelected
                  ? "bg-[#345C5A] text-white shadow-md"
                  : "bg-white text-[#2E4A4A] border border-[#E3E6E6]"
                }`}
            >
              <span className={`text-[11px] font-medium ${isSelected ? "text-white/80" : "text-[#9CA3AF]"}`}>
                {format(date, "EEE")}
              </span>
              <span className={`text-lg font-bold leading-tight ${isSelected ? "text-white" : ""}`}>
                {format(date, "d")}
              </span>
              {isToday && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#345C5A] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Glass card wrapping everything below the date scroller */}
      <div className="px-5 pb-6 relative z-10">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
          }}
        >
          {/* Date label & flights chip */}
          <div className="px-5 pt-4 pb-3 border-b border-black/5">
            <p className="text-[#2E4A4A] font-semibold text-base">
              {dayLabel} | {dateLabel}
            </p>
            <div className="flex gap-2 mt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#F2F3F3] text-[#2E4A4A] text-xs font-medium">
                Flights: {flights.length}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="px-5 pt-4 pb-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#345C5A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : flights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#E3E6E6] flex items-center justify-center mb-4">
                  <span className="text-2xl">✈️</span>
                </div>
                <p className="text-[#2E4A4A] font-semibold text-lg">No Trips Scheduled</p>
                <p className="text-[#9CA3AF] text-sm mt-1">Nothing planned for this day.</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[54px] top-0 bottom-0 w-px bg-[#E3E6E6]" />

                {flights.map((flight) => {
                  const depTime = formatHour(flight.departure_time);
                  const arrTime = formatHour(flight.arrival_time);
                  return (
                    <div key={flight.id} className="flex gap-4 mb-6 last:mb-0">
                      {/* Time column */}
                      <div className="w-[54px] text-right shrink-0 pt-3">
                        <span className="text-xs font-semibold text-[#6B7B7B] leading-none">
                          {depTime.split(" ")[0]}
                        </span>
                        <br />
                        <span className="text-[10px] text-[#9CA3AF]">{depTime.split(" ")[1]}</span>
                      </div>

                      {/* Dot */}
                      <div className="relative flex items-start pt-3">
                        <div className="w-3 h-3 rounded-full bg-[#345C5A] border-2 border-white shadow-sm z-10" />
                      </div>

                      {/* Card */}
                      <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-[#E3E6E6]">
                        <p className="text-[#2E4A4A] font-semibold text-sm">
                          {flight.departure_airport} → {flight.arrival_airport}
                        </p>
                        <p className="text-[#6B7B7B] text-xs mt-1">
                          {depTime} – {arrTime}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ItineraryPage;
