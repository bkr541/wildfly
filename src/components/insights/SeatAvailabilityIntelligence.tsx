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
        subtitle="Routes with highest avg GoWild itinerary seats in the selected period"
        icon={AnalyticsUpIcon}
        variant="most-seats"
        rows={most.stats}
        limited={most.limited}
      />
      <SeatAvailabilityCard
        title="Lowest Seat Availability"
        subtitle="Routes with fewest avg GoWild itinerary seats in the selected period"
        icon={AnalyticsDownIcon}
        variant="lowest-seats"
        rows={lowest.stats}
        limited={lowest.limited}
      />
      <SeatAvailabilityCard
        title="GoWild Seats Available"
        subtitle="Avg GoWild itinerary seats by departure airport"
        icon={Location01Icon}
        variant="airport-average"
        rows={airportStats}
        airportDict={airportDict}
      />
    </div>
  );
};

export default SeatAvailabilityIntelligence;
