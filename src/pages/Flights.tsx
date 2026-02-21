import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPlaneDeparture, faPlaneArrival } from "@fortawesome/free-solid-svg-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";

type TripType = "one-way" | "round-trip" | "day-trip" | "multi-day";

interface Airport {
  id: number;
  name: string;
  iata_code: string;
}

const tripOptions: { value: TripType; label: string }[] = [
  { value: "one-way", label: "One Way" },
  { value: "round-trip", label: "Round Trip" },
  { value: "day-trip", label: "Day Trip" },
  { value: "multi-day", label: "Multi Day" },
];

const Flights = ({ onBack }: { onBack: () => void }) => {
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [airports, setAirports] = useState<Airport[]>([]);

  const [departureQuery, setDepartureQuery] = useState("");
  const [arrivalQuery, setArrivalQuery] = useState("");
  const [selectedDeparture, setSelectedDeparture] = useState<Airport | null>(null);
  const [selectedArrival, setSelectedArrival] = useState<Airport | null>(null);
  const [showDepartureList, setShowDepartureList] = useState(false);
  const [showArrivalList, setShowArrivalList] = useState(false);

  const [departureDate, setDepartureDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();

  const showReturnDate = tripType === "round-trip" || tripType === "multi-day";

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code")
        .order("name");
      if (data) setAirports(data);
    };
    load();
  }, []);

  const filteredDepartures = useMemo(
    () =>
      departureQuery.length < 1
        ? []
        : airports.filter(
            (a) =>
              a.name.toLowerCase().includes(departureQuery.toLowerCase()) ||
              a.iata_code.toLowerCase().includes(departureQuery.toLowerCase())
          ).slice(0, 20),
    [departureQuery, airports]
  );

  const filteredArrivals = useMemo(
    () =>
      arrivalQuery.length < 1
        ? []
        : airports.filter(
            (a) =>
              a.name.toLowerCase().includes(arrivalQuery.toLowerCase()) ||
              a.iata_code.toLowerCase().includes(arrivalQuery.toLowerCase())
          ).slice(0, 20),
    [arrivalQuery, airports]
  );

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 pt-10 pb-4 relative z-10">
        <button onClick={onBack} type="button" className="text-[#2E4A4A] hover:opacity-80 transition-opacity">
          <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-[#2E4A4A] tracking-tight">Flights</h1>
      </header>

      <div className="px-6 flex flex-col gap-6 relative z-10">
        {/* Trip Type Switch */}
        <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm">
          {tripOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTripType(opt.value)}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all",
                tripType === opt.value
                  ? "bg-[#345C5A] text-white shadow-md"
                  : "text-[#6B7B7B] hover:text-[#2E4A4A]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Departure Airport */}
        <div className="relative">
          <label className="text-sm font-semibold text-[#2E4A4A] mb-1.5 block">Departure</label>
          <div className="relative">
            <FontAwesomeIcon icon={faPlaneDeparture} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <Input
              placeholder="Search airport..."
              value={selectedDeparture ? `${selectedDeparture.name} (${selectedDeparture.iata_code})` : departureQuery}
              onChange={(e) => {
                setDepartureQuery(e.target.value);
                setSelectedDeparture(null);
                setShowDepartureList(true);
              }}
              onFocus={() => !selectedDeparture && setShowDepartureList(true)}
              onBlur={() => setTimeout(() => setShowDepartureList(false), 200)}
              className="pl-10 bg-white border-[#E3E6E6] text-[#2E4A4A] placeholder:text-[#9CA3AF] h-12 rounded-xl"
            />
          </div>
          {showDepartureList && filteredDepartures.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-lg border border-[#E3E6E6] max-h-48 overflow-y-auto">
              {filteredDepartures.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={() => {
                    setSelectedDeparture(a);
                    setDepartureQuery("");
                    setShowDepartureList(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#F2F3F3] text-sm text-[#2E4A4A]"
                >
                  <span className="font-semibold">{a.iata_code}</span> — {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Arrival Airport */}
        <div className="relative">
          <label className="text-sm font-semibold text-[#2E4A4A] mb-1.5 block">Arrival</label>
          <div className="relative">
            <FontAwesomeIcon icon={faPlaneArrival} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <Input
              placeholder="Search airport..."
              value={selectedArrival ? `${selectedArrival.name} (${selectedArrival.iata_code})` : arrivalQuery}
              onChange={(e) => {
                setArrivalQuery(e.target.value);
                setSelectedArrival(null);
                setShowArrivalList(true);
              }}
              onFocus={() => !selectedArrival && setShowArrivalList(true)}
              onBlur={() => setTimeout(() => setShowArrivalList(false), 200)}
              className="pl-10 bg-white border-[#E3E6E6] text-[#2E4A4A] placeholder:text-[#9CA3AF] h-12 rounded-xl"
            />
          </div>
          {showArrivalList && filteredArrivals.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-lg border border-[#E3E6E6] max-h-48 overflow-y-auto">
              {filteredArrivals.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={() => {
                    setSelectedArrival(a);
                    setArrivalQuery("");
                    setShowArrivalList(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#F2F3F3] text-sm text-[#2E4A4A]"
                >
                  <span className="font-semibold">{a.iata_code}</span> — {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Pickers */}
        <div className={cn("grid gap-4", showReturnDate ? "grid-cols-2" : "grid-cols-1")}>
          {/* Departure Date */}
          <div>
            <label className="text-sm font-semibold text-[#2E4A4A] mb-1.5 block">Departure Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-12 rounded-xl bg-white border-[#E3E6E6]",
                    !departureDate && "text-[#9CA3AF]"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {departureDate ? format(departureDate, "MMM d, yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={departureDate}
                  onSelect={setDepartureDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Return Date */}
          {showReturnDate && (
            <div>
              <label className="text-sm font-semibold text-[#2E4A4A] mb-1.5 block">Return Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-12 rounded-xl bg-white border-[#E3E6E6]",
                      !returnDate && "text-[#9CA3AF]"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {returnDate ? format(returnDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={returnDate}
                    onSelect={setReturnDate}
                    disabled={(date) => date < (departureDate || new Date())}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Flights;
