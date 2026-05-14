import { getFilteredSnapshots, type AirportInsightsProps } from "./airportHelpers";
import TopOriginAirportsCard from "./TopOriginAirportsCard";
import TopDestinationAirportsCard from "./TopDestinationAirportsCard";
import AirportAvailabilityHeatmapCard from "./AirportAvailabilityHeatmapCard";
import { type AirportDict } from "@/hooks/useAirportDictionary";
import { groupLegsIntoItineraries } from "./itineraryHelpers";
import { useMemo } from "react";

type Props = AirportInsightsProps & { airportDict?: AirportDict };

const AirportGoWildInsightsSection = ({ snapshots, dateRange, airportDict }: Props) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);
  const itineraries = useMemo(() => groupLegsIntoItineraries(filtered as any), [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopOriginAirportsCard itineraries={itineraries} airportDict={airportDict} />
        <TopDestinationAirportsCard itineraries={itineraries} airportDict={airportDict} />
      </div>
      <AirportAvailabilityHeatmapCard snapshots={filtered} />
    </div>
  );
};

export default AirportGoWildInsightsSection;
