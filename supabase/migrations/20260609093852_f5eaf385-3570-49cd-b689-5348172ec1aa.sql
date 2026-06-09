
CREATE OR REPLACE FUNCTION public.notify_bulk_search_issues()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_log record;
  v_dev record;
  v_type text;
  v_title text;
  v_body text;
BEGIN
  -- Failed jobs (any time) that we have not yet notified about
  FOR v_log IN
    SELECT id, timezone_group, target_date, status, started_at, finished_at,
           airports_total, airports_succeeded, airports_failed,
           coalesce(error_message, '') AS error_message
    FROM public.bulk_search_job_logs
    WHERE status = 'failed'
  LOOP
    v_type  := 'bulk_search_failed';
    v_title := format('Bulk search FAILED (%s · %s)', v_log.timezone_group, v_log.target_date);
    v_body  := format(
      'Job %s failed after processing %s/%s airports. %s',
      v_log.id,
      coalesce(v_log.airports_succeeded, 0),
      coalesce(v_log.airports_total, 0),
      CASE WHEN length(v_log.error_message) > 0
           THEN 'Error: ' || left(v_log.error_message, 240)
           ELSE 'No error message captured.' END
    );

    FOR v_dev IN SELECT user_id FROM public.developer_allowlist LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_dev.user_id
          AND n.type = v_type
          AND (n.data->>'bulk_search_job_log_id') = v_log.id::text
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_dev.user_id, v_type, v_title, v_body,
          jsonb_build_object(
            'bulk_search_job_log_id', v_log.id,
            'timezone_group', v_log.timezone_group,
            'target_date', v_log.target_date,
            'status', v_log.status,
            'airports_total', v_log.airports_total,
            'airports_succeeded', v_log.airports_succeeded,
            'airports_failed', v_log.airports_failed,
            'started_at', v_log.started_at,
            'finished_at', v_log.finished_at,
            'error_message', v_log.error_message
          )
        );
        v_inserted := v_inserted + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Jobs still 'running' for more than 45 minutes with no finish
  FOR v_log IN
    SELECT id, timezone_group, target_date, status, started_at, finished_at,
           airports_total, airports_succeeded, airports_failed
    FROM public.bulk_search_job_logs
    WHERE status = 'running'
      AND finished_at IS NULL
      AND started_at < now() - interval '45 minutes'
  LOOP
    v_type  := 'bulk_search_stuck';
    v_title := format('Bulk search STUCK >45m (%s · %s)', v_log.timezone_group, v_log.target_date);
    v_body  := format(
      'Job %s has been running for %s minutes (started %s). Processed %s/%s airports and never reported completion.',
      v_log.id,
      floor(extract(epoch FROM (now() - v_log.started_at)) / 60)::int,
      to_char(v_log.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
      coalesce(v_log.airports_succeeded, 0),
      coalesce(v_log.airports_total, 0)
    );

    FOR v_dev IN SELECT user_id FROM public.developer_allowlist LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_dev.user_id
          AND n.type = v_type
          AND (n.data->>'bulk_search_job_log_id') = v_log.id::text
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_dev.user_id, v_type, v_title, v_body,
          jsonb_build_object(
            'bulk_search_job_log_id', v_log.id,
            'timezone_group', v_log.timezone_group,
            'target_date', v_log.target_date,
            'status', v_log.status,
            'airports_total', v_log.airports_total,
            'airports_succeeded', v_log.airports_succeeded,
            'started_at', v_log.started_at,
            'minutes_running', floor(extract(epoch FROM (now() - v_log.started_at)) / 60)::int
          )
        );
        v_inserted := v_inserted + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- Schedule the check every 5 minutes (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('notify-bulk-search-issues');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'notify-bulk-search-issues',
  '*/5 * * * *',
  $cron$ SELECT public.notify_bulk_search_issues(); $cron$
);

-- Backfill immediately for the two stuck ET/CT runs (and any failed history)
SELECT public.notify_bulk_search_issues();
