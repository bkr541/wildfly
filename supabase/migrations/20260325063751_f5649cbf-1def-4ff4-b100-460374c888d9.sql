ALTER TABLE public.flight_snapshots
  DROP COLUMN IF EXISTS total_trip_minutes,
  DROP COLUMN IF EXISTS carrier_code,
  DROP COLUMN IF EXISTS itinerary_flight_number,
  DROP COLUMN IF EXISTS final_destination_iata,
  DROP COLUMN IF EXISTS created_at;