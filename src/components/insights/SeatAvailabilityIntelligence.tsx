import { useMemo } from "react";
import { AnalyticsUpIcon, AnalyticsDownIcon, Location01Icon } from "@hugeicons/core-free-icons";
import SeatAvailabilityCard from "./SeatAvailabilityCard";
import { computeSeatAnalytics, type SeatAnalytics } from "./seatHelpers";
import { type FlightSnapshot } from "./airportHelpers";

interface Props {
  snapshots: FlightSnapshot[];
}

const SeatAvailabilityIntelligence = ({ snapshots }: Props) => {
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
        title="Airport Seat Averages"
        subtitle="Avg GoWild seats by departure airport"
        icon={Location01Icon}
        variant="airport-average"
        rows={analytics.airportAverages}
      />
    </div>
  );
};

export default SeatAvailabilityIntelligence;
