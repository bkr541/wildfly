import { useMemo } from "react";
import { AnalyticsUpIcon, AnalyticsDownIcon, Location01Icon } from "@hugeicons/core-free-icons";
import SeatAvailabilityCard from "./SeatAvailabilityCard";
import { computeSeatAnalytics, type SeatAnalytics } from "./seatHelpers";
import { type FlightSnapshot } from "./airportHelpers";
import { type AirportDict } from "@/hooks/useAirportDictionary";

interface Props {
  snapshots: FlightSnapshot[];
  airportDict?: AirportDict;
}

const SeatAvailabilityIntelligence = ({ snapshots, airportDict }: Props) => {
  const analytics: SeatAnalytics = useMemo(() => computeSeatAnalytics(snapshots), [snapshots]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SeatAvailabilityCard
        title="Most Seats Available"
        subtitle="Routes with highest avg GoWild seats"
        icon={AnalyticsUpIcon}
        variant="most-seats"
        rows={analytics.routesWithMostSeats}
      />
      <SeatAvailabilityCard
        title="Lowest Seat Availability"
        subtitle="Routes with fewest avg GoWild seats"
        icon={AnalyticsDownIcon}
        variant="lowest-seats"
        rows={analytics.routesWithLowestSeats}
      />
      <SeatAvailabilityCard
        title="GoWild Seats Available"
        subtitle="Avg GoWild seats by departure airport"
        icon={Location01Icon}
        variant="airport-average"
        rows={analytics.airportAverages}
        airportDict={airportDict}
      />
    </div>
  );
};

export default SeatAvailabilityIntelligence;
