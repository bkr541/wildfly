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
import { useNextHomeGoWildSummary } from "@/hooks/useNextHomeGoWildSummary";

interface Props {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: (page: string, data?: string) => void;
}

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const CARD_STYLE = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow:
    "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
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

function StatTile({
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
    <div className="flex-1 rounded-2xl bg-[#F5FAF8] border border-[#E4EFEC] px-3 py-3 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7B8C8C] truncate">{label}</p>
        <span className="h-7 w-7 rounded-full bg-white flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={icon} size={14} color="#059669" strokeWidth={2} />
        </span>
      </div>
      <p className="text-[34px] font-black leading-none tracking-tight text-[#1A2E2E]">{value}</p>
      <p className="text-[11px] font-semibold text-[#7B8C8C] mt-1 truncate">{hint}</p>
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
                <div className="flex gap-3">
                  <div className="h-28 flex-1 rounded-2xl bg-[#EEF2F2]" />
                  <div className="h-28 flex-1 rounded-2xl bg-[#EEF2F2]" />
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
                className="rounded-2xl overflow-hidden"
                style={CARD_STYLE}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#059669] truncate">
                        {feed.homeCity || feed.airportName || "Home airport"}
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-[34px] font-black leading-none tracking-tight text-[#1A2E2E]">
                          {feed.homeAirport ?? "—"}
                        </span>
                        <span className="text-xs font-semibold text-[#6B7280] truncate">
                          {targetDateLabel}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openSearch}
                      className="rounded-full bg-[#D1FAE5] px-3 py-1.5 text-xs font-black text-[#047857] shrink-0 active:scale-[0.96] transition-transform"
                    >
                      View search
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <StatTile
                      label="All flights"
                      value={formatNumber(feed.allFlightsCount)}
                      hint={`${formatNumber(feed.destinationCount)} destination${feed.destinationCount === 1 ? "" : "s"}`}
                      icon={Airplane01Icon}
                    />
                    <StatTile
                      label="GoWild results"
                      value={formatNumber(feed.goWildFlightsCount)}
                      hint={feed.goWildFlightsCount > 0 ? `From ${money(feed.lowestGoWildPrice, feed.currency)}` : "No GoWild fares seen"}
                      icon={SunCloud01Icon}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3 text-[10px] font-semibold text-[#6B7B7B]">
                    <span>{formatNumber(feed.nonstopGoWildCount)} nonstop GoWild</span>
                    <span>{formatNumber(feed.totalGoWildSeats)} seats seen</span>
                    {observed && <span>Seen {observed}</span>}
                  </div>
                </div>
                <div className="h-1.5 bg-gradient-to-r from-[#10B981] to-[#059669]" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
