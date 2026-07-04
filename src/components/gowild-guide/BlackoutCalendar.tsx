import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import {
  BLACKOUT_PERIODS,
  getBlackoutDatesForMonth,
  getBlackoutPeriodsForYear,
  getBlackoutYears,
  getNextBlackoutPeriod,
  isBlackoutDate,
} from "@/utils/blackoutDates";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
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

interface Props {
  id?: string;
}

export function BlackoutCalendar({ id }: Props) {
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const years = useMemo(() => getBlackoutYears(), []);
  const initialYear = years.includes(nowYear) ? nowYear : (years[0] ?? nowYear);
  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialYear === nowYear ? nowMonth : 0);

  const today = todayYmdUtc();
  const blackoutDays = useMemo(() => new Set(getBlackoutDatesForMonth(year, month)), [year, month]);
  const periodsThisYear = useMemo(() => getBlackoutPeriodsForYear(year), [year]);
  const nextPeriod = useMemo(() => getNextBlackoutPeriod(today), [today]);

  // Build a grid of cells (including leading/trailing blanks).
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ d: number | null; date?: string }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ d: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, date: ymd(year, month, d) });

  const prevMonth = () => {
    if (month === 0) {
      const idx = years.indexOf(year);
      if (idx > 0) {
        setYear(years[idx - 1]);
        setMonth(11);
      }
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      const idx = years.indexOf(year);
      if (idx >= 0 && idx < years.length - 1) {
        setYear(years[idx + 1]);
        setMonth(0);
      }
    } else setMonth(month + 1);
  };

  return (
    <div className="space-y-3" id={id}>
      {/* Year selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {years.map((y) => {
          const sel = y === year;
          return (
            <button
              key={y}
              type="button"
              onClick={() => {
                setYear(y);
                setMonth(0);
              }}
              className={[
                "px-3 min-h-[36px] rounded-full text-xs font-bold border transition-all",
                sel
                  ? "bg-[#059669] text-white border-[#059669]"
                  : "bg-white text-[#2E4A4A] border-[#E8EBEB] hover:border-[#10B981]",
              ].join(" ")}
              aria-pressed={sel}
            >
              {y}
            </button>
          );
        })}
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-[#E8EBEB] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="h-9 w-9 rounded-full border border-[#E8EBEB] flex items-center justify-center hover:border-[#10B981]"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="#1A2E2E" strokeWidth={2} />
          </button>
          <div className="text-sm font-bold text-[#1A2E2E]">
            {MONTHS[month]} {year}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next month"
            className="h-9 w-9 rounded-full border border-[#E8EBEB] flex items-center justify-center hover:border-[#10B981]"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="#1A2E2E" strokeWidth={2} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`${MONTHS[month]} ${year} blackout calendar`}>
          {cells.map((cell, i) => {
            if (cell.d === null) return <div key={`b-${i}`} />;
            const isBlack = blackoutDays.has(cell.date!);
            const isToday = cell.date === today;
            const dateObj = new Date(`${cell.date}T00:00:00Z`);
            const label = `${dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}, ${
              isBlack ? "GoWild blackout date" : "pass-eligible date"
            }`;
            return (
              <div
                key={cell.date}
                role="gridcell"
                aria-label={label}
                className={[
                  "aspect-square min-h-[40px] flex items-center justify-center text-sm relative",
                ].join(" ")}
              >
                <div
                  aria-hidden="true"
                  className={[
                    "h-9 w-9 flex items-center justify-center rounded-full font-semibold",
                    isToday
                      ? "bg-[#3B82F6] text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)]"
                      : isBlack
                        ? "bg-[#111827] text-white"
                        : "text-[#2E4A4A]",
                  ].join(" ")}
                >
                  {cell.d}
                </div>
                {isBlack && !isToday && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 text-[8px] font-bold uppercase tracking-wider text-[#111827]"
                  >
                    ✕
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-[#6B7B7B] flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#111827]" aria-hidden /> Blackout
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#3B82F6]" aria-hidden /> Today
          </span>
        </div>
      </div>

      {/* Next blackout */}
      {nextPeriod && (
        <div className="rounded-xl border border-[#E8EBEB] bg-[#F0FDF4] p-3 text-xs text-[#1A2E2E]">
          <span className="font-bold text-[#059669] uppercase tracking-wider">Next blackout:</span>{" "}
          {nextPeriod.start === nextPeriod.end ? nextPeriod.start : `${nextPeriod.start} → ${nextPeriod.end}`}
          {" "}— {nextPeriod.description}
        </div>
      )}

      {/* Accessible text list of blackouts for the displayed year */}
      <details className="rounded-xl border border-[#E8EBEB] bg-white">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-[#2E4A4A]">
          View all {year} blackout periods ({periodsThisYear.length})
        </summary>
        <ul className="px-4 pb-3 text-xs text-[#2E4A4A] space-y-1">
          {periodsThisYear.map((p) => (
            <li key={`${p.start}-${p.end}`}>
              <span className="font-semibold">
                {p.start === p.end ? p.start : `${p.start} → ${p.end}`}
              </span>{" "}
              — {p.description}
            </li>
          ))}
        </ul>
      </details>

      <p className="text-[11px] text-[#6B7B7B] leading-snug">
        A blackout date normally means standard GoWild redemption is restricted. It is not a
        standard fixed blackout-date fee. Frontier may occasionally run a separate promotion
        that offers select travel dates at a higher promotional or early-booking price.
        Travel beginning on an eligible date may sometimes continue into a blackout date when
        the first itinerary segment departs on the eligible date. Frontier's current terms control.
      </p>

      {/* Sanity check: ensures BLACKOUT_PERIODS is the only data source. */}
      <span hidden>{BLACKOUT_PERIODS.length} periods loaded · {isBlackoutDate(today) ? "today blackout" : "today eligible"}</span>
    </div>
  );
}

export default BlackoutCalendar;
