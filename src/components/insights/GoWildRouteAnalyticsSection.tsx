import { useMemo } from "react";
import { computeRouteAnalytics } from "./routeHelpers";
import { type AirportDict } from "@/hooks/useAirportDictionary";
import type { Itinerary } from "./insightTypes";
import TopRoutesCard from "./TopRoutesCard";
import WorstRoutesCard from "./WorstRoutesCard";
import MostReliableRouteCard from "./MostReliableRouteCard";
import MostFrequentGoWildRouteCard from "./MostFrequentGoWildRouteCard";

type Props = {
  itineraries: Itinerary[];
  airportDict?: AirportDict;
};

const GoWildRouteAnalyticsSection = ({ itineraries, airportDict }: Props) => {
  const analytics = useMemo(() => computeRouteAnalytics(itineraries), [itineraries]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TopRoutesCard result={analytics.topRoutes} />
      <WorstRoutesCard result={analytics.worstRoutes} />
      <MostReliableRouteCard data={analytics.mostReliableRoute} airportDict={airportDict} />
      <MostFrequentGoWildRouteCard data={analytics.mostFrequentGoWildRoute} />
    </div>
  );
};

export default GoWildRouteAnalyticsSection;
