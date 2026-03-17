import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  CheckmarkCircle01Icon,
  Location01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  FloppyDiskIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TravelPreferencesScreenProps {
  onBack: () => void;
}

interface LocationOption {
  id: number;
  city: string | null;
  state_code: string | null;
  name: string;
}

const fmt = (loc: LocationOption) =>
  loc.city && loc.state_code ? `${loc.city}, ${loc.state_code}` : loc.name;

const TravelPreferencesScreen = ({ onBack }: TravelPreferencesScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [homeCity, setHomeCity] = useState<LocationOption | null>(null);
  const [homeCitySearch, setHomeCitySearch] = useState("");
  const [homeCityResults, setHomeCityResults] = useState<LocationOption[]>([]);
  const [showHomeDropdown, setShowHomeDropdown] = useState(false);

  const [favoriteCities, setFavoriteCities] = useState<LocationOption[]>([]);
  const [favSearch, setFavSearch] = useState("");
  const [favResults, setFavResults] = useState<LocationOption[]>([]);
  const [showFavDropdown, setShowFavDropdown] = useState(false);

  const [travelDefaultsOpen, setTravelDefaultsOpen] = useState(false);
  const [defaultDepartureToHome, setDefaultDepartureToHome] = useState(false);

  const homeRef = useRef<HTMLDivElement>(null);
  const favRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAuthUserId(user.id);

      const { data: info } = await supabase
        .from("user_info")
        .select("id, home_location_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!info) { setLoading(false); return; }

      setUserId(info.id);

      if (info.home_location_id) {
        const { data: loc } = await supabase
          .from("locations")
          .select("id, city, state_code, name")
          .eq("id", info.home_location_id)
          .maybeSingle();
        if (loc) {
          setHomeCity(loc as LocationOption);
          setHomeCitySearch(fmt(loc as LocationOption));
        }
      }

      const { data: favRows } = await supabase
        .from("user_locations")
        .select("location_id")
        .eq("user_id", info.id);
      if (favRows && favRows.length > 0) {
        const ids = favRows.map((r) => r.location_id);
        const { data: locs } = await supabase
          .from("locations")
          .select("id, city, state_code, name")
          .in("id", ids);
        if (locs) setFavoriteCities(locs as LocationOption[]);
      }

      // Load user_settings
      const { data: settings } = await supabase
        .from("user_settings")
        .select("default_departure_to_home")
        .eq("user_id", user.id)
        .maybeSingle();
      if (settings) setDefaultDepartureToHome((settings as any).default_departure_to_home ?? false);

      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (homeRef.current && !homeRef.current.contains(e.target as Node)) setShowHomeDropdown(false);
      if (favRef.current && !favRef.current.contains(e.target as Node)) setShowFavDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchLocations = useCallback(async (query: string, setter: (r: LocationOption[]) => void) => {
    if (query.length < 3) { setter([]); return; }
    const { data } = await supabase
      .from("locations")
      .select("id, city, state_code, name")
      .or(`city.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(10);
    setter((data as LocationOption[]) || []);
  }, []);

  const handleHomeSearch = (val: string) => {
    setHomeCitySearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocations(val, setHomeCityResults);
      setShowHomeDropdown(val.length >= 3);
    }, 300);
  };

  const handleFavSearch = (val: string) => {
    setFavSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocations(val, setFavResults);
      setShowFavDropdown(val.length >= 3);
    }, 300);
  };

  const selectHome = (loc: LocationOption) => {
    setHomeCity(loc);
    setHomeCitySearch(fmt(loc));
    setShowHomeDropdown(false);
    setFavoriteCities((prev) => prev.filter((f) => f.id !== loc.id));
  };

  const addFav = (loc: LocationOption) => {
    if (favoriteCities.length >= 5) return;
    if (homeCity && loc.id === homeCity.id) return;
    if (favoriteCities.some((f) => f.id === loc.id)) return;
    setFavoriteCities((prev) => [...prev, loc]);
    setFavSearch("");
    setShowFavDropdown(false);
  };

  const removeFav = (id: number) => setFavoriteCities((prev) => prev.filter((f) => f.id !== id));

  const handleSave = async () => {
    if (!userId || !authUserId) return;
    setSaving(true);

    await supabase.from("user_info").update({
      home_location_id: homeCity?.id ?? null,
      home_city: homeCity ? fmt(homeCity) : null,
    }).eq("id", userId);
    await supabase.from("user_locations").delete().eq("user_id", userId);
    if (favoriteCities.length > 0) {
      await supabase.from("user_locations").insert(favoriteCities.map((f) => ({ user_id: userId, location_id: f.id })));
    }

    // Save user_settings
    await supabase.from("user_settings")
      .upsert({ user_id: authUserId, default_departure_to_home: defaultDepartureToHome } as any, { onConflict: "user_id" });

    setSaving(false);
    toast.success("Travel preferences updated");
    onBack();
  };

  const labelStyle = "text-xs font-semibold text-[#6B7B7B] mb-1 block";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">
        {/* Home City */}
        <div ref={homeRef} className="form-group relative">
          <label className={labelStyle}>Home City</label>
          <div
            className={cn(
              "app-input-container flex items-center h-10 bg-white",
              homeCitySearch.length > 0 && "focus-within",
            )}
            style={{ padding: "0 0.8em" }}
          >
            <HugeiconsIcon icon={Search01Icon} size={20} color="#345C5A" strokeWidth={1.5} className="shrink-0 mr-2" />
            <input
              value={homeCitySearch}
              onChange={(e) => handleHomeSearch(e.target.value)}
              onFocus={() => { if (homeCitySearch.length >= 3) setShowHomeDropdown(true); }}
              placeholder="Search for your home city..."
              className="flex-1 bg-transparent outline-none text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF]"
            />
            {homeCity && (
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} color="#345C5A" strokeWidth={1.5} className="shrink-0 ml-2" />
            )}
          </div>
          {showHomeDropdown && homeCityResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-[#E3E6E6] rounded-xl shadow-lg max-h-44 overflow-y-auto">
              {homeCityResults.map((loc) => (
                <button key={loc.id} onClick={() => selectHome(loc)} className="w-full flex items-center px-4 py-2.5 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3]">
                  <HugeiconsIcon icon={Location01Icon} size={14} color="#849494" strokeWidth={1.5} className="mr-3 shrink-0" />
                  {fmt(loc)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Favorite Cities */}
        <div ref={favRef} className="form-group relative">
          <label className={labelStyle}>Favorite Cities {favoriteCities.length > 0 && `(${favoriteCities.length}/5)`}</label>
          <div
            className={cn(
              "app-input-container flex items-center gap-1.5 min-h-10 bg-white",
              favoriteCities.length >= 5 && "opacity-50 pointer-events-none",
            )}
            style={{ padding: "0.3em 0.8em" }}
          >
            <HugeiconsIcon icon={Search01Icon} size={20} color="#345C5A" strokeWidth={1.5} className="shrink-0 mr-1" />
            <div className="flex flex-wrap gap-1.5 flex-1 items-center py-0.5">
              {favoriteCities.map((loc) => (
                <span key={loc.id} className="inline-flex items-center gap-1.5 bg-[#E8F1F1] border border-[#D6DEDF] text-[#2E4A4A] text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full shadow-sm whitespace-nowrap shrink-0">
                  {fmt(loc)}
                  <button
                    type="button"
                    onClick={() => removeFav(loc.id)}
                    className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors leading-none"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={10} color="currentColor" strokeWidth={1.5} />
                  </button>
                </span>
              ))}
              <input
                value={favSearch}
                onChange={(e) => handleFavSearch(e.target.value)}
                onFocus={() => { if (favSearch.length >= 3) setShowFavDropdown(true); }}
                placeholder={favoriteCities.length === 0 ? "Search for favorite cities..." : ""}
                disabled={favoriteCities.length >= 5}
                className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF]"
              />
            </div>
          </div>
          {showFavDropdown && favResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-[#E3E6E6] rounded-xl shadow-lg max-h-44 overflow-y-auto">
              {favResults.filter((l) => !homeCity || l.id !== homeCity.id).map((loc) => (
                <button key={loc.id} onClick={() => addFav(loc)} className="w-full flex items-center px-4 py-2.5 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3]">
                  <HugeiconsIcon icon={Location01Icon} size={14} color="#849494" strokeWidth={1.5} className="mr-3 shrink-0" />
                  {fmt(loc)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Travel Defaults */}
      <div className="px-5">
        <div className="bg-white rounded-2xl border border-[#E3E6E6] shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setTravelDefaultsOpen(o => !o)}
            className="flex items-center justify-between w-full px-4 py-3.5 text-sm font-bold text-[#6B7B7B] hover:bg-[#F8F9F9] transition-colors"
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Home01Icon} size={16} color="currentColor" strokeWidth={1.5} />
              <span>Travel Defaults</span>
            </div>
            <HugeiconsIcon
              icon={travelDefaultsOpen ? ArrowDown01Icon : ArrowUp01Icon}
              size={13}
              color="#C4CACA"
              strokeWidth={2}
            />
          </button>

          {travelDefaultsOpen && (
            <div className="border-t border-[#E3E6E6] px-4 py-3 animate-fade-in">
              <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-[#F2F3F3]">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#2E4A4A] leading-snug">Default departure to home airport</p>
                  <p className="text-xs text-[#849494] mt-0.5">Pre-fill your home city airport in Routes & Flights</p>
                </div>
                <Switch
                  checked={defaultDepartureToHome}
                  onCheckedChange={setDefaultDepartureToHome}
                  className="data-[state=checked]:bg-[#345C5A]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        <button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-widest uppercase shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6">
          <span>{saving ? "Saving..." : "Save Changes"}</span>
          {!saving && <HugeiconsIcon icon={FloppyDiskIcon} size={18} color="white" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
};

export default TravelPreferencesScreen;

