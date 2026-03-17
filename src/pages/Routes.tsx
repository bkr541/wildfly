import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAirportDictionary, type AirportInfo } from "@/hooks/useAirportDictionary";
import { useRouteStats } from "@/hooks/useRouteStats";
import { useRouteFavorites } from "@/hooks/useRouteFavorites";
import { useUserSettings } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppInput } from "@/components/ui/app-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RouteIcon,
  FavouriteIcon,
  Search01Icon,
  Airplane01Icon,
  RepeatIcon,
  Alert01Icon,
  Link01Icon,
  Delete01Icon,
  ArrowDown01Icon,
  MapsIcon,
  ListViewIcon,
  FavouriteIcon as StarFilledIcon,
  HeartAddIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

const LS_ORIGIN_KEY = "routes_lastOrigin";

const ACTIVE_VIEW_FLEX = 1.7;

const glassStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.55)",
  boxShadow:
    "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07), 0 1px 3px 0 rgba(0,0,0,0.06)",
};

/* ── Origin Input ────────────────────────────────────── */
const OriginCombobox = ({
  value,
  onChange,
  hubsSorted,
  airportDict,
}: {
  value: string;
  onChange: (v: string) => void;
  hubsSorted: { iata: string; count: number }[];
  airportDict: Record<string, AirportInfo>;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return hubsSorted.slice(0, 30);
    return hubsSorted.filter(h => {
      const info = airportDict[h.iata];
      return h.iata.toLowerCase().includes(q) ||
        info?.name?.toLowerCase().includes(q) ||
        info?.city?.toLowerCase().includes(q);
    }).slice(0, 30);
  }, [query, hubsSorted, airportDict]);

  const selectedInfo = airportDict[value];

  const handleClear = () => {
    onChange("");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="relative w-full">
      {/* Label styled like Flights UI */}
      <label className="text-sm font-bold text-[#059669] ml-1 mb-0 block">Origin Airport</label>

      <div
        className={cn("app-input-container", isFocused && "focus-within")}
        style={{ backgroundColor: "transparent" }}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <HugeiconsIcon icon={RouteIcon} size={20} color="#345C5A" strokeWidth={1.5} className="shrink-0 mr-2" />

        {value && !open ? (
          <span className="flex-1 text-sm text-[#2E4A4A] font-medium truncate py-2">
            <span className="font-bold text-[#345C5A]">{value}</span>
            {selectedInfo?.city ? ` – ${selectedInfo.city}` : selectedInfo?.name ? ` – ${selectedInfo.name}` : ""}
          </span>
        ) : (
          <input
            ref={inputRef}
            type="text"
            placeholder={value ? `${value}${selectedInfo?.city ? ` – ${selectedInfo.city}` : ""}` : "Search airport or city..."}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { setIsFocused(true); setOpen(true); }}
            onBlur={() => { setIsFocused(false); setTimeout(() => setOpen(false), 200); }}
            className="app-input flex-1"
          />
        )}

        {value && (
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={e => { e.stopPropagation(); handleClear(); }}
            className="app-input-toggle ml-1"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} color="#9CA3AF" strokeWidth={1.5} />
          </button>
        )}
        {!value && (
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} color="#9CA3AF" strokeWidth={1.5} className="shrink-0 ml-1" />
        )}
      </div>

      {/* Dropdown styled like Flights departure/arrival sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E3E6E6] max-h-72 overflow-y-auto z-50"
          >
            {filtered.map(h => {
              const info = airportDict[h.iata];
              return (
                <button
                  key={h.iata}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(h.iata); setOpen(false); setQuery(""); }}
                  className={cn(
                    "w-full text-left px-5 py-2 hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors flex items-center gap-4",
                    h.iata === value && "bg-[#345C5A]/5"
                  )}
                >
                  <HugeiconsIcon icon={Airplane01Icon} size={20} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-[#345C5A] text-lg shrink-0">{h.iata}</span>
                      <span className="text-[#6B7B7B] truncate text-base">{info?.city || info?.name || ""}</span>
                      {info?.state && <span className="text-[#9CA3AF] text-sm shrink-0">{info.state}</span>}
                    </div>
                    {info?.name && info?.city && (
                      <p className="text-sm text-[#9CA3AF] truncate">{info.name}</p>
                    )}
                  </div>
                  <span className="text-xs text-[#9CA3AF] shrink-0">{h.count} dest</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Destination Card ────────────────────────────────── */
const DestCard = ({
  destIata,
  origin,
  info,
  isReciprocal,
  isFav,
  onToggleFav,
  onSearch,
  highlighted,
  onHover,
}: {
  destIata: string;
  origin: string;
  info?: AirportInfo;
  isReciprocal: boolean;
  isFav: boolean;
  onToggleFav: () => void;
  onSearch: () => void;
  highlighted: boolean;
  onHover: (iata: string | null) => void;
}) => (
  <div
    className={cn(
      "bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-all hover:shadow-md",
      highlighted ? "border-[#345C5A] shadow-md ring-1 ring-[#345C5A]/20" : "border-[#E3E6E6]"
    )}
    onMouseEnter={() => onHover(destIata)}
    onMouseLeave={() => onHover(null)}
    data-dest={destIata}
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-bold text-[#345C5A] text-sm">{destIata}</span>
        {info ? (
          <span className="text-[#2E4A4A] text-sm truncate">{info.city || info.name}</span>
        ) : (
          <span className="text-[#9CA3AF] text-xs italic">Unknown airport details</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {info?.region && (
          <span className="text-xs text-[#6B7B7B] bg-[#F2F3F3] rounded-full px-2 py-0.5">{info.region}</span>
        )}
        {!info?.region && info?.state && (
          <span className="text-xs text-[#6B7B7B] bg-[#F2F3F3] rounded-full px-2 py-0.5">{info.state}</span>
        )}
        {isReciprocal ? (
          <Badge variant="secondary" className="text-[10px] bg-[#E8F1F1] text-[#345C5A] border-[#345C5A]/20 px-2 py-0">
            <HugeiconsIcon icon={RepeatIcon} size={10} color="#345C5A" strokeWidth={1.5} className="mr-1" />
            Round-trip
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-[#9CA3AF] border-[#E3E6E6] px-2 py-0">
            One-way
          </Badge>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#345C5A] hover:bg-[#345C5A]/10"
              onClick={onSearch}
            >
              <HugeiconsIcon icon={Airplane01Icon} size={14} color="currentColor" strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search flights</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isFav ? "text-yellow-500" : "text-[#9CA3AF] hover:text-yellow-500")}
              onClick={onToggleFav}
            >
              <HugeiconsIcon icon={isFav ? StarFilledIcon : FavouriteIcon} size={14} color="currentColor" strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isFav ? "Remove favorite" : "Add to favorites"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#9CA3AF] hover:text-[#345C5A]"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/routes?origin=${origin}&dest=${destIata}`);
              }}
            >
              <HugeiconsIcon icon={Link01Icon} size={12} color="currentColor" strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy link</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
);

/* ── Route Map ───────────────────────────────────────── */
const RouteMap = ({
  origin,
  destinations,
  airportDict,
  filteredDests,
  showAllLines,
  hoveredDest,
  onHover,
}: {
  origin: string;
  destinations: string[];
  airportDict: Record<string, AirportInfo>;
  filteredDests: string[];
  showAllLines: boolean;
  hoveredDest: string | null;
  onHover: (d: string | null) => void;
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstance = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  const originInfo = airportDict[origin];
  const hasMissingCoords = useMemo(() => {
    return destinations.some(d => {
      const info = airportDict[d];
      return !info?.latitude || !info?.longitude;
    });
  }, [destinations, airportDict]);

  const linesToDraw = showAllLines ? destinations : filteredDests;

  useEffect(() => {
    let L: any;
    let mounted = true;

    (async () => {
      L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (!mounted || !mapRef.current) return;

      if (mapInstance.current) {
        mapInstance.current.remove();
      }

      const center: [number, number] = originInfo?.latitude && originInfo?.longitude
        ? [originInfo.latitude, originInfo.longitude]
        : [39.8, -98.6];

      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true }).setView(center, 4);
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      setMapLoaded(true);
    })();

    return () => {
      mounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [origin]);

  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    let L: any;
    (async () => {
      L = await import("leaflet");

      for (const l of layersRef.current) {
        mapInstance.current.removeLayer(l);
      }
      layersRef.current = [];

      const map = mapInstance.current;

      if (originInfo?.latitude && originInfo?.longitude) {
        const originIcon = L.divIcon({
          className: "",
          html: `<div style="display:flex;flex-direction:column;align-items:center;">
            <div style="font-size:9px;font-weight:800;color:white;background:#059669;border-radius:3px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.25);letter-spacing:0.05em;">${origin}</div>
            <div style="width:14px;height:14px;background:#345C5A;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>`,
          iconSize: [40, 34],
          iconAnchor: [20, 34],
        });
        const m = L.marker([originInfo.latitude, originInfo.longitude], { icon: originIcon })
          .addTo(map)
          .bindPopup(`<strong>${origin}</strong><br/>${originInfo.city || originInfo.name || ""}`);
        layersRef.current.push(m);
      }

      for (const dest of linesToDraw) {
        const info = airportDict[dest];
        if (!info?.latitude || !info?.longitude) continue;
        if (!originInfo?.latitude || !originInfo?.longitude) continue;

        const isHovered = hoveredDest === dest;

        // Solid primary green line
        const line = L.polyline(
          [[originInfo.latitude, originInfo.longitude], [info.latitude, info.longitude]],
          {
            color: "#10B981",
            weight: isHovered ? 3 : 2,
            opacity: isHovered ? 1 : 0.55,
          }
        ).addTo(map);
        layersRef.current.push(line);

        // Destination dot with IATA code label above
        const dotSize = isHovered ? 10 : 8;
        const labelBg = isHovered ? "#059669" : "#345C5A";
        const destIcon = L.divIcon({
          className: "",
          html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
            <div style="font-size:9px;font-weight:800;color:white;background:${labelBg};border-radius:3px;padding:1px 4px;margin-bottom:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.25);letter-spacing:0.05em;">${dest}</div>
            <div style="width:${dotSize}px;height:${dotSize}px;background:${isHovered ? "#10B981" : "#345C5A"};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
          </div>`,
          iconSize: [32, 22 + dotSize],
          iconAnchor: [16, 22 + dotSize],
        });
        const marker = L.marker([info.latitude, info.longitude], { icon: destIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;font-size:13px;">
              <strong>${origin} → ${dest}</strong><br/>
              ${info.city || info.name || dest}
            </div>
          `);
        marker.on("mouseover", () => onHover(dest));
        marker.on("mouseout", () => onHover(null));
        layersRef.current.push(marker);
      }
    })();
  }, [mapLoaded, linesToDraw, hoveredDest, origin, originInfo, airportDict, onHover]);

  return (
    <div className="flex flex-col gap-2">
      {hasMissingCoords && (
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF] bg-[#FDF6E3] rounded-lg px-3 py-1.5 border border-yellow-200">
          <HugeiconsIcon icon={Alert01Icon} size={12} color="#EAB308" strokeWidth={1.5} />
          Some routes hidden due to missing coordinates.
        </div>
      )}
      <div ref={mapRef} className="w-full h-[400px] rounded-xl overflow-hidden border border-[#E3E6E6] bg-[#F2F3F3]" />
    </div>
  );
};

const viewOptions: { value: "map" | "grid"; label: string; icon: any }[] = [
  { value: "map", label: "Map", icon: MapsIcon },
  { value: "grid", label: "List", icon: ListViewIcon },
];

type SortMode = "az" | "za" | "region";
type ViewMode = "map" | "grid";

/* ── Routes Page ──────────────────────────────────────── */
const RoutesPage = ({ onNavigate }: { onNavigate?: (page: string, data?: string) => void }) => {
  const { dict: airportDict, loading: airportsLoading } = useAirportDictionary();
  const { isFavorite, toggleFavorite, clearAll, getFavoritesList } = useRouteFavorites();
  const { settings: userSettings } = useUserSettings();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlOrigin = params.get("origin") || "";
  const urlDest = params.get("dest") || "";

  const [origin, setOrigin] = useState<string>("");
  const [defaultHomeApplied, setDefaultHomeApplied] = useState(false);
  const [destSearch, setDestSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("az");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [showAllLines, setShowAllLines] = useState(false);
  const [hoveredDest, setHoveredDest] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  const stats = useRouteStats(origin || null);

  useEffect(() => {
    if (urlOrigin) {
      setOrigin(urlOrigin);
    } else {
      const saved = localStorage.getItem(LS_ORIGIN_KEY);
      if (saved && stats.hubsSorted.some(h => h.iata === saved)) {
        setOrigin(saved);
      }
    }
  }, [stats.hubsSorted.length]);

  useEffect(() => {
    if (defaultHomeApplied || urlOrigin || origin) return;
    if (!userSettings.default_departure_to_home) return;
    if (stats.hubsSorted.length === 0) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: info } = await supabase
        .from("user_info")
        .select("home_location_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!info?.home_location_id) return;
      const { data: ap } = await supabase
        .from("airports")
        .select("iata_code")
        .eq("location_id", info.home_location_id)
        .limit(1)
        .maybeSingle();
      if (ap?.iata_code && stats.hubsSorted.some(h => h.iata === ap.iata_code)) {
        setOrigin(ap.iata_code);
        setDefaultHomeApplied(true);
      }
    })();
  }, [userSettings.default_departure_to_home, stats.hubsSorted.length, defaultHomeApplied, urlOrigin, origin]);

  useEffect(() => {
    if (origin) localStorage.setItem(LS_ORIGIN_KEY, origin);
  }, [origin]);

  useEffect(() => {
    if (urlDest) {
      setTimeout(() => {
        const el = document.querySelector(`[data-dest="${urlDest}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [urlDest, origin]);

  const filteredDests = useMemo(() => {
    let dests = [...stats.destinations];
    const q = destSearch.toLowerCase();
    if (q) {
      dests = dests.filter(d => {
        const info = airportDict[d];
        return d.toLowerCase().includes(q) ||
          info?.name?.toLowerCase().includes(q) ||
          info?.city?.toLowerCase().includes(q);
      });
    }
    dests.sort((a, b) => {
      const ai = airportDict[a];
      const bi = airportDict[b];
      if (sortMode === "az") return (ai?.city || a).localeCompare(bi?.city || b);
      if (sortMode === "za") return (bi?.city || b).localeCompare(ai?.city || a);
      return (ai?.region || "ZZZ").localeCompare(bi?.region || "ZZZ");
    });
    return dests;
  }, [stats.destinations, destSearch, sortMode, airportDict]);

  const handleSearch = useCallback(() => {
    if (onNavigate) onNavigate("flights");
  }, [onNavigate]);

  const favsList = useMemo(() => getFavoritesList(), [getFavoritesList]);

  if (airportsLoading) {
    return (
      <div className="px-5 pt-6 pb-4 animate-fade-in">
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={glassStyle}>
          <Skeleton className="h-4 w-28 bg-[#E3E6E6]" />
          <Skeleton className="h-10 w-full bg-[#E3E6E6]" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 bg-[#E3E6E6] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-6 animate-fade-in">
      {/* Single glass card wrapping everything */}
      <div className="rounded-2xl overflow-visible" style={glassStyle}>
        <div className="px-5 pt-5 pb-5 flex flex-col gap-4">

          {/* Origin Airport */}
          <OriginCombobox
            value={origin}
            onChange={setOrigin}
            hubsSorted={stats.hubsSorted}
            airportDict={airportDict}
          />

          {/* Main content — revealed after origin selected */}
          <AnimatePresence>
            {origin && (
              <motion.div
                key="routes-content"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-4"
              >
                {/* Stats Chips */}
                <div className="flex flex-wrap gap-2">
                  <div className="bg-white/70 border border-[#E3E6E6] rounded-full px-3 py-1 text-xs font-semibold text-[#2E4A4A]">
                    Destinations: <span className="text-[#345C5A]">{stats.destinations.length}</span>
                  </div>
                  <div className="bg-white/70 border border-[#E3E6E6] rounded-full px-3 py-1 text-xs font-semibold text-[#2E4A4A]">
                    Hub rank: <span className="text-[#345C5A]">#{stats.hubRank}</span>
                  </div>
                  <div className="bg-white/70 border border-[#E3E6E6] rounded-full px-3 py-1 text-xs font-semibold text-[#2E4A4A]">
                    Reciprocal: <span className="text-[#345C5A]">{stats.reciprocalPercent}%</span>
                  </div>
                  {stats.anomalies.length > 0 && (
                    <div className="bg-[#FDF6E3] border border-yellow-200 rounded-full px-3 py-1 text-xs font-semibold text-yellow-700">
                      <HugeiconsIcon icon={Alert01Icon} size={12} color="#A16207" strokeWidth={1.5} className="mr-1 inline" />
                      Anomalies: {stats.anomalies.length}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-black/5" />

                {/* Map/List toggle + Favorites */}
                <div className="flex items-center justify-between gap-3">
                  {/* Sliding pill toggle */}
                  <div
                    className="rounded-full p-[2px] flex relative flex-1 bg-[#F2F3F3]"
                  >
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out"
                      style={{
                        background: "#10B981",
                        width: `calc((100% - 4px) * ${ACTIVE_VIEW_FLEX} / ${viewOptions.length - 1 + ACTIVE_VIEW_FLEX})`,
                        left: `calc(2px + (100% - 4px) * ${viewOptions.findIndex(o => o.value === viewMode)} / ${viewOptions.length - 1 + ACTIVE_VIEW_FLEX})`,
                      }}
                    />
                    {viewOptions.map(opt => {
                      const isActive = viewMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setViewMode(opt.value)}
                          style={{ flex: isActive ? ACTIVE_VIEW_FLEX : 1 }}
                          className={cn(
                            "py-2.5 px-3 text-sm font-semibold rounded-full transition-all duration-300 relative z-10 flex items-center justify-center gap-2 overflow-hidden",
                            isActive ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
                          )}
                        >
                          <HugeiconsIcon icon={opt.icon} size={18} color="currentColor" strokeWidth={2} className="shrink-0" />
                          {isActive && <span className="animate-fade-in whitespace-nowrap">{opt.label}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Favorites toggle */}
                  <button
                    onClick={() => setShowFavorites(v => !v)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 rounded-full border text-xs font-semibold transition-all",
                      showFavorites
                        ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                        : "bg-white/70 border-[#E3E6E6] text-[#6B7B7B] hover:border-[#345C5A]/30"
                    )}
                  >
                    <HugeiconsIcon icon={HeartAddIcon} size={18} color="currentColor" strokeWidth={2} />
                  </button>
                </div>

                {/* Favorites Panel */}
                <AnimatePresence>
                  {showFavorites && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-3 pt-1">
                        {favsList.length > 0 && (
                          <div className="flex justify-end">
                            {!confirmClear ? (
                              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} className="text-xs text-[#9CA3AF] hover:text-red-500">
                                <HugeiconsIcon icon={Delete01Icon} size={12} color="currentColor" strokeWidth={1.5} className="mr-1" />
                                Clear all
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[#6B7B7B]">Are you sure?</span>
                                <Button variant="ghost" size="sm" onClick={() => { clearAll(); setConfirmClear(false); }} className="text-xs text-red-500 hover:text-red-700">Yes, clear</Button>
                                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)} className="text-xs text-[#6B7B7B]">Cancel</Button>
                              </div>
                            )}
                          </div>
                        )}
                        {favsList.length === 0 ? (
                          <div className="text-center py-8 text-[#9CA3AF]">
                            <HugeiconsIcon icon={FavouriteIcon} size={32} color="#9CA3AF" strokeWidth={1} className="mb-2 mx-auto opacity-40" />
                            <p className="text-sm font-semibold">No favorites yet</p>
                            <p className="text-xs mt-1">Star a route to save it here</p>
                          </div>
                        ) : (
                          favsList.map(({ origin: o, dest: d }) => (
                            <DestCard
                              key={`${o}|${d}`}
                              destIata={d}
                              origin={o}
                              info={airportDict[d]}
                              isReciprocal={false}
                              isFav={true}
                              onToggleFav={() => toggleFavorite(o, d)}
                              onSearch={() => handleSearch()}
                              highlighted={false}
                              onHover={() => {}}
                            />
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Map View */}
                <AnimatePresence mode="wait">
                  {viewMode === "map" && (
                    <motion.div
                      key="map-view"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col gap-3"
                    >
                      {stats.destinations.length > 60 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowAllLines(!showAllLines)}
                            className={cn(
                              "text-xs px-3 py-1 rounded-full border transition-colors font-medium",
                              showAllLines ? "bg-[#345C5A] text-white border-[#345C5A]" : "bg-white/70 text-[#6B7B7B] border-[#E3E6E6]"
                            )}
                          >
                            {showAllLines ? "Show filtered lines" : "Show all lines"}
                          </button>
                          <span className="text-xs text-[#9CA3AF]">
                            {showAllLines ? stats.destinations.length : filteredDests.length} routes shown
                          </span>
                        </div>
                      )}
                      <RouteMap
                        origin={origin}
                        destinations={stats.destinations}
                        airportDict={airportDict}
                        filteredDests={filteredDests}
                        showAllLines={showAllLines || stats.destinations.length <= 60}
                        hoveredDest={hoveredDest}
                        onHover={setHoveredDest}
                      />
                    </motion.div>
                  )}

                  {/* List View */}
                  {viewMode === "grid" && (
                    <motion.div
                      key="grid-view"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col gap-3"
                    >
                      <AppInput
                        icon={Search01Icon}
                        placeholder="Filter by name or code..."
                        value={destSearch}
                        onChange={e => setDestSearch(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#6B7B7B]">Sort:</span>
                        {([["az", "A–Z"], ["za", "Z–A"], ["region", "Region"]] as [SortMode, string][]).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => setSortMode(val)}
                            className={cn(
                              "text-xs px-3 py-1 rounded-full border transition-colors font-medium",
                              sortMode === val ? "bg-[#345C5A] text-white border-[#345C5A]" : "bg-white/70 text-[#6B7B7B] border-[#E3E6E6] hover:border-[#345C5A]/30"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.hubsSorted.slice(0, 8).map(h => (
                          <button
                            key={h.iata}
                            onClick={() => setOrigin(h.iata)}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-colors font-semibold",
                              h.iata === origin ? "bg-[#345C5A] text-white border-[#345C5A]" : "bg-white/70 text-[#6B7B7B] border-[#E3E6E6] hover:border-[#345C5A]/30"
                            )}
                          >
                            {h.iata}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        {filteredDests.length === 0 ? (
                          <div className="text-center py-8 text-[#9CA3AF] text-sm">No destinations match your search.</div>
                        ) : (
                          filteredDests.map(dest => {
                            const info = airportDict[dest];
                            const isReciprocal = stats.anomalies.indexOf(dest) === -1;
                            return (
                              <DestCard
                                key={dest}
                                destIata={dest}
                                origin={origin}
                                info={info}
                                isReciprocal={isReciprocal}
                                isFav={isFavorite(origin, dest)}
                                onToggleFav={() => toggleFavorite(origin, dest)}
                                onSearch={() => handleSearch()}
                                highlighted={hoveredDest === dest || urlDest === dest}
                                onHover={setHoveredDest}
                              />
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          <AnimatePresence>
            {!origin && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12 text-[#9CA3AF]"
              >
                <HugeiconsIcon icon={RouteIcon} size={48} color="#9CA3AF" strokeWidth={1} className="mb-3 mx-auto opacity-30" />
                <p className="font-semibold text-sm">Select an origin airport to explore routes</p>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
};

export default RoutesPage;
