import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CalendarCheckOut02Icon,
  CalendarCheckIn02Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";
import { format, startOfDay, getYear, getMonth, getDaysInMonth } from "date-fns";
import { isBlackoutDate } from "@/utils/blackoutDates";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function DatePickerSheet({
  open,
  onClose,
  label,
  selected,
  onSelect,
  minDate,
  departureDate,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  selected?: Date;
  onSelect: (date: Date) => void;
  minDate?: Date;
  departureDate?: Date;
}) {
  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(minDate) : today;

  const [calDate, setCalDate] = useState<Date | null>(selected ?? null);

  const initialBase = selected ?? today;
  const [selMonth, setSelMonth] = useState(getMonth(initialBase));
  const [selYear, setSelYear] = useState(getYear(initialBase));

  useEffect(() => {
    if (open) {
      const base = selected ?? null;
      setCalDate(base);
      const navBase = selected ?? today;
      setSelMonth(getMonth(navBase));
      setSelYear(getYear(navBase));
    }
  }, [open]);

  const handleCalendarSelect = (date: Date) => {
    setCalDate(date);
    setSelMonth(getMonth(date));
    setSelYear(getYear(date));
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleConfirm = () => {
    if (!calDate) return;
    onSelect(calDate);
    onClose();
  };

  const goToPrevMonth = () => {
    const prev = new Date(selYear, selMonth - 1, 1);
    if (prev >= new Date(min.getFullYear(), min.getMonth(), 1)) {
      setSelMonth(getMonth(prev));
      setSelYear(getYear(prev));
    }
  };
  const goToNextMonth = () => {
    const next = new Date(selYear, selMonth + 1, 1);
    setSelMonth(getMonth(next));
    setSelYear(getYear(next));
  };

  const canGoPrev = new Date(selYear, selMonth - 1, 1) >= new Date(min.getFullYear(), min.getMonth(), 1);

  const monthsToShow = [
    { month: selMonth, year: selYear },
    { month: (selMonth + 1) % 12, year: selMonth === 11 ? selYear + 1 : selYear },
  ];

  const isReturnPicker = label === "Return Date" && !!departureDate;
  const depDay = departureDate ? startOfDay(departureDate) : null;

  const renderMonth = (monthIdx: number, year: number) => {
    const firstDay = new Date(year, monthIdx, 1);
    const startDow = firstDay.getDay();
    const daysCount = getDaysInMonth(firstDay);
    const cells: (number | null)[] = [
      ...Array(startDow).fill(null),
      ...Array.from({ length: daysCount }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const weekendCols = new Set([0, 6]);

    return (
      <div key={`${year}-${monthIdx}`} className="px-4 pb-1">
        <div className="flex items-center justify-between pt-3 pb-2">
          <span className="text-[18px] font-bold text-[#2E4A4A]">
            {MONTHS[monthIdx]} {year}
          </span>
        </div>

        <div className="grid grid-cols-7 mb-0.5">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
            <div key={d} className="flex items-center justify-center py-0.5">
              <span className={`text-[11px] font-semibold ${weekendCols.has(i) ? "text-red-400" : "text-[#9CA3AF]"}`}>{d}</span>
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              if (!day) return <div key={di} />;

              const thisDate = startOfDay(new Date(year, monthIdx, day));
              const isPast = thisDate < min;
              const isSelected = calDate &&
                thisDate.getFullYear() === calDate.getFullYear() &&
                thisDate.getMonth() === calDate.getMonth() &&
                thisDate.getDate() === calDate.getDate();
              const isDeparture = depDay && thisDate.getTime() === depDay.getTime();
              const isInRange = isReturnPicker && depDay && calDate &&
                thisDate > depDay && thisDate < calDate;
              const isRangeStart = isDeparture && isReturnPicker && calDate && depDay && calDate > depDay;
              const isRangeEnd = isSelected && isReturnPicker && depDay && calDate && calDate > depDay;
              const isToday = thisDate.getTime() === today.getTime();
              const isBlackout = isBlackoutDate(format(thisDate, "yyyy-MM-dd"));
              const isWeekend = weekendCols.has(di);

              const rangeLeft = (isInRange || isRangeEnd) && di !== 0;
              const rangeRight = (isInRange || isRangeStart) && di !== 6;

              let textColor = "text-[#2E4A4A]";
              if (isPast) textColor = "text-[#C4C9C9]";
              else if (isSelected || isDeparture) textColor = "text-white";
              else if (isBlackout) textColor = "text-white";
              else if (isToday) textColor = "text-white";
              else if (isInRange) textColor = "text-[#059669]";
              else if (isWeekend) textColor = "text-red-500";

              let buttonStyle: React.CSSProperties | undefined;
              if (isSelected || isDeparture) {
                buttonStyle = {
                  background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                  border: "none",
                  boxShadow: "0 2px 8px rgba(16,185,129,0.35)",
                };
              } else if (isBlackout) {
                buttonStyle = { background: isToday ? "#3B82F6" : "#374151" };
              } else if (isToday) {
                buttonStyle = { background: "#3B82F6" };
              }

              return (
                <div key={di} className="relative flex items-center justify-center py-0.5">
                  {rangeLeft && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-9" style={{ background: "#D1FAE5" }} />
                  )}
                  {rangeRight && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-9" style={{ background: "#D1FAE5" }} />
                  )}
                  <button
                    type="button"
                    disabled={isPast}
                    onClick={() => !isPast && handleCalendarSelect(thisDate)}
                    className={cn(
                      "relative z-10 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                      isPast && "cursor-default",
                      !isPast && !isSelected && !isDeparture && !isBlackout && "hover:bg-[#F0FDF4]",
                      textColor,
                    )}
                    style={buttonStyle}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const isReturnLabel = label === "Return Date";

  return (
    <BottomSheet open={open} onClose={onClose} style={{ top: "5%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <HugeiconsIcon icon={isReturnLabel ? CalendarCheckIn02Icon : CalendarCheckOut02Icon} size={15} color="white" strokeWidth={2} />
          </div>
          <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">{label}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevMonth}
            disabled={!canGoPrev}
            className="h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#F2F3F3] disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="h-9 w-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#F2F3F3]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={22} color="currentColor" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[#F0F1F1]">
        <div className="flex items-center gap-1.5">
          <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: "#374151" }}>8</span>
          <span className="text-xs text-[#6B7280] font-medium">Blackout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: "linear-gradient(135deg, #059669 0%, #10B981 100%)" }}>8</span>
          <span className="text-xs text-[#6B7280] font-medium">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-6 w-6 rounded-full flex items-center justify-center text-[#2E4A4A] text-[11px] font-semibold" style={{ border: "2px solid #3B82F6" }}>8</span>
          <span className="text-xs text-[#6B7280] font-medium">Today</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {monthsToShow.map(({ month, year }) => renderMonth(month, year))}
        <div className="h-4" />
      </div>

      {/* Confirm button */}
      <div className="px-5 py-4 border-t border-[#F0F1F1] bg-white">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!calDate}
          className="w-full h-12 rounded-full text-white text-sm font-black uppercase tracking-[0.45em] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
        >
          <HugeiconsIcon icon={isReturnLabel ? CalendarCheckIn02Icon : CalendarCheckOut02Icon} size={20} color="white" strokeWidth={2} />
          {calDate ? format(calDate, "MMM d, yyyy") : "Select Date"}
        </button>
      </div>
    </BottomSheet>
  );
}
