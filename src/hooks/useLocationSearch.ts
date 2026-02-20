import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LocationOption {
  id: number;
  city: string | null;
  state_code: string | null;
  name: string;
}

export const formatLocationDisplay = (loc: LocationOption) =>
  loc.city && loc.state_code ? `${loc.city}, ${loc.state_code}` : loc.name;

export function useLocationSearch() {
  const [results, setResults] = useState<LocationOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) { setResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("locations")
        .select("id, city, state_code, name")
        .or(`city.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(10);
      setResults((data as LocationOption[]) || []);
      setShowDropdown(true);
    }, 300);
  }, []);

  const close = () => setShowDropdown(false);

  return { results, showDropdown, search, close, setShowDropdown };
}
