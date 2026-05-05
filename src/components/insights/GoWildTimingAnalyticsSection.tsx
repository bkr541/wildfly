import { useMemo } from "react";
import { Calendar01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { getDayOfWeekStats, getTimeWindowStats } from "./timingHelpers";
import { getFilteredSnapshots, type AirportInsightsProps } from "./airportHelpers";
import RankedInsightCard from "./RankedInsightCard";

const GoWildTimingAnalyticsSection = ({ snapshots, dateRange }: AirportInsightsProps) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);
  const dayStats = useMemo(() => getDayOfWeekStats(filtered), [filtered]);
  const timeStats = useMemo(() => getTimeWindowStats(filtered), [filtered]);

  const bestDays = useMemo(() => [...dayStats].sort((a, b) => b.percentage - a.percentage), [dayStats]);
  const worstDays = useMemo(() => [...dayStats].sort((a, b) => a.percentage - b.percentage), [dayStats]);
  const bestTimes = useMemo(() => [...timeStats].sort((a, b) => b.percentage - a.percentage), [timeStats]);
  const worstTimes = useMemo(() => [...timeStats].sort((a, b) => a.percentage - b.percentage), [timeStats]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <RankedInsightCard
        title="Best Days of Week"
        subtitle="Highest GoWild success rate"
        icon={Calendar01Icon}
        rows={bestDays}
        emptyMessage="Not enough day-of-week data yet."
      />
      <RankedInsightCard
        title="Worst Days of Week"
        subtitle="Lowest GoWild success rate"
        icon={Calendar01Icon}
        iconBg="#FEE2E2"
        iconColor="#EF4444"
        rows={worstDays}
        emptyMessage="Not enough day-of-week data yet."
      />
      <RankedInsightCard
        title="Best Departure Time Windows"
        subtitle="Highest GoWild departure success"
        icon={Clock01Icon}
        rows={bestTimes}
        emptyMessage="Not enough departure time data yet."
      />
      <RankedInsightCard
        title="Worst Departure Time Windows"
        subtitle="Lowest GoWild departure success"
        icon={Clock01Icon}
        iconBg="#FEE2E2"
        iconColor="#EF4444"
        rows={worstTimes}
        emptyMessage="Not enough departure time data yet."
      />
    </div>
  );
};

export default GoWildTimingAnalyticsSection;
