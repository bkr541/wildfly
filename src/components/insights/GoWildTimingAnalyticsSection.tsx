import { useMemo } from "react";
import { Calendar01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import {
  groupLegsIntoItineraries,
  getDayOfWeekItineraryStats,
  getTimeWindowItineraryStats,
} from "./itineraryHelpers";
import { getFilteredSnapshots, type AirportInsightsProps } from "./airportHelpers";
import RankedInsightCard from "./RankedInsightCard";

const GoWildTimingAnalyticsSection = ({ snapshots, dateRange }: AirportInsightsProps) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);
  const itineraries = useMemo(() => groupLegsIntoItineraries(filtered as any), [filtered]);
  const dayStats = useMemo(() => getDayOfWeekItineraryStats(itineraries), [itineraries]);
  const timeStats = useMemo(() => getTimeWindowItineraryStats(itineraries), [itineraries]);

  const bestDays = useMemo(
    () => [...dayStats.rows].sort((a, b) => b.goWildRate - a.goWildRate),
    [dayStats]
  );
  const worstDays = useMemo(
    () => [...dayStats.rows].sort((a, b) => a.goWildRate - b.goWildRate),
    [dayStats]
  );
  const bestTimes = useMemo(
    () => [...timeStats.rows].sort((a, b) => b.goWildRate - a.goWildRate).slice(0, 5),
    [timeStats]
  );
  const worstTimes = useMemo(
    () => [...timeStats.rows].sort((a, b) => a.goWildRate - b.goWildRate).slice(0, 5),
    [timeStats]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <RankedInsightCard
        title="Best Days of Week"
        subtitle="Highest GoWild itinerary rate in the selected period"
        icon={Calendar01Icon}
        rows={bestDays}
        limited={dayStats.limited}
        emptyMessage="Not enough day-of-week itinerary data yet."
      />
      <RankedInsightCard
        title="Worst Days of Week"
        subtitle="Lowest GoWild itinerary rate in the selected period"
        icon={Calendar01Icon}
        rows={worstDays}
        limited={dayStats.limited}
        emptyMessage="Not enough day-of-week itinerary data yet."
      />
      <RankedInsightCard
        title="Best Departure Window"
        subtitle="Highest GoWild itinerary rate by 2-hour window"
        icon={Clock01Icon}
        rows={bestTimes}
        limited={timeStats.limited}
        emptyMessage="Not enough departure time itinerary data yet."
      />
      <RankedInsightCard
        title="Worst Departure Window"
        subtitle="Lowest GoWild itinerary rate by 2-hour window"
        icon={Clock01Icon}
        rows={worstTimes}
        limited={timeStats.limited}
        emptyMessage="Not enough departure time itinerary data yet."
      />
    </div>
  );
};

export default GoWildTimingAnalyticsSection;
