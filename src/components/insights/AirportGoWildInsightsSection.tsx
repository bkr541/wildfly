import { getFilteredSnapshots, type AirportInsightsProps } from "./airportHelpers";
import TopOriginAirportsCard from "./TopOriginAirportsCard";
import TopDestinationAirportsCard from "./TopDestinationAirportsCard";
import AirportAvailabilityHeatmapCard from "./AirportAvailabilityHeatmapCard";
import { type AirportDict } from "@/hooks/useAirportDictionary";

type Props = AirportInsightsProps & { airportDict?: AirportDict };

const AirportGoWildInsightsSection = ({ snapshots, dateRange, airportDict }: Props) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopOriginAirportsCard snapshots={filtered} airportDict={airportDict} />
        <TopDestinationAirportsCard snapshots={filtered} airportDict={airportDict} />
      </div>
      <AirportAvailabilityHeatmapCard snapshots={filtered} />
    </div>
  );
};

export default AirportGoWildInsightsSection;
