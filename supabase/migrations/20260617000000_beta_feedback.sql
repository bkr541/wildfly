-- ============================================================
-- Beta Feedback
-- ============================================================
-- Collects in-app feedback submissions from beta users.
-- Each row is linked to auth.users via user_id.
--
-- Security model:
--   · Authenticated users may INSERT and SELECT their own rows.
--   · No UPDATE or DELETE policy — feedback is immutable once submitted.
--   · Admin reads go through service-role (bypasses RLS).
-- ============================================================

CREATE TABLE public.beta_feedback (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Environment
  app_version       text        NOT NULL,
  device            text        NOT NULL,
  os_version        text        NOT NULL,
  browser_version   text,                    -- nullable; only relevant for web

  -- Feedback
  feedback_type     text        NOT NULL
    CHECK (feedback_type IN ('Bug', 'Feature Request', 'Performance', 'UI/UX', 'Crash', 'Other')),
  summary           text        NOT NULL,
  severity          text        NOT NULL
    CHECK (severity IN ('Blocker', 'Major', 'Minor', 'Trivial', 'Enhancement')),
  attachment_url    text,                    -- nullable; Supabase Storage path or public URL
  app_page          text        NOT NULL,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX beta_feedback_user_id_idx    ON public.beta_feedback (user_id);
CREATE INDEX beta_feedback_created_at_idx ON public.beta_feedback (created_at DESC);
CREATE INDEX beta_feedback_severity_idx   ON public.beta_feedback (severity);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Users may insert feedback for themselves only.
CREATE POLICY "bf_owner_insert"
  ON public.beta_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users may read their own submitted feedback.
CREATE POLICY "bf_owner_select"
  ON public.beta_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- No UPDATE or DELETE policies — submissions are immutable.
-- Admin access goes through service-role which bypasses RLS.

-- ── Privileges ────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT ON public.beta_feedback TO authenticated;
