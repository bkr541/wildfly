import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAirportDictionary, type AirportInfo } from "@/hooks/useAirportDictionary";
import { useRouteStats } from "@/hooks/useRouteStats";
import { useRouteFavorites } from "@/hooks/useRouteFavorites";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const LS_ORIGIN_KEY = "routes_lastOrigin";

/* ── Origin Combobox ─────────────────────────────────── */
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
  const ref = useRef<HTMLInputElement>(null);

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

  return (
    <div className="relative flex-1 min-w-[200px]">
      <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">Origin Airport</label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setTimeout(() => ref.current?.focus(), 50); }}
        className="w-full flex items-center gap-2 h-10 bg-white border border-[#E3E6E6] rounded-xl px-3 text-sm text-[#2E4A4A] hover:border-[#345C5A]/30 transition-colors"
      >
        <HugeiconsIcon icon={RouteIcon} size={16} color="#345C5A" strokeWidth={1.5} className="shrink-0" />
        <span className="truncate flex-1 text-left">
          {value ? `${value} – ${selectedInfo?.city || selectedInfo?.name || ""}` : "Select origin..."}
        </span>
        <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E3E6E6] max-h-72 overflow-y-auto z-50">
          <div className="p-2 border-b border-[#E3E6E6]">
            <input
              ref={ref}
              type="text"
              placeholder="Search airports..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-[#F2F3F3] outline-none text-[#2E4A4A] placeholder:text-[#9CA3AF]"
            />
          </div>
          {filtered.map(h => {
            const info = airportDict[h.iata];
            return (
              <button
                key={h.iata}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(h.iata); setOpen(false); setQuery(""); }}
                className={cn(
                  "w-full text-left px-4 py-2 text-sm hover:bg-[#F2F3F3] transition-colors flex items-center justify-between",
                  h.iata === value && "bg-[#345C5A]/5"
                )}
              >
                <span>
                  <span className="font-bold text-[#345C5A]">{h.iata}</span>
                  <span className="ml-2 text-[#6B7B7B]">{info?.city || info?.name || ""}</span>
                </span>
                <span className="text-xs text-[#9CA3AF]">{h.count} dest</span>
              </button>
            );
          })}
        </div>
      )}
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

/* ── Map Tab ─────────────────────────────────────────── */
const RouteMap = ({
  origin,
  destinations,
  airportDict,
  filteredDests,
  showAllLines,
  hoveredDest,
  onHover,
  onSearch,
  isFavorite,
  onToggleFav,
}: {
  origin: string;
  destinations: string[];
  airportDict: Record<string, AirportInfo>;
  filteredDests: string[];
  showAllLines: boolean;
  hoveredDest: string | null;
  onHover: (d: string | null) => void;
  onSearch: (origin: string, dest: string) => void;
  isFavorite: (origin: string, dest: string) => boolean;
  onToggleFav: (origin: string, dest: string) => void;
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

  // Draw markers and lines
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    let L: any;
    (async () => {
      L = await import("leaflet");

      // Clear old layers
      for (const l of layersRef.current) {
        mapInstance.current.removeLayer(l);
      }
      layersRef.current = [];

      const map = mapInstance.current;

      // Origin marker
      if (originInfo?.latitude && originInfo?.longitude) {
        const originIcon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;background:#345C5A;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const m = L.marker([originInfo.latitude, originInfo.longitude], { icon: originIcon })
          .addTo(map)
          .bindPopup(`<strong>${origin}</strong><br/>${originInfo.city || originInfo.name || ""}`);
        layersRef.current.push(m);
      }

      // Destination markers + lines
      for (const dest of linesToDraw) {
        const info = airportDict[dest];
        if (!info?.latitude || !info?.longitude) continue;
        if (!originInfo?.latitude || !originInfo?.longitude) continue;

        const isHovered = hoveredDest === dest;
        const line = L.polyline(
          [[originInfo.latitude, originInfo.longitude], [info.latitude, info.longitude]],
          {
            color: isHovered ? "#345C5A" : "#345C5A",
            weight: isHovered ? 3 : 1.5,
            opacity: isHovered ? 0.9 : 0.35,
            dashArray: isHovered ? undefined : "4 6",
          }
        ).addTo(map);
        layersRef.current.push(line);

        const destIcon = L.divIcon({
          className: "",
          html: `<div style="width:${isHovered ? 10 : 8}px;height:${isHovered ? 10 : 8}px;background:${isHovered ? "#345C5A" : "#6B7B7B"};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:all 0.2s;"></div>`,
          iconSize: [isHovered ? 10 : 8, isHovered ? 10 : 8],
          iconAnchor: [isHovered ? 5 : 4, isHovered ? 5 : 4],
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

/* ── Sort options ─────────────────────────────────────── */
type SortMode = "az" | "za" | "region";

/* ── Routes Page ──────────────────────────────────────── */
const RoutesPage = ({ onNavigate }: { onNavigate?: (page: string, data?: string) => void }) => {
  const { dict: airportDict, loading: airportsLoading } = useAirportDictionary();
  const { isFavorite, toggleFavorite, clearAll, getFavoritesList, loading: favsLoading } = useRouteFavorites();

  // URL params
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlOrigin = params.get("origin") || "";
  const urlDest = params.get("dest") || "";

  const [origin, setOrigin] = useState<string>("");
  const [destSearch, setDestSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("az");
  const [activeTab, setActiveTab] = useState("list");
  const [showAllLines, setShowAllLines] = useState(false);
  const [hoveredDest, setHoveredDest] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const stats = useRouteStats(origin || null);

  // Init origin from URL > localStorage > top hub
  useEffect(() => {
    if (urlOrigin) {
      setOrigin(urlOrigin);
    } else {
      const saved = localStorage.getItem(LS_ORIGIN_KEY);
      if (saved && stats.hubsSorted.some(h => h.iata === saved)) {
        setOrigin(saved);
      } else if (stats.hubsSorted.length > 0) {
        setOrigin(stats.hubsSorted[0].iata);
      }
    }
  }, [stats.hubsSorted.length]);

  // Save origin to localStorage
  useEffect(() => {
    if (origin) localStorage.setItem(LS_ORIGIN_KEY, origin);
  }, [origin]);

  // Highlight dest from URL
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
      // region
      return (ai?.region || "ZZZ").localeCompare(bi?.region || "ZZZ");
    });
    return dests;
  }, [stats.destinations, destSearch, sortMode, airportDict]);

  const handleSearch = useCallback((orig: string, dest: string) => {
    if (onNavigate) {
      onNavigate("flights");
    }
  }, [onNavigate]);

  const favsList = useMemo(() => {
    const list = getFavoritesList();
    // optionally filter by current origin
    return list;
  }, [getFavoritesList]);

  const topHubs = useMemo(() => stats.hubsSorted.slice(0, 8), [stats.hubsSorted]);

  if (airportsLoading) {
    return (
      <div className="px-6 pt-0 pb-4 animate-fade-in">
        <Skeleton className="h-8 w-40 mb-4 bg-[#E3E6E6]" />
        <Skeleton className="h-10 w-full mb-3 bg-[#E3E6E6]" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-[#E3E6E6] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-0 pb-6 animate-fade-in flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-0 tracking-tight">Routes</h1>
        <p className="text-[#6B7B7B] text-base">Explore direct routes from any origin.</p>
      </div>

      {/* Top Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-end flex-wrap">
          <OriginCombobox
            value={origin}
            onChange={setOrigin}
            hubsSorted={stats.hubsSorted}
            airportDict={airportDict}
          />
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">Search Destinations</label>
            <div className="relative">
              <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filter by name or code..."
                value={destSearch}
                onChange={e => setDestSearch(e.target.value)}
                className="pl-9 h-10 bg-white border-[#E3E6E6] rounded-xl text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF]"
              />
            </div>
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6B7B7B]">Sort:</span>
          {([["az", "A–Z"], ["za", "Z–A"], ["region", "Region"]] as [SortMode, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSortMode(val)}
              className={cn(
                "text-xs px-3 py-1 rounded-full border transition-colors font-medium",
                sortMode === val
                  ? "bg-[#345C5A] text-white border-[#345C5A]"
                  : "bg-white text-[#6B7B7B] border-[#E3E6E6] hover:border-[#345C5A]/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Chips */}
      {origin && (
        <div className="flex flex-wrap gap-2">
          <div className="bg-white border border-[#E3E6E6] rounded-full px-3 py-1 text-xs font-semibold text-[#2E4A4A] shadow-sm">
            Destinations: <span className="text-[#345C5A]">{stats.destinations.length}</span>
          </div>
          <div className="bg-white border border-[#E3E6E6] rounded-full px-3 py-1 text-xs font-semibold text-[#2E4A4A] shadow-sm">
            Hub rank: <span className="text-[#345C5A]">#{stats.hubRank}</span>
          </div>
          <div className="bg-white border border-[#E3E6E6] rounded-full px-3 py-1 text-xs font-semibold text-[#2E4A4A] shadow-sm">
            Reciprocal: <span className="text-[#345C5A]">{stats.reciprocalPercent}%</span>
          </div>
          {stats.anomalies.length > 0 && (
            <div className="bg-[#FDF6E3] border border-yellow-200 rounded-full px-3 py-1 text-xs font-semibold text-yellow-700 shadow-sm">
              <HugeiconsIcon icon={Alert01Icon} size={12} color="#A16207" strokeWidth={1.5} className="mr-1 inline" />
              Anomalies: {stats.anomalies.length}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-white border border-[#E3E6E6] rounded-xl h-11 p-1">
          <TabsTrigger value="list" className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-[#345C5A] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7B7B]">
            <HugeiconsIcon icon={ListViewIcon} size={14} color="currentColor" strokeWidth={1.5} className="mr-1.5" />
            List
          </TabsTrigger>
          <TabsTrigger value="map" className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-[#345C5A] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7B7B]">
            <HugeiconsIcon icon={MapsIcon} size={14} color="currentColor" strokeWidth={1.5} className="mr-1.5" />
            Map
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-[#345C5A] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#6B7B7B]">
            <HugeiconsIcon icon={HeartAddIcon} size={14} color="currentColor" strokeWidth={1.5} className="mr-1.5" />
            Favorites
          </TabsTrigger>
        </TabsList>

        {/* LIST TAB */}
        <TabsContent value="list" className="mt-3">
          {!origin ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <HugeiconsIcon icon={RouteIcon} size={40} color="#9CA3AF" strokeWidth={1} className="mb-3 mx-auto opacity-40" />
              <p className="font-semibold">Pick an origin airport to explore routes</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Quick Hubs */}
              <div className="flex flex-wrap gap-1.5">
                {topHubs.map(h => (
                  <button
                    key={h.iata}
                    onClick={() => setOrigin(h.iata)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors font-semibold",
                      h.iata === origin
                        ? "bg-[#345C5A] text-white border-[#345C5A]"
                        : "bg-white text-[#6B7B7B] border-[#E3E6E6] hover:border-[#345C5A]/30"
                    )}
                  >
                    {h.iata}
                  </button>
                ))}
              </div>

              {/* Destination Cards */}
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
                        onSearch={() => handleSearch(origin, dest)}
                        highlighted={hoveredDest === dest || urlDest === dest}
                        onHover={setHoveredDest}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* MAP TAB */}
        <TabsContent value="map" className="mt-3">
          {!origin ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <HugeiconsIcon icon={MapsIcon} size={40} color="#9CA3AF" strokeWidth={1} className="mb-3 mx-auto opacity-40" />
              <p className="font-semibold">Select an origin to view routes on the map</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.destinations.length > 60 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAllLines(!showAllLines)}
                    className={cn(
                      "text-xs px-3 py-1 rounded-full border transition-colors font-medium",
                      showAllLines
                        ? "bg-[#345C5A] text-white border-[#345C5A]"
                        : "bg-white text-[#6B7B7B] border-[#E3E6E6]"
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
                onSearch={handleSearch}
                isFavorite={isFavorite}
                onToggleFav={(o, d) => toggleFavorite(o, d)}
              />
            </div>
          )}
        </TabsContent>

        {/* FAVORITES TAB */}
        <TabsContent value="favorites" className="mt-3">
          <div className="flex flex-col gap-3">
            {favsList.length > 0 && (
              <div className="flex justify-end">
                {!confirmClear ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmClear(true)}
                    className="text-xs text-[#9CA3AF] hover:text-red-500"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={12} color="currentColor" strokeWidth={1.5} className="mr-1" />
                    Clear all
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6B7B7B]">Are you sure?</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { clearAll(); setConfirmClear(false); }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Yes, clear
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmClear(false)}
                      className="text-xs text-[#6B7B7B]"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}

            {favsList.length === 0 ? (
              <div className="text-center py-12 text-[#9CA3AF]">
                <HugeiconsIcon icon={FavouriteIcon} size={40} color="#9CA3AF" strokeWidth={1} className="mb-3 mx-auto opacity-40" />
                <p className="font-semibold">No favorite routes yet</p>
                <p className="text-xs mt-1">Star a route to save it here</p>
              </div>
            ) : (
              favsList.map(({ origin: o, dest: d }) => {
                const info = airportDict[d];
                return (
                  <DestCard
                    key={`${o}|${d}`}
                    destIata={d}
                    origin={o}
                    info={info}
                    isReciprocal={false}
                    isFav={true}
                    onToggleFav={() => toggleFavorite(o, d)}
                    onSearch={() => handleSearch(o, d)}
                    highlighted={false}
                    onHover={() => {}}
                  />
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RoutesPage;
