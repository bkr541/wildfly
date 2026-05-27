## Goal
Track GoWild seat availability over time per real-world itinerary so users can see current seats, original seats, and the delta — without cache views polluting fresh provider observations. Then expose this through a new Route Availability Calendar in GoWild Insights.

Keeps `flight_snapshots` as the append-only canonical observation table.

---

## Phase 1 — Database migration

Add to `flight_snapshots`:
- `stable_itinerary_key text` (nullable; backfilled where possible)
- `availability_status text not null default 'returned'` with CHECK (`returned`, `no_gowild_fare`, `not_returned`)

Add to `flight_searches`:
- `result_source text` with CHECK (`live_api`, `scheduled_bulk_search`, `admin_bulk_search`, `cache_hit`)
- `provider_observed_at timestamptz`

Indexes:
- `flight_snapshots (stable_itinerary_key, snapshot_at desc)`
- `flight_snapshots (leg_origin_iata, leg_destination_iata, departure_at)`
- `flight_searches (result_source, provider_observed_at desc)`

Backfill:
- Populate `stable_itinerary_key` for existing nonstop rows where `airline`, `flight_number`, `departure_at`, `arrival_at` are present. Connecting itineraries (stops > 0) without per-segment data stay NULL.
- Set existing `flight_searches.result_source = 'live_api'`, `provider_observed_at = search_timestamp` as best-effort backfill.

---

## Phase 2 — Stable identity in writer

Update `src/utils/flightSnapshotWriter.ts`:
- Add `buildStableItineraryKey(normalizedFlight)` helper using uppercase IATA + carrier, ISO datetimes, per-segment chain joined by `>`.
- Add `availability_status` (default `'returned'`).
- Accept new params `resultSource` and `providerObservedAt` from caller; writer no longer fires for cache hits (see Phase 3).

Update `flight_searches` insert sites to pass `result_source` + `provider_observed_at`:
- `src/pages/Flights.tsx` (live user search → `live_api`)
- `supabase/functions/scheduled-bulk-search/index.ts` (`scheduled_bulk_search`)
- Any admin bulk path (`admin_bulk_search`)

---

## Phase 3 — Fresh vs. cache separation

Inspect current flow:
- If cache-hit path currently writes a new `flight_searches` row + snapshots, change to: still log the user search row with `result_source='cache_hit'` and `provider_observed_at = cached payload's original observation time`, but **skip `writeFlightSnapshots`** for cache hits.
- Live API path writes snapshots as today, with `result_source='live_api'`.

---

## Phase 4 — Disappearance tracking (`no_gowild_fare` / `not_returned`)

In the live-API/bulk write path (server-side via a new SECURITY DEFINER SQL function called after `writeFlightSnapshots`):
- Given (origin, destination-scope, travel_date, returned `stable_itinerary_key`s):
  - Find latest prior observation per stable_key for that scope that had `has_go_wild=true` and `availability_status='returned'`.
  - For each such prior key NOT in current returned set, insert a synthetic snapshot row: `has_go_wild=false`, `go_wild_available_seats=0`, `availability_status='not_returned'`, same identity fields copied forward, `snapshot_at=now()`.
- For itineraries returned in payload but lacking GoWild fare, writer inserts with `availability_status='no_gowild_fare'`.
- Scope guard: only when the new search's scope is comparable (same origin + (same destination OR all-destinations covering it) + same travel_date). Route-specific search for MCO never touches LAS rows.

---

## Phase 5 — RPCs

`get_route_gowild_inventory_calendar(p_origin_iata, p_destination_iata, p_start_date, p_end_date)` — one row per travel_date with current/original seat & flight counts, seat_change, lowest fares, last_provider_observed_at.

`get_route_gowild_inventory_day_details(p_origin_iata, p_destination_iata, p_travel_date)` — one row per stable_itinerary_key with first/latest seats, change, status, fares, times.

Both:
- Exclude `result_source='cache_hit'` via join to `flight_searches`.
- Use `DISTINCT ON (stable_itinerary_key) ... ORDER BY snapshot_at DESC` to pick latest; symmetric for earliest.
- `SECURITY DEFINER`, `search_path=public`, require `auth.uid()`.

---

## Phase 6 — Route Availability Calendar UI

New component in GoWild Insights page: `RouteAvailabilityCalendarCard`.
- Reuses existing airport selector (`AirportSearchSheet`).
- Month nav (left/right arrows, same style as existing blackout calendar in `Preview.tsx`).
- Each day cell: flights count + seats now + delta indicator. Empty days neutral. Blackout overlay using `src/utils/blackoutDates.ts`.
- Click day → bottom sheet showing per-itinerary cards (reuse `BottomSheet`) with first→current seats, status label, current fares.
- Loading/empty/error states per spec.

Mount in `src/pages/GoWildInsights.tsx` below existing sections.

---

## Phase 7 — Verification

Manually exercise scenarios 1–8 against the new RPCs using `supabase--read_query`. Document results in final response.

---

## Technical notes
- All time strings normalized via `new Date(x).toISOString()` before hashing into key.
- Missing carrier/flight_number → use literal `?` placeholder, still deterministic.
- Public schema GRANTs included for any new functions (`EXECUTE TO authenticated`).
- No changes to `src/integrations/supabase/types.ts` or `client.ts`.

---

## Scope confirmation needed
This is a 15–25 file change across DB + edge functions + writer + UI. Before I start, confirm:
1. Proceed with the **preferred** cache approach (cache hits log search row but skip snapshot insert)?
2. OK to add the disappearance-tracking logic as a new SECURITY DEFINER SQL function called from the client after `writeFlightSnapshots`, vs. moving snapshot writes server-side entirely?
3. Mount the new Calendar in `GoWildInsights.tsx` (not `Preview.tsx`)?