import { useMemo } from "react";
import { AnalyticsUpIcon, AnalyticsDownIcon, Location01Icon } from "@hugeicons/core-free-icons";
import SeatAvailabilityCard from "./SeatAvailabilityCard";
import { computeSeatAnalytics } from "./seatHelpers";
import { groupIntoItineraries } from "./itineraryHelpers";
import type { Itinerary, RawSnapshotRow } from "./insightTypes";
import { type AirportDict } from "@/hooks/useAirportDictionary";

interface Props {
  itineraries?: Itinerary[];
  snapshots?: any[];
  airportDict?: AirportDict;
}

const SeatAvailabilityIntelligence = ({ itineraries, snapshots, airportDict }: Props) => {
  const its = useMemo(
    () => itineraries ?? groupIntoItineraries((snapshots ?? []) as RawSnapshotRow[]),
    [itineraries, snapshots]
  );
  const analytics = useMemo(() => computeSeatAnalytics(its), [its]);

  return (
    <>
      {analytics.meta.limitedData && (
        <p className="text-[11px] text-amber-700 px-1">
          Limited data — fewer than 5 routes have ≥{analytics.meta.threshold} GoWild itineraries.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SeatAvailabilityCard
          title="Most Seats Available"
          subtitle="Routes with highest avg GoWild seats (min across legs)"
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
          title="GoWild Seats by Origin"
          subtitle="Avg GoWild itinerary seats by origin airport"
          icon={Location01Icon}
          variant="airport-average"
          rows={analytics.airportAverages}
          airportDict={airportDict}
        />
      </div>
    </>
  );
};

export default SeatAvailabilityIntelligence;
