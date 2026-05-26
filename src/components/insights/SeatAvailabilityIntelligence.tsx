import { useMemo } from "react";
import { AnalyticsUpIcon, AnalyticsDownIcon, Location01Icon } from "@hugeicons/core-free-icons";
import SeatAvailabilityCard from "./SeatAvailabilityCard";
import {
  groupLegsIntoItineraries,
  getMostSeatsItineraryRoutes,
  getLowestSeatsItineraryRoutes,
  getSeatItineraryAirportStats,
} from "./itineraryHelpers";
import { type FlightSnapshot } from "./airportHelpers";
import { type AirportDict } from "@/hooks/useAirportDictionary";

interface Props {
  snapshots: FlightSnapshot[];
  airportDict?: AirportDict;
}

const SeatAvailabilityIntelligence = ({ snapshots, airportDict }: Props) => {
  const itineraries = useMemo(() => groupLegsIntoItineraries(snapshots as any), [snapshots]);
  const most = useMemo(() => getMostSeatsItineraryRoutes(itineraries), [itineraries]);
  const lowest = useMemo(() => getLowestSeatsItineraryRoutes(itineraries), [itineraries]);
  const airportStats = useMemo(() => getSeatItineraryAirportStats(itineraries), [itineraries]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SeatAvailabilityCard
        title="Most Seats Available"
        subtitle="Routes with highest avg GoWild seats per itinerary opportunity"
        icon={AnalyticsUpIcon}
        variant="most-seats"
        rows={most.stats}
        limited={most.limited}
      />
      <SeatAvailabilityCard
        title="Lowest Seat Availability"
        subtitle="Routes with some GoWild availability but low avg seats per itinerary"
        icon={AnalyticsDownIcon}
        variant="lowest-seats"
        rows={lowest.stats}
        limited={lowest.limited}
        emptyMessage="No routes with observed GoWild seat availability in this period."
      />
      <SeatAvailabilityCard
        title="GoWild Seats Available"
        subtitle="Avg GoWild seats per itinerary by departure airport"
        icon={Location01Icon}
        variant="airport-average"
        rows={airportStats}
        airportDict={airportDict}
      />
    </div>
  );
};

export default SeatAvailabilityIntelligence;
