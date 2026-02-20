import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useLocationSearch, formatLocationDisplay, type LocationOption } from "@/hooks/useLocationSearch";
import { Search } from "lucide-react";
import SubScreenLayout from "@/components/userhub/SubScreenLayout";

const inputBase =
  "w-full px-4 py-3 rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none transition-all border border-border focus:ring-2 focus:ring-ring";

const HomeCity = () => {
  const navigate = useNavigate();
  const { user, loading, reload } = useUserProfile();
  const loc = useLocationSearch();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<LocationOption | null>(null);
  const [initialId, setInitialId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [saving, setSaving] = useState(false);

  // Load current home city
  useEffect(() => {
    if (!user?.home_location_id) return;
    setInitialId(user.home_location_id);
    const loadCurrent = async () => {
      const { data } = await supabase
        .from("locations")
        .select("id, city, state_code, name")
        .eq("id", user.home_location_id!)
        .maybeSingle();
      if (data) {
        const l = data as LocationOption;
        setSelected(l);
        setSearchText(formatLocationDisplay(l));
      }
    };
    loadCurrent();
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) loc.close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isDirty = selected?.id !== initialId;

  const handleSave = async () => {
    if (!user || !selected) return;
    setSaving(true);
    await supabase.from("users").update({ home_location_id: selected.id }).eq("id", user.id);
    await reload();
    setSaving(false);
    setInitialId(selected.id);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <SubScreenLayout
      title="Home City"
      subtitle="Set your home base."
      onBack={() => navigate("/user-hub/account")}
      isDirty={isDirty}
      isSaving={saving}
      onSave={handleSave}
    >
      <div ref={wrapRef} className="form-group relative mt-4">
        <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Home City</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              loc.search(e.target.value);
            }}
            onFocus={() => searchText.length >= 3 && loc.setShowDropdown(true)}
            placeholder="Search for your home city..."
            className={`${inputBase} pl-10`}
          />
        </div>
        {loc.showDropdown && loc.results.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {loc.results.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setSelected(l);
                  setSearchText(formatLocationDisplay(l));
                  loc.close();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                {formatLocationDisplay(l)}
              </button>
            ))}
          </div>
        )}
      </div>
    </SubScreenLayout>
  );
};

export default HomeCity;
