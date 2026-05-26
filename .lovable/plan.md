## Goal

Run the existing `/admin/bulk-search` (Domestic Only ON, Optimize By Timezone ON, date = tomorrow) automatically every day, once per US timezone, at the moment each region releases GoWild passes:

| Timezone group | Eastern wall-clock trigger |
|---|---|
| ET | 12:02 AM |
| CT | 01:02 AM |
| MT | 02:02 AM |
| PT | 03:02 AM |

Log every run (success or failure) so you can audit it.

## Approach

Three pieces:

1. **New edge function** `scheduled-bulk-search` (Deno, runs server-side with the service-role key). It ports the bulk-search loop from `src/pages/AdminBulkSearch.tsx` so it doesn't need a browser session. Accepts `{ timezone: "ET" | "CT" | "MT" | "PT" }` in the body, then:
   - Computes "tomorrow" in America/New_York (handles DST).
   - Loads `airports` filtered to `is_active = true`, `locations.country = 'United States of America'`, and `timezone IN (group)`.
   - For each airport: calls `flight-proxy` (`/search`), normalizes via the same logic as `normalizeAllDestinationsResponse`, upserts `flight_search_cache`, inserts `flight_searches` (with `triggered_by = 'scheduled_bulk_search'` and a synthetic system user id), and writes itinerary-level rows to `flight_snapshots`.
   - Same 750 ms inter-airport delay, exponential backoff on 429, max 3 retries.
   - Writes a single row to a new `bulk_search_job_logs` table at the end (status `success` or `failed`, with counts + duration + error message).

   Because we already call this only from `pg_cron` (server side), we keep `verify_jwt = false` for this function and gate it with a shared-secret header (`x-job-secret`) that the cron job passes; the function rejects anything without the matching secret. This keeps the public endpoint safe.

2. **New table** `bulk_search_job_logs` for the audit trail:

   | column | purpose |
   |---|---|
   | `id` uuid pk | |
   | `timezone_group` text | `ET` / `CT` / `MT` / `PT` |
   | `target_date` date | the next-day date searched |
   | `status` text | `success` / `failed` / `partial` |
   | `airports_total` int | how many airports were in the batch |
   | `airports_succeeded` int | |
   | `airports_failed` int | |
   | `gowild_found_count` int | |
   | `duration_ms` int | wall time |
   | `error_message` text | populated on hard failure |
   | `started_at`, `finished_at` timestamptz | |
   | `created_at` timestamptz default now() | |

   RLS: only the developer allowlist can `SELECT`; no public insert/update/delete (writes happen via service role inside the edge function).

3. **Cron schedule** via `pg_cron` + `pg_net`. Because `pg_cron` schedules in UTC, a single fixed UTC time would drift across DST. The clean fix: schedule **one dispatcher job every 5 minutes** that calls a tiny dispatcher edge function (`scheduled-bulk-search-dispatcher`). The dispatcher reads the current time in `America/New_York` and, if it's within the matching window (`00:02`, `01:02`, `02:02`, `03:02`), invokes `scheduled-bulk-search` with the right `timezone` group. This handles DST automatically and avoids 8 separate cron entries.

   To prevent duplicate runs if the dispatcher fires twice inside the same minute, the dispatcher first checks `bulk_search_job_logs` for an existing row with the same `target_date` + `timezone_group` started in the last hour and skips if found.

## File-level changes

**New**
- `supabase/functions/scheduled-bulk-search/index.ts` — main batch runner (ported from `AdminBulkSearch.tsx` + `flightSnapshotWriter.ts`, adapted for Deno + service-role client).
- `supabase/functions/scheduled-bulk-search-dispatcher/index.ts` — lightweight 5-minute trigger, idempotent.
- Migration: create `bulk_search_job_logs` table + RLS policies.
- Insert (separate, non-migration): the two `cron.schedule(...)` rows (dispatcher every 5 min) and the `app_config` row `scheduled_bulk_search_secret` storing the shared-secret header.

**Edited**
- `supabase/config.toml` — add `[functions.scheduled-bulk-search]` and `[functions.scheduled-bulk-search-dispatcher]` blocks with `verify_jwt = false` (gated by `x-job-secret` instead).

**Not edited**
- `src/pages/AdminBulkSearch.tsx` — manual UI stays exactly as-is.
- `flight_snapshots` / `flight_searches` schemas — unchanged.

## Open questions before I implement

1. **System user id for `flight_searches.user_id`**: the table requires `user_id NOT NULL` and RLS allows insert only when `auth.uid() = user_id`. The edge function will use the service-role client (which bypasses RLS), but the row still needs *some* uuid. Options:
   - (a) Reuse your developer/admin uuid (e.g., the test account) so these searches show up under your account.
   - (b) Use a dedicated synthetic uuid like `00000000-0000-0000-0000-000000000001` to clearly mark "system / scheduled job" rows.
   Which do you prefer? Default if unspecified: **(b)**, since it keeps your personal Recent Searches clean.

2. **Run windows for the four groups**: the spec says ET runs at 00:02, CT at 01:02, etc. — all expressed as Eastern wall-clock. This means CT/MT/PT trigger one/two/three Eastern hours after midnight Eastern, which is exactly midnight Central/Mountain/Pacific. Confirming this is what you want (vs. each group firing at midnight of its *own* zone, which would also be 4 different Eastern times but only if you wanted to ignore DST drift between zones — it works out the same in practice).

If both defaults are fine, I'll proceed.