
CREATE TABLE IF NOT EXISTS public.bulk_search_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone_group text NOT NULL CHECK (timezone_group IN ('ET','CT','MT','PT')),
  target_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed','partial','running','skipped')),
  airports_total integer NOT NULL DEFAULT 0,
  airports_succeeded integer NOT NULL DEFAULT 0,
  airports_failed integer NOT NULL DEFAULT 0,
  gowild_found_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_search_job_logs_started
  ON public.bulk_search_job_logs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_search_job_logs_tz_date
  ON public.bulk_search_job_logs (timezone_group, target_date);

ALTER TABLE public.bulk_search_job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read job logs"
  ON public.bulk_search_job_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.developer_allowlist
    WHERE developer_allowlist.user_id = auth.uid()
  ));

CREATE POLICY "No client insert job logs"
  ON public.bulk_search_job_logs
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client update job logs"
  ON public.bulk_search_job_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "No client delete job logs"
  ON public.bulk_search_job_logs
  FOR DELETE
  USING (false);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
