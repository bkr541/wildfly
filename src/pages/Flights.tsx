import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faHouse,
  faPlane,
  faLocationDot,
  faTreeCity,
  faUserGroup,
  faCreditCard,
  faRightFromBracket,
  faChevronLeft,
  faPlaneDeparture,
  faPlaneArrival,
  faCalendarDays,
  faArrowRight,
  faRepeat,
  faSun,
  faRoute,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { normalizeSingleRouteResponse, normalizeAllDestinationsResponse } from "@/utils/normalizeFlights";

const ACTIVE_TRIP_FLEX = 1.7;

const menuItems = [
  { icon: faHouse, label: "Home" },
  { icon: faPlane, label: "Flights" },
  { icon: faLocationDot, label: "Destinations" },
  { icon: faUserGroup, label: "Friends" },
  { icon: faCreditCard, label: "Subscription" },
];

type TripType = "one-way" | "round-trip" | "day-trip" | "multi-day";

const tripOptions: { value: TripType; label: string; icon: any }[] = [
  { value: "one-way", label: "One Way", icon: faArrowRight },
  { value: "round-trip", label: "Round Trip", icon: faRepeat },
  { value: "day-trip", label: "Day Trip", icon: faSun },
  { value: "multi-day", label: "Multi Day", icon: faRoute },
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

/* ── Airport Searchbox ─────────────────────────────────────── */
const AirportSearchbox = ({
  label,
  icon,
  value,
  onChange,
  airports,
  containerClassName,
  disabled = false,
  placeholder = "Search airport or city...",
}: {
  label: string;
  icon: any;
  value: Airport | null;
  onChange: (a: Airport | null) => void;
  airports: Airport[];
  containerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shouldShow = query.trim().length > 2;

  const groupedAirports = useMemo(() => {
    if (!shouldShow || disabled) return {};
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
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(airport);
        return acc;
      },
      {} as Record<string, Airport[]>,
    );
  }, [query, airports, shouldShow, disabled]);

  const showClear = !!value && !disabled;

  return (
    <div className={cn("relative", containerClassName, disabled && "opacity-70")}>
      <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">{label}</label>

      {/* Fixed height so the row doesn't grow when the clear (x) button appears */}
      <div
        className={cn(
          "flex items-center gap-2.5 bg-transparent transition-colors h-10",
          disabled ? "cursor-not-allowed" : "cursor-text",
        )}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        <FontAwesomeIcon icon={icon} className="w-4 h-4 text-[#345C5A] shrink-0" />

        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          value={open ? query : value ? `${value.iata_code} – ${value.name}` : ""}
          onChange={(e) => {
            if (disabled) return;
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery("");
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className={cn(
            "flex-1 h-full bg-transparent outline-none text-[#2E4A4A] text-sm placeholder:text-[#9CA3AF] min-w-0 truncate",
            disabled && "cursor-not-allowed",
          )}
        />

        {showClear && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setQuery("");
              setOpen(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors"
          >
            <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && !disabled && shouldShow && Object.keys(groupedAirports).length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-[#E3E6E6] max-h-64 overflow-y-auto z-50 py-2">
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
};

/* ── Flights Page ──────────────────────────────────────────── */
const FlightsPage = ({
  onSignOut,
  onNavigate,
}: {
  onSignOut: () => void;
  onNavigate: (page: string, data?: string) => void;
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullName, setFullName] = useState("");

  const [tripType, setTripType] = useState<TripType>("one-way");
  const [airports, setAirports] = useState<Airport[]>([]);
  const [departure, setDeparture] = useState<Airport | null>(null);
  const [arrival, setArrival] = useState<Airport | null>(null);

  const [departureDate, setDepartureDate] = useState<Date>();
  const [arrivalDate, setArrivalDate] = useState<Date>();
  const [depDateOpen, setDepDateOpen] = useState(false);
  const [retDateOpen, setRetDateOpen] = useState(false);

  const [searchAll, setSearchAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const showReturnDate = tripType === "round-trip" || tripType === "multi-day";

  const today = useMemo(() => startOfDay(new Date()), []);

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
    const map: Record<string, string> = { Home: "home", Destinations: "destinations" };
    if (map[label]) setTimeout(() => onNavigate(map[label]), 300);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {loading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F2F3F3]">
          <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-[#345C5A]/20 animate-ping" />
            <div
              className="absolute inset-2 rounded-full border-4 border-[#345C5A]/30 animate-ping"
              style={{ animationDelay: "0.3s" }}
            />
            <div
              className="absolute inset-4 rounded-full border-4 border-[#345C5A]/40 animate-ping"
              style={{ animationDelay: "0.6s" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <FontAwesomeIcon icon={faPlane} className="w-10 h-10 text-[#345C5A] animate-bounce" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#2E4A4A] tracking-tight mb-2">Searching Flights</p>
          <p className="text-sm text-[#6B7B7B]">This may take a moment…</p>
        </div>
      )}

      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      <header className="flex items-center justify-start px-6 pt-8 pb-2 relative z-10">
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
                  className="flex items-center gap-3 py-2 text-[#2E4A4A] hover:text-[#345C5A] hover:bg-[#F2F3F3] rounded-xl px-2 transition-colors"
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
                className="flex items-center gap-3 px-8 py-5 text-[#2E4A4A] hover:text-red-600 transition-colors w-full"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="w-5 h-5" />
                <span className="text-base font-semibold">Logout</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="px-6 pt-0 pb-3 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-1 tracking-tight">Flights</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Find and track your upcoming flights.</p>
      </div>

      <div className="px-6 pb-8 relative z-10 flex flex-col gap-5 animate-fade-in">
        {/* Trip Type Switch */}
        <div className="bg-white rounded-2xl p-1.5 flex shadow-sm border border-[#E3E6E6] relative">
          <div
            className="absolute top-1.5 bottom-1.5 rounded-xl bg-[#345C5A] shadow-[0_4px_10px_rgba(0,0,0,0.10)] transition-all duration-300 ease-in-out"
            style={{
              width: `calc(((100% - 12px) * ${ACTIVE_TRIP_FLEX} / ${tripOptions.length - 1 + ACTIVE_TRIP_FLEX}) - 8px)`,
              left: `calc(10px + (100% - 12px) * ${tripOptions.findIndex((o) => o.value === tripType)} / ${
                tripOptions.length - 1 + ACTIVE_TRIP_FLEX
              })`,
            }}
          />
          {tripOptions.map((opt) => {
            const isActive = tripType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTripType(opt.value)}
                style={{ flex: isActive ? ACTIVE_TRIP_FLEX : 1 }}
                className={cn(
                  "py-2.5 px-3 text-xs font-semibold rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                  isActive ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
                )}
              >
                <FontAwesomeIcon icon={opt.icon} className="w-4 h-4 shrink-0 transition-transform duration-300" />
                {isActive && <span className="animate-fade-in whitespace-nowrap">{opt.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Airport + Dates Group */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-visible">
          <div className="relative">
            <AirportSearchbox
              label="Departure"
              icon={faPlaneDeparture}
              value={departure}
              onChange={setDeparture}
              airports={airports}
              containerClassName="px-3 pt-3 pb-2"
            />

            <div className="h-px bg-[#E3E6E6] mx-3" />

            <AirportSearchbox
              label="Arrival"
              icon={faPlaneArrival}
              value={arrival}
              onChange={setArrival}
              airports={airports}
              disabled={searchAll}
              placeholder={searchAll ? "Searching all destinations" : "Search airport or city..."}
              containerClassName="px-3 pt-2 pb-2"
            />

            <div className="h-px bg-[#E3E6E6] mx-3" />
          </div>

          {/* Dates */}
          <div className="px-3 pt-2 pb-3">
            <div className={cn("grid gap-2", showReturnDate ? "grid-cols-2" : "grid-cols-1")}>
              <div>
                <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block cursor-pointer">Departure Date</label>

                <Popover open={depDateOpen} onOpenChange={setDepDateOpen}>
                  <PopoverTrigger asChild>
                    {/* CHANGED: fixed height to match airport inputs */}
                    <button type="button" className="w-full flex items-center gap-2.5 text-left outline-none h-10">
                      <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-[#345C5A] shrink-0" />
                      <span className={cn("text-sm", departureDate ? "text-[#2E4A4A]" : "text-[#9CA3AF]")}>
                        {departureDate ? format(departureDate, "MMM d, yyyy") : "Select date"}
                      </span>
                    </button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={departureDate}
                      onSelect={(date) => {
                        setDepartureDate(date);
                        setDepDateOpen(false);
                        if (arrivalDate && date && startOfDay(arrivalDate) < startOfDay(date))
                          setArrivalDate(undefined);
                      }}
                      disabled={(date) => date < today}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {showReturnDate && (
                <div>
                  <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block cursor-pointer">Return Date</label>

                  <Popover open={retDateOpen} onOpenChange={setRetDateOpen}>
                    <PopoverTrigger asChild>
                      {/* CHANGED: fixed height to match airport inputs */}
                      <button type="button" className="w-full flex items-center gap-2.5 text-left outline-none h-10">
                        <FontAwesomeIcon icon={faCalendarDays} className="w-4 h-4 text-[#345C5A] shrink-0" />
                        <span className={cn("text-sm", arrivalDate ? "text-[#2E4A4A]" : "text-[#9CA3AF]")}>
                          {arrivalDate ? format(arrivalDate, "MMM d, yyyy") : "Select date"}
                        </span>
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
                        disabled={(date) => date < startOfDay(departureDate ?? today)}
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

        {/* Search All Destinations (outside group, below, right-justified) */}
        <div className="flex items-center justify-end gap-2 -mt-1">
          <label htmlFor="search-all" className="text-xs font-semibold text-[#6B7B7B] cursor-pointer select-none">
            Search All Destinations
          </label>

          {/* CHANGED: knob is absolutely positioned so it stays perfectly centered */}
          <button
            id="search-all"
            type="button"
            role="switch"
            aria-checked={searchAll}
            onClick={() =>
              setSearchAll((prev) => {
                const next = !prev;
                if (next) setArrival(null);
                return next;
              })
            }
            className={cn(
              "relative inline-flex items-center h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
              searchAll ? "bg-[#345C5A]" : "bg-[#E3E6E6]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                searchAll ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {/* Search Button */}
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            if (!departure || !departureDate) return;
            const originCode = departure.iata_code;
            const depFormatted = format(departureDate, "yyyy-MM-dd");

            setLoading(true);
            try {
              let data, error;

              if (searchAll) {
                ({ data, error } = await supabase.functions.invoke("getAllDestinations", {
                  body: { departureAirport: originCode, departureDate: depFormatted },
                }));
              } else {
                const destinationCode = arrival?.iata_code || "";
                let targetUrl: string;
                let functionName: string;

                if (tripType === "round-trip" && arrivalDate) {
                  const retFormatted = format(arrivalDate, "yyyy-MM-dd");
                  targetUrl = `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${originCode}&d1=${destinationCode}&dd1=${encodeURIComponent(
                    depFormatted + " 00:00:00",
                  )}&dd2=${encodeURIComponent(retFormatted + " 00:00:00")}&r=true&adt=1&umnr=false&loy=false&mon=true&ftype=GW`;
                  functionName = "getRoundTripRoute";
                } else {
                  targetUrl = `https://booking.flyfrontier.com/Flight/InternalSelect?o1=${originCode}&d1=${destinationCode}&dd1=${encodeURIComponent(
                    depFormatted + " 00:00:00",
                  )}&adt=1&umnr=false&loy=false&mon=true&ftype=GW`;
                  functionName = "getSingleRoute";
                }

                ({ data, error } = await supabase.functions.invoke(functionName, {
                  body: { targetUrl, origin: originCode, destination: destinationCode },
                }));
              }

              if (error) {
                console.error("Edge function error:", error);
              } else {
                console.log("Scrape response:", data);
                const normalized = searchAll
                  ? normalizeAllDestinationsResponse(data)
                  : normalizeSingleRouteResponse(data);
                console.log("Normalized flights:", normalized);
                onNavigate("flight-results", JSON.stringify(normalized, null, 2));
              }
            } catch (err) {
              console.error("Failed to invoke edge function:", err);
            } finally {
              setLoading(false);
            }
          }}
          className="w-full py-4 bg-[#345C5A] text-white font-semibold text-base rounded-2xl shadow-sm hover:bg-[#2E4A4A] active:scale-[0.98] transition-all mt-2 disabled:opacity-60"
        >
          {loading ? "Searching..." : "Search Flights"}
        </button>
      </div>
    </div>
  );
};

export default FlightsPage;
