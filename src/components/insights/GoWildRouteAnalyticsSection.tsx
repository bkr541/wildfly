import { useMemo } from "react";
import { computeRouteAnalytics } from "./routeHelpers";
import { getFilteredSnapshots } from "./airportHelpers";
import type { AirportInsightsProps } from "./airportHelpers";
import TopRoutesCard from "./TopRoutesCard";
import WorstRoutesCard from "./WorstRoutesCard";
import MostReliableRouteCard from "./MostReliableRouteCard";

const GoWildRouteAnalyticsSection = ({ snapshots, dateRange }: AirportInsightsProps) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);
  const analytics = useMemo(() => computeRouteAnalytics(filtered), [filtered]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TopRoutesCard routes={analytics.topRoutes} />
      <WorstRoutesCard routes={analytics.worstRoutes} />
      <MostReliableRouteCard data={analytics.mostReliableRoute} />
    </div>
  );
};

export default GoWildRouteAnalyticsSection;
