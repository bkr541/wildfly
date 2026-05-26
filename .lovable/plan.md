
## Goal

Remove the 5,000-row cap on `GoWildInsights` and ensure every analytics card is calculated from **all** matching `flight_snapshots` rows in the selected period, by paginating the Supabase query.

## Files to change

- `src/pages/GoWildInsights.tsx` — only file touched. Helpers in `itineraryHelpers.ts`, `airportHelpers.ts`, `timingHelpers.ts`, `routeHelpers.ts`, `seatHelpers.ts` already accept arbitrary arrays and stay as-is.

## Implementation

1. **Remove `HARD_ROW_CAP` and the cap-reached banner.** Delete the amber "Showing the most recent 5,000…" notice and `capReached` logic.

2. **Replace the single query with a paginated loader.** Inside the existing `useEffect`:
   - Page size: `1000` (Supabase's safe default ceiling).
   - Order: `snapshot_at desc, id desc` (stable, deterministic) — applied via two `.order()` calls.
   - Loop using `.range(from, from + PAGE_SIZE - 1)` until a page returns fewer than `PAGE_SIZE` rows.
   - Re-apply `.gte("snapshot_at", sinceIso)` on every page so the date filter is consistent across pages.
   - Keep the same `SELECT_FIELDS` list (already includes every required column).
   - Honor `cancelled` between pages so period switches abort in-flight pagination.
   - Accumulate rows in a local array; only call `setSnapshots` once at the end (avoids re-rendering all cards per page).

3. **Error handling.** If any page errors, stop paginating, call `setError(error.message)` (covers "a later pagination request fails"), and leave `snapshots` empty so the existing `ErrorCard` renders.

4. **Loading state.** Keep `loading=true` for the entire pagination loop; only flip to `false` in a `finally` after the loop ends or is cancelled. The existing `SkeletonCard` continues to show.

5. **Dev visibility.** After pagination completes, `console.info` the raw row count and grouped itinerary count (computed via `groupLegsIntoItineraries`) for verification. No UI surface needed.

6. **Safety ceiling (defensive only).** Hard stop at 200 pages (= 200k rows) to prevent a runaway loop in pathological cases; log a warning if hit. Not surfaced in UI since real datasets are far below this.

## What is NOT changed

- `flightSnapshotWriter.ts`, itinerary grouping, card components, period filter UI, RLS, and schema all remain untouched.
- No new RPC or server-side aggregation — client-side pagination is sufficient given the row sizes here and matches the existing architecture.

## Validation

- Manually switch periods (24h → 7d → 30d → All) and confirm in the console that row counts grow and itinerary counts update.
- Confirm a single `snapshot_at desc, id desc` ordering produces no duplicate `id`s across pages (spot-check via console log of `new Set(rows.map(r=>r.id)).size === rows.length`).
- Confirm cards update when data beyond the first 5,000 rows is included (compare All Time vs 7d totals).
