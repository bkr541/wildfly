import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirportIcon,
  Calendar01Icon,
  Clock01Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { AirportSearchSheet, type Airport as BaseAirport } from "@/components/AirportSearchSheet";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateBookingWindowOpen,
  formatCountdown,
  formatInZone,
} from "@/utils/gowildBookingWindow";
import type { TravelType } from "@/types/gowildGuide";

export interface CalculatorAirport extends BaseAirport {
  timezone?: string | null;
}

/** Today's YYYY-MM-DD in UTC (avoids browser-tz drift on input default). */
function todayUtcYmd(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  /** Optional id used by hero buttons to scroll-to. */
  id?: string;
}

/**
 * Interactive "When can I book?" tool.
 * Pulls airports including IANA timezone from Supabase.
 */
export function BookingWindowCalculator({ id }: Props) {
  const [airports, setAirports] = useState<CalculatorAirport[]>([]);
  const [origin, setOrigin] = useState<CalculatorAirport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [departureDate, setDepartureDate] = useState<string>("");
  const [departureTime, setDepartureTime] = useState<string>("06:00");
  const [travelType, setTravelType] = useState<TravelType>("domestic");
  const [now, setNow] = useState<number>(() => Date.now());
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code, timezone, location_id, locations(city, state_code, region)")
        .order("iata_code");
      if (cancelled || !data) return;
      // Normalize shape (locations may come back as array)
      const rows: CalculatorAirport[] = (data as unknown as Array<Record<string, unknown>>).map((r) => {
        const loc = Array.isArray(r.locations)
          ? (r.locations as Record<string, unknown>[])[0]
          : (r.locations as Record<string, unknown> | undefined);
        return {
          id: r.id as number,
          name: r.name as string,
          iata_code: r.iata_code as string,
          location_id: (r.location_id as number | null) ?? null,
          timezone: (r.timezone as string | null) ?? null,
          locations: loc
            ? {
                city: (loc.city as string) ?? "",
                state_code: (loc.state_code as string) ?? "",
                region: (loc.region as string) ?? "",
              }
            : null,
        };
      });
      setAirports(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const result = useMemo(() => {
    if (!departureDate) return null;
    return calculateBookingWindowOpen({
      departureDate,
      travelType,
      originTimezone: origin?.timezone ?? null,
    });
  }, [departureDate, travelType, origin]);

  const countdown = useMemo(
    () => formatCountdown(result?.opensAtIso ?? null, now),
    [result, now],
  );

  const originLocalNow = useMemo(() => {
    if (!origin?.timezone) return "";
    return formatInZone(new Date(now).toISOString(), origin.timezone, "EEE, MMM d • h:mm:ss a zzz");
  }, [origin, now]);

  const opensAtLabel = useMemo(() => {
    if (!result) return "";
    if (result.exactTimezone && result.opensAtIso && origin?.timezone) {
      return formatInZone(result.opensAtIso, origin.timezone, "EEE, MMM d, yyyy 'at' h:mm a zzz");
    }
    if (result.opensOnDate) {
      return `${result.opensOnDate} (midnight in origin local time)`;
    }
    return "";
  }, [result, origin]);

  return (
    <div className="space-y-3" id={id}>
      {/* Origin */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5">
          Origin airport
        </label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full text-left rounded-xl border border-[#E8EBEB] bg-white px-4 py-3 flex items-center gap-3 min-h-[48px] hover:border-[#10B981] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
        >
          <HugeiconsIcon icon={AirportIcon} size={20} color="#059669" strokeWidth={2} />
          {origin ? (
            <span className="text-[#1A2E2E] font-semibold text-base truncate">
              <span className="text-[#059669]">{origin.iata_code}</span>
              <span className="text-[#6B7B7B] mx-2">|</span>
              {origin.locations?.city ?? origin.name}
              {origin.locations?.state_code ? `, ${origin.locations.state_code}` : ""}
            </span>
          ) : (
            <span className="text-[#9CA3AF] text-base">Choose an airport…</span>
          )}
        </button>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="gwg-depart-date"
            className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5"
          >
            Departure date
          </label>
          <div className="app-input-container" style={{ minHeight: 48 }}>
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={Calendar01Icon} size={18} color="currentColor" strokeWidth={2} />
            </button>
            <input
              id="gwg-depart-date"
              type="date"
              className="app-input"
              value={departureDate}
              min={todayUtcYmd()}
              onChange={(e) => setDepartureDate(e.target.value)}
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="gwg-depart-time"
            className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5"
          >
            Departure time
          </label>
          <div className="app-input-container" style={{ minHeight: 48 }}>
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={Clock01Icon} size={18} color="currentColor" strokeWidth={2} />
            </button>
            <input
              id="gwg-depart-time"
              type="time"
              className="app-input"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
      </div>

      {/* Travel type */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5">
          Travel type
        </label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Travel type">
          {(["domestic", "international"] as const).map((t) => {
            const sel = travelType === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setTravelType(t)}
                className={[
                  "min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition-all",
                  sel
                    ? "bg-[#F0FDF4] border-[#059669] text-[#059669]"
                    : "bg-white border-[#E8EBEB] text-[#374151] hover:border-[#6EE7B7]",
                ].join(" ")}
              >
                {t === "domestic" ? "Domestic" : "International (10 days)"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result */}
      <div
        ref={liveRef}
        aria-live="polite"
        className="mt-2 rounded-xl border border-[#E8EBEB] bg-white p-4 space-y-2"
      >
        {!origin || !departureDate ? (
          <p className="text-sm text-[#6B7B7B]">
            Select an origin airport and a departure date to see when the booking window opens.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <HugeiconsIcon
                icon={countdown.isOpen ? CheckmarkCircle01Icon : Clock01Icon}
                size={20}
                color={countdown.isOpen ? "#059669" : "#1A2E2E"}
                strokeWidth={2}
              />
              <div className="text-sm leading-snug">
                <p className="text-[#1A2E2E] font-bold">
                  {countdown.isOpen
                    ? "Booking window should be open"
                    : result?.exactTimezone
                      ? `Opens in ${countdown.label}`
                      : "Opens at midnight in the origin airport's local timezone"}
                </p>
                {opensAtLabel && (
                  <p className="text-[#2E4A4A] text-xs mt-0.5">{opensAtLabel}</p>
                )}
                {origin.timezone ? (
                  <p className="text-[#6B7B7B] text-xs mt-0.5">
                    Origin timezone: {origin.timezone} • {originLocalNow}
                  </p>
                ) : (
                  <p className="text-[#9CA3AF] text-xs mt-0.5">
                    This airport has no stored IANA timezone, so the live countdown is unavailable.
                    The calendar-day rule still applies.
                  </p>
                )}
                {departureTime && (
                  <p className="text-[#6B7B7B] text-xs mt-0.5">
                    Departure: {departureDate} at {departureTime} (origin local)
                  </p>
                )}
              </div>
            </div>

            {result?.isBlackoutDeparture && (
              <div className="flex items-start gap-2 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] px-3 py-2">
                <HugeiconsIcon icon={AlertCircleIcon} size={18} color="#92400E" strokeWidth={2} />
                <p className="text-xs text-[#92400E] leading-snug">
                  The selected departure date is a published blackout date. Standard GoWild
                  redemption is normally restricted. Promotional pricing may still appear.
                </p>
              </div>
            )}

            <p className="text-[11px] text-[#9CA3AF] leading-snug">
              GoWild seats are limited and not guaranteed. The window opening only describes
              when fares may appear, not whether seats will be available.
            </p>
          </>
        )}
      </div>

      <ul className="text-xs text-[#6B7B7B] list-disc pl-5 space-y-1">
        <li>Flights at 6:00 AM and 11:00 PM the next day both open at midnight that calendar day (domestic).</li>
        <li>A return flight may not open at the same time as the outbound flight.</li>
        <li>For a connecting itinerary, the first segment's departure date controls the date.</li>
      </ul>

      <AirportSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        airports={airports}
        onSelect={(a) => setOrigin(a as CalculatorAirport)}
      />
    </div>
  );
}

export default BookingWindowCalculator;
