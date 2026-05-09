# Fix: Bulk Search Not Writing to `flight_snapshots`

## Root cause

The `/admin/bulk-search` flow runs:

1. Calls the flight API (returns flights whose timing lives in `rawPayload.segments[].departure_time / arrival_time`).
2. `normalizeAllDestinationsResponse(raw, date)` builds each flight's `legs` array from top-level `f.depart_time` / `f.arrive_time` — **fields the API never returns at the top level**. So every leg ends up with:

   ```json
   { "origin": "BWI", "destination": "BQN", "departure_time": "", "arrival_time": "" }
   ```

   (Confirmed by inspecting `flight_search_cache.payload->'flights'->0`.)

3. `writeFlightSnapshots(...)` iterates legs and explicitly skips any leg missing `departure_time` or `arrival_time` (it can't satisfy the `NOT NULL` columns `departure_at` / `arrival_at`):

   ```ts
   if (!leg.departure_time || !leg.arrival_time) return;
   ```

4. Result: 0 rows inserted for every search. The error is also swallowed by the `.catch(() => {})` on the call site, hiding the failure. DB confirms `snaps = 0` for every `triggered_by='admin_bulk_search'` row.

## Fix

Make the bulk-search normalizer produce real per-segment legs from `rawPayload.segments`, matching the shape the snapshot writer expects.

### `src/utils/normalizeFlights.ts` — `normalizeAllDestinationsResponse`

Replace the synthetic single-leg block with one leg per segment:

```ts
const segments = Array.isArray(f.rawPayload?.segments) ? f.rawPayload.segments : [];

const legs = segments.length > 0
  ? segments.map((s: any) => ({
      origin: s.departure_airport ?? "",
      destination: s.arrival_airport ?? "",
      departure_time: s.departure_time ?? "",   // already full ISO
      arrival_time:   s.arrival_time   ?? "",
    }))
  : [{
      origin: f.origin ?? "",
      destination: f.destination ?? "",
      departure_time: date ? toTimestamp(f.depart_time ?? "", date) : (f.depart_time ?? ""),
      arrival_time:   date ? toTimestamp(f.arrive_time ?? "", date) : (f.arrive_time ?? ""),
    }];
```

This keeps the existing fallback for any future payload shape that does have top-level times, but the real path now uses the segment timestamps.

### `src/pages/AdminBulkSearch.tsx` — surface failures

Replace the silent swallow so future regressions are visible (logged, not thrown):

```ts
writeFlightSnapshots(fsRow.id, normalized.flights, iata_code)
  .catch((e) => console.warn("[bulk-search] snapshot write failed", iata_code, e));
```

## Verification

1. Run `/admin/bulk-search` for one date.
2. Query:
   ```sql
   select fs.id, fs.flight_results_count,
          (select count(*) from flight_snapshots s where s.flight_search_id = fs.id) as snaps
   from flight_searches fs
   where fs.triggered_by = 'admin_bulk_search'
   order by fs.search_timestamp desc limit 5;
   ```
   Expect `snaps > 0` (one row per flight leg).
3. Spot-check a snapshot row's `departure_at` / `arrival_at` are populated.

## Out of scope

- No schema changes.
- No RLS changes (existing insert policy already permits owner of the parent `flight_searches` row).
- Single-destination search path is unaffected (uses a different normalizer).
