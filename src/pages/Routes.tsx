import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAirportDictionary, type AirportInfo } from "@/hooks/useAirportDictionary";
import { useRouteStats } from "@/hooks/useRouteStats";
import { useRouteFavorites } from "@/hooks/useRouteFavorites";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useRadarRouteMetrics } from "@/hooks/useRadarRouteMetrics";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppInput } from "@/components/ui/app-input";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomSheet } from "@/components/BottomSheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
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
  Location01Icon,
  Location04Icon,
  AddCircleIcon,
  MapsIcon,
  ListViewIcon,
  FavouriteIcon as StarFilledIcon,
  HeartAddIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import React, { Suspense, lazy } from "react";
import type { RadarStyledRoute, RadarStyledAirport } from "@/components/maps/radar/radarMapTypes";

const RadarStyledRouteMap = lazy(() => import("@/components/maps/radar/RadarStyledRouteMap"));

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
type OriginOption = { iata: string; count: number; info?: AirportInfo };

export const OriginCombobox = ({
  value,
  onChange,
  hubsSorted,
  airportDict,
  label = "Origin Airport",
}: {
  value: string;
  onChange: (v: string) => void;
  hubsSorted: { iata: string; count: number }[];
  airportDict: Record<string, AirportInfo>;
  label?: string;
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const selectedInfo = airportDict[value];

  const options = useMemo<OriginOption[]>(
    () =>
      hubsSorted.map((hub) => ({
        ...hub,
        info: airportDict[hub.iata],
      })),
    [airportDict, hubsSorted],
  );

  const popularOptions = useMemo(() => options.slice(0, 8), [options]);

  useEffect(() => {
    if (!sheetOpen) return;
    setQuery("");
    requestAnimationFrame(() => {
      setTimeout(() => sheetInputRef.current?.focus(), 50);
    });
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sheetOpen]);

  const shouldShow = query.trim().length >= 2;

  const groupedOptions = useMemo(() => {
    if (!shouldShow) return {} as Record<string, OriginOption[]>;
    const q = query.trim().toLowerCase();
    const filtered = options
      .filter(({ iata, info }) => {
        const cityState = [info?.city, info?.state].filter(Boolean).join(" ");
        return (
          iata.toLowerCase().includes(q) ||
          info?.name?.toLowerCase().includes(q) ||
          info?.city?.toLowerCase().includes(q) ||
          cityState.toLowerCase().includes(q)
        );
      })
      .slice(0, 40);

    const grouped = filtered.reduce((acc, option) => {
      const city = option.info?.city;
      const state = option.info?.state;
      const key = city && state ? `${city}, ${state}` : "Other Locations";
      if (!acc[key]) acc[key] = [];
      acc[key].push(option);
      return acc;
    }, {} as Record<string, OriginOption[]>);

    return Object.fromEntries(
      Object.entries(grouped).map(([key, airports]) => {
        const list = airports as OriginOption[];
        return [list.length > 1 ? key : `__single__${key}`, list];
      }),
    ) as Record<string, OriginOption[]>;
  }, [options, query, shouldShow]);

  const displayValue = value
    ? `${value}${selectedInfo?.city ? ` | ${selectedInfo.city}` : selectedInfo?.name ? ` | ${selectedInfo.name}` : ""}`
    : "";

  const selectAirport = (iata: string) => {
    onChange(iata);
    setQuery("");
    setSheetOpen(false);
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange("");
    setQuery("");
  };

  return (
    <div className="relative z-10 w-full">
      <label className="ml-1 mb-0 block text-sm font-bold text-[#059669]">{label}</label>

      <div
        className="app-input-container cursor-pointer"
        style={{ minHeight: 48, backgroundColor: "transparent" }}
        onClick={() => setSheetOpen(true)}
      >
        <button type="button" tabIndex={-1} className="app-input-icon-btn">
          <HugeiconsIcon icon={RouteIcon} size={20} color="currentColor" strokeWidth={2} />
        </button>
        <span
          className="app-input flex-1 truncate"
          style={{ color: displayValue ? "#1F2937" : "#6B7280" }}
        >
          {displayValue || "Search airport or city..."}
        </span>
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="app-input-reset app-input-reset--visible"
            aria-label={`Clear ${label}`}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
          </button>
        ) : (
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} color="#9CA3AF" strokeWidth={1.5} className="shrink-0 ml-1" />
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} style={{ top: "5%" }}>
        <div className="flex items-center justify-between border-b border-[#F0F1F1] px-5 pt-2 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              <HugeiconsIcon icon={Location01Icon} size={15} color="white" strokeWidth={2} />
            </div>
            <h2 className="text-[22px] font-medium leading-tight text-[#6B7280]">
              Select {label.replace(/ Airport$/, "")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-black/5 hover:text-[#2E4A4A]"
          >
            <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
          </button>
        </div>

        <div className="px-5 pb-4 pt-3">
          <div className="app-input-container">
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={Location01Icon} size={20} color="currentColor" strokeWidth={2} />
            </button>
            <input
              ref={sheetInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search airport or city…"
              className="app-input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="app-input-reset app-input-reset--visible"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!shouldShow ? (
            <div className="px-5 pt-2">
              <div className="mb-6">
                <p className="mb-2 block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B7B7B]">
                  Popular Airports
                </p>
                <div className="-mx-5 flex flex-nowrap gap-2.5 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: "none" }}>
                  {popularOptions.map(({ iata, info, count }) => (
                    <button
                      key={iata}
                      type="button"
                      onClick={() => selectAirport(iata)}
                      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{
                        background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
                        color: "#065F46",
                        border: "1px solid #6EE7B7",
                      }}
                    >
                      <HugeiconsIcon icon={Airplane01Icon} size={14} color="#059669" strokeWidth={2.5} />
                      <span className="font-bold">{iata}</span>
                      {info?.city && <span className="font-medium opacity-60">{info.city}</span>}
                      <span className="font-medium opacity-50">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F0FDF4]">
                  <HugeiconsIcon icon={Airplane01Icon} size={28} color="#059669" strokeWidth={2} />
                </div>
                <p className="mb-1 text-base font-bold text-[#2E4A4A]">Search for an airport</p>
                <p className="text-sm text-[#9CA3AF]">Type 2 or more letters to see results</p>
              </div>
            </div>
          ) : Object.keys(groupedOptions).length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <p className="mb-1 text-base font-bold text-[#2E4A4A]">No airports found</p>
              <p className="text-sm text-[#9CA3AF]">Try a different city or airport code</p>
            </div>
          ) : (
            <div className="py-3 px-4">
              {Object.entries(groupedOptions).map(([cityGroup, cityAirports]) => {
                const airports = cityAirports as OriginOption[];
                const isSingle = cityGroup.startsWith("__single__");
                const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
                const firstAirport = airports[0];
                return (
                  <div key={cityGroup} className="mb-2 last:mb-0">
                    {!isSingle && firstAirport && (
                      <button
                        type="button"
                        onClick={() => selectAirport(firstAirport.iata)}
                        className="flex w-full items-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-wider text-[#6B7B7B] transition-colors hover:bg-[#F2F3F3]"
                      >
                        <HugeiconsIcon icon={Location04Icon} size={20} color="currentColor" strokeWidth={2} className="opacity-60" />
                        {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                      </button>
                    )}
                    {airports.map(({ iata, count, info }, index) => (
                      <div key={iata}>
                        {index > 0 && <div className="mx-1 border-t border-[#F0F1F1]" />}
                        <button
                          type="button"
                          onClick={() => selectAirport(iata)}
                          className={cn(
                            "flex w-full items-center gap-3 overflow-hidden py-1.5 pr-4 text-left text-base transition-colors hover:bg-[#F2F3F3] active:bg-[#E8F5F0]",
                            isSingle ? "pl-4" : "pl-14",
                          )}
                        >
                          <HugeiconsIcon icon={Airplane01Icon} size={22} color="#6B7B7B" strokeWidth={2} className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 text-sm font-bold text-[#345C5A]">{iata}</span>
                              <span className="shrink-0 text-xs text-[#9CA3AF]">•</span>
                              <span className="truncate text-sm font-medium text-[#2E4A4A]">
                                {info?.name ?? `${iata} Airport`}
                              </span>
                            </div>
                            {info?.city && (
                              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#F2F3F3] px-2 py-0.5 text-xs font-medium text-[#6B7B7B]">
                                <HugeiconsIcon icon={Location01Icon} size={10} color="currentColor" strokeWidth={2} />
                                <span className="truncate">
                                  {info.city}{info.state ? `, ${info.state}` : ""}
                                </span>
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-[#9CA3AF]">{count} dest</span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          <div className="h-10" />
        </div>
      </BottomSheet>
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
}) => {
  const [imgErr, setImgErr] = useState(false);
  const bgImage = info?.locationId && !imgErr
    ? `/assets/locations/${info.locationId}_background.png`
    : null;

  return (
    <div
      className={cn(
        "bg-white rounded-xl border flex items-center gap-0 transition-all hover:shadow-md overflow-hidden",
        highlighted ? "border-[#345C5A] shadow-md ring-1 ring-[#345C5A]/20" : "border-[#E3E6E6]"
      )}
      onMouseEnter={() => onHover(destIata)}
      onMouseLeave={() => onHover(null)}
      data-dest={destIata}
    >
      {/* Location image thumbnail */}
      <div className="relative w-[72px] h-[72px] shrink-0 bg-[#C8D5D5] overflow-hidden">
        {bgImage ? (
          <img
            src={bgImage}
            alt={info?.city || destIata}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)", opacity: 0.7 }}
          />
        )}
        {/* IATA code overlay */}
        <div className="absolute inset-0 flex items-end justify-start p-1.5 bg-gradient-to-t from-black/40 to-transparent">
          <span className="text-[11px] font-black text-white leading-none tracking-wide drop-shadow">
            {destIata}
          </span>
        </div>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 px-3 py-3">
        <div className="flex items-center gap-2">
          {info ? (
            <span className="text-[#2E4A4A] text-sm font-semibold truncate">{info.city || info.name}</span>
          ) : (
            <span className="text-[#9CA3AF] text-xs italic">Unknown airport</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
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

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0 pr-2">
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
};

/* ── Route Map ───────────────────────────────────────── */
const RouteMap = ({
  origin,
  destinations,
  airportDict,
  filteredDests,
  showAllLines,
  hoveredDest,
  onHover,
  routeMetricsMap,
  airportMetricsMap,
}: {
  origin: string;
  destinations: string[];
  airportDict: Record<string, AirportInfo>;
  filteredDests: string[];
  showAllLines: boolean;
  hoveredDest: string | null;
  onHover: (d: string | null) => void;
  routeMetricsMap: Map<string, RadarStyledRoute>;
  airportMetricsMap: Map<string, RadarStyledAirport>;
}) => {
  const destsToShow = showAllLines ? destinations : filteredDests;

  const hasMissingCoords = useMemo(() => {
    return destinations.some(d => {
      const info = airportDict[d];
      return !info?.latitude || !info?.longitude;
    });
  }, [destinations, airportDict]);

  const originInfo = airportDict[origin];

  // Build RadarStyledRoute[] for the visible destinations
  const routes = useMemo<RadarStyledRoute[]>(() => {
    if (!originInfo?.latitude || !originInfo?.longitude) return [];
    return destsToShow.flatMap(dest => {
      const destInfo = airportDict[dest];
      if (!destInfo?.latitude || !destInfo?.longitude) return [];

      const routeKey = `${origin}-${dest}`;
      const existing = routeMetricsMap.get(routeKey);
      if (existing) {
        return [{
          ...existing,
          currentSearch: { city: destInfo.city ?? undefined },
        }];
      }
      // No historical data — build a gray stub
      return [{
        routeKey,
        origin,
        destination: dest,
        originLat: originInfo.latitude!,
        originLng: originInfo.longitude!,
        destinationLat: destInfo.latitude!,
        destinationLng: destInfo.longitude!,
        snapshotCount: 0,
        goWildCount: 0,
        availabilityRate: null,
        avgGoWildSeats: null,
        avgGoWildFare: null,
        avgSavings: null,
        searchCount: 0,
        volatilityScore: null,
        freshnessStatus: "unknown",
        isStale: false,
      } as RadarStyledRoute];
    });
  }, [destsToShow, origin, originInfo, airportDict, routeMetricsMap]);

  // Build RadarStyledAirport[] for origin + visible destinations
  const airportNodes = useMemo<RadarStyledAirport[]>(() => {
    const nodes: RadarStyledAirport[] = [];
    // Add all destinations (and origin)
    const allCodes = [origin, ...destsToShow];
    for (const code of allCodes) {
      const existing = airportMetricsMap.get(code);
      if (existing) { nodes.push(existing); continue; }
      const info = airportDict[code];
      if (!info?.latitude || !info?.longitude) continue;
      nodes.push({
        iata: code,
        lat: info.latitude,
        lng: info.longitude,
        name: info.name ?? code,
        city: info.city ?? code,
        routeCount: 0,
        searchVolume: 0,
        avgAvailabilityRate: null,
        avgSeats: null,
        avgSavings: null,
        freshnessStatus: "unknown",
      });
    }
    return nodes;
  }, [destsToShow, origin, airportDict, airportMetricsMap]);

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);

  // Sync hoveredDest → selectedRoute
  useEffect(() => {
    if (hoveredDest) {
      setSelectedRoute(`${origin}-${hoveredDest}`);
    } else {
      setSelectedRoute(null);
    }
  }, [hoveredDest, origin]);

  const handleSelectRoute = useCallback((routeKey: string) => {
    const dest = routeKey.split("-")[1];
    onHover(dest ?? null);
  }, [onHover]);

  const handleSelectAirport = useCallback((iata: string) => {
    setSelectedAirport(prev => prev === iata ? null : iata);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {hasMissingCoords && (
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF] bg-[#FDF6E3] rounded-lg px-3 py-1.5 border border-yellow-200">
          <HugeiconsIcon icon={Alert01Icon} size={12} color="#EAB308" strokeWidth={1.5} />
          Some routes hidden due to missing coordinates.
        </div>
      )}
      <div className="w-full h-[400px] rounded-xl overflow-hidden border border-[#E3E6E6] bg-[#F2F3F3]">
        <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-[#F2F3F3]"><span className="text-sm text-[#6B7B7B]">Loading map…</span></div>}>
          <RadarStyledRouteMap
            routes={routes}
            airports={airportNodes}
            mode="availability"
            selectedRoute={selectedRoute}
            selectedAirport={selectedAirport}
            onSelectRoute={handleSelectRoute}
            onSelectAirport={handleSelectAirport}
            fitBounds
            fitKey={`${origin}-${destsToShow.length}`}
            showLegend
            legendPosition="bottom-right"
            height="100%"
          />
        </Suspense>
      </div>
    </div>
  );
};

const viewOptions: {
  value: "map" | "grid";
  label: string;
  icon: IconSvgElement;
}[] = [
  { value: "map", label: "Map", icon: MapsIcon },
  { value: "grid", label: "List", icon: ListViewIcon },
];

type SortMode = "az" | "za" | "region";
type ViewMode = "map" | "grid";

/* ── Routes Page ──────────────────────────────────────── */
interface RoutesPageProps {
  onNavigate?: (page: string, data?: string) => void;
  restoreInitialOrigin?: boolean;
}

const RoutesPage = ({
  onNavigate,
  restoreInitialOrigin = true,
}: RoutesPageProps) => {
  const { dict: airportDict, loading: airportsLoading } = useAirportDictionary();
  const { isFavorite, toggleFavorite, clearAll, getFavoritesList } = useRouteFavorites();
  const { settings: userSettings } = useUserSettings();
  const { routeMetrics: routeMetricsMap, airportMetrics: airportMetricsMap } = useRadarRouteMetrics();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlOrigin = params.get("origin") || "";
  const urlDest = params.get("dest") || "";

  const [origin, setOrigin] = useState<string>("");
  const [defaultHomeApplied, setDefaultHomeApplied] = useState(false);
  const initialOriginRestoreAttempted = useRef(false);
  const [destSearch, setDestSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("az");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [showAllLines, setShowAllLines] = useState(false);
  const [hoveredDest, setHoveredDest] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  const stats = useRouteStats(origin || null);

  useEffect(() => {
    if (!restoreInitialOrigin) return;
    if (initialOriginRestoreAttempted.current) return;
    if (stats.hubsSorted.length === 0) return;

    initialOriginRestoreAttempted.current = true;

    if (urlOrigin) {
      setOrigin(urlOrigin);
      return;
    }

    const saved = localStorage.getItem(LS_ORIGIN_KEY);
    if (saved && stats.hubsSorted.some(h => h.iata === saved)) {
      setOrigin(saved);
    }
  }, [restoreInitialOrigin, stats.hubsSorted, urlOrigin]);

  useEffect(() => {
    if (!restoreInitialOrigin) return;
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
  }, [
    defaultHomeApplied,
    origin,
    restoreInitialOrigin,
    stats.hubsSorted,
    urlOrigin,
    userSettings.default_departure_to_home,
  ]);

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
      <div className="relative isolate overflow-visible rounded-2xl" style={glassStyle}>
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
                        routeMetricsMap={routeMetricsMap}
                        airportMetricsMap={airportMetricsMap}
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
