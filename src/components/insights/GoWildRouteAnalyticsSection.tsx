import { useMemo } from "react";
import { computeRouteAnalytics } from "./routeHelpers";
import {
  groupLegsIntoItineraries,
  getTopItineraryRoutes,
  getWorstItineraryRoutes,
  getMostFrequentGoWildItineraryRoute,
} from "./itineraryHelpers";
import { getFilteredSnapshots } from "./airportHelpers";
import type { AirportInsightsProps } from "./airportHelpers";
import { type AirportDict } from "@/hooks/useAirportDictionary";
import TopRoutesCard from "./TopRoutesCard";
import WorstRoutesCard from "./WorstRoutesCard";
import MostReliableRouteCard from "./MostReliableRouteCard";
import MostFrequentGoWildRouteCard from "./MostFrequentGoWildRouteCard";

type Props = AirportInsightsProps & { airportDict?: AirportDict };

const GoWildRouteAnalyticsSection = ({ snapshots, dateRange, airportDict }: Props) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);
  const itineraries = useMemo(() => groupLegsIntoItineraries(filtered as any), [filtered]);
  const top = useMemo(() => getTopItineraryRoutes(itineraries), [itineraries]);
  const worst = useMemo(() => getWorstItineraryRoutes(itineraries), [itineraries]);
  const mostFrequent = useMemo(
    () => getMostFrequentGoWildItineraryRoute(itineraries),
    [itineraries]
  );
  // Reliability still uses leg-level analytics (untouched per spec).
  const legAnalytics = useMemo(() => computeRouteAnalytics(filtered), [filtered]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TopRoutesCard routes={top.routes} limited={top.limited} />
      <WorstRoutesCard routes={worst.routes} limited={worst.limited} />
      <MostFrequentGoWildRouteCard data={mostFrequent} />
      <MostReliableRouteCard data={legAnalytics.mostReliableRoute} airportDict={airportDict} />
    </div>
  );
};

export default GoWildRouteAnalyticsSection;
