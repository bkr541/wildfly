import { useMemo } from "react";
import { Calendar01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { getDayOfWeekStats, getTimeWindowStats } from "./timingHelpers";
import { groupIntoItineraries } from "./itineraryHelpers";
import type { Itinerary, RawSnapshotRow } from "./insightTypes";
import RankedInsightCard from "./RankedInsightCard";

type Props = {
  itineraries?: Itinerary[];
  snapshots?: any[];
};

const GoWildTimingAnalyticsSection = ({ itineraries, snapshots }: Props) => {
  const its = useMemo(
    () => itineraries ?? groupIntoItineraries((snapshots ?? []) as RawSnapshotRow[]),
    [itineraries, snapshots]
  );
  const dayStats = useMemo(() => getDayOfWeekStats(its), [its]);
  const timeStats = useMemo(() => getTimeWindowStats(its), [its]);

  const bestDays = useMemo(
    () => ({ ...dayStats, rows: [...dayStats.rows].sort((a, b) => b.percentage - a.percentage) }),
    [dayStats]
  );
  const worstDays = useMemo(
    () => ({ ...dayStats, rows: [...dayStats.rows].sort((a, b) => a.percentage - b.percentage) }),
    [dayStats]
  );
  const bestTimes = useMemo(
    () => ({ ...timeStats, rows: [...timeStats.rows].sort((a, b) => b.percentage - a.percentage).slice(0, 5) }),
    [timeStats]
  );
  const worstTimes = useMemo(
    () => ({ ...timeStats, rows: [...timeStats.rows].sort((a, b) => a.percentage - b.percentage).slice(0, 5) }),
    [timeStats]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <RankedInsightCard title="Best Days of Week" subtitle="Highest GoWild itinerary rate"
        icon={Calendar01Icon} result={bestDays} emptyMessage="Not enough day-of-week data yet." />
      <RankedInsightCard title="Worst Days of Week" subtitle="Lowest GoWild itinerary rate"
        icon={Calendar01Icon} result={worstDays} emptyMessage="Not enough day-of-week data yet." />
      <RankedInsightCard title="Best Departure Window" subtitle="Highest GoWild itinerary rate"
        icon={Clock01Icon} result={bestTimes} emptyMessage="Not enough departure time data yet." />
      <RankedInsightCard title="Worst Departure Window" subtitle="Lowest GoWild itinerary rate"
        icon={Clock01Icon} result={worstTimes} emptyMessage="Not enough departure time data yet." />
    </div>
  );
};

export default GoWildTimingAnalyticsSection;
