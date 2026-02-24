import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faMagnifyingGlass,
  faCircleCheck,
  faLocationDot,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

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

  const [homeCity, setHomeCity] = useState<LocationOption | null>(null);
  const [homeCitySearch, setHomeCitySearch] = useState("");
  const [homeCityResults, setHomeCityResults] = useState<LocationOption[]>([]);
  const [showHomeDropdown, setShowHomeDropdown] = useState(false);

  const [favoriteCities, setFavoriteCities] = useState<LocationOption[]>([]);
  const [favSearch, setFavSearch] = useState("");
  const [favResults, setFavResults] = useState<LocationOption[]>([]);
  const [showFavDropdown, setShowFavDropdown] = useState(false);

  const homeRef = useRef<HTMLDivElement>(null);
  const favRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: info } = await supabase
        .from("user_info")
        .select("id, home_location_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!info) { setLoading(false); return; }

      setUserId(info.id);

      // Load home city
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

      // Load favorites
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
    if (!userId) return;
    setSaving(true);

    await supabase.from("user_info").update({ home_location_id: homeCity?.id ?? null }).eq("id", userId);
    await supabase.from("user_locations").delete().eq("user_id", userId);
    if (favoriteCities.length > 0) {
      await supabase.from("user_locations").insert(favoriteCities.map((f) => ({ user_id: userId, location_id: f.id })));
    }

    setSaving(false);
    toast.success("Travel preferences updated");
    onBack();
  };

  const labelStyle = "block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-1.5";
  const inputStyle = "w-full px-3.5 py-3 rounded-xl bg-[#E8EAE9] text-[#2E4A4A] placeholder:text-[#849494] outline-none transition-all border-2 border-transparent focus:border-[#345C5A] focus:bg-white text-sm";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" onClick={onBack} className="h-10 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-70 transition-opacity">
          <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-[#345C5A] tracking-tight">Travel Preferences</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">
        {/* Home City */}
        <div ref={homeRef} className="form-group relative">
          <label className={labelStyle}>Home City</label>
          <div className="relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#849494]" />
            <input
              value={homeCitySearch}
              onChange={(e) => handleHomeSearch(e.target.value)}
              onFocus={() => { if (homeCitySearch.length >= 3) setShowHomeDropdown(true); }}
              placeholder="Search for your home city..."
              className={`${inputStyle} pl-10 ${homeCity ? "pr-10 text-[#345C5A] font-medium" : ""}`}
            />
            {homeCity && <FontAwesomeIcon icon={faCircleCheck} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#345C5A]" />}
          </div>
          {showHomeDropdown && homeCityResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-[#E3E6E6] rounded-xl shadow-lg max-h-44 overflow-y-auto">
              {homeCityResults.map((loc) => (
                <button key={loc.id} onClick={() => selectHome(loc)} className="w-full flex items-center px-4 py-2.5 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3]">
                  <FontAwesomeIcon icon={faLocationDot} className="w-3.5 h-3.5 text-[#849494] mr-3" />
                  {fmt(loc)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Favorite Cities */}
        <div ref={favRef} className="form-group relative">
          <label className={labelStyle}>Favorite Cities {favoriteCities.length > 0 && `(${favoriteCities.length}/5)`}</label>
          <div className="relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#849494]" />
            <input
              value={favSearch}
              onChange={(e) => handleFavSearch(e.target.value)}
              onFocus={() => { if (favSearch.length >= 3) setShowFavDropdown(true); }}
              placeholder={favoriteCities.length >= 5 ? "Max 5 cities reached" : "Search for favorite cities..."}
              disabled={favoriteCities.length >= 5}
              className={`${inputStyle} pl-10 disabled:opacity-50`}
            />
          </div>
          {showFavDropdown && favResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-[#E3E6E6] rounded-xl shadow-lg max-h-44 overflow-y-auto">
              {favResults.filter((l) => !homeCity || l.id !== homeCity.id).map((loc) => (
                <button key={loc.id} onClick={() => addFav(loc)} className="w-full flex items-center px-4 py-2.5 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3]">
                  <FontAwesomeIcon icon={faLocationDot} className="w-3.5 h-3.5 text-[#849494] mr-3" />
                  {fmt(loc)}
                </button>
              ))}
            </div>
          )}
          {favoriteCities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {favoriteCities.map((loc) => (
                <span key={loc.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#345C5A] text-white text-xs font-semibold">
                  {fmt(loc)}
                  <button onClick={() => removeFav(loc.id)} className="hover:opacity-80">
                    <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-[#345C5A] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default TravelPreferencesScreen;
