/**
 * RouteAvailabilityCalendarCard
 *
 * Per-route monthly calendar showing the current trustworthy GoWild seat
 * inventory by travel date. Each cell is driven by `get_route_gowild_inventory_calendar`
 * (latest observation per stable itinerary, cache_hit rows excluded). Tapping
 * a day opens `get_route_gowild_inventory_day_details` for per-itinerary
 * "first → now" deltas including disappeared itineraries.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomSheet } from "@/components/BottomSheet";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
import type { FlightSnapshot } from "@/components/insights/airportHelpers";

const CARD_SHADOW =
  "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)";

type CalendarRow = {
  travel_date: string;
  available_flights_now: number;
  available_seats_now: number;
  original_available_flights: number;
  original_available_seats: number;
  seat_change: number;
  lowest_gowild_fare_now: number | null;
  lowest_standard_fare_now: number | null;
  last_provider_observed_at: string | null;
  has_observation: boolean;
  has_current_gowild_availability: boolean;
};

type DayDetailRow = {
  stable_itinerary_key: string;
  departure_at: string;
  arrival_at: string;
  airline: string | null;
  flight_number: string | null;
  stops: number | null;
  total_duration_display: string | null;
  first_seats: number;
  current_seats: number;
  seat_change: number;
  first_observed_at: string | null;
  latest_observed_at: string | null;
  latest_availability_status: string;
  current_gowild_fare: number | null;
  current_standard_fare: number | null;
  is_currently_available: boolean;
};

type Route = { origin: string; destination: string; observations: number };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
}

function formatDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export default function RouteAvailabilityCalendarCard({
  snapshots,
}: {
  snapshots: FlightSnapshot[];
}) {
  // Derive routes ranked by observation density (excludes blank pairs).
  const routes = useMemo<Route[]>(() => {
    const counts = new Map<string, number>();
    for (const s of snapshots) {
      const o = (s.leg_origin_iata ?? "").toUpperCase();
      const d = (s.leg_destination_iata ?? "").toUpperCase();
      if (!o || !d || o.length !== 3 || d.length !== 3) continue;
      const k = `${o}|${d}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([k, v]) => {
        const [origin, destination] = k.split("|");
        return { origin, destination, observations: v };
      })
      .sort((a, b) => b.observations - a.observations)
      .slice(0, 24);
  }, [snapshots]);

  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  useEffect(() => {
    if (!selectedRoute && routes.length > 0) setSelectedRoute(routes[0]);
  }, [routes, selectedRoute]);

  // Current month being viewed
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRoute) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    (async () => {
      try {
        const { data, error } = await (supabase.rpc as any)(
          "get_route_gowild_inventory_calendar",
          {
            p_origin_iata: selectedRoute.origin,
            p_destination_iata: selectedRoute.destination,
            p_start_date: ymd(first),
            p_end_date: ymd(last),
          },
        );
        if (cancelled) return;
        if (error) throw new Error(error.message);
        setRows((data ?? []) as CalendarRow[]);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load calendar");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedRoute, viewMonth, viewYear]);

  const rowByDate = useMemo(() => {
    const m = new Map<string, CalendarRow>();
    for (const r of rows) m.set(r.travel_date, r);
    return m;
  }, [rows]);

  // Build month grid
  const cells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewMonth, viewYear]);

  const [openDate, setOpenDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<DayDetailRow[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  useEffect(() => {
    if (!openDate || !selectedRoute) return;
    let cancelled = false;
    setDayLoading(true);
    setDayError(null);
    setDayDetails([]);
    (async () => {
      try {
        const { data, error } = await (supabase.rpc as any)(
          "get_route_gowild_inventory_day_details",
          {
            p_origin_iata: selectedRoute.origin,
            p_destination_iata: selectedRoute.destination,
            p_travel_date: openDate,
          },
        );
        if (cancelled) return;
        if (error) throw new Error(error.message);
        setDayDetails((data ?? []) as DayDetailRow[]);
        setDayLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setDayError(e?.message ?? "Failed to load day details");
        setDayLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [openDate, selectedRoute]);

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewMonth(d.getMonth()); setViewYear(d.getFullYear());
  };
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewMonth(d.getMonth()); setViewYear(d.getFullYear());
  };

  if (routes.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white p-5 flex flex-col gap-4" style={{ boxShadow: CARD_SHADOW }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #059669 0%, #10B981 100%)" }}
        >
          <HugeiconsIcon icon={Calendar03Icon} size={18} color="white" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-widest uppercase text-[#059669]">
            Route Availability
          </div>
          <div className="text-sm text-[#6B7280] leading-tight">
            Current GoWild seat inventory by travel date
          </div>
        </div>
      </div>

      {/* Route picker (horizontal scroll chips) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {routes.map((r) => {
          const selected = selectedRoute?.origin === r.origin && selectedRoute?.destination === r.destination;
          return (
            <button
              key={`${r.origin}-${r.destination}`}
              type="button"
              onClick={() => setSelectedRoute(r)}
              className={`shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                selected
                  ? "bg-emerald-600 text-white"
                  : "bg-[#F2F3F3] text-[#6B7280] hover:bg-[#E8EEEE]"
              }`}
            >
              {r.origin} → {r.destination}
            </button>
          );
        })}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          className="h-8 w-8 flex items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F2F3F3]"
          aria-label="Previous month"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="currentColor" strokeWidth={2.5} />
        </button>
        <div className="text-sm font-bold text-[#2E4A4A]">
          {MONTHS[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          onClick={goNext}
          className="h-8 w-8 flex items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F2F3F3]"
          aria-label="Next month"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="currentColor" strokeWidth={2.5} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-[#9CA3AF] uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="h-14" />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const row = rowByDate.get(dateStr);
          const hasData = !!row && row.has_observation;
          const hasGw = !!row?.has_current_gowild_availability;
          const seats = row?.available_seats_now ?? 0;
          const delta = row?.seat_change ?? 0;

          let bg = "#F8FAFA";
          let textColor = "#9CA3AF";
          if (hasData && hasGw) {
            bg = "#ECFDF5";
            textColor = "#065F46";
          } else if (hasData && !hasGw) {
            bg = "#FEF2F2";
            textColor = "#991B1B";
          }

          return (
            <button
              key={i}
              type="button"
              disabled={!hasData}
              onClick={() => setOpenDate(dateStr)}
              className="h-14 rounded-lg flex flex-col items-center justify-center transition-transform disabled:opacity-60 disabled:cursor-default active:scale-95"
              style={{ background: bg }}
            >
              <span className="text-[11px] font-bold" style={{ color: textColor }}>{d}</span>
              {hasData && (
                <>
                  <span className="text-[11px] font-bold leading-none" style={{ color: textColor }}>
                    {seats}
                  </span>
                  {delta !== 0 && (
                    <span
                      className="text-[9px] leading-none font-semibold mt-0.5"
                      style={{ color: delta > 0 ? "#059669" : "#DC2626" }}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {loading && <div className="text-xs text-[#9CA3AF]">Loading…</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-[#6B7280] font-medium">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: "#ECFDF5" }} />
          GoWild available
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: "#FEF2F2" }} />
          No GoWild seats
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: "#F8FAFA" }} />
          Not observed
        </div>
      </div>

      {/* Day details bottom sheet */}
      <BottomSheet open={!!openDate} onClose={() => setOpenDate(null)} style={{ top: "20%" }}>
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-[#F0F1F1]">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#059669]">
              {selectedRoute?.origin} → {selectedRoute?.destination}
            </div>
            <div className="text-base font-bold text-[#2E4A4A]">
              {openDate ? formatDateLabel(openDate) : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenDate(null)}
            className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:bg-black/5"
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={22} color="currentColor" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {dayLoading && <div className="text-xs text-[#9CA3AF]">Loading itineraries…</div>}
          {dayError && <div className="text-xs text-red-500">{dayError}</div>}
          {!dayLoading && !dayError && dayDetails.length === 0 && (
            <div className="text-xs text-[#9CA3AF]">No observations for this day.</div>
          )}
          <div className="flex flex-col gap-2">
            {dayDetails.map((d) => {
              const disappeared = d.latest_availability_status === "not_returned";
              const noFare = d.latest_availability_status === "no_gowild_fare";
              return (
                <div
                  key={d.stable_itinerary_key}
                  className="rounded-xl p-3 flex flex-col gap-1.5"
                  style={{
                    background: disappeared ? "#FEF2F2" : noFare ? "#F8FAFA" : "#F0FDF4",
                    border: `1px solid ${disappeared ? "#FECACA" : noFare ? "#E5E7EB" : "#A7F3D0"}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[#2E4A4A]">
                      {d.airline ?? "—"} {d.flight_number ?? ""}{" "}
                      <span className="text-xs font-medium text-[#6B7280]">
                        {(d.stops ?? 0) === 0 ? "Nonstop" : `${d.stops} stop${(d.stops ?? 0) > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#2E4A4A]">
                      {formatTime(d.departure_at)} → {formatTime(d.arrival_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {disappeared ? (
                      <span className="font-semibold text-red-700">
                        Disappeared (last seen {d.first_seats} seats)
                      </span>
                    ) : noFare ? (
                      <span className="font-semibold text-[#6B7280]">No GoWild fare currently</span>
                    ) : (
                      <>
                        <span className="font-semibold text-emerald-700">
                          {d.first_seats} → {d.current_seats} seats
                        </span>
                        {d.seat_change !== 0 && (
                          <span
                            className="font-semibold"
                            style={{ color: d.seat_change > 0 ? "#059669" : "#DC2626" }}
                          >
                            {d.seat_change > 0 ? `+${d.seat_change}` : d.seat_change}
                          </span>
                        )}
                        {d.current_gowild_fare != null && (
                          <span className="text-[#6B7280]">
                            ${d.current_gowild_fare.toFixed(0)} GW
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
