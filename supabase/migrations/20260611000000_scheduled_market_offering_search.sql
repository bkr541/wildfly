
-- ============================================================
-- Scheduled Market Offering Search
-- Adds the log table, SQL trigger wrapper, and four pg_cron
-- schedules that fire the edge function quarterly on the 1st
-- of Jan/Apr/Jul/Oct at 05:00 ET.
-- ============================================================


-- ── 1. Log table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.market_offering_sync_logs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status               text        NOT NULL CHECK (status IN ('running','success','failed','skipped')),
  snapshot_id          uuid        REFERENCES public.frontier_market_snapshots(id) ON DELETE SET NULL,
  stations_upserted    integer     NOT NULL DEFAULT 0,
  airports_created     integer     NOT NULL DEFAULT 0,
  airports_deactivated integer     NOT NULL DEFAULT 0,
  routes_upserted      integer     NOT NULL DEFAULT 0,
  routes_deactivated   integer     NOT NULL DEFAULT 0,
  duration_ms          integer,
  error_message        text,
  triggered_by         text        NOT NULL DEFAULT 'cron',
  started_at           timestamptz NOT NULL DEFAULT now(),
  finished_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_offering_sync_logs_started
  ON public.market_offering_sync_logs (started_at DESC);

ALTER TABLE public.market_offering_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read market offering sync logs"
  ON public.market_offering_sync_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.developer_allowlist
    WHERE developer_allowlist.user_id = auth.uid()
  ));

CREATE POLICY "No client insert market offering sync logs"
  ON public.market_offering_sync_logs
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client update market offering sync logs"
  ON public.market_offering_sync_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "No client delete market offering sync logs"
  ON public.market_offering_sync_logs
  FOR DELETE
  USING (false);


-- ── 2. SQL trigger wrapper ────────────────────────────────────
-- pg_cron can only execute SQL, so this function bridges the gap:
-- it reads the shared secret at runtime (never embedded in SQL)
-- and fires the edge function via pg_net (installed in extensions schema).

CREATE OR REPLACE FUNCTION public.trigger_market_offering_search()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT config_value INTO v_secret
  FROM public.app_config
  WHERE config_key = 'scheduled_job_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING '[market-offering-search] scheduled_job_secret not found in app_config — aborting';
    RETURN;
  END IF;

  PERFORM extensions.http_post(
    url     := 'https://ejgxmkglklyumyycpvgi.supabase.co/functions/v1/scheduled-market-offering-search',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_secret,
                 'Content-Type',  'application/json'),
    body    := '{}'::jsonb
  );
END;
$$;


-- ── 3. pg_cron schedules (DST-aware) ─────────────────────────
-- 05:00 ET on Jan 1  = 10:00 UTC (EST, UTC-5)
-- 05:00 ET on Apr 1  = 09:00 UTC (EDT, UTC-4)
-- 05:00 ET on Jul 1  = 09:00 UTC (EDT, UTC-4)
-- 05:00 ET on Oct 1  = 09:00 UTC (EDT, US DST ends first Sun of Nov)

DO $$ BEGIN PERFORM cron.unschedule('market-offering-search-jan'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('market-offering-search-apr'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('market-offering-search-jul'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('market-offering-search-oct'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('market-offering-search-jan', '0 10 1 1 *',  $c$ SELECT public.trigger_market_offering_search(); $c$);
SELECT cron.schedule('market-offering-search-apr', '0 9  1 4 *',  $c$ SELECT public.trigger_market_offering_search(); $c$);
SELECT cron.schedule('market-offering-search-jul', '0 9  1 7 *',  $c$ SELECT public.trigger_market_offering_search(); $c$);
SELECT cron.schedule('market-offering-search-oct', '0 9  1 10 *', $c$ SELECT public.trigger_market_offering_search(); $c$);
