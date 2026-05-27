## What's actually happening

**Where your bulk-search data went:**

- **`bulk_search_job_logs`** — does receive rows (5 in the last day). Most are stuck at `status='running'`, `airports_succeeded=0` because the underlying job never finishes — the dispatcher log shows `tz=CT returned 504` (edge function timeout). The two "success" rows since midnight are the *placeholder* rows inserted by `/admin/bulk-search` to suppress the cron run (their `error_message` literally says so), not real completions.
- **`flight_searches`** — receives one row per airport request as bulk-search runs (77 rows on 5/26, 14 today). These contain the request envelope and `json_body` but not per-itinerary analytics.
- **`flight_snapshots`** — **zero rows since 2026‑05‑19**. Every batch insert is rejected by Postgres with:
  `cannot insert a non-DEFAULT value into column "leg_route"`

## Root cause

`flight_snapshots.leg_route` was changed to a **`GENERATED ALWAYS AS (leg_origin_iata || '-' || leg_destination_iata)`** column. Both writers still send an explicit value:

- `src/utils/flightSnapshotWriter.ts:120`
- `supabase/functions/scheduled-bulk-search/index.ts:205`

Because the inserts are batched and non-blocking, the failure was logged as a warning and the parent flow continued — so `flight_searches` kept growing while `flight_snapshots` silently received nothing. GoWild Insights then has nothing to read.

## Fix

1. **Remove `leg_route` from both snapshot insert payloads** — let the generated column compute itself. No schema change needed; the column already produces the correct value.
2. **Backfill check** — after the fix, run one manual bulk-search and verify a fresh `flight_snapshots` row appears for that `flight_search_id`. Confirm `leg_route` is populated automatically.
3. **Note about the dispatcher 504** — the `scheduled-bulk-search` invocation is timing out at the edge gateway (the function itself keeps running and writes per-airport rows). That's a separate scalability concern, not the cause of the empty Insights page. Flagging it but not changing it in this pass unless you want me to also address it.

## Out of scope (call out, don't touch)

- The stuck `status='running'` job-log rows from 5/26–5/27 will stay stuck until a finalizer pass clears them. Optional cleanup: a one-shot UPDATE setting them to `status='partial'` once we confirm new runs finalize correctly. Tell me if you want that included.
- No changes to the RPC, Insights UI, or `leg_route` column definition.

## Files to edit

- `src/utils/flightSnapshotWriter.ts` — drop `leg_route` from the row object.
- `supabase/functions/scheduled-bulk-search/index.ts` — drop `leg_route` from the row object.
