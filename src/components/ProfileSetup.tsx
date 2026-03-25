import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { AppInput } from "@/components/ui/app-input";
import { Call02Icon, Search01Icon, CalendarCheckOut02Icon, Cancel01Icon, Location01Icon, Location04Icon, Home01Icon, HeartAddIcon, ArrowRight01Icon, AirplaneTakeOff01Icon, UserCircle02Icon, AddCircleIcon, AirportIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import {
  faChevronLeft,
  faCamera,
  faUsers,
  faLocationDot,
} from "@fortawesome/free-solid-svg-icons";

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
  avatar_url: string | null;
}

interface LocationOption {
  id: number;
  city: string | null;
  state_code: string | null;
  name: string;
}

interface AirportOption {
  id: number;
  iata_code: string;
  name: string;
  locations?: { city: string | null; state_code: string | null; region: string | null };
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    else if (digits.length > 0) formatted = `(${digits}`;
    setMobileNumber(formatted);
  };

  // Screen 2 state
  const [homeCity, setHomeCity] = useState<LocationOption | null>(null);
  const [homeCitySearch, setHomeCitySearch] = useState("");
  const [homeCityResults, setHomeCityResults] = useState<LocationOption[]>([]);
  const [showHomeCitySheet, setShowHomeCitySheet] = useState(false);
  const [favoriteCities, setFavoriteCities] = useState<LocationOption[]>([]);
  const [favSearch, setFavSearch] = useState("");
  const [favResults, setFavResults] = useState<LocationOption[]>([]);
  const [showFavSheet, setShowFavSheet] = useState(false);
  const [homeCityError, setHomeCityError] = useState("");
  const [favCityError, setFavCityError] = useState("");
  const [destTab, setDestTab] = useState<"home" | "favorites">("home");

  // Home Airport state
  const [allAirports, setAllAirports] = useState<AirportOption[]>([]);
  const [homeAirport, setHomeAirport] = useState<AirportOption | null>(null);
  const [showHomeAirportSheet, setShowHomeAirportSheet] = useState(false);
  const [airportQuery, setAirportQuery] = useState("");
  const [homeAirportError, setHomeAirportError] = useState("");
  const airportInputRef = useRef<HTMLInputElement>(null);

  const homeCityInputRef = useRef<HTMLInputElement>(null);
  const favCityInputRef = useRef<HTMLInputElement>(null);
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
        .select("id, first_name, last_name, username, dob, mobile_number, home_location_id, image_file, avatar_url")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      if (data) {
        setUser(data as UserData);
        const defaultUsername = `${data.first_name || ""}${data.last_name || ""}`.replace(/\s/g, "");
        setUsername(data.username || defaultUsername);
        setDob(data.dob || "");
        setMobileNumber((data as any).mobile_number || "");
        // Prefer avatar_url (canonical); fall back to legacy image_file
        const rawAvatar = (data as any).avatar_url || (data.image_file?.startsWith("http") ? data.image_file : null);
        if (rawAvatar) setAvatarUrl(rawAvatar);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Load all airports for the airport sheet
  useEffect(() => {
    supabase
      .from("airports")
      .select("id, iata_code, name, locations(city, state_code, region)")
      .then(({ data }) => {
        if (data) setAllAirports(data as AirportOption[]);
      });
  }, []);

  // Focus airport sheet input when it opens
  useEffect(() => {
    if (showHomeAirportSheet) {
      setAirportQuery("");
      requestAnimationFrame(() => {
        setTimeout(() => { airportInputRef.current?.focus(); }, 50);
      });
    }
  }, [showHomeAirportSheet]);

  // Filtered airports for the home airport sheet
  const filteredAirports = useMemo(() => {
    const q = airportQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allAirports
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.iata_code.toLowerCase().includes(q) ||
          (a.locations && !Array.isArray(a.locations) && (a.locations as any).city?.toLowerCase().includes(q)),
      )
      .slice(0, 40);
  }, [airportQuery, allAirports]);

  const searchLocations = useCallback(async (query: string, setter: (r: LocationOption[]) => void) => {
...
  // Screen 2: Continue
  const handleScreen2Continue = async () => {
    let hasError = false;
    if (!homeCity) {
      setDestTab("home");
      setHomeCityError("Home City is required");
      hasError = true;
    }
    if (!homeAirport) {
      setDestTab("home");
      setHomeAirportError("Home Airport is required");
      hasError = true;
    }
    if (hasError) return;
    if (!user) return;
    setSaving(true);
    const homeCityLabel = homeCity!.city && homeCity!.state_code
      ? `${homeCity!.city}, ${homeCity!.state_code}`
      : homeCity!.name;
    await supabase.from("user_info").update({
      home_location_id: homeCity!.id,
      home_city: homeCityLabel,
      home_airport: homeAirport!.iata_code,
    }).eq("id", user.id);
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
  const labelStyle = "block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-0.5";
  const buttonStyle =
    "w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm shadow-lg hover:shadow-xl transform active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6";
  const glassStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow:
      "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
  };

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
      <div className="flex items-center justify-between px-6 pt-10 pb-2">
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
        <div
          className="flex gap-1.5 flex-1 justify-center max-w-[200px] rounded-full px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.80)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.60)",
            boxShadow: "0 1px 6px 0 rgba(52,92,90,0.10)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors ${i <= step ? "bg-[#10B981]" : "bg-[#DDE0E0]"}`}
            />
          ))}
        </div>
        <div className="w-8 h-8" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col gap-4">

        {/* ===================== Screen 1: Profile ===================== */}
        {step === 0 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-[#2E4A4A] mt-[6px] mb-0.5">{firstName}'s Profile</h1>
              <p className="text-[#6B7B7B] text-base mb-[6px]">Let's start off by learning a little more about you.</p>
            </div>

            <div className="rounded-2xl p-5 overflow-visible" style={glassStyle}>
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <label className="relative w-28 h-28 rounded-full bg-[#E3E6E6] flex items-center justify-center cursor-pointer overflow-hidden group">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <FontAwesomeIcon
                      icon={faCamera}
                      className="w-9 h-9 text-[#345C5A] group-hover:opacity-80 transition-opacity"
                    />
                  )}
                  <div className="absolute inset-0 bg-[#F2F3F3]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <FontAwesomeIcon icon={faCamera} className="w-7 h-7 text-[#345C5A]" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div className="form-group">
                  <label className={labelStyle}>
                    Username <span className="text-red-500">*</span>
                  </label>
                  <AppInput
                    icon={UserCircle02Icon}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameError("");
                    }}
                    placeholder="username"
                    error={usernameError || undefined}
                  />
                </div>
                <div className="form-group">
                  <label className={labelStyle}>Date of Birth</label>
                  <AppInput
                    icon={CalendarCheckOut02Icon}
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max="9999-12-31"
                    className="text-left [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden appearance-none"
                  />
                </div>
                <div className="form-group">
                  <label className={labelStyle}>Mobile Number</label>
                  <AppInput
                    icon={Call02Icon}
                    type="tel"
                    inputMode="numeric"
                    value={mobileNumber}
                    onChange={handlePhoneChange}
                    placeholder="(555) 000-0000"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ===================== Screen 2: Destinations ===================== */}
        {step === 1 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-[#2E4A4A] mt-[6px] mb-0.5">{firstName}'s Destinations</h1>
              <p className="text-[#6B7B7B] text-base mb-[6px]">
                Tell us where you call home and your favorite places to explore.
              </p>
            </div>

            <div className="rounded-2xl overflow-visible" style={glassStyle}>
              {/* Tab Row */}
              <div className="flex items-center justify-around border-b border-[rgba(0,0,0,0.06)]">
                {([
                  { key: "home", label: "Home City", icon: Home01Icon },
                  { key: "favorites", label: "Favorite Cities", icon: HeartAddIcon },
                ] as { key: "home" | "favorites"; label: string; icon: any }[]).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDestTab(key)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-3.5 text-[15px] w-1/2 transition-colors relative",
                      destTab === key ? "text-[#10B981] font-bold" : "text-gray-400 hover:text-gray-600 font-semibold",
                    )}
                  >
                    <HugeiconsIcon
                      icon={icon}
                      size={15}
                      strokeWidth={destTab === key ? 2.5 : 1.5}
                      color={destTab === key ? "#10B981" : undefined}
                    />
                    {label}
                    {destTab === key && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#10B981] rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-5">
                {/* Home City Tab */}
                {destTab === "home" && (
                  <div className="form-group">
                    <label className={labelStyle}>
                      Home City <span className="text-red-500">*</span>
                    </label>
                    <AppInput
                      icon={Home01Icon}
                      value={homeCitySearch}
                      onChange={() => {}}
                      onFocus={() => setShowHomeCitySheet(true)}
                      readOnly
                      placeholder="Search for your home city..."
                      error={homeCityError || undefined}
                      clearable={!!homeCity}
                      onClear={() => { setHomeCity(null); setHomeCitySearch(""); setHomeCityError(""); }}
                    />
                  </div>
                )}

                {/* Favorite Cities Tab */}
                {destTab === "favorites" && (
                  <div className="form-group">
                    <label className={labelStyle}>
                      Favorite Cities {favoriteCities.length > 0 && `(${favoriteCities.length}/5)`}
                    </label>
                    <AppInput
                      icon={HeartAddIcon}
                      value=""
                      onChange={() => {}}
                      onFocus={() => { if (favoriteCities.length < 5) setShowFavSheet(true); }}
                      readOnly
                      placeholder={favoriteCities.length >= 5 ? "Max 5 cities reached" : "Search for favorite cities..."}
                      disabled={favoriteCities.length >= 5}
                    />

                    {/* Chips */}
                    {favoriteCities.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-[#6B7B7B] mb-3">
                          Selected Cities: <span className="font-bold text-[#2E4A4A]">{favoriteCities.length}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {favoriteCities.map((loc) => (
                            <span
                              key={loc.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold shrink-0"
                              style={{
                                background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
                                color: "#065F46",
                                border: "1px solid #6EE7B7",
                              }}
                            >
                              <HugeiconsIcon icon={Location01Icon} size={12} color="#059669" strokeWidth={2.5} />
                              {formatLocationDisplay(loc)}
                              <button
                                onClick={() => removeFavorite(loc.id)}
                                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                              >
                                <HugeiconsIcon icon={Cancel01Icon} size={12} color="#065F46" strokeWidth={2.5} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ===================== City Search Sheets (portaled) ===================== */}
        <BottomSheet open={showHomeCitySheet} onClose={() => setShowHomeCitySheet(false)} style={{ top: "5%" }}>
                  {/* Title row */}
                  <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                      >
                        <HugeiconsIcon icon={Home01Icon} size={15} color="white" strokeWidth={2} />
                      </div>
                      <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">Home City</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowHomeCitySheet(false)}
                      className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
                    >
                      <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
                    </button>
                  </div>

                  {/* Search input */}
                  <div className="px-5 pt-4 pb-4">
                    <div className="app-input-container">
                      <button type="button" tabIndex={-1} className="app-input-icon-btn">
                        <HugeiconsIcon icon={Search01Icon} size={20} color="currentColor" strokeWidth={2} />
                      </button>
                      <input
                        ref={homeCityInputRef}
                        type="text"
                        value={homeCitySearch}
                        onChange={(e) => handleHomeCitySearch(e.target.value)}
                        placeholder="Search city or state…"
                        className="app-input"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        autoFocus
                      />
                      {homeCitySearch.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setHomeCitySearch(""); setHomeCityResults([]); }}
                          className="app-input-reset app-input-reset--visible"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {homeCityResults.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => selectHomeCity(loc)}
                        className="w-full flex items-center px-5 py-3.5 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors border-b border-[#F0F1F1] last:border-0"
                      >
                        <FontAwesomeIcon icon={faLocationDot} className="w-4 h-4 text-[#849494] mr-3 flex-shrink-0" />
                        {formatLocationDisplay(loc)}
                      </button>
                    ))}
                  </div>
        </BottomSheet>

        <BottomSheet open={showFavSheet} onClose={() => setShowFavSheet(false)} style={{ top: "5%" }}>
                  {/* Title row */}
                  <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                      >
                        <HugeiconsIcon icon={HeartAddIcon} size={15} color="white" strokeWidth={2} />
                      </div>
                      <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">
                        Favorite Cities {favoriteCities.length > 0 && `(${favoriteCities.length}/5)`}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFavSheet(false)}
                      className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
                    >
                      <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
                    </button>
                  </div>

                  {/* Search input */}
                  <div className="px-5 pt-4 pb-4">
                    <div className="app-input-container">
                      <button type="button" tabIndex={-1} className="app-input-icon-btn">
                        <HugeiconsIcon icon={Search01Icon} size={20} color="currentColor" strokeWidth={2} />
                      </button>
                      <input
                        ref={favCityInputRef}
                        type="text"
                        value={favSearch}
                        onChange={(e) => handleFavSearch(e.target.value)}
                        placeholder="Search city or state…"
                        className="app-input"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        autoFocus
                      />
                      {favSearch.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setFavSearch(""); setFavResults([]); }}
                          className="app-input-reset app-input-reset--visible"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {favResults
                      .filter((loc) => !homeCity || loc.id !== homeCity.id)
                      .filter((loc) => !favoriteCities.some((f) => f.id === loc.id))
                      .map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => addFavorite(loc)}
                          className="w-full flex items-center px-5 py-3.5 text-sm text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors border-b border-[#F0F1F1] last:border-0"
                        >
                          <FontAwesomeIcon icon={faLocationDot} className="w-4 h-4 text-[#849494] mr-3 flex-shrink-0" />
                          {formatLocationDisplay(loc)}
                        </button>
                      ))}
                  </div>
        </BottomSheet>

        {/* ===================== Screen 3: Friends ===================== */}
        {step === 2 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-[#2E4A4A] mt-[6px] mb-0.5">{firstName}'s Friends</h1>
              <p className="text-[#6B7B7B] text-base mb-[6px]">
                Find your travel buddies, make a crew, and explore together.
              </p>
            </div>

            <div className="rounded-2xl p-5" style={glassStyle}>
              <div className="mb-4">
                <AppInput icon={Search01Icon} disabled placeholder="Find Friends" />
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#E3E6E6]/50 border border-[#DDE0E0]">
                <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-[#6B7B7B] flex-shrink-0" />
                <p className="text-[#6B7B7B] text-sm font-medium">This feature is coming soon</p>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Sticky button footer */}
      <div className="sticky bottom-0 px-6 pb-6 pt-2 bg-[#F2F3F3]">
        {step === 0 && (
          <button onClick={handleScreen1Continue} disabled={saving} className={buttonStyle}>
            {saving ? "Saving..." : "Continue"}
            {!saving && <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="white" strokeWidth={2} />}
          </button>
        )}
        {step === 1 && (
          <button onClick={handleScreen2Continue} disabled={saving} className={buttonStyle}>
            {saving ? "Saving..." : "Continue"}
            {!saving && <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="white" strokeWidth={2} />}
          </button>
        )}
        {step === 2 && (
          <button onClick={handleStartFlying} disabled={saving} className={buttonStyle}>
            {saving ? "Saving..." : "Start Flying"}
            {!saving && <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={18} color="white" strokeWidth={2} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;
