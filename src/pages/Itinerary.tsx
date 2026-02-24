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

const DATE_RANGE = 7; // 3 before + today + 3 after

const ItineraryPage = () => {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [flights, setFlights] = useState<FlightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => {
    return Array.from({ length: DATE_RANGE }, (_, i) => addDays(subDays(today, 3), i));
  }, [today]);

  // Scroll to center on mount
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const selected = container.children[3] as HTMLElement; // middle item
      if (selected) {
        const offset = selected.offsetLeft - container.offsetWidth / 2 + selected.offsetWidth / 2;
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
      {/* Title Group */}
      <div className="px-6 pt-0 pb-3 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-0 tracking-tight">Itinerary</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Your upcoming travel plans.</p>
      </div>

      {/* Horizontal Date Scroller */}
      <div
        ref={scrollRef}
        className="flex gap-2 px-6 pb-4 overflow-x-auto scrollbar-hide relative z-10"
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

      {/* Date label & flights chip */}
      <div className="px-6 pb-2 relative z-10">
        <p className="text-[#2E4A4A] font-semibold text-base">
          {dayLabel} | {dateLabel}
        </p>
        <div className="flex gap-2 mt-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-[#E3E6E6] text-[#2E4A4A] text-xs font-medium">
            Flights: {flights.length}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 px-6 pt-4 pb-8 relative z-10">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#345C5A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : flights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
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

            {flights.map((flight, idx) => {
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
    </>
  );
};

export default ItineraryPage;
