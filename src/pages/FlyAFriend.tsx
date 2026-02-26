import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Airplane01Icon, Location01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { AppInput } from "@/components/ui/app-input";
import { cn } from "@/lib/utils";

interface Airport {
  id: number;
  name: string;
  iata_code: string;
  locations?: { city: string; state_code: string };
}

const AirportInput = ({
  label,
  icon,
  value,
  onChange,
  onSelect,
  airports,
  placeholder,
}: {
  label: string;
  icon: any;
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: Airport) => void;
  airports: Airport[];
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim().length > 1
    ? airports.filter(
        (a) =>
          a.name.toLowerCase().includes(value.toLowerCase()) ||
          a.iata_code.toLowerCase().includes(value.toLowerCase()) ||
          a.locations?.city?.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10)
    : [];

  return (
    <div className="relative w-full" ref={ref}>
      <AppInput
        label={label}
        icon={icon}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        clearable
        onClear={() => { onChange(""); setOpen(false); }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E3E6E6] z-50 max-h-52 overflow-y-auto">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(a); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F2F3F3] text-left transition-colors"
            >
              <span className="text-xs font-bold text-[#345C5A] w-8 shrink-0">{a.iata_code}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#2E4A4A] truncate">{a.name}</p>
                {a.locations && (
                  <p className="text-xs text-[#9CA3AF] truncate">{a.locations.city}, {a.locations.state_code}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const FlyAFriendPage = () => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originAirport, setOriginAirport] = useState<Airport | null>(null);
  const [destAirport, setDestAirport] = useState<Airport | null>(null);

  useEffect(() => {
    supabase
      .from("airports")
      .select("id, name, iata_code, locations(city, state_code)")
      .then(({ data }) => {
        if (data) setAirports(data as any[]);
      });
  }, []);

  const handleSearch = () => {
    if (!originAirport || !destAirport) return;
    // Placeholder for future search logic
    alert(`Searching flights from ${originAirport.iata_code} to ${destAirport.iata_code}`);
  };

  return (
    <div className="flex flex-col min-h-screen px-5 pt-6 pb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#2E4A4A] leading-tight">Fly a Friend</h2>
        <p className="text-sm text-[#6B7B7B] mt-1">Search flights for someone special</p>
      </div>

      <div className="flex flex-col gap-5 flex-1">
        <AirportInput
          label="Departing Airport"
          icon={Airplane01Icon}
          value={origin}
          onChange={(v) => { setOrigin(v); setOriginAirport(null); }}
          onSelect={(a) => { setOrigin(`${a.iata_code} – ${a.name}`); setOriginAirport(a); }}
          airports={airports}
          placeholder="Search airport or city..."
        />

        <AirportInput
          label="Arrival Airport"
          icon={Location01Icon}
          value={destination}
          onChange={(v) => { setDestination(v); setDestAirport(null); }}
          onSelect={(a) => { setDestination(`${a.iata_code} – ${a.name}`); setDestAirport(a); }}
          airports={airports}
          placeholder="Search airport or city..."
        />
      </div>

      <button
        type="button"
        onClick={handleSearch}
        disabled={!originAirport || !destAirport}
        className={cn(
          "mt-auto w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all",
          originAirport && destAirport
            ? "bg-[#345C5A] text-white shadow-lg active:scale-95"
            : "bg-[#E3E6E6] text-[#9CA3AF] cursor-not-allowed"
        )}
      >
        <HugeiconsIcon icon={Search01Icon} size={20} color="currentColor" strokeWidth={2} />
        Search Flights
      </button>
    </div>
  );
};

export default FlyAFriendPage;
