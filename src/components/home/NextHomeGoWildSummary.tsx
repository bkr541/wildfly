import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RefreshCw } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Airplane01Icon,
  Alert01Icon,
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  Search01Icon,
  SunCloud01Icon,
} from "@hugeicons/core-free-icons";
import { useNextHomeGoWildSummary, type NextHomeGoWildSummaryFeed } from "@/hooks/useNextHomeGoWildSummary";

interface Props {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: (page: string, data?: string) => void;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";
const CARD_STYLE = {
  background: "rgba(255,255,255,0.94)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.76)",
  boxShadow: CARD_SHADOW,
};

const FALLBACK_ROUTE_POINTS = [
  { destination: "DEN", x: 26, y: 30 },
  { destination: "LAS", x: 16, y: 52 },
  { destination: "DFW", x: 38, y: 68 },
  { destination: "LGA", x: 86, y: 32 },
  { destination: "MCO", x: 83, y: 73 },
  { destination: "TPA", x: 73, y: 83 },
];

const US_BOUNDS = {
  minLat: 24,
  maxLat: 50,
  minLng: -125,
  maxLng: -66,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Number(value ?? 0)));
}

function readableDate(value?: string) {
  if (!value) return "Tomorrow";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function shortDate(value?: string) {
  if (!value) return "Tomorrow";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function observedLabel(value?: string | null, timezone?: string) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function money(value?: number | null, currency = "USD") {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function projectPoint(latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null) return null;
  const x = ((longitude - US_BOUNDS.minLng) / (US_BOUNDS.maxLng - US_BOUNDS.minLng)) * 100;
  const y = ((US_BOUNDS.maxLat - latitude) / (US_BOUNDS.maxLat - US_BOUNDS.minLat)) * 100;
  return { x: clamp(x, 8, 92), y: clamp(y, 12, 88) };
}

function routePath(origin: { x: number; y: number }, dest: { x: number; y: number }, index: number) {
  const midX = (origin.x + dest.x) / 2;
  const midY = Math.min(origin.y, dest.y) - 8 - (index % 3) * 4;
  return `M ${origin.x} ${origin.y} Q ${midX} ${clamp(midY, 8, 84)} ${dest.x} ${dest.y}`;
}

function MetricIcon({ icon, size = 17 }: { icon: any; size?: number }) {
  return (
    <span className="h-9 w-9 rounded-2xl bg-white/82 border border-[#DDECEA] shadow-[0_6px_16px_rgba(15,118,110,0.08)] flex items-center justify-center shrink-0">
      <HugeiconsIcon icon={icon} size={size} color="#059669" strokeWidth={2} />
    </span>
  );
}

function SmallMetricTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: any;
}) {
  return (
    <div className="rounded-2xl bg-white/70 border border-[#E1ECE9] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] min-w-0">
      <MetricIcon icon={icon} size={16} />
      <p className="text-[11px] font-semibold text-[#596B72] mt-2 truncate">{label}</p>
      <p className="text-[27px] sm:text-[30px] font-black leading-none tracking-tight text-[#1A2E2E] mt-1">{value}</p>
      <p className="text-[10px] font-medium text-[#7B8C8C] mt-1 truncate">{hint}</p>
    </div>
  );
}

function HeroMetricTile({ feed }: { feed: NextHomeGoWildSummaryFeed }) {
  const hasGoWild = feed.goWildFlightsCount > 0;

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[#10B981]/55 bg-gradient-to-br from-[#F4FFFB] via-white to-[#E7F9F2] px-4 py-4 sm:px-5 sm:py-5 min-h-[155px]">
      <div className="absolute right-0 top-0 h-full w-[46%] opacity-55 pointer-events-none">
        <svg viewBox="0 0 220 160" className="h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="nextGwHeroDots" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="108" cy="92" r="78" fill="url(#nextGwHeroDots)" />
          <path
            d="M28 118 C66 101 82 84 112 73 C134 65 135 51 154 58 C169 63 181 42 197 28"
            fill="none"
            stroke="#059669"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.75"
          />
          <path d="M182 28H199V45" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        </svg>
      </div>
      <div className="relative z-10">
        <MetricIcon icon={SunCloud01Icon} />
        <p className="text-base font-black text-[#059669] mt-3">GoWild Results</p>
        <p className="text-[58px] sm:text-[66px] font-black leading-[0.9] tracking-tight text-[#0F2F2D] mt-4">
          {formatNumber(feed.goWildFlightsCount)}
        </p>
        <p className="text-sm sm:text-base font-semibold text-[#6B7B7B] mt-3">
          {hasGoWild ? <>from <span className="text-[#059669]">{money(feed.lowestGoWildPrice, feed.currency)}</span></> : "No GoWild fares seen"}
        </p>
      </div>
    </div>
  );
}

function MiniRouteMap({ feed }: { feed: NextHomeGoWildSummaryFeed }) {
  const dataRoutes = (feed.topRoutes ?? []).filter((route) => route.destination).slice(0, 6);
  const originPoint = projectPoint(feed.homeAirportLatitude, feed.homeAirportLongitude) ?? { x: 72, y: 62 };
  const hasGeoRoutes = dataRoutes.some((route) => projectPoint(route.latitude, route.longitude));
  const plottedRoutes = (dataRoutes.length > 0 ? dataRoutes : FALLBACK_ROUTE_POINTS).map((route, index) => {
    const fallback = FALLBACK_ROUTE_POINTS[index % FALLBACK_ROUTE_POINTS.length];
    const geoPoint = "latitude" in route ? projectPoint(route.latitude, route.longitude) : null;
    return {
      destination: route.destination,
      point: hasGeoRoutes && geoPoint ? geoPoint : { x: fallback.x, y: fallback.y },
      goWildResults: "goWildResults" in route ? route.goWildResults : undefined,
    };
  });
  const mapCaption = dataRoutes.length > 0 ? "Top GoWild routes" : "Route map preview";

  return (
    <div className="rounded-[1.35rem] border border-[#DDECEA] bg-gradient-to-br from-[#F7FCFA] via-white to-[#EEF8F5] overflow-hidden min-h-[245px] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <svg viewBox="0 0 560 300" className="h-full min-h-[245px] w-full" role="img" aria-label={`${mapCaption} from ${feed.homeAirport ?? "your home airport"}`}>
        <defs>
          <linearGradient id="nextGwMapFade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#DDF5EC" stopOpacity="0.74" />
          </linearGradient>
          <filter id="nextGwDotShadow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#059669" floodOpacity="0.22" />
          </filter>
        </defs>

        <rect x="0" y="0" width="560" height="300" fill="url(#nextGwMapFade)" />
        <g opacity="0.45" stroke="#B9C9C7" strokeWidth="1.25" fill="none">
          <path d="M42 62 C88 72 131 48 178 58 C229 69 256 36 306 49 C351 60 377 48 418 57 C466 67 500 82 522 119 C496 137 468 131 449 155 C429 180 444 212 414 232 C373 260 329 235 291 244 C246 255 222 226 179 231 C135 236 99 225 83 190 C66 152 36 127 42 62Z" />
          <path d="M95 66 L112 220" />
          <path d="M160 58 L176 230" />
          <path d="M228 58 L222 238" />
          <path d="M295 48 L290 244" />
          <path d="M362 53 L350 242" />
          <path d="M428 62 L416 230" />
          <path d="M70 108 C178 126 268 112 492 122" />
          <path d="M78 156 C184 172 280 162 462 168" />
          <path d="M94 202 C184 214 292 209 412 216" />
        </g>

        <g fill="none" strokeLinecap="round">
          {plottedRoutes.map((route, index) => (
            <motion.path
              key={`${route.destination}-${index}`}
              d={routePath(
                { x: originPoint.x * 5.6, y: originPoint.y * 3 },
                { x: route.point.x * 5.6, y: route.point.y * 3 },
                index,
              )}
              stroke="#059669"
              strokeWidth={index < 2 ? 2.8 : 2.1}
              opacity={index < 2 ? 0.86 : 0.56}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: index < 2 ? 0.86 : 0.56 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.05 * index }}
            />
          ))}
        </g>

        <g>
          {plottedRoutes.map((route, index) => {
            const x = route.point.x * 5.6;
            const y = route.point.y * 3;
            const anchor = x < originPoint.x * 5.6 ? "end" : "start";
            const labelX = anchor === "end" ? x - 12 : x + 12;
            const countLabel = route.goWildResults && route.goWildResults > 0 ? `${formatNumber(route.goWildResults)}` : null;
            return (
              <g key={`${route.destination}-dot-${index}`}>
                <circle cx={x} cy={y} r={index < 2 ? 6 : 5} fill="#059669" filter="url(#nextGwDotShadow)" />
                <text x={labelX} y={y - 5} textAnchor={anchor} fontSize="18" fontWeight="800" fill="#1A2E2E" fontFamily="inherit">
                  {route.destination}
                </text>
                {countLabel && (
                  <text x={labelX} y={y + 14} textAnchor={anchor} fontSize="10" fontWeight="700" fill="#6B7B7B" fontFamily="inherit">
                    {countLabel} GoWild
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g>
          <circle cx={originPoint.x * 5.6} cy={originPoint.y * 3} r="13" fill="#FFFFFF" stroke="#BFE9DA" strokeWidth="5" />
          <circle cx={originPoint.x * 5.6} cy={originPoint.y * 3} r="8" fill="#059669" filter="url(#nextGwDotShadow)" />
          <text x={originPoint.x * 5.6 + 18} y={originPoint.y * 3 + 6} fontSize="20" fontWeight="900" fill="#1A2E2E" fontFamily="inherit">
            {feed.homeAirport ?? "HOME"}
          </text>
        </g>

        <g transform="translate(24 266)">
          <path d="M0 0 H24" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
          <text x="38" y="5" fontSize="13" fontWeight="700" fill="#6B7B7B" fontFamily="inherit">
            {mapCaption}
          </text>
        </g>
      </svg>
    </div>
  );
}

function StateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl px-4 py-4 flex items-center gap-3" style={CARD_STYLE}>
      <div className="h-11 w-11 rounded-full bg-[#E6F7F2] flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={icon} size={20} color="#059669" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1A2E2E]">{title}</p>
        <p className="text-xs text-[#7B8C8C] mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function NextHomeGoWildSummary({ isCollapsed = false, onToggle, onNavigate }: Props) {
  const { feed, loading, error, refetch } = useNextHomeGoWildSummary();
  const observed = observedLabel(feed.observedAt, feed.homeAirportTimezone);
  const targetDateLabel = readableDate(feed.targetDate);
  const targetShortDate = shortDate(feed.targetDate);

  const openSearch = () => {
    if (!feed.homeAirport || !feed.targetDate) {
      onNavigate?.("flights");
      return;
    }

    onNavigate?.(
      "flights",
      JSON.stringify({
        quickSearch: true,
        origin: feed.homeAirport,
        date: feed.targetDate,
        label: "Tomorrow",
        allDestinations: true,
      }),
    );
  };

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-1 px-1 group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <HugeiconsIcon icon={SunCloud01Icon} size={13} color="#059669" strokeWidth={2} />
          <h2 className="text-xs font-semibold text-[#059669] uppercase tracking-wider truncate">
            Tomorrow's GoWild
          </h2>
          {feed.homeAirport && (
            <span className="text-[10px] font-bold text-[#7B8C8C] bg-white/70 rounded-full px-2 py-0.5">
              From {feed.homeAirport}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {observed && !isCollapsed && (
            <span className="hidden sm:inline text-[9px] font-semibold text-[#9AADAD]">Seen {observed}</span>
          )}
          <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
            <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="next-home-gowild-summary-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "visible" }}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-[11px] font-medium text-[#7B8C8C]">
                {targetDateLabel} · Nightly home-airport scan · Uses 0 searches
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                aria-label="Refresh Tomorrow's GoWild"
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/80 transition-colors"
              >
                <RefreshCw size={13} className="text-[#6B7B7B]" />
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl p-4 animate-pulse" style={CARD_STYLE}>
                <div className="h-3 w-44 rounded bg-[#E5EAEA] mb-3" />
                <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4">
                  <div className="h-64 rounded-[1.35rem] bg-[#EEF2F2]" />
                  <div className="space-y-3">
                    <div className="h-40 rounded-[1.35rem] bg-[#EEF2F2]" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-28 rounded-2xl bg-[#EEF2F2]" />
                      <div className="h-28 rounded-2xl bg-[#EEF2F2]" />
                    </div>
                  </div>
                </div>
              </div>
            ) : error ? (
              <StateCard
                icon={Alert01Icon}
                title="Tomorrow's scan could not load"
                description={error}
                action={(
                  <button type="button" onClick={() => void refetch()} className="text-xs font-bold text-[#059669]">
                    Retry
                  </button>
                )}
              />
            ) : feed.status === "home_airport_missing" ? (
              <StateCard
                icon={Location01Icon}
                title="Choose your home airport"
                description="Add a home airport to see tomorrow's bulk-scan totals automatically."
                action={(
                  <button type="button" onClick={() => onNavigate?.("account")} className="text-xs font-bold text-[#059669]">
                    Set up
                  </button>
                )}
              />
            ) : feed.status === "timezone_missing" ? (
              <StateCard
                icon={Alert01Icon}
                title="Airport timezone is unavailable"
                description="Wildfly needs timezone metadata for this home airport before it can show the nightly scan."
              />
            ) : ["processing", "not_ready"].includes(feed.status) ? (
              <StateCard
                icon={Clock01Icon}
                title="Tomorrow's scan is warming up"
                description={`The 12:01am bulk search for ${feed.homeAirport ?? "your airport"} has not published yet. This card refreshes automatically.`}
              />
            ) : feed.status === "job_failed" ? (
              <StateCard
                icon={Alert01Icon}
                title="The nightly airport search needs attention"
                description="No current next-day inventory was published for this airport. Try again shortly or run a live search."
                action={(
                  <button type="button" onClick={openSearch} className="text-xs font-bold text-[#059669]">
                    Search
                  </button>
                )}
              />
            ) : feed.status === "no_available_flights" ? (
              <StateCard
                icon={Calendar03Icon}
                title="No flights returned for tomorrow"
                description={`The latest scheduled scan from ${feed.homeAirport ?? "your home airport"} did not return any flight results.`}
                action={(
                  <button type="button" onClick={openSearch} className="flex items-center gap-1 text-xs font-bold text-[#059669]">
                    <HugeiconsIcon icon={Search01Icon} size={13} color="#059669" strokeWidth={2} /> Live search
                  </button>
                )}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } }}
                className="rounded-[1.65rem] overflow-hidden"
                style={CARD_STYLE}
              >
                <div className="px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[40px] sm:text-[50px] font-black leading-none tracking-tight text-[#1A2E2E]">
                        {feed.homeAirport ?? "—"}
                      </span>
                      <span className="h-10 hidden sm:block w-px bg-[#D8E4E2]" />
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-9 w-9 rounded-full bg-[#E6F7F2] flex items-center justify-center shrink-0">
                          <HugeiconsIcon icon={Location01Icon} size={17} color="#059669" strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#4B5963] truncate">Home airport</p>
                          <p className="text-[11px] text-[#7B8C8C] truncate">
                            {[feed.homeCity, feed.homeState].filter(Boolean).join(", ") || feed.airportName || "Nightly scan origin"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:text-right">
                      <MetricIcon icon={Calendar03Icon} />
                      <div>
                        <p className="text-sm font-bold text-[#1A2E2E]">Tomorrow scan</p>
                        <p className="text-[12px] font-semibold text-[#6B7B7B]">{targetShortDate}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-4">
                    <MiniRouteMap feed={feed} />
                    <div className="flex flex-col gap-3 min-w-0">
                      <HeroMetricTile feed={feed} />
                      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3">
                        <SmallMetricTile
                          label="All Flights"
                          value={formatNumber(feed.allFlightsCount)}
                          hint="scanned"
                          icon={Airplane01Icon}
                        />
                        <SmallMetricTile
                          label="Destinations"
                          value={formatNumber(feed.destinationCount)}
                          hint={`from ${feed.homeAirport ?? "home"}`}
                          icon={Location01Icon}
                        />
                        <SmallMetricTile
                          label="Nonstop GoWild"
                          value={formatNumber(feed.nonstopGoWildCount)}
                          hint="direct options"
                          icon={Airplane01Icon}
                        />
                        <SmallMetricTile
                          label="Seats Seen"
                          value={formatNumber(feed.totalGoWildSeats)}
                          hint="total availability"
                          icon={Calendar03Icon}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#E1ECE9] mt-4 pt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DFF8EC] px-3 py-1.5 text-xs font-black text-[#047857]">
                        <HugeiconsIcon icon={SunCloud01Icon} size={14} color="#059669" strokeWidth={2} />
                        GoWild
                      </span>
                      {observed && <span className="text-[11px] font-semibold text-[#7B8C8C]">Seen {observed}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={openSearch}
                      className="inline-flex items-center justify-center rounded-full border border-[#A7D8CB] bg-white/70 px-5 py-2 text-sm font-black text-[#047857] shadow-[0_8px_18px_rgba(15,118,110,0.08)] active:scale-[0.98] transition-transform"
                    >
                      View search <span className="ml-2 text-base leading-none">→</span>
                    </button>
                  </div>
                </div>
                <div className="h-1.5 bg-gradient-to-r from-[#10B981] via-[#059669] to-[#047857]" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
