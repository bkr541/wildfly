import { useMemo } from "react";
import { computeRouteAnalytics } from "./routeHelpers";
import { getFilteredSnapshots } from "./airportHelpers";
import type { AirportInsightsProps } from "./airportHelpers";
import { type AirportDict } from "@/hooks/useAirportDictionary";
import TopRoutesCard from "./TopRoutesCard";
import WorstRoutesCard from "./WorstRoutesCard";
import MostReliableRouteCard from "./MostReliableRouteCard";

type Props = AirportInsightsProps & { airportDict?: AirportDict };

const GoWildRouteAnalyticsSection = ({ snapshots, dateRange, airportDict }: Props) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);
  const analytics = useMemo(() => computeRouteAnalytics(filtered), [filtered]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TopRoutesCard routes={analytics.topRoutes} />
      <WorstRoutesCard routes={analytics.worstRoutes} />
      <MostReliableRouteCard data={analytics.mostReliableRoute} airportDict={airportDict} />
    </div>
  );
};

export default GoWildRouteAnalyticsSection;
