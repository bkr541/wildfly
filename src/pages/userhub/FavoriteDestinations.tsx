import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useLocationSearch, formatLocationDisplay, type LocationOption } from "@/hooks/useLocationSearch";
import { Search, X } from "lucide-react";
import SubScreenLayout from "@/components/userhub/SubScreenLayout";

const inputBase =
  "w-full px-4 py-3 rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none transition-all border border-border focus:ring-2 focus:ring-ring";

const FavoriteDestinations = () => {
  const navigate = useNavigate();
  const { user, loading } = useUserProfile();
  const loc = useLocationSearch();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [favs, setFavs] = useState<LocationOption[]>([]);
  const [initialIds, setInitialIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState("");
  const [saving, setSaving] = useState(false);

  // Load existing favorites
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_locations")
        .select("location_id, locations:location_id(id, city, state_code, name)")
        .eq("user_id", user.id);
      if (data) {
        const mapped = data
          .map((d: any) => d.locations as LocationOption)
          .filter(Boolean);
        setFavs(mapped);
        setInitialIds(mapped.map((l) => l.id).sort());
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) loc.close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentIds = favs.map((f) => f.id).sort();
  const isDirty = JSON.stringify(currentIds) !== JSON.stringify(initialIds);

  const addFav = (l: LocationOption) => {
    if (favs.length >= 5) return;
    if (user?.home_location_id === l.id) return;
    if (favs.some((f) => f.id === l.id)) return;
    setFavs((prev) => [...prev, l]);
    setSearchText("");
    loc.close();
  };

  const removeFav = (id: number) => setFavs((prev) => prev.filter((f) => f.id !== id));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("user_locations").delete().eq("user_id", user.id);
    if (favs.length > 0) {
      await supabase
        .from("user_locations")
        .insert(favs.map((f) => ({ user_id: user.id, location_id: f.id })));
    }
    setSaving(false);
    setInitialIds(favs.map((f) => f.id).sort());
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <SubScreenLayout
      title="Favorite Destinations"
      subtitle="Your go-to cities for adventure."
      onBack={() => navigate("/user-hub/account")}
      isDirty={isDirty}
      isSaving={saving}
      onSave={handleSave}
    >
      <div ref={wrapRef} className="form-group relative mt-4">
        <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
          Favorites {favs.length > 0 && `(${favs.length}/5)`}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              loc.search(e.target.value);
            }}
            onFocus={() => searchText.length >= 3 && loc.setShowDropdown(true)}
            placeholder={favs.length >= 5 ? "Max 5 cities reached" : "Search for cities..."}
            disabled={favs.length >= 5}
            className={`${inputBase} pl-10 disabled:opacity-50`}
          />
        </div>
        {loc.showDropdown && loc.results.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {loc.results
              .filter((l) => l.id !== user?.home_location_id && !favs.some((f) => f.id === l.id))
              .map((l) => (
                <button
                  key={l.id}
                  onClick={() => addFav(l)}
                  className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  {formatLocationDisplay(l)}
                </button>
              ))}
          </div>
        )}
      </div>

      {favs.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">Selected Cities: {favs.length}</p>
          <div className="flex flex-wrap gap-2">
            {favs.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-foreground text-sm">
                {formatLocationDisplay(l)}
                <button onClick={() => removeFav(l.id)} className="hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </SubScreenLayout>
  );
};

export default FavoriteDestinations;
