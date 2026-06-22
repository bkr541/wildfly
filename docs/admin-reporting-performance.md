# Admin Reporting — Performance Reference

This document describes the performance characteristics of the Wildfly admin reporting system: indexes, limits, timeouts, and guidance for inspecting slow reports or adding new ones.

---

## Grain and scope

All admin reports operate at the **request/event grain** (individual flight searches, route checks, user sessions). Aggregation is done in the RPC or report handler, not in the browser.

Reports pull from production read replicas where available. No raw SQL is accepted from the client; every report maps through a registered handler in `supabase/functions/_shared/reporting/reportRegistry.ts`.

---

## Row and pagination caps

| Limit               | Value  | Where enforced                                      |
| ------------------- | ------ | --------------------------------------------------- |
| Max page size       | 500    | `clampPageSize()` in `reportEngine.ts`              |
| Max export rows     | 5,000  | `MAX_EXPORT_ROWS` in `adminReportExport.ts`         |
| RPC row cap (Supabase default) | 1,000 | Override with `.limit()` in each handler |

If a report returns more rows than the page size the `truncated` flag is set to `true` on the run record and the result payload. A truncation warning is displayed in the UI.

---

## Timeouts

| Layer                   | Timeout  | Constant / location                                       |
| ----------------------- | -------- | --------------------------------------------------------- |
| Edge Function handler   | 15 000 ms | `HANDLER_TIMEOUT_MS` — `reportEngine.ts`                 |
| PostgreSQL statement    | 14 s     | `SET LOCAL statement_timeout = '14s'` — each RPC         |
| Supabase Edge Function  | 150 s    | Platform default — beyond our control                     |

The handler timeout (`15 s`) is intentionally 1 second longer than the DB statement timeout (`14 s`) so a timed-out query surfaces as a DB error rather than a silent handler timeout.

When a query exceeds the statement timeout the run is marked `failed` with `error_code = TIMEOUT`. The UI shows a user-friendly timeout message without SQL or stack traces.

---

## Database indexes

### `admin_report_runs` (history / audit log)

| Index name                     | Columns                             | Used for                                        |
| ------------------------------ | ----------------------------------- | ----------------------------------------------- |
| `idx_arr_slug_started`         | `(report_slug, started_at DESC)`    | Filter by slug + date range in history view     |
| `idx_arr_status_started`       | `(status, started_at DESC)`         | Filter by status in history view                |
| `idx_arr_definition_started`   | `(report_definition_id, started_at DESC)` | Join to definition + date range             |
| `idx_arr_requested_by_started` | `(requested_by, started_at DESC)`   | Per-user audit queries                          |

### Search RPCs (`searches.*` reports)

| Index name                | Columns                                |
| ------------------------- | -------------------------------------- |
| `idx_rpt_fs_ts_route`     | `(created_at DESC, origin, dest)`      |
| `idx_rpt_fs_source_ts`    | `(source, created_at DESC)`            |

### GoWild RPCs (`gowild.*` reports)

| Index name                        | Columns                                              |
| --------------------------------- | ---------------------------------------------------- |
| `idx_rpt_snapshot_search_key_time`| `(search_key, created_at DESC)`                     |
| `idx_rpt_snapshot_key_status_time`| `(search_key, status, created_at DESC)`             |

---

## How to inspect a slow report

### 1. Check the run record

```sql
SELECT
  report_slug,
  status,
  duration_ms,
  error_code,
  error_message,
  parameters,
  started_at
FROM admin_report_runs
WHERE report_slug = '<slug>'
ORDER BY started_at DESC
LIMIT 20;
```

> **Do not include email, user_id, or other PII values in queries you paste into Slack, Notion, or issue trackers.**

### 2. Inspect query plans (staging / replica only)

Enable `EXPLAIN ANALYZE` on the RPC body in a temporary migration or staging function. Never run expensive `EXPLAIN ANALYZE` against production under load.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ... FROM flight_searches
WHERE created_at >= now() - interval '7 days'
  AND source = 'web';
```

Look for: sequential scans on large tables, nested-loop joins with high estimated rows, missing index conditions.

### 3. Check statement_timeout behavior

If `duration_ms` is approximately 14 000 ms and `error_code` is `TIMEOUT`, the PostgreSQL statement timeout fired. Options:
- Narrow the date range or add a more selective filter.
- Add a composite index on the filter columns.
- Consider pre-aggregating into a materialized view updated by a cron job.

### 4. Pagination

All handlers accept `page` and `page_size` (max 500). If users consistently need all rows, increase `MAX_EXPORT_ROWS` and use the export path (CSV/XLSX/JSON) instead of the paginated result table.

---

## How to add a new report

### Checklist

1. **Define the handler** in `supabase/functions/_shared/reporting/handlers/<category>/`.
   - Call a named RPC; never accept SQL or table names from params.
   - Apply `SET LOCAL statement_timeout = '14s'` at the top of every RPC.
   - Use `applyPiiMask()` for any column with `pii: true`.

2. **Register in `reportRegistry.ts`**:
   ```ts
   REPORT_REGISTRY.set("category.slug", {
     handlerKey:          "category.slug",
     version:             1,
     handler:             myHandler,
     validateParameters:  myParamValidator,
     columns:             MY_COLUMNS,
   });
   ```

3. **Insert into `admin_report_definitions`** (migration):
   ```sql
   INSERT INTO admin_report_definitions (
     slug, category, name, description,
     handler_key, version, parameter_schema,
     default_parameters, output_config,
     contains_pii, is_active, sort_order
   ) VALUES (
     'category.slug', 'Category', 'Human Name', 'What it does.',
     'category.slug', 1, '{"fields":[]}'::jsonb,
     '{}'::jsonb, '{}'::jsonb,
     false, true, 100
   );
   ```
   `handler_key` must match `registryEntry.handlerKey` exactly — a mismatch causes a `REPORT_VERSION_MISMATCH` error at runtime.

4. **Add indexes** for any new filter columns used in WHERE clauses of the report RPC. Name them `idx_rpt_<table_short>_<columns>`.

5. **Write tests** covering: unauthorized access, parameter validation, PII masking (if `contains_pii: true`), timeout error rendering, and truncation warning.

6. **No PII in URL params**: if the report has PII-related params (emails, user IDs), ensure they are not in `encodeUrlState`. Add any new PII-adjacent key names to `FORBIDDEN_PARAM_KEYS` in `reportingUrlState.ts`.

---

## Metrics to watch

| Metric                       | How to query                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Average run duration (7d)    | `SELECT report_slug, AVG(duration_ms) FROM admin_report_runs WHERE started_at > now() - interval '7 days' AND status = 'completed' GROUP BY 1 ORDER BY 2 DESC` |
| Failure rate by slug         | `SELECT report_slug, COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*)::float FROM admin_report_runs GROUP BY 1` |
| Timeout runs                 | `SELECT report_slug, COUNT(*) FROM admin_report_runs WHERE error_code = 'TIMEOUT' GROUP BY 1 ORDER BY 2 DESC` |
| Export volume                | `SELECT format, COUNT(*), SUM(row_count) FROM admin_report_exports GROUP BY 1`         |

> Do not expose these queries directly in any client-accessible endpoint. Run them from a database client with service-role credentials on a read replica.
