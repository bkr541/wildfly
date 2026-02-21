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
  faUserGroup,
  faCreditCard,
  faRightFromBracket,
  faChevronLeft,
  faPlaneDeparture,
  faPlaneArrival,
  faCalendarDays,
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
}

/* ── Airport Searchbox ─────────────────────────────────────── */
const AirportSearchbox = ({
  label,
  icon,
  value,
  onChange,
  airports,
}: {
  label: string;
  icon: any;
  value: Airport | null;
  onChange: (a: Airport | null) => void;
  airports: Airport[];
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return airports.slice(0, 30);
    const q = query.toLowerCase();
    return airports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [query, airports]);

  return (
    <div className="relative">
      <label className="text-xs font-semibold text-[#6B7B7B] mb-1.5 block">{label}</label>
      <div
        className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-[#E3E6E6] focus-within:border-[#345C5A] transition-colors cursor-text"
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        <FontAwesomeIcon icon={icon} className="w-4 h-4 text-[#345C5A]" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search airport..."
          value={open ? query : value ? `${value.iata_code} – ${value.name}` : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="flex-1 bg-transparent outline-none text-[#2E4A4A] text-sm placeholder:text-[#9CA3AF]"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-lg border border-[#E3E6E6] max-h-48 overflow-y-auto z-50">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(a);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              <span className="font-semibold text-[#345C5A]">{a.iata_code}</span>
              <span className="ml-2">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Flights Page ──────────────────────────────────────────── */
const FlightsPage = ({
  onSignOut,
  onNavigate,
}: {
  onSignOut: () => void;
  onNavigate: (page: string) => void;
}) => {
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

  const showReturnDate = tripType === "round-trip" || tripType === "multi-day";

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
        .select("id, name, iata_code")
        .order("name");
      if (data) setAirports(data);
    };

    loadProfile();
    loadAirports();
  }, []);

  const handleMenuClick = (label: string) => {
    setSheetOpen(false);
    const map: Record<string, string> = { Home: "home", Destinations: "destinations" };
    if (map[label]) setTimeout(() => onNavigate(map[label]), 300);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button type="button" className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity">
              <FontAwesomeIcon icon={faBars} className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85%] sm:max-w-sm p-0 bg-white border-none rounded-r-3xl flex flex-col">
            <div className="flex items-center gap-4 px-6 pt-10 pb-6">
              <Avatar className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm">
                <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
                <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[#9CA3AF] text-sm font-medium">Hello,</p>
                <p className="text-[#2E4A4A] text-lg font-semibold truncate">{fullName}</p>
              </div>
              <button onClick={() => setSheetOpen(false)} className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors" type="button">
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
                onClick={() => { setSheetOpen(false); setTimeout(() => onSignOut(), 300); }}
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
          <button type="button" className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="w-[22px] h-[22px]" />
          </button>
          <button type="button" className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative">
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

      <div className="px-6 pt-2 pb-4 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-2 tracking-tight">Flights</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Find and track your upcoming flights.</p>
      </div>

      {/* ── Flight Search Form ─────────────────────────────── */}
      <div className="px-6 pb-8 relative z-10 flex flex-col gap-5 animate-fade-in">
        {/* Trip Type Switch */}
        <div className="bg-white rounded-2xl p-1.5 flex shadow-sm border border-[#E3E6E6]">
          {tripOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTripType(opt.value)}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200",
                tripType === opt.value
                  ? "bg-[#345C5A] text-white shadow-sm"
                  : "text-[#6B7B7B] hover:text-[#2E4A4A]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Departure Airport */}
        <AirportSearchbox
          label="Departure"
          icon={faPlaneDeparture}
          value={departure}
          onChange={setDeparture}
          airports={airports}
        />

        {/* Arrival Airport */}
        <AirportSearchbox
          label="Arrival"
          icon={faPlaneArrival}
          value={arrival}
          onChange={setArrival}
          airports={airports}
        />

        {/* Date Pickers */}
        <div className={cn("grid gap-4", showReturnDate ? "grid-cols-2" : "grid-cols-1")}>
          {/* Departure Date */}
          <div>
            <label className="text-xs font-semibold text-[#6B7B7B] mb-1.5 block">Departure Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-[#E3E6E6] hover:border-[#345C5A] transition-colors text-left",
                    !departureDate && "text-[#9CA3AF]"
                  )}
                >
                  <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-[#345C5A]" />
                  <span className="text-sm">
                    {departureDate ? format(departureDate, "MMM d, yyyy") : "Select date"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={departureDate}
                  onSelect={setDepartureDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Return Date — only for Round Trip / Multi Day */}
          {showReturnDate && (
            <div>
              <label className="text-xs font-semibold text-[#6B7B7B] mb-1.5 block">Return Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-[#E3E6E6] hover:border-[#345C5A] transition-colors text-left",
                      !arrivalDate && "text-[#9CA3AF]"
                    )}
                  >
                    <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-[#345C5A]" />
                    <span className="text-sm">
                      {arrivalDate ? format(arrivalDate, "MMM d, yyyy") : "Select date"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={arrivalDate}
                    onSelect={setArrivalDate}
                    disabled={(date) =>
                      date < (departureDate || new Date())
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
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

export default FlightsPage;
