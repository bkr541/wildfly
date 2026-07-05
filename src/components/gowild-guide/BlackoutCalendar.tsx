import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CalendarRemove02Icon } from "@hugeicons/core-free-icons";
import {
  BLACKOUT_PERIODS,
  getBlackoutDatesForMonth,
  getBlackoutPeriodsForYear,
  getNextBlackoutPeriod,
  isBlackoutDate,
} from "@/utils/blackoutDates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayYmdUtc(): string {
  const d = new Date();
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function monthKey(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function addUtcMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function parseUtcMonth(date: string): Date {
  const [year, month] = date.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, 1));
}

function getCalendarBounds() {
  const sortedPeriods = [...BLACKOUT_PERIODS].sort((a, b) => a.start.localeCompare(b.start));
  const firstPeriod = sortedPeriods[0];
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  const firstMonth = firstPeriod ? parseUtcMonth(firstPeriod.start) : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const finalMonth = lastPeriod ? parseUtcMonth(lastPeriod.end) : firstMonth;
  const latestFirstMonth = addUtcMonths(finalMonth, -1);

  return {
    firstMonth,
    latestFirstMonth: monthKey(latestFirstMonth) >= monthKey(firstMonth) ? latestFirstMonth : firstMonth,
  };
}

interface Props {
  id?: string;
}

export function BlackoutCalendar({ id }: Props) {
  const today = todayYmdUtc();
  const todayDate = useMemo(() => {
    const [year, month, day] = today.split("-").map((part) => Number.parseInt(part, 10));
    return new Date(Date.UTC(year, month - 1, day));
  }, [today]);
  const bounds = useMemo(() => getCalendarBounds(), []);
  const initialMonth = useMemo(() => {
    const currentMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1));
    if (monthKey(currentMonth) < monthKey(bounds.firstMonth)) return bounds.firstMonth;
    if (monthKey(currentMonth) > monthKey(bounds.latestFirstMonth)) return bounds.latestFirstMonth;
    return currentMonth;
  }, [bounds.firstMonth, bounds.latestFirstMonth, todayDate]);
  const [displayMonth, setDisplayMonth] = useState<Date>(initialMonth);

  const visibleYears = useMemo(() => {
    const years = new Set<number>();
    years.add(displayMonth.getUTCFullYear());
    years.add(addUtcMonths(displayMonth, 1).getUTCFullYear());
    return Array.from(years).sort((a, b) => a - b);
  }, [displayMonth]);
  const visiblePeriods = useMemo(() => {
    const periods = visibleYears.flatMap((year) => getBlackoutPeriodsForYear(year));
    return periods.filter(
      (period, index, list) =>
        list.findIndex((candidate) => candidate.start === period.start && candidate.end === period.end) === index,
    );
  }, [visibleYears]);
  const nextPeriod = useMemo(() => getNextBlackoutPeriod(today), [today]);
  const canGoPrev = monthKey(addUtcMonths(displayMonth, -1)) >= monthKey(bounds.firstMonth);
  const canGoNext = monthKey(addUtcMonths(displayMonth, 1)) <= monthKey(bounds.latestFirstMonth);

  const goToPrevMonth = () => {
    if (canGoPrev) setDisplayMonth((current) => addUtcMonths(current, -1));
  };

  const goToNextMonth = () => {
    if (canGoNext) setDisplayMonth((current) => addUtcMonths(current, 1));
  };

  const renderMonth = (monthDate: Date) => {
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const blackoutDays = new Set(getBlackoutDatesForMonth(year, month));
    const cells: Array<number | null> = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const weekendCols = new Set([0, 6]);

    return (
      <div key={`${year}-${month}`} className="px-4 pb-4 pt-3">
        <div className="flex items-center justify-between pb-2">
          <span className="text-[18px] font-bold text-[#2E4A4A]">
            {MONTHS[month]} {year}
          </span>
        </div>

        <div className="grid grid-cols-7 mb-0.5">
          {WEEKDAYS.map((day, index) => (
            <div key={`${day}-${index}`} className="flex items-center justify-center py-0.5">
              <span className={`text-[11px] font-semibold ${weekendCols.has(index) ? "text-red-400" : "text-[#9CA3AF]"}`}>
                {day}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7" role="grid" aria-label={`${MONTHS[month]} ${year} blackout calendar`}>
          {cells.map((day, index) => {
            if (!day) return <div key={`blank-${index}`} className="h-10" aria-hidden="true" />;

            const date = ymd(year, month, day);
            const isBlackout = blackoutDays.has(date);
            const isToday = date === today;
            const isWeekend = weekendCols.has(index % 7);
            const dateObj = new Date(`${date}T00:00:00Z`);
            const label = `${dateObj.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}, ${isBlackout ? "GoWild blackout date" : "pass-eligible date"}${isToday ? ", today" : ""}`;

            let textColor = "text-[#2E4A4A]";
            if (isBlackout) textColor = "text-white";
            else if (isWeekend) textColor = "text-red-500";

            return (
              <div
                key={date}
                role="gridcell"
                aria-label={label}
                className="relative flex items-center justify-center py-0.5"
              >
                <span
                  aria-hidden="true"
                  className={[
                    "relative z-10 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    !isBlackout && "hover:bg-[#F0FDF4]",
                    textColor,
                  ].filter(Boolean).join(" ")}
                  style={{
                    background: isBlackout ? "#374151" : undefined,
                    border: isToday ? "2px solid #3B82F6" : undefined,
                    boxShadow: isToday ? "0 2px 8px rgba(59,130,246,0.18)" : undefined,
                  }}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3" id={id}>
      <div className="overflow-hidden rounded-xl border border-[#E8EBEB] bg-white">
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-[#F0F1F1]">
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              <HugeiconsIcon icon={CalendarRemove02Icon} size={15} color="white" strokeWidth={2} />
            </div>
            <h3 className="text-[22px] font-medium text-[#6B7280] leading-tight">Blackout Calendar</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevMonth}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#F2F3F3] disabled:opacity-30"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              disabled={!canGoNext}
              aria-label="Next month"
              className="h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#F2F3F3] disabled:opacity-30"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[#F0F1F1] flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: "#374151" }}>8</span>
            <span className="text-xs text-[#6B7280] font-medium">Blackout</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-6 w-6 rounded-full flex items-center justify-center text-[#2E4A4A] text-[11px] font-semibold" style={{ border: "2px solid #3B82F6" }}>8</span>
            <span className="text-xs text-[#6B7280] font-medium">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: "linear-gradient(135deg, #059669 0%, #10B981 100%)" }}>8</span>
            <span className="text-xs text-[#6B7280] font-medium">Selected</span>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          {[displayMonth, addUtcMonths(displayMonth, 1)].map(renderMonth)}
        </div>
      </div>

      {nextPeriod && (
        <div className="rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] p-3 text-xs text-[#1A2E2E]">
          <span className="font-bold text-[#059669] uppercase tracking-wider">Next blackout:</span>{" "}
          {nextPeriod.start === nextPeriod.end ? nextPeriod.start : `${nextPeriod.start} → ${nextPeriod.end}`}
          {" "}— {nextPeriod.description}
        </div>
      )}

      <details className="rounded-xl border border-[#E8EBEB] bg-white">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-[#2E4A4A]">
          View blackout periods for {visibleYears.join(" / ")} ({visiblePeriods.length})
        </summary>
        <ul className="px-4 pb-3 text-xs text-[#2E4A4A] space-y-1">
          {visiblePeriods.map((period) => (
            <li key={`${period.start}-${period.end}`}>
              <span className="font-semibold">
                {period.start === period.end ? period.start : `${period.start} → ${period.end}`}
              </span>{" "}
              — {period.description}
            </li>
          ))}
        </ul>
      </details>

      <p className="text-[11px] text-[#6B7B7B] leading-snug">
        A blackout date normally means standard GoWild redemption is restricted. It is not a
        standard fixed blackout-date fee. Frontier may occasionally run a separate promotion
        that offers select travel dates at a higher promotional or early-booking price.
        Travel beginning on an eligible date may sometimes continue into a blackout date when
        the first itinerary segment departs on the eligible date. Frontier&apos;s current terms control.
      </p>

      <span hidden>{BLACKOUT_PERIODS.length} periods loaded · {isBlackoutDate(today) ? "today blackout" : "today eligible"}</span>
    </div>
  );
}

export default BlackoutCalendar;
