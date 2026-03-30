import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

const FlightExplorer = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  return (
    <div className="flex-1 flex flex-col relative z-10 animate-fade-in">
      {/* Calendar — top ~1/3 */}
      <div className="px-4 pt-2 pb-2">
        <div className="rounded-2xl overflow-hidden shadow-lg border border-border/30 bg-card">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            showOutsideDays
            weekStartsOn={1}
            className="!p-0 w-full explorer-calendar"
            classNames={{
              months: "w-full",
              month: "w-full",
              caption:
                "flex items-center justify-between px-4 py-2 bg-primary text-primary-foreground rounded-t-2xl",
              caption_label: "text-base font-bold tracking-wide",
              nav: "flex items-center gap-2",
              nav_button:
                "h-7 w-7 flex items-center justify-center rounded-full text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15 transition-colors",
              nav_button_previous: "",
              nav_button_next: "",
              head_row: "flex w-full bg-secondary text-secondary-foreground/70",
              head_cell:
                "flex-1 text-center text-xs font-semibold py-1.5 uppercase tracking-wider",
              table: "w-full border-collapse",
              row: "flex w-full",
              cell: "flex-1 flex items-center justify-center p-0.5",
              day: "h-full w-full flex items-center justify-center rounded-full text-sm font-medium text-card-foreground hover:bg-muted transition-colors cursor-pointer",
              day_selected:
                "!bg-primary !text-primary-foreground font-bold",
              day_today:
                "ring-2 ring-ring ring-inset font-bold",
              day_outside: "text-muted-foreground/40",
              day_disabled: "text-muted-foreground/30 cursor-not-allowed",
              day_range_middle: "",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft: () => (
                <FontAwesomeIcon icon={faChevronLeft} className="h-3.5 w-3.5" />
              ),
              IconRight: () => (
                <FontAwesomeIcon icon={faChevronRight} className="h-3.5 w-3.5" />
              ),
            }}
          />
        </div>
      </div>

      {/* Bottom section placeholder */}
      <div className="flex-1 px-5 pb-4">
        <p className="text-muted-foreground text-sm">
          Select a date to explore available flights.
        </p>
      </div>
    </div>
  );
};

export default FlightExplorer;
