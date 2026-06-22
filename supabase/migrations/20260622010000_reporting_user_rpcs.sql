-- =============================================================================
-- Reporting RPCs — Users category
--
-- Three SECURITY DEFINER functions callable only by service_role.
-- No dynamic SQL. All bounds validated inside the function as a second line
-- of defense behind the Edge Function Zod validators.
-- =============================================================================

-- =============================================================================
-- 1. report_users_top_search_active
--
-- Grain: one row per user who had ≥1 user-initiated flight_searches row
--        in [p_date_from, p_date_to).
--
-- Ranking: search_count DESC → gowild_search_count DESC → last_search_at DESC.
-- No composite activity score is computed.
--
-- Saved-flight, feedback, and route-favorite counts are aggregated all-time
-- (not bounded to the date window) so the caller sees lifetime engagement
-- alongside recent search activity.
--
-- System-activity exclusion (when p_include_system_activity = false):
--   • Excludes the all-zero system UUID from user_id.
--   • Excludes rows where triggered_by IN ('scheduled_bulk_search','admin_bulk_search').
--   • Preserves rows where triggered_by IS NULL (normal user-initiated searches).
--
-- Each activity table is aggregated in its own CTE before joining to prevent
-- row-multiplication artefacts from multi-table joins on raw activity rows.
--
-- PII: email is masked at the database layer when p_include_pii = false.
--      The Edge Function engine layer applies an additional safety net.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_users_top_search_active(
  p_date_from               timestamptz,
  p_date_to                 timestamptz,
  p_limit                   int          DEFAULT 10,
  p_include_system_activity boolean      DEFAULT false,
  p_user_status             text         DEFAULT 'all',
  p_include_pii             boolean      DEFAULT false
)
RETURNS TABLE (
  user_id               uuid,
  display_name          text,
  email                 text,
  status                text,
  signup_type           text,
  home_airport          text,
  search_count          bigint,
  gowild_search_count   bigint,
  saved_flight_count    bigint,
  feedback_count        bigint,
  route_favorite_count  bigint,
  last_search_at        timestamptz,
  last_login            timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bounds guard: clamp limit to [1, 100] regardless of what the caller passes.
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
  -- Reject unknown status values silently by resetting to 'all'.
  IF p_user_status NOT IN ('all', 'current', 'pending') THEN
    p_user_status := 'all';
  END IF;

  -- Timeout slightly below the Edge Function 15 s handler timeout.
  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  WITH
    -- User-initiated searches in the window, aggregated per Auth user_id.
    -- Kept in a separate CTE to prevent row-multiplication on later joins.
    searches AS (
      SELECT
        fs.user_id,
        COUNT(*)                                              AS search_count,
        COUNT(*) FILTER (WHERE fs.gowild_found = true)       AS gowild_search_count,
        MAX(fs.search_timestamp)                              AS last_search_at
      FROM public.flight_searches fs
      WHERE
        fs.search_timestamp >= p_date_from
        AND fs.search_timestamp <  p_date_to
        AND (
          p_include_system_activity
          OR (
            fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
            AND (
              fs.triggered_by IS NULL
              OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
            )
          )
        )
      GROUP BY fs.user_id
    ),

    -- All-time saved-flight count per Auth user_id.
    saved AS (
      SELECT uf.user_id, COUNT(*) AS saved_flight_count
      FROM public.user_flights uf
      GROUP BY uf.user_id
    ),

    -- All-time beta-feedback count per Auth user_id.
    feedback AS (
      SELECT bf.user_id, COUNT(*) AS feedback_count
      FROM public.beta_feedback bf
      GROUP BY bf.user_id
    ),

    -- All-time route-favorite count per Auth user_id.
    favorites AS (
      SELECT rf.user_id, COUNT(*) AS route_favorite_count
      FROM public.route_favorites rf
      GROUP BY rf.user_id
    )

  SELECT
    ui.auth_user_id                                                     AS user_id,
    ui.display_name,
    -- Mask email at the database layer; engine layer provides a safety net.
    CASE
      WHEN p_include_pii THEN ui.email
      ELSE COALESCE(LEFT(ui.email, 1), '') || '***@'
           || COALESCE(SPLIT_PART(ui.email, '@', 2), '')
    END                                                                 AS email,
    ui.status,
    ui.signup_type,
    ui.home_airport,
    s.search_count,
    s.gowild_search_count,
    COALESCE(sv.saved_flight_count,   0)                                AS saved_flight_count,
    COALESCE(fb.feedback_count,       0)                                AS feedback_count,
    COALESCE(fav.route_favorite_count, 0)                               AS route_favorite_count,
    s.last_search_at,
    ui.last_login
  FROM searches s
  -- Join activity to user profiles via the Auth user_id link, not user_info.id.
  JOIN  public.user_info ui  ON ui.auth_user_id = s.user_id
  LEFT JOIN saved        sv  ON sv.user_id      = s.user_id
  LEFT JOIN feedback     fb  ON fb.user_id      = s.user_id
  LEFT JOIN favorites    fav ON fav.user_id     = s.user_id
  WHERE
    (p_user_status = 'all' OR ui.status = p_user_status)
    AND ui.auth_user_id IS NOT NULL
  ORDER BY
    s.search_count          DESC,
    s.gowild_search_count   DESC,
    s.last_search_at        DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.report_users_top_search_active(
  timestamptz, timestamptz, int, boolean, text, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_users_top_search_active(
  timestamptz, timestamptz, int, boolean, text, boolean
) TO service_role;

-- =============================================================================
-- 2. report_users_dormant
--
-- Grain: one row per user in user_info whose last recorded activity
--        pre-dates the dormancy cutoff, or who has never had any recorded activity.
--
-- "Last recorded activity" is the GREATEST of:
--   user_info.last_login,
--   MAX(flight_searches.search_timestamp),
--   MAX(user_flights.created_at),
--   MAX(route_favorites.created_at),
--   MAX(beta_feedback.created_at),
--   MAX(credit_transactions.created_at)
--
-- Users where all of the above are NULL are returned with never_active = true.
-- The GREATEST() function ignores NULLs, so a single non-NULL value wins.
--
-- NOTE: user_info does not have a reliable created_at column. This report
--       cannot be used to measure account age or time-since-signup.
--
-- PII: email masked at DB layer when p_include_pii = false.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_users_dormant(
  p_inactive_days  int      DEFAULT 30,
  p_user_status    text     DEFAULT 'current',
  p_limit          int      DEFAULT 100,
  p_include_pii    boolean  DEFAULT false
)
RETURNS TABLE (
  user_id               uuid,
  display_name          text,
  email                 text,
  status                text,
  signup_type           text,
  home_airport          text,
  last_login            timestamptz,
  last_search_at        timestamptz,
  last_saved_flight_at  timestamptz,
  last_feedback_at      timestamptz,
  last_activity_at      timestamptz,
  inactive_days         int,
  never_active          boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
BEGIN
  -- Bounds guard.
  p_inactive_days := LEAST(GREATEST(COALESCE(p_inactive_days, 30), 1), 730);
  p_limit         := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  IF p_user_status NOT IN ('all', 'current', 'pending') THEN
    p_user_status := 'current';
  END IF;

  SET LOCAL statement_timeout = '14s';

  v_cutoff := now() - (p_inactive_days * INTERVAL '1 day');

  RETURN QUERY
  WITH
    -- Latest search timestamp per Auth user_id (all-time, no date window).
    last_searches AS (
      SELECT fs.user_id, MAX(fs.search_timestamp) AS last_search_at
      FROM public.flight_searches fs
      GROUP BY fs.user_id
    ),
    -- Latest saved-flight timestamp per Auth user_id.
    last_saves AS (
      SELECT uf.user_id, MAX(uf.created_at) AS last_saved_flight_at
      FROM public.user_flights uf
      GROUP BY uf.user_id
    ),
    -- Latest feedback timestamp per Auth user_id.
    last_feedback AS (
      SELECT bf.user_id, MAX(bf.created_at) AS last_feedback_at
      FROM public.beta_feedback bf
      GROUP BY bf.user_id
    ),
    -- Latest route-favorite timestamp per Auth user_id.
    last_favorites AS (
      SELECT rf.user_id, MAX(rf.created_at) AS last_favorite_at
      FROM public.route_favorites rf
      GROUP BY rf.user_id
    ),
    -- Latest credit-transaction timestamp per Auth user_id.
    last_credits AS (
      SELECT ct.user_id, MAX(ct.created_at) AS last_credit_at
      FROM public.credit_transactions ct
      GROUP BY ct.user_id
    ),
    -- Combine all activity signals per user into a single last_activity_at.
    user_activity AS (
      SELECT
        ui.auth_user_id                                       AS user_id,
        ui.display_name,
        CASE
          WHEN p_include_pii THEN ui.email
          ELSE COALESCE(LEFT(ui.email, 1), '') || '***@'
               || COALESCE(SPLIT_PART(ui.email, '@', 2), '')
        END                                                   AS email,
        ui.status,
        ui.signup_type,
        ui.home_airport,
        ui.last_login,
        ls.last_search_at,
        lsv.last_saved_flight_at,
        lf.last_feedback_at,
        -- GREATEST ignores NULLs; returns NULL only when ALL inputs are NULL.
        GREATEST(
          ui.last_login,
          ls.last_search_at,
          lsv.last_saved_flight_at,
          lf.last_feedback_at,
          lfav.last_favorite_at,
          lc.last_credit_at
        ) AS last_activity_at
      FROM public.user_info ui
      -- Join each activity table via auth_user_id, not user_info.id.
      LEFT JOIN last_searches  ls   ON ls.user_id   = ui.auth_user_id
      LEFT JOIN last_saves     lsv  ON lsv.user_id  = ui.auth_user_id
      LEFT JOIN last_feedback  lf   ON lf.user_id   = ui.auth_user_id
      LEFT JOIN last_favorites lfav ON lfav.user_id = ui.auth_user_id
      LEFT JOIN last_credits   lc   ON lc.user_id   = ui.auth_user_id
      WHERE
        ui.auth_user_id IS NOT NULL
        AND (p_user_status = 'all' OR ui.status = p_user_status)
    )

  SELECT
    ua.user_id,
    ua.display_name,
    ua.email,
    ua.status,
    ua.signup_type,
    ua.home_airport,
    ua.last_login,
    ua.last_search_at,
    ua.last_saved_flight_at,
    ua.last_feedback_at,
    ua.last_activity_at,
    CASE
      WHEN ua.last_activity_at IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM (now() - ua.last_activity_at))::int
    END                                                               AS inactive_days,
    (ua.last_activity_at IS NULL)                                     AS never_active
  FROM user_activity ua
  WHERE
    ua.last_activity_at IS NULL          -- never had any recorded activity
    OR ua.last_activity_at < v_cutoff    -- last activity older than the cutoff
  ORDER BY
    ua.last_activity_at ASC NULLS FIRST  -- never-active users first, then oldest
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.report_users_dormant(int, text, int, boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_users_dormant(int, text, int, boolean)
  TO service_role;

-- =============================================================================
-- 3. report_users_engagement_summary
--
-- Grain: ONE summary row for all eligible users in [p_date_from, p_date_to).
--
-- All user counts use DISTINCT Auth user_ids to prevent double-counting.
-- users_with_no_recorded_activity is relative to the date window — a user who
-- was active last year but not in this window counts as having no activity here.
--
-- No PII parameter: this report returns only aggregate counts, containsPii = false.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_users_engagement_summary(
  p_date_from               timestamptz,
  p_date_to                 timestamptz,
  p_user_status             text     DEFAULT 'all',
  p_include_system_activity boolean  DEFAULT false
)
RETURNS TABLE (
  eligible_users                    bigint,
  users_with_searches               bigint,
  users_with_gowild_hits            bigint,
  users_with_saved_flights          bigint,
  users_with_route_favorites        bigint,
  users_with_feedback               bigint,
  users_with_credit_activity        bigint,
  users_with_no_recorded_activity   bigint,
  search_engagement_rate            numeric,
  save_engagement_rate              numeric,
  feedback_engagement_rate          numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_status NOT IN ('all', 'current', 'pending') THEN
    p_user_status := 'all';
  END IF;

  SET LOCAL statement_timeout = '14s';

  RETURN QUERY
  WITH
    -- Eligible user set; each auth_user_id appears at most once.
    eligible AS (
      SELECT auth_user_id
      FROM public.user_info
      WHERE auth_user_id IS NOT NULL
        AND (p_user_status = 'all' OR status = p_user_status)
    ),
    -- Precompute all counts in a single CTE to keep the final SELECT readable.
    c AS (
      SELECT
        -- Total eligible users.
        (SELECT COUNT(*)::bigint FROM eligible)                                   AS total,

        -- Distinct eligible users who ran at least one qualifying search in window.
        (SELECT COUNT(DISTINCT fs.user_id)::bigint
         FROM public.flight_searches fs
         JOIN eligible e ON e.auth_user_id = fs.user_id
         WHERE fs.search_timestamp >= p_date_from
           AND fs.search_timestamp <  p_date_to
           AND (
             p_include_system_activity
             OR (
               fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
               AND (
                 fs.triggered_by IS NULL
                 OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
               )
             )
           )
        )                                                                         AS with_searches,

        -- Distinct eligible users with at least one GoWild hit in window.
        (SELECT COUNT(DISTINCT fs.user_id)::bigint
         FROM public.flight_searches fs
         JOIN eligible e ON e.auth_user_id = fs.user_id
         WHERE fs.search_timestamp >= p_date_from
           AND fs.search_timestamp <  p_date_to
           AND fs.gowild_found = true
           AND (
             p_include_system_activity
             OR (
               fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
               AND (
                 fs.triggered_by IS NULL
                 OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
               )
             )
           )
        )                                                                         AS with_gowild,

        -- Distinct eligible users who saved at least one flight in window.
        (SELECT COUNT(DISTINCT uf.user_id)::bigint
         FROM public.user_flights uf
         JOIN eligible e ON e.auth_user_id = uf.user_id
         WHERE uf.created_at >= p_date_from AND uf.created_at < p_date_to
        )                                                                         AS with_saved,

        -- Distinct eligible users who added at least one route favorite in window.
        (SELECT COUNT(DISTINCT rf.user_id)::bigint
         FROM public.route_favorites rf
         JOIN eligible e ON e.auth_user_id = rf.user_id
         WHERE rf.created_at >= p_date_from AND rf.created_at < p_date_to
        )                                                                         AS with_favorites,

        -- Distinct eligible users who submitted beta feedback in window.
        (SELECT COUNT(DISTINCT bf.user_id)::bigint
         FROM public.beta_feedback bf
         JOIN eligible e ON e.auth_user_id = bf.user_id
         WHERE bf.created_at >= p_date_from AND bf.created_at < p_date_to
        )                                                                         AS with_feedback,

        -- Distinct eligible users with credit activity in window.
        (SELECT COUNT(DISTINCT ct.user_id)::bigint
         FROM public.credit_transactions ct
         JOIN eligible e ON e.auth_user_id = ct.user_id
         WHERE ct.created_at >= p_date_from AND ct.created_at < p_date_to
        )                                                                         AS with_credits,

        -- Eligible users with NO recorded activity in the window across all tables.
        -- Defined relative to the date window, not all-time.
        (SELECT COUNT(*)::bigint
         FROM eligible e
         WHERE NOT EXISTS (
           SELECT 1 FROM public.flight_searches fs
           WHERE fs.user_id = e.auth_user_id
             AND fs.search_timestamp >= p_date_from AND fs.search_timestamp < p_date_to
             AND (
               p_include_system_activity
               OR (
                 fs.user_id <> '00000000-0000-0000-0000-000000000000'::uuid
                 AND (
                   fs.triggered_by IS NULL
                   OR fs.triggered_by NOT IN ('scheduled_bulk_search', 'admin_bulk_search')
                 )
               )
             )
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.user_flights uf
           WHERE uf.user_id = e.auth_user_id
             AND uf.created_at >= p_date_from AND uf.created_at < p_date_to
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.route_favorites rf
           WHERE rf.user_id = e.auth_user_id
             AND rf.created_at >= p_date_from AND rf.created_at < p_date_to
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.beta_feedback bf
           WHERE bf.user_id = e.auth_user_id
             AND bf.created_at >= p_date_from AND bf.created_at < p_date_to
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.credit_transactions ct
           WHERE ct.user_id = e.auth_user_id
             AND ct.created_at >= p_date_from AND ct.created_at < p_date_to
         )
        )                                                                         AS with_no_activity
    )
  SELECT
    c.total,
    c.with_searches,
    c.with_gowild,
    c.with_saved,
    c.with_favorites,
    c.with_feedback,
    c.with_credits,
    c.with_no_activity,
    CASE WHEN c.total = 0 THEN NULL::numeric
         ELSE ROUND(100.0 * c.with_searches / c.total, 2)
    END AS search_engagement_rate,
    CASE WHEN c.total = 0 THEN NULL::numeric
         ELSE ROUND(100.0 * c.with_saved    / c.total, 2)
    END AS save_engagement_rate,
    CASE WHEN c.total = 0 THEN NULL::numeric
         ELSE ROUND(100.0 * c.with_feedback / c.total, 2)
    END AS feedback_engagement_rate
  FROM c;
END;
$$;

REVOKE ALL ON FUNCTION public.report_users_engagement_summary(
  timestamptz, timestamptz, text, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.report_users_engagement_summary(
  timestamptz, timestamptz, text, boolean
) TO service_role;
