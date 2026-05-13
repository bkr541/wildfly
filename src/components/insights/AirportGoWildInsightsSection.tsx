import { useMemo } from "react";
import {
  getOriginAirportStatsFromItineraries,
  getDestinationAirportStatsFromItineraries,
} from "./airportHelpers";
import { groupIntoItineraries } from "./itineraryHelpers";
import type { Itinerary, RawSnapshotRow } from "./insightTypes";
import TopOriginAirportsCard from "./TopOriginAirportsCard";
import TopDestinationAirportsCard from "./TopDestinationAirportsCard";
import AirportAvailabilityHeatmapCard from "./AirportAvailabilityHeatmapCard";
import { type AirportDict } from "@/hooks/useAirportDictionary";

type Props = {
  itineraries?: Itinerary[];
  snapshots?: any[];
  airportDict?: AirportDict;
};

const AirportGoWildInsightsSection = ({ itineraries, snapshots, airportDict }: Props) => {
  const its = useMemo(
    () => itineraries ?? groupIntoItineraries((snapshots ?? []) as RawSnapshotRow[]),
    [itineraries, snapshots]
  );
  const origins = useMemo(() => getOriginAirportStatsFromItineraries(its), [its]);
  const destinations = useMemo(() => getDestinationAirportStatsFromItineraries(its), [its]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopOriginAirportsCard result={origins} airportDict={airportDict} />
        <TopDestinationAirportsCard result={destinations} airportDict={airportDict} />
      </div>
      {snapshots && snapshots.length > 0 && (
        <AirportAvailabilityHeatmapCard snapshots={snapshots as any} />
      )}
    </div>
  );
};

export default AirportGoWildInsightsSection;
