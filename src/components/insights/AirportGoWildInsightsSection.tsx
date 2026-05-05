import { getFilteredSnapshots, type AirportInsightsProps } from "./airportHelpers";
import TopOriginAirportsCard from "./TopOriginAirportsCard";
import TopDestinationAirportsCard from "./TopDestinationAirportsCard";
import AirportAvailabilityHeatmapCard from "./AirportAvailabilityHeatmapCard";

const AirportGoWildInsightsSection = ({ snapshots, dateRange }: AirportInsightsProps) => {
  const filtered = getFilteredSnapshots(snapshots, dateRange);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopOriginAirportsCard snapshots={filtered} />
        <TopDestinationAirportsCard snapshots={filtered} />
      </div>
      <AirportAvailabilityHeatmapCard snapshots={filtered} />
    </div>
  );
};

export default AirportGoWildInsightsSection;
