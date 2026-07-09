import { lazy, Suspense, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, RefreshCw } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  Search01Icon,
  SunCloud01Icon,
} from "@hugeicons/core-free-icons";
import { useNextHomeGoWildSummary, type NextHomeGoWildSummaryFeed } from "@/hooks/useNextHomeGoWildSummary";
import type { MultiDestMapDestination } from "@/components/MultiDestMap";

const MultiDestMap = lazy(() => import("@/components/MultiDestMap"));

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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Number(value ?? 0)));
}

function money(value?: number | null, currency = "USD") {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E1ECE9] bg-white/74 px-2.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[#7B8C8C]">{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-black leading-none text-[#1A2E2E]">{value}</p>
    </div>
  );
}

function CompactRouteMap({ feed }: { feed: NextHomeGoWildSummaryFeed }) {
  const depLatLng = useMemo<[number, number] | null>(() => {
    if (feed.homeAirportLatitude == null || feed.homeAirportLongitude == null) return null;
    return [Number(feed.homeAirportLatitude), Number(feed.homeAirportLongitude)];
  }, [feed.homeAirportLatitude, feed.homeAirportLongitude]);

  const destinations = useMemo<MultiDestMapDestination[]>(() => {
    return (feed.topRoutes ?? [])
      .map((route) => {
        if (route.latitude == null || route.longitude == null) return null;
        return {
          iata: route.destination,
          latLng: [Number(route.latitude), Number(route.longitude)] as [number, number],
          city: route.destinationCity ?? route.destination,
          stateCode: route.destinationState ?? undefined,
          country: undefined,
          hasGoWild: true,
          hasNonstop: route.nonstopCount > 0,
          flightCount: route.goWildResults,
          minFare: route.lowestPrice ?? null,
        } satisfies MultiDestMapDestination;
      })
      .filter((destination): destination is MultiDestMapDestination => destination != null);
  }, [feed.topRoutes]);

  if (!depLatLng || destinations.length === 0) {
    return (
      <div className="flex h-full min-h-[138px] items-center justify-center rounded-[1.2rem] border border-[#E1ECE9] bg-[#F1F7F5] px-3 text-center">
        <p className="text-[11px] font-semibold text-[#7B8C8C]">
          Route map appears when airport coordinates are available.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[138px] overflow-hidden rounded-[1.2rem] border border-[#D8E7E3] bg-[#F1F7F5]">
      <Suspense
        fallback={(
          <div className="flex h-full w-full items-center justify-center bg-[#F1F7F5]">
            <span className="text-[11px] font-semibold text-[#7B8C8C]">Loading route map…</span>
          </div>
        )}
      >
        <MultiDestMap
          depIata={feed.homeAirport ?? "HOME"}
          depLatLng={depLatLng}
          destinations={destinations}
          invalidateKey={`${feed.homeAirport ?? "home"}-${destinations.length}`}
          compact
        />
      </Suspense>
    </div>
  );
}

function SummaryCard({ feed, onOpenSearch }: { feed: NextHomeGoWildSummaryFeed; onOpenSearch: () => void }) {
  const hasGoWild = feed.goWildFlightsCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } }}
      className="overflow-hidden rounded-[1.45rem]"
      style={CARD_STYLE}
    >
      <div className="px-4 py-3.5">
        <div className="grid grid-cols-[0.82fr_1.18fr] gap-3">
          <div className="flex min-w-0 flex-col justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[36px] font-black leading-none tracking-tight text-[#1A2E2E]">
                  {feed.homeAirport ?? "—"}
                </span>
                <span className="inline-flex h-7 items-center rounded-full bg-[#DFF8EC] px-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#047857]">
                  GoWild
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] font-semibold text-[#7B8C8C]">
                {[feed.homeCity, feed.homeState].filter(Boolean).join(", ") || feed.airportName || "Home airport"}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.11em] text-[#059669]">Tomorrow results</p>
              <p className="mt-0.5 text-[42px] font-black leading-none tracking-tight text-[#0F2F2D]">
                {formatNumber(feed.goWildFlightsCount)}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[#6B7B7B]">
                {hasGoWild ? <>from <span className="font-black text-[#059669]">{money(feed.lowestGoWildPrice, feed.currency)}</span></> : "No GoWild fares seen"}
              </p>
            </div>
          </div>

          <CompactRouteMap feed={feed} />
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <MetricPill label="Flights" value={formatNumber(feed.allFlightsCount)} />
          <MetricPill label="Dests" value={formatNumber(feed.destinationCount)} />
          <MetricPill label="Nonstop" value={formatNumber(feed.nonstopGoWildCount)} />
          <MetricPill label="Seats" value={formatNumber(feed.totalGoWildSeats)} />
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border border-[#A7D8CB] bg-white/82 text-[13px] font-black text-[#047857] shadow-[0_8px_18px_rgba(15,118,110,0.08)] active:scale-[0.98] transition-transform"
        >
          View search <span className="ml-2 text-base leading-none">→</span>
        </button>
      </div>
      <div className="h-1.5 bg-[#059669]" />
    </motion.div>
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
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => event.key === "Enter" && onToggle?.()}
        className="w-full flex items-center justify-between mb-1 px-1 group cursor-pointer"
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
          {!isCollapsed && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void refetch();
              }}
              aria-label="Refresh Tomorrow's GoWild"
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/80 transition-colors"
            >
              <RefreshCw size={13} className="text-[#6B7B7B]" />
            </button>
          )}
          <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
            <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
          </motion.div>
        </div>
      </div>

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
            {loading ? (
              <div className="rounded-[1.45rem] p-4 animate-pulse" style={CARD_STYLE}>
                <div className="grid grid-cols-[0.82fr_1.18fr] gap-3">
                  <div className="space-y-3">
                    <div className="h-9 w-24 rounded bg-[#E5EAEA]" />
                    <div className="h-20 rounded-2xl bg-[#EEF2F2]" />
                  </div>
                  <div className="h-[138px] rounded-[1.2rem] bg-[#EEF2F2]" />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((key) => <div key={key} className="h-12 rounded-2xl bg-[#EEF2F2]" />)}
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
              <SummaryCard feed={feed} onOpenSearch={openSearch} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
