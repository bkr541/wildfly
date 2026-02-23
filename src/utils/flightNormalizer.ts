// Define the shape of the raw incoming data for safety

interface RawFareData {
  standard: number | null;
  discount_den: number | null;
  go_wild: number | null;
  currency?: string;
}

interface RawFlightData {
  origin: string;
  destination: string;
  depart_time: string;
  arrive_time: string;
  duration: string | number;
  stops: string | number;
  fares: RawFareData;
}

// Define the shape of your clean, normalized output

export interface NormalizedFlight {
  origin: string;
  destination: string;
  stops: number;
  fares: {
    standard: number | null;
    discount_den: number | null;
    go_wild: number | null;
    currency: string;
  };
  duration_minutes: number;
  depart_time_raw: string;
  arrive_time_raw: string;
}

export function normalizeWildflyFlightData(flightResponses: any[]): NormalizedFlight[] {
  const normalizedFlights: NormalizedFlight[] = [];

  for (const response of flightResponses) {
    // Safely extract the flights array from the nested JSON structure
    const flights: RawFlightData[] = response?.data?.json?.flights || [];

    for (const flight of flights) {
      const normFlight: Partial<NormalizedFlight> = {
        origin: flight.origin,
        destination: flight.destination,
        depart_time_raw: flight.depart_time,
        arrive_time_raw: flight.arrive_time,
      };

      // 1. Normalize Stops
      const stopsRaw = String(flight.stops).toLowerCase();
      if (stopsRaw.includes('nonstop') || stopsRaw === '0') {
        normFlight.stops = 0;
      } else {
        // Extract the first integer found for layovers
        const match = stopsRaw.match(/\d+/);
        normFlight.stops = match ? parseInt(match[0], 10) : 1;
      }

      // 2. Normalize Fares
      const fares = flight.fares;
      const cleanFare = (val: any) =>
        (val === null || val === -1 || val === undefined) ? null : Number(val);

      normFlight.fares = {
        standard: cleanFare(fares.standard),
        discount_den: cleanFare(fares.discount_den),
        go_wild: cleanFare(fares.go_wild),
        currency: fares.currency || 'USD',
      };

      // 3. Normalize Duration to Total Minutes
      const durationRaw = String(flight.duration);
      let totalMinutes = 0;

      if (durationRaw.includes(':')) {
        // Handles format: "1.03:06:00" or "01:51:00"
        const parts = durationRaw.split(':');
        if (parts.length >= 2) {
          let days = 0;
          let hours = 0;
          const hoursStr = parts[0];

          if (hoursStr.includes('.')) {
            const [d, h] = hoursStr.split('.');
            days = parseInt(d, 10) || 0;
            hours = parseInt(h, 10) || 0;
          } else {
            hours = parseInt(hoursStr, 10) || 0;
          }

          const minutes = parseInt(parts[1], 10) || 0;
          totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;
        }
      } else {
        // Handles format: "2 hrs 21 min" or "1 day(s) 1 hrs 40 min"
        const daysMatch = durationRaw.match(/(\d+)\s*day/);
        const hoursMatch = durationRaw.match(/(\d+)\s*hr/);
        const minsMatch = durationRaw.match(/(\d+)\s*min/);

        if (daysMatch) totalMinutes += parseInt(daysMatch[1], 10) * 24 * 60;
        if (hoursMatch) totalMinutes += parseInt(hoursMatch[1], 10) * 60;
        if (minsMatch) totalMinutes += parseInt(minsMatch[1], 10);
      }

      normFlight.duration_minutes = totalMinutes;

      // Push the fully constructed object
      normalizedFlights.push(normFlight as NormalizedFlight);
    }
  }

  return normalizedFlights;
}
