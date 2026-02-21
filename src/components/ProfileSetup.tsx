import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faCamera, faXmark, faMagnifyingGlass, faUsers } from "@fortawesome/free-solid-svg-icons";

interface ProfileSetupProps {
  onComplete: () => void;
}

interface UserData {
  id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  dob: string | null;
  mobile_number: string | null;
  home_location_id: number | null;
  image_file: string;
}

interface LocationOption {
  id: number;
  city: string | null;
  state_code: string | null;
  name: string;
}

const formatLocationDisplay = (loc: LocationOption) =>
  loc.city && loc.state_code ? `${loc.city}, ${loc.state_code}` : loc.name;

const ProfileSetup = ({ onComplete }: ProfileSetupProps) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showInterstitial, setShowInterstitial] = useState(false);

  // Screen 1 state
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [usernameError, setUsernameError] = useState("");

  // Screen 2 state
  const [homeCity, setHomeCity] = useState<LocationOption | null>(null);
  const [homeCitySearch, setHomeCitySearch] = useState("");
  const [homeCityResults, setHomeCityResults] = useState<LocationOption[]>([]);
  const [showHomeCityDropdown, setShowHomeCityDropdown] = useState(false);
  const [favoriteCities, setFavoriteCities] = useState<LocationOption[]>([]);
  const [favSearch, setFavSearch] = useState("");
  const [favResults, setFavResults] = useState<LocationOption[]>([]);
  const [showFavDropdown, setShowFavDropdown] = useState(false);
  const [homeCityError, setHomeCityError] = useState("");

  const homeCityRef = useRef<HTMLDivElement>(null);
  const favCityRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data } = await supabase
        .from("user_info")
        .select("id, first_name, last_name, username, dob, mobile_number, home_location_id, image_file")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      if (data) {
        setUser(data as UserData);
        const defaultUsername = `${data.first_name || ""}${data.last_name || ""}`.replace(/\s/g, "");
        setUsername(data.username || defaultUsername);
        setDob(data.dob || "");
        setMobileNumber((data as any).mobile_number || "");
        if (data.image_file && data.image_file.startsWith("http")) {
          setAvatarUrl(data.image_file);
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (homeCityRef.current && !homeCityRef.current.contains(e.target as Node)) setShowHomeCityDropdown(false);
      if (favCityRef.current && !favCityRef.current.contains(e.target as Node)) setShowFavDropdown(false);
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

  const handleHomeCitySearch = (val: string) => {
    setHomeCitySearch(val);
    setHomeCityError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocations(val, setHomeCityResults);
      setShowHomeCityDropdown(val.length >= 3);
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

  const selectHomeCity = (loc: LocationOption) => {
    setHomeCity(loc);
    setHomeCitySearch(formatLocationDisplay(loc));
    setShowHomeCityDropdown(false);
    // Remove from favorites if it was selected
    setFavoriteCities(prev => prev.filter(f => f.id !== loc.id));
  };

  const addFavorite = (loc: LocationOption) => {
    if (favoriteCities.length >= 5) return;
    if (homeCity && loc.id === homeCity.id) return;
    if (favoriteCities.some(f => f.id === loc.id)) return;
    setFavoriteCities(prev => [...prev, loc]);
    setFavSearch("");
    setShowFavDropdown(false);
  };

  const removeFavorite = (id: number) => {
    setFavoriteCities(prev => prev.filter(f => f.id !== id));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const path = `${authUser.id}/avatar.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl);
      await supabase.from("user_info").update({ image_file: urlData.publicUrl }).eq("id", user.id);
    }
  };

  // Screen 1: Continue
  const handleScreen1Continue = async () => {
    if (!username.trim()) { setUsernameError("Username is required"); return; }
    if (!user) return;
    setSaving(true);
    const updates: Record<string, any> = { username: username.trim() };
    if (dob) updates.dob = dob;
    if (mobileNumber.trim()) updates.mobile_number = mobileNumber.trim();
    await supabase.from("user_info").update(updates).eq("id", user.id);
    setSaving(false);
    setStep(1);
  };

  // Screen 2: Continue
  const handleScreen2Continue = async () => {
    if (!homeCity) { setHomeCityError("Home City is required"); return; }
    if (!user) return;
    setSaving(true);
    await supabase.from("user_info").update({ home_location_id: homeCity.id }).eq("id", user.id);
    // Sync user_locations: delete all then insert current favorites
    await supabase.from("user_locations").delete().eq("user_id", user.id);
    if (favoriteCities.length > 0) {
      await supabase.from("user_locations").insert(
        favoriteCities.map(f => ({ user_id: user.id, location_id: f.id }))
      );
    }
    setSaving(false);
    setStep(2);
  };

  // Screen 3: Start Flying
  const handleStartFlying = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("user_info").update({ onboarding_complete: "Yes" }).eq("id", user.id);
    setSaving(false);
    setShowInterstitial(true);
    setTimeout(() => onComplete(), 2500);
  };

  const firstName = user?.first_name || "User";

  const inputBase = "w-full px-4 py-3 rounded-xl bg-white text-[#1A4E54] placeholder:text-gray-400 outline-none transition-all border border-gray-200 focus:ring-2 focus:ring-[#1A4E54]/20 focus:border-[#1A4E54]";
  const inputError = "w-full px-4 py-3 rounded-xl bg-white text-[#1A4E54] placeholder:text-gray-400 outline-none transition-all border border-destructive focus:ring-2 focus:ring-destructive/20";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Interstitial
  if (showInterstitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F3F3F3] animate-fade-in px-8">
        <div className="w-20 h-20 rounded-full bg-[#1A4E54]/10 flex items-center justify-center mb-8 animate-scale-in">
          <span className="text-4xl">✈️</span>
        </div>
        <h1 className="text-3xl font-bold text-[#1A4E54] mb-3 text-center">You're All Set!</h1>
        <p className="text-gray-500 text-lg text-center">It's time to get wild</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F3F3F3]">
      {/* Header */}
      <div className="flex items-center px-6 pt-10 pb-2">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="mr-3 text-[#1A4E54]">
            <FontAwesomeIcon icon={faChevronLeft} className="w-6 h-6" />
          </button>
        )}
        <div className="flex gap-2 flex-1 justify-center max-w-[200px] mx-auto">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-colors ${i <= step ? "bg-[#3D918B]" : "bg-gray-200"}`} />
          ))}
        </div>
        {step === 0 && <div className="w-6" />}
      </div>

      <div className="flex-1 px-6 pb-6 flex flex-col">
        {/* ===================== Screen 1: Profile ===================== */}
        {step === 0 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h1 className="text-3xl font-bold text-[#1A4E54] mt-8 mb-2">User's Profile</h1>
            <p className="text-gray-500 text-base mb-10">Let's start off by learning a little more about you.</p>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              <label className="relative w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer overflow-hidden group">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <FontAwesomeIcon icon={faCamera} className="w-10 h-10 text-[#1A4E54] opacity-60 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <FontAwesomeIcon icon={faCamera} className="w-8 h-8 text-white" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
              <p className="text-[#1A4E54] font-bold text-lg mt-4 hidden">{user?.first_name} {user?.last_name}</p>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div className="form-group">
                <label className="block text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">Username *</label>
                <input
                  value={username}
                  onChange={e => { setUsername(e.target.value); setUsernameError(""); }}
                  placeholder="username"
                  className={usernameError ? inputError : inputBase}
                />
                {usernameError && <p className="text-destructive text-xs mt-1">{usernameError}</p>}
              </div>
              <div className="form-group">
                <label className="block text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">Date of Birth</label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={inputBase} />
              </div>
              <div className="form-group">
                <label className="block text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">Mobile Number</label>
                <input type="tel" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="+1 (555) 000-0000" className={inputBase} />
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button
                onClick={handleScreen1Continue}
                disabled={saving}
                className="w-full py-4 rounded-xl bg-[#1A4E54] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ===================== Screen 2: Destinations ===================== */}
        {step === 1 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h1 className="text-3xl font-bold text-[#1A4E54] mt-8 mb-2">User's Destinations</h1>
            <p className="text-gray-500 text-base mb-10">Tell us where you call home and your favorite places to explore.</p>

            {/* Home City */}
            <div ref={homeCityRef} className="form-group relative mb-6">
              <label className="block text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">Home City *</label>
              <div className="relative">
                 <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={homeCitySearch}
                  onChange={e => handleHomeCitySearch(e.target.value)}
                  onFocus={() => homeCitySearch.length >= 3 && setShowHomeCityDropdown(true)}
                  placeholder="Search for your home city..."
                  className={`${homeCityError ? inputError : inputBase} pl-12`}
                />
              </div>
              {homeCityError && <p className="text-destructive text-xs mt-1">{homeCityError}</p>}
              {showHomeCityDropdown && homeCityResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {homeCityResults.map(loc => (
                    <button key={loc.id} onClick={() => selectHomeCity(loc)} className="w-full text-left px-4 py-3 text-sm text-[#1A4E54] hover:bg-gray-50 transition-colors">
                      {formatLocationDisplay(loc)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Favorite Cities - only show when home city selected */}
            {homeCity && (
              <div ref={favCityRef} className="form-group relative mb-4">
                <label className="block text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">
                  Favorite Cities {favoriteCities.length > 0 && `(${favoriteCities.length}/5)`}
                </label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={favSearch}
                    onChange={e => handleFavSearch(e.target.value)}
                    onFocus={() => favSearch.length >= 3 && setShowFavDropdown(true)}
                    placeholder={favoriteCities.length >= 5 ? "Max 5 cities reached" : "Search for favorite cities..."}
                    disabled={favoriteCities.length >= 5}
                    className={`${inputBase} pl-12 disabled:opacity-50`}
                  />
                </div>
                {showFavDropdown && favResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {favResults
                      .filter(loc => loc.id !== homeCity.id && !favoriteCities.some(f => f.id === loc.id))
                      .map(loc => (
                        <button key={loc.id} onClick={() => addFavorite(loc)} className="w-full text-left px-4 py-3 text-sm text-[#1A4E54] hover:bg-gray-50 transition-colors">
                          {formatLocationDisplay(loc)}
                        </button>
                      ))}
                  </div>
                )}

                {/* Chips */}
                {favoriteCities.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Selected Cities: {favoriteCities.length}</p>
                    <div className="flex flex-wrap gap-2">
                      {favoriteCities.map(loc => (
                        <span key={loc.id} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-[#1A4E54] text-sm font-medium shadow-sm">
                          {formatLocationDisplay(loc)}
                          <button onClick={() => removeFavorite(loc.id)} className="hover:text-destructive transition-colors">
                            <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-6">
              <button
                onClick={handleScreen2Continue}
                disabled={saving}
                className="w-full py-4 rounded-xl bg-[#1A4E54] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ===================== Screen 3: Friends ===================== */}
        {step === 2 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h1 className="text-3xl font-bold text-[#1A4E54] mt-8 mb-2">User's Friends</h1>
            <p className="text-gray-500 text-base mb-10">Find your travel buddies, make a crew, and explore together.</p>

            <div className="relative mb-6">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                disabled
                placeholder="Find Friends"
                className={`${inputBase} pl-12 opacity-50 cursor-not-allowed`}
              />
            </div>
            <div className="flex items-center gap-4 p-5 rounded-xl bg-white border border-gray-100 shadow-sm">
              <FontAwesomeIcon icon={faUsers} className="w-6 h-6 text-[#1A4E54] opacity-40 flex-shrink-0" />
              <p className="text-[#1A4E54] opacity-60 text-base font-medium">This feature is coming soon</p>
            </div>

            <div className="mt-auto pt-6">
              <button
                onClick={handleStartFlying}
                disabled={saving}
                className="w-full py-4 rounded-xl bg-[#1A4E54] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : "Start Flying"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;
