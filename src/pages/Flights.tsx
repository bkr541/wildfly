import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faMagnifyingGlass,
  faHouse,
  faPlane,
  faLocationDot,
  faTreeCity,
  faUserGroup,
  faCreditCard,
  faRightFromBracket,
  faChevronLeft,
  faCalendarDays,
  faArrowRightArrowLeft,
  faChevronDown,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { faBell } from "@fortawesome/free-regular-svg-icons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const menuItems = [
  { icon: faHouse, label: "Home" },
  { icon: faPlane, label: "Flights" },
  { icon: faLocationDot, label: "Destinations" },
  { icon: faUserGroup, label: "Friends" },
  { icon: faCreditCard, label: "Subscription" },
];

type TripType = "one-way" | "round-trip" | "day-trip" | "multi-day";

const tripOptions: { value: TripType; label: string }[] = [
  { value: "one-way", label: "One Way" },
  { value: "round-trip", label: "Round Trip" },
  { value: "day-trip", label: "Day Trip" },
  { value: "multi-day", label: "Multi Day" },
];

interface Airport {
  id: number;
  name: string;
  iata_code: string;
  locations?: {
    city: string;
    state_code: string;
    region: string;
  };
}

/* ── New Airport Searchbox (Matches Design) ────────────────── */
const AirportSearchboxNew = ({
  label,
  value,
  onChange,
  airports,
}: {
  label: string;
  value: Airport | null;
  onChange: (a: Airport | null) => void;
  airports: Airport[];
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shouldShow = query.trim().length > 1;

  // Filter and Group Airports
  const groupedAirports = useMemo(() => {
    if (!shouldShow) return {};
    const q = query.toLowerCase();

    const filteredList = airports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q) ||
          (a.locations?.city && a.locations.city.toLowerCase().includes(q)),
      )
      .slice(0, 30);

    return filteredList.reduce(
      (acc, airport) => {
        const city = airport.locations?.city;
        const state = airport.locations?.state_code;
        const groupKey = city && state ? `${city}, ${state}` : "Other Locations";

        if (!acc[groupKey]) {
          acc[groupKey] = [];
        }
        acc[groupKey].push(airport);
        return acc;
      },
      {} as Record<string, Airport[]>,
    );
  }, [query, airports, shouldShow]);

  // Edit Mode (Search Input)
  if (open) {
    return (
      <div className="relative p-2">
        <div className="flex items-center gap-3 bg-[#F2F3F3] rounded-xl px-4 py-3">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 text-[#9CA3AF]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search airport or city..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            autoFocus
            className="flex-1 bg-transparent outline-none text-[#2E4A4A] text-sm placeholder:text-[#9CA3AF]"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4 text-[#9CA3AF] hover:text-[#2E4A4A]" />
          </button>
        </div>

        {shouldShow && Object.keys(groupedAirports).length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E3E6E6] max-h-64 overflow-y-auto z-50 py-2">
            {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => (
              <div key={cityGroup} className="mb-2 last:mb-0">
                <div className="px-4 py-1.5 text-xs font-bold text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2">
                  <FontAwesomeIcon icon={faTreeCity} className="w-3 h-3 opacity-60" />
                  {cityGroup !== "Other Locations" ? `${cityGroup} Area` : cityGroup}
                </div>
                {cityAirports.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(a);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full text-left pr-4 pl-11 py-2 text-sm hover:bg-[#F2F3F3] transition-colors flex flex-col gap-0.5 overflow-hidden"
                  >
                    <div className="flex items-center text-[#2E4A4A] w-full min-w-0">
                      <FontAwesomeIcon icon={faLocationDot} className="w-3 h-3 mr-2 text-[#9CA3AF] shrink-0" />
                      <span className="font-semibold text-[#345C5A] shrink-0">{a.iata_code}</span>
                      <span className="ml-2 truncate">{a.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Display Mode
  return (
    <div className="p-5 cursor-pointer hover:bg-[#F9FAFA] transition-colors rounded-2xl" onClick={() => setOpen(true)}>
      <p className="text-xs text-[#9CA3AF] mb-1">{label}</p>
      <p className="text-xl font-bold text-[#2E4A4A] truncate">
        {value ? `${value.name.split("–")[0].trim()} (${value.iata_code})` : "Select Airport"}
      </p>
    </div>
  );
};

/* ── Flights Page ──────────────────────────────────────────── */
const FlightsPage = ({ onSignOut, onNavigate }: { onSignOut: () => void; onNavigate: (page: string) => void }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullName, setFullName] = useState("");

  // Flight search state
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [airports, setAirports] = useState<Airport[]>([]);
  const [departure, setDeparture] = useState<Airport | null>(null);
  const [arrival, setArrival] = useState<Airport | null>(null);
  const [departureDate, setDepartureDate] = useState<Date>();
  const [arrivalDate, setArrivalDate] = useState<Date>();
  const [depDateOpen, setDepDateOpen] = useState(false);
  const [retDateOpen, setRetDateOpen] = useState(false);

  const showReturnDate = tripType === "round-trip" || tripType === "multi-day";

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_info")
        .select("image_file, first_name, last_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (data) {
        if (data.image_file && data.image_file.startsWith("http")) setAvatarUrl(data.image_file);
        const fi = (data.first_name?.[0] || "").toUpperCase();
        const li = (data.last_name?.[0] || "").toUpperCase();
        setInitials(fi + li || "U");
        setFullName([data.first_name, data.last_name].filter(Boolean).join(" ") || "Explorer");
      }
    };

    const loadAirports = async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code, locations(city, state_code, region)")
        .order("name");
      if (data) setAirports(data as unknown as Airport[]);
    };

    loadProfile();
    loadAirports();
  }, []);

  const handleMenuClick = (label: string) => {
    setSheetOpen(false);
    const map: Record<string, string> = {
      Home: "home",
      Destinations: "destinations",
    };
    if (map[label]) setTimeout(() => onNavigate(map[label]), 300);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Background Elements */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity"
            >
              <FontAwesomeIcon icon={faBars} className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85%] sm:max-w-sm p-0 bg-white border-none rounded-r-3xl flex flex-col"
          >
            {/* ... Drawer Content ... */}
            <div className="flex items-center gap-4 px-6 pt-10 pb-6">
              <Avatar className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm">
                <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
                <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[#9CA3AF] text-sm font-medium">Hello,</p>
                <p className="text-[#2E4A4A] text-lg font-semibold truncate">{fullName}</p>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors"
                type="button"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
              </button>
            </div>
            <div className="h-px bg-[#E5E7EB] mx-6" />
            <nav className="flex-1 px-6 pt-4 flex flex-col justify-start gap-1">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleMenuClick(item.label)}
                  className="flex items-center gap-4 py-2.5 text-[#2E4A4A] hover:text-[#345C5A] hover:bg-[#F2F3F3] rounded-xl px-2 transition-colors"
                >
                  <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
                  <span className="text-base font-semibold">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-auto">
              <div className="h-px bg-[#E5E7EB] mx-6" />
              <button
                onClick={() => {
                  setSheetOpen(false);
                  setTimeout(() => onSignOut(), 300);
                }}
                type="button"
                className="flex items-center gap-4 px-8 py-5 text-[#2E4A4A] hover:text-red-600 transition-colors w-full"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="w-5 h-5" />
                <span className="text-base font-semibold">Logout</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-5 h-12">
          <button
            type="button"
            className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} className="w-[22px] h-[22px]" />
          </button>
          <button
            type="button"
            className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative"
          >
            <FontAwesomeIcon icon={faBell} className="w-6 h-6" />
          </button>
          <Avatar
            className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onNavigate("account")}
          >
            <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
            <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Page Title */}
      <div className="px-6 pt-2 pb-6 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-2 tracking-tight">Flights</h1>
      </div>

      {/* ── Flight Search Form Card ────────────────────────── */}
      <div className="px-6 pb-8 relative z-10 animate-fade-in">
        <div className="bg-white rounded-[32px] shadow-xl p-6">
          {/* Trip Type Tabs */}
          <div className="bg-[#F2F3F3] rounded-full p-1 flex mb-6">
            {tripOptions.map((opt) => {
              const isActive = tripType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTripType(opt.value)}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold rounded-full transition-all duration-200 text-center",
                    isActive ? "bg-white text-[#2E4A4A] shadow-sm" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Airports Container */}
          <div className="bg-white border border-[#E3E6E6] rounded-2xl relative mb-6">
            {/* Departure */}
            <div className="border-b border-[#E3E6E6]">
              <AirportSearchboxNew label="From" value={departure} onChange={setDeparture} airports={airports} />
            </div>
            {/* Arrival */}
            <div>
              <AirportSearchboxNew label="To" value={arrival} onChange={setArrival} airports={airports} />
            </div>
            {/* Swap Button */}
            <button
              type="button"
              className="absolute right-8 top-1/2 -translate-y-1/2 bg-[#345C5A] text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-10"
              onClick={() => {
                const temp = departure;
                setDeparture(arrival);
                setArrival(temp);
              }}
            >
              <FontAwesomeIcon icon={faArrowRightArrowLeft} className="w-5 h-5 rotate-90" />
            </button>
          </div>

          {/* Date & Travelers Row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Departure Date */}
            <Popover open={depDateOpen} onOpenChange={setDepDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="bg-white border border-[#E3E6E6] rounded-2xl p-4 text-left hover:border-[#345C5A] transition-colors"
                >
                  <p className="text-xs text-[#9CA3AF] mb-1">Departure</p>
                  <div className="flex items-center justify-between">
                    <p className={cn("text-lg font-bold", departureDate ? "text-[#2E4A4A]" : "text-[#9CA3AF]")}>
                      {departureDate ? format(departureDate, "EEE, dd MMM") : "Select date"}
                    </p>
                    <FontAwesomeIcon icon={faCalendarDays} className="w-5 h-5 text-[#2E4A4A]" />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={departureDate}
                  onSelect={(date) => {
                    setDepartureDate(date);
                    setDepDateOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Return Date or Travelers */}
            {showReturnDate ? (
              <Popover open={retDateOpen} onOpenChange={setRetDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="bg-white border border-[#E3E6E6] rounded-2xl p-4 text-left hover:border-[#345C5A] transition-colors"
                  >
                    <p className="text-xs text-[#9CA3AF] mb-1">Return</p>
                    <div className="flex items-center justify-between">
                      <p className={cn("text-lg font-bold", arrivalDate ? "text-[#2E4A4A]" : "text-[#9CA3AF]")}>
                        {arrivalDate ? format(arrivalDate, "EEE, dd MMM") : "Select date"}
                      </p>
                      <FontAwesomeIcon icon={faCalendarDays} className="w-5 h-5 text-[#2E4A4A]" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={arrivalDate}
                    onSelect={(date) => {
                      setArrivalDate(date);
                      setRetDateOpen(false);
                    }}
                    disabled={(date) => date < (departureDate || new Date())}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              // Static Travelers (for one-way/day-trip layout match)
              <button
                type="button"
                className="bg-white border border-[#E3E6E6] rounded-2xl p-4 text-left flex items-center justify-between"
              >
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">Travelers</p>
                  <p className="text-lg font-bold text-[#2E4A4A]">2 Adults</p>
                </div>
                <FontAwesomeIcon icon={faChevronDown} className="w-5 h-5 text-[#2E4A4A]" />
              </button>
            )}
          </div>

          {/* Travelers Row (for Round Trip) */}
          {showReturnDate && (
            <div className="mb-6">
              <button
                type="button"
                className="w-full bg-white border border-[#E3E6E6] rounded-2xl p-4 text-left flex items-center justify-between"
              >
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">Travelers</p>
                  <p className="text-lg font-bold text-[#2E4A4A]">2 Adults</p>
                </div>
                <FontAwesomeIcon icon={faChevronDown} className="w-5 h-5 text-[#2E4A4A]" />
              </button>
            </div>
          )}

          {/* Search Button */}
          <button
            type="button"
            onClick={() => onNavigate("flight-results")}
            className="w-full py-5 bg-black text-white font-bold text-xl rounded-full shadow-md hover:opacity-90 transition-opacity"
          >
            Find Flights
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlightsPage;
