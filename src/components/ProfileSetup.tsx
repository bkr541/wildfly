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
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
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
    if (query.length < 3) {
      setter([]);
      return;
    }
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
    setFavoriteCities((prev) => prev.filter((f) => f.id !== loc.id));
  };

  const addFavorite = (loc: LocationOption) => {
    if (favoriteCities.length >= 5) return;
    if (homeCity && loc.id === homeCity.id) return;
    if (favoriteCities.some((f) => f.id === loc.id)) return;
    setFavoriteCities((prev) => [...prev, loc]);
    setFavSearch("");
    setShowFavDropdown(false);
  };

  const removeFavorite = (id: number) => {
    setFavoriteCities((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;
    const path = `${authUser.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl);
      await supabase.from("user_info").update({ image_file: urlData.publicUrl }).eq("id", user.id);
    }
  };

  // Screen 1: Continue
  const handleScreen1Continue = async () => {
    if (!username.trim()) {
      setUsernameError("Username is required");
      return;
    }
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
    if (!homeCity) {
      setHomeCityError("Home City is required");
      return;
    }
    if (!user) return;
    setSaving(true);
    await supabase.from("user_info").update({ home_location_id: homeCity.id }).eq("id", user.id);
    // Sync user_locations: delete all then insert current favorites
    await supabase.from("user_locations").delete().eq("user_id", user.id);
    if (favoriteCities.length > 0) {
      await supabase
        .from("user_locations")
        .insert(favoriteCities.map((f) => ({ user_id: user.id, location_id: f.id })));
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

  // Style constants
  const inputBase =
    "w-full px-4 py-4 rounded-xl bg-[#E8EAE9] text-[#2E4A4A] placeholder:text-[#849494] outline-none transition-all border-none focus:ring-2 focus:ring-[#345C5A]/20";
  const inputError =
    "w-full px-4 py-4 rounded-xl bg-[#E8EAE9] text-[#2E4A4A] outline-none transition-all border-2 border-red-500 focus:ring-2 focus:ring-red-500";
  const labelStyle = "block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-2";
  const buttonStyle =
    "w-full py-4 rounded-xl bg-[#345C5A] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F2F3F3]">
        <p className="text-[#6B7B7B]">Loading...</p>
      </div>
    );
  }

  // Interstitial
  if (showInterstitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F2F3F3] animate-fade-in px-8">
        <div className="w-20 h-20 rounded-full bg-[#345C5A]/10 flex items-center justify-center mb-8 animate-scale-in">
          <span className="text-4xl">✈️</span>
        </div>
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-3 text-center">You're All Set!</h1>
        <p className="text-[#6B7B7B] text-lg text-center">Welcome to Wildfly</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F3F3]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-10 pb-4">
        {/* Left Side: Back Button Space */}
        <div className="w-8 h-8 flex items-center justify-start">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="text-[#2E4A4A] hover:opacity-80 transition-opacity"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Center: Progress Bar */}
        <div className="flex gap-1.5 flex-1 justify-center max-w-[200px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors ${i <= step ? "bg-[#345C5A]" : "bg-[#DDE0E0]"}`}
            />
          ))}
        </div>

        {/* Right Side: Empty Spacer for perfect centering */}
        <div className="w-8 h-8" />
      </div>

      <div className="flex-1 px-6 pb-6 flex flex-col">
        {/* ===================== Screen 1: Profile ===================== */}
        {step === 0 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h1 className="text-3xl font-bold text-[#2E4A4A] mt-2 mb-1">{firstName}'s Profile</h1>
            <p className="text-[#6B7B7B] text-base mb-8">Let's start off by learning a little more about you.</p>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              <label className="relative w-32 h-32 rounded-full bg-[#E3E6E6] flex items-center justify-center cursor-pointer overflow-hidden group">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <FontAwesomeIcon
                    icon={faCamera}
                    className="w-10 h-10 text-[#345C5A] group-hover:opacity-80 transition-opacity"
                  />
                )}
                <div className="absolute inset-0 bg-[#F2F3F3]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <FontAwesomeIcon icon={faCamera} className="w-8 h-8 text-[#345C5A]" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>

            {/* Fields */}
            <div className="space-y-5">
              <div className="form-group">
                <label className={labelStyle}>Username *</label>
                <input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError("");
                  }}
                  placeholder="username"
                  className={usernameError ? inputError : inputBase}
                />
                {usernameError && <p className="text-red-500 text-xs mt-1">{usernameError}</p>}
              </div>
              <div className="form-group">
                <label className={labelStyle}>Date of Birth</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputBase} />
              </div>
              <div className="form-group">
                <label className={labelStyle}>Mobile Number</label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className={inputBase}
                />
              </div>
            </div>

            <div className="mt-auto pt-8">
              <button onClick={handleScreen1Continue} disabled={saving} className={buttonStyle}>
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ===================== Screen 2: Destinations ===================== */}
        {step === 1 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h1 className="text-3xl font-bold text-[#2E4A4A] mt-2 mb-1">{firstName}'s Destinations</h1>
            <p className="text-[#6B7B7B] text-base mb-8">
              Tell us where you call home and your favorite places to explore.
            </p>

            {/* Home City */}
            <div ref={homeCityRef} className="form-group relative mb-6">
              <label className={labelStyle}>Home City *</label>
              <div className="relative">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849494]"
                />
                <input
                  value={homeCitySearch}
                  onChange={(e) => handleHomeCitySearch(e.target.value)}
                  onFocus={() => homeCitySearch.length >= 3 && setShowHomeCityDropdown(true)}
                  placeholder="Search for your home city..."
                  className={`${homeCityError ? inputError : inputBase} pl-11`}
                />
              </div>
              {homeCityError && <p className="text-red-500 text-xs mt-1">{homeCityError}</p>}
              {showHomeCityDropdown && homeCityResults.length > 0 && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-[#E3E6E6] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {homeCityResults.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => selectHomeCity(loc)}
                      className="w-full text-left px-4 py-3 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors"
                    >
                      {formatLocationDisplay(loc)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Favorite Cities - only show when home city selected */}
            {homeCity && (
              <div ref={favCityRef} className="form-group relative mb-4">
                <label className={labelStyle}>
                  Favorite Cities {favoriteCities.length > 0 && `(${favoriteCities.length}/5)`}
                </label>
                <div className="relative">
                  <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849494]"
                  />
                  <input
                    value={favSearch}
                    onChange={(e) => handleFavSearch(e.target.value)}
                    onFocus={() => favSearch.length >= 3 && setShowFavDropdown(true)}
                    placeholder={favoriteCities.length >= 5 ? "Max 5 cities reached" : "Search for favorite cities..."}
                    disabled={favoriteCities.length >= 5}
                    className={`${inputBase} pl-11 disabled:opacity-50`}
                  />
                </div>
                {showFavDropdown && favResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-[#E3E6E6] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {favResults
                      .filter((loc) => loc.id !== homeCity.id && !favoriteCities.some((f) => f.id === loc.id))
                      .map((loc) => (
                        <button
                          key={loc.id}
                          onClick={() => addFavorite(loc)}
                          className="w-full text-left px-4 py-3 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors"
                        >
                          {formatLocationDisplay(loc)}
                        </button>
                      ))}
                  </div>
                )}

                {/* Chips */}
                {favoriteCities.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-[#6B7B7B] mb-2">Selected Cities: {favoriteCities.length}</p>
                    <div className="flex flex-wrap gap-2">
                      {favoriteCities.map((loc) => (
                        <span
                          key={loc.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E3E6E6] text-[#2E4A4A] text-sm font-medium"
                        >
                          {formatLocationDisplay(loc)}
                          <button
                            onClick={() => removeFavorite(loc.id)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <FontAwesomeIcon icon={faXmark} className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-8">
              <button onClick={handleScreen2Continue} disabled={saving} className={buttonStyle}>
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ===================== Screen 3: Friends ===================== */}
        {step === 2 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h1 className="text-3xl font-bold text-[#2E4A4A] mt-2 mb-1">{firstName}'s Friends</h1>
            <p className="text-[#6B7B7B] text-base mb-8">
              Find your travel buddies, make a crew, and explore together.
            </p>

            <div className="relative mb-5">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849494]"
              />
              <input
                disabled
                placeholder="Find Friends"
                className={`${inputBase} pl-11 opacity-50 cursor-not-allowed`}
              />
            </div>
            <div className="flex items-center gap-4 p-5 rounded-xl bg-[#E3E6E6]/50 border border-[#DDE0E0]">
              <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-[#6B7B7B] flex-shrink-0" />
              <p className="text-[#6B7B7B] text-sm font-medium">This feature is coming soon</p>
            </div>

            <div className="mt-auto pt-8">
              <button onClick={handleStartFlying} disabled={saving} className={buttonStyle}>
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
