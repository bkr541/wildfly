-- ============================================================
-- Admin Reporting Foundation
-- Tables: admin_report_definitions, admin_report_runs,
--         admin_report_exports
-- All three tables are service-role-only (no anon/authenticated
-- direct access). Reporting UI goes through Edge Functions.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. admin_report_definitions
--    Stores report metadata + UI config only.
--    No SQL text, no function names, no table references.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_report_definitions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text        NOT NULL UNIQUE,
  category            text        NOT NULL,
  name                text        NOT NULL,
  description         text        NOT NULL DEFAULT '',
  handler_key         text        NOT NULL UNIQUE,
  parameter_schema    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  default_parameters  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  output_config       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  contains_pii        boolean     NOT NULL DEFAULT false,
  is_active           boolean     NOT NULL DEFAULT true,
  sort_order          integer     NOT NULL DEFAULT 100,
  version             integer     NOT NULL DEFAULT 1,
  created_by          uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by          uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_report_definitions_slug_nonempty
    CHECK (length(trim(slug)) > 0),

  CONSTRAINT admin_report_definitions_handler_key_nonempty
    CHECK (length(trim(handler_key)) > 0),

  CONSTRAINT admin_report_definitions_version_min
    CHECK (version >= 1),

  CONSTRAINT admin_report_definitions_sort_order_nonneg
    CHECK (sort_order >= 0),

  CONSTRAINT admin_report_definitions_parameter_schema_is_object
    CHECK (jsonb_typeof(parameter_schema) = 'object'),

  CONSTRAINT admin_report_definitions_default_parameters_is_object
    CHECK (jsonb_typeof(default_parameters) = 'object'),

  CONSTRAINT admin_report_definitions_output_config_is_object
    CHECK (jsonb_typeof(output_config) = 'object')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ard_active_category_sort
  ON public.admin_report_definitions (category, sort_order)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ard_category
  ON public.admin_report_definitions (category);

CREATE INDEX IF NOT EXISTS idx_ard_handler_key
  ON public.admin_report_definitions (handler_key);

-- updated_at trigger — reuse the project's existing handle_updated_at()
DROP TRIGGER IF EXISTS set_admin_report_definitions_updated_at
  ON public.admin_report_definitions;
CREATE TRIGGER set_admin_report_definitions_updated_at
  BEFORE UPDATE ON public.admin_report_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.admin_report_definitions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_report_definitions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_report_definitions TO service_role;

DO $$ BEGIN
  CREATE POLICY "Service role full access to admin_report_definitions"
    ON public.admin_report_definitions FOR ALL
    USING     (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 2. admin_report_runs
--    Records every attempted report execution.
--    Result rows are never stored here.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_report_runs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_definition_id  uuid        NOT NULL REFERENCES public.admin_report_definitions(id) ON DELETE RESTRICT,
  report_slug           text        NOT NULL,
  report_version        integer     NOT NULL,
  requested_by          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  parameters            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status                text        NOT NULL,
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz NULL,
  duration_ms           integer     NULL,
  row_count             integer     NULL,
  truncated             boolean     NOT NULL DEFAULT false,
  error_code            text        NULL,
  error_message         text        NULL,

  CONSTRAINT admin_report_runs_status_check
    CHECK (status IN ('running', 'completed', 'failed')),

  CONSTRAINT admin_report_runs_duration_nonneg
    CHECK (duration_ms IS NULL OR duration_ms >= 0),

  CONSTRAINT admin_report_runs_row_count_nonneg
    CHECK (row_count IS NULL OR row_count >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arr_requested_by_started
  ON public.admin_report_runs (requested_by, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_arr_definition_started
  ON public.admin_report_runs (report_definition_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_arr_status_started
  ON public.admin_report_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_arr_slug_started
  ON public.admin_report_runs (report_slug, started_at DESC);

-- RLS
ALTER TABLE public.admin_report_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_report_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_report_runs TO service_role;

DO $$ BEGIN
  CREATE POLICY "Service role full access to admin_report_runs"
    ON public.admin_report_runs FOR ALL
    USING     (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 3. admin_report_exports
--    Audit table for every export from a completed run.
--    Multiple exports per run are supported (e.g. CSV then XLSX).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_report_exports (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id  uuid        NOT NULL REFERENCES public.admin_report_runs(id) ON DELETE CASCADE,
  requested_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  format         text        NOT NULL,
  row_count      integer     NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_report_exports_format_check
    CHECK (format IN ('csv', 'xlsx', 'json'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_are_run_id
  ON public.admin_report_exports (report_run_id);

CREATE INDEX IF NOT EXISTS idx_are_requested_by_created
  ON public.admin_report_exports (requested_by, created_at DESC);

-- RLS
ALTER TABLE public.admin_report_exports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_report_exports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_report_exports TO service_role;

DO $$ BEGIN
  CREATE POLICY "Service role full access to admin_report_exports"
    ON public.admin_report_exports FOR ALL
    USING     (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 4. Initial report catalog seed (idempotent)
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.admin_report_definitions
  (slug, category, name, description, handler_key, contains_pii,
   parameter_schema, default_parameters, output_config, sort_order, version)
VALUES

-- ── Users ─────────────────────────────────────────────────────

(
  'users.top-search-active',
  'Users',
  'Top Search-Active Users',
  'Lists the users who performed the most flight searches in a given period, ranked by total search count. Contains PII — handle with care.',
  'users.top-search-active',
  true,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true,
        "helperText": "Inclusive start of the analysis window"
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true,
        "helperText": "Inclusive end of the analysis window"
      },
      {
        "key": "limit",
        "label": "Max Results",
        "type": "number",
        "required": false,
        "minimum": 1,
        "maximum": 500,
        "helperText": "Maximum number of users to return"
      }
    ]
  }'::jsonb,
  '{"limit": 50}'::jsonb,
  '{
    "defaultSort": {"key": "search_count", "direction": "desc"},
    "chart": {"type": "none"}
  }'::jsonb,
  10,
  1
),

(
  'users.dormant',
  'Users',
  'Dormant Users',
  'Returns accounts that have not performed any flight search within the configured inactivity window. Useful for churn analysis and re-engagement targeting. Contains PII.',
  'users.dormant',
  true,
  '{
    "fields": [
      {
        "key": "days_inactive",
        "label": "Days Since Last Activity",
        "type": "number",
        "required": true,
        "minimum": 7,
        "maximum": 730,
        "helperText": "Users with no search in this many days are considered dormant"
      },
      {
        "key": "limit",
        "label": "Max Results",
        "type": "number",
        "required": false,
        "minimum": 1,
        "maximum": 500
      }
    ]
  }'::jsonb,
  '{"days_inactive": 30, "limit": 100}'::jsonb,
  '{
    "defaultSort": {"key": "last_active_at", "direction": "asc"},
    "chart": {"type": "none"}
  }'::jsonb,
  20,
  1
),

(
  'users.engagement-summary',
  'Users',
  'User Engagement Summary',
  'Aggregated (non-PII) engagement metrics over time: new signups, daily/weekly active users, and total searches per period.',
  'users.engagement-summary',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "granularity",
        "label": "Granularity",
        "type": "select",
        "required": false,
        "options": [
          {"label": "Daily", "value": "day"},
          {"label": "Weekly", "value": "week"},
          {"label": "Monthly", "value": "month"}
        ]
      }
    ]
  }'::jsonb,
  '{"granularity": "day"}'::jsonb,
  '{
    "defaultSort": {"key": "period", "direction": "asc"},
    "chart": {
      "type": "line",
      "xKey": "period",
      "yKeys": ["new_users", "active_users", "searches"]
    }
  }'::jsonb,
  30,
  1
),

-- ── Flight Searches ────────────────────────────────────────────

(
  'searches.volume-over-time',
  'Flight Searches',
  'Search Volume Over Time',
  'Total flight search volume aggregated by day, week, or month. Shows overall platform usage trends.',
  'searches.volume-over-time',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "granularity",
        "label": "Granularity",
        "type": "select",
        "required": false,
        "options": [
          {"label": "Daily", "value": "day"},
          {"label": "Weekly", "value": "week"},
          {"label": "Monthly", "value": "month"}
        ]
      }
    ]
  }'::jsonb,
  '{"granularity": "day"}'::jsonb,
  '{
    "defaultSort": {"key": "period", "direction": "asc"},
    "chart": {
      "type": "line",
      "xKey": "period",
      "yKeys": ["search_count", "unique_users"]
    }
  }'::jsonb,
  10,
  1
),

(
  'searches.top-routes',
  'Flight Searches',
  'Top Searched Routes',
  'Origin-destination pairs ranked by number of searches in the selected period. Identifies the most-demanded routes on the platform.',
  'searches.top-routes',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "limit",
        "label": "Max Results",
        "type": "number",
        "required": false,
        "minimum": 1,
        "maximum": 200
      }
    ]
  }'::jsonb,
  '{"limit": 25}'::jsonb,
  '{
    "defaultSort": {"key": "search_count", "direction": "desc"},
    "chart": {
      "type": "bar",
      "xKey": "route",
      "yKeys": ["search_count"]
    }
  }'::jsonb,
  20,
  1
),

(
  'searches.zero-results',
  'Flight Searches',
  'Zero-Result Searches',
  'Routes where the search returned zero available flights. High counts signal data gaps or routes Frontier does not serve.',
  'searches.zero-results',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "limit",
        "label": "Max Results",
        "type": "number",
        "required": false,
        "minimum": 1,
        "maximum": 200
      }
    ]
  }'::jsonb,
  '{"limit": 50}'::jsonb,
  '{
    "defaultSort": {"key": "zero_result_count", "direction": "desc"},
    "chart": {
      "type": "bar",
      "xKey": "route",
      "yKeys": ["zero_result_count"]
    }
  }'::jsonb,
  30,
  1
),

(
  'searches.source-cache-mix',
  'Flight Searches',
  'Search Source and Cache Mix',
  'Breakdown of search results by data source (live vs. cache) and provider. Helps evaluate cache hit rates and scraper reliability.',
  'searches.source-cache-mix',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      }
    ]
  }'::jsonb,
  '{}'::jsonb,
  '{
    "defaultSort": {"key": "count", "direction": "desc"},
    "chart": {
      "type": "donut",
      "xKey": "source_label",
      "yKeys": ["count"]
    }
  }'::jsonb,
  40,
  1
),

-- ── GoWild Availability ────────────────────────────────────────

(
  'gowild.route-reliability',
  'GoWild Availability',
  'Most Reliable GoWild Routes',
  'Routes ranked by GoWild seat-availability reliability: the percentage of search snapshots that returned at least one GoWild seat.',
  'gowild.route-reliability',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "min_appearances",
        "label": "Min. Snapshots Required",
        "type": "number",
        "required": false,
        "minimum": 1,
        "helperText": "Exclude routes with fewer data points than this threshold"
      },
      {
        "key": "limit",
        "label": "Max Results",
        "type": "number",
        "required": false,
        "minimum": 1,
        "maximum": 200
      }
    ]
  }'::jsonb,
  '{"min_appearances": 5, "limit": 50}'::jsonb,
  '{
    "defaultSort": {"key": "reliability_pct", "direction": "desc"},
    "chart": {
      "type": "bar",
      "xKey": "route",
      "yKeys": ["reliability_pct"]
    }
  }'::jsonb,
  10,
  1
),

(
  'gowild.disappeared-itineraries',
  'GoWild Availability',
  'Disappeared Itineraries',
  'Itineraries that were available in one snapshot but missing in the next, indicating GoWild seat loss. Helps identify volatile routes.',
  'gowild.disappeared-itineraries',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "limit",
        "label": "Max Results",
        "type": "number",
        "required": false,
        "minimum": 1,
        "maximum": 200
      }
    ]
  }'::jsonb,
  '{"limit": 50}'::jsonb,
  '{
    "defaultSort": {"key": "disappeared_count", "direction": "desc"},
    "chart": {
      "type": "bar",
      "xKey": "route",
      "yKeys": ["disappeared_count"]
    }
  }'::jsonb,
  20,
  1
),

(
  'gowild.fare-savings-by-route',
  'GoWild Availability',
  'GoWild Fare Savings by Route',
  'Estimated per-ticket savings when a GoWild itinerary is available versus the lowest market-rate alternative on the same route.',
  'gowild.fare-savings-by-route',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "origin",
        "label": "Origin Airport",
        "type": "airport",
        "required": false,
        "helperText": "Filter to a single departure airport"
      },
      {
        "key": "limit",
        "label": "Max Results",
        "type": "number",
        "required": false,
        "minimum": 1,
        "maximum": 200
      }
    ]
  }'::jsonb,
  '{"limit": 50}'::jsonb,
  '{
    "defaultSort": {"key": "avg_savings", "direction": "desc"},
    "chart": {
      "type": "bar",
      "xKey": "route",
      "yKeys": ["avg_gowild_fare", "avg_market_fare"]
    }
  }'::jsonb,
  30,
  1
),

-- ── Beta Program ───────────────────────────────────────────────

(
  'beta.feedback-summary',
  'Beta Program',
  'Beta Feedback Summary',
  'Aggregated counts of beta feedback submissions over time, broken down by category and status.',
  'beta.feedback-summary',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "status",
        "label": "Status Filter",
        "type": "select",
        "required": false,
        "options": [
          {"label": "All", "value": "all"},
          {"label": "New", "value": "new"},
          {"label": "In Review", "value": "in_review"},
          {"label": "Resolved", "value": "resolved"}
        ]
      },
      {
        "key": "granularity",
        "label": "Granularity",
        "type": "select",
        "required": false,
        "options": [
          {"label": "Daily", "value": "day"},
          {"label": "Weekly", "value": "week"},
          {"label": "Monthly", "value": "month"}
        ]
      }
    ]
  }'::jsonb,
  '{"status": "all", "granularity": "week"}'::jsonb,
  '{
    "defaultSort": {"key": "period", "direction": "asc"},
    "chart": {
      "type": "line",
      "xKey": "period",
      "yKeys": ["submission_count"]
    }
  }'::jsonb,
  10,
  1
),

-- ── Operations ─────────────────────────────────────────────────

(
  'operations.bulk-search-job-health',
  'Operations',
  'Bulk Search Job Health',
  'Monitoring report for the scheduled bulk-search pipeline: jobs queued, completed, and failed per period, with average completion time.',
  'operations.bulk-search-job-health',
  false,
  '{
    "fields": [
      {
        "key": "start_date",
        "label": "Start Date",
        "type": "date",
        "required": true
      },
      {
        "key": "end_date",
        "label": "End Date",
        "type": "date",
        "required": true
      },
      {
        "key": "granularity",
        "label": "Granularity",
        "type": "select",
        "required": false,
        "options": [
          {"label": "Hourly", "value": "hour"},
          {"label": "Daily", "value": "day"},
          {"label": "Weekly", "value": "week"}
        ]
      }
    ]
  }'::jsonb,
  '{"granularity": "day"}'::jsonb,
  '{
    "defaultSort": {"key": "period", "direction": "asc"},
    "chart": {
      "type": "bar",
      "xKey": "period",
      "yKeys": ["jobs_completed", "jobs_failed"]
    }
  }'::jsonb,
  10,
  1
)

ON CONFLICT (slug) DO UPDATE SET
  category           = EXCLUDED.category,
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  handler_key        = EXCLUDED.handler_key,
  contains_pii       = EXCLUDED.contains_pii,
  parameter_schema   = EXCLUDED.parameter_schema,
  default_parameters = EXCLUDED.default_parameters,
  output_config      = EXCLUDED.output_config,
  sort_order         = EXCLUDED.sort_order,
  version            = EXCLUDED.version,
  updated_at         = now();
