
-- Create announcements table
CREATE TABLE public.announcements (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text        NOT NULL,
  body          text        NOT NULL,
  cta_label     text,
  cta_url       text,
  image_url     text,
  audience      text        NOT NULL DEFAULT 'all',
  priority      integer     NOT NULL DEFAULT 0,
  is_published  boolean     NOT NULL DEFAULT false,
  publish_at    timestamptz,
  expires_at    timestamptz,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_audience_check CHECK (audience IN ('all', 'free', 'pro', 'beta'))
);

-- Create announcement_views table
CREATE TABLE public.announcement_views (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id  uuid        NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL,
  seen_at          timestamptz NOT NULL DEFAULT now(),
  dismissed_at     timestamptz,
  CONSTRAINT announcement_views_unique UNIQUE (announcement_id, user_id)
);

-- Indexes
CREATE INDEX idx_announcements_audience       ON public.announcements (audience);
CREATE INDEX idx_announcements_publish_at     ON public.announcements (publish_at);
CREATE INDEX idx_announcements_is_published   ON public.announcements (is_published);
CREATE INDEX idx_announcement_views_user_id   ON public.announcement_views (user_id);
CREATE INDEX idx_announcement_views_ann_id    ON public.announcement_views (announcement_id);

-- RLS
ALTER TABLE public.announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;

-- announcements: authenticated users can read published, non-expired announcements
CREATE POLICY "Authenticated users can read published announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND (publish_at  IS NULL OR publish_at  <= now())
    AND (expires_at  IS NULL OR expires_at  >  now())
  );

-- announcements: no client-side writes
CREATE POLICY "No client insert announcements"
  ON public.announcements FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "No client update announcements"
  ON public.announcements FOR UPDATE
  TO public
  USING (false);

CREATE POLICY "No client delete announcements"
  ON public.announcements FOR DELETE
  TO public
  USING (false);

-- announcement_views: users can insert their own view rows
CREATE POLICY "Users can insert own announcement views"
  ON public.announcement_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- announcement_views: users can update their own view rows (e.g. set dismissed_at)
CREATE POLICY "Users can update own announcement views"
  ON public.announcement_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- announcement_views: users can read their own view rows
CREATE POLICY "Users can read own announcement views"
  ON public.announcement_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- announcement_views: immutable ledger – no deletes
CREATE POLICY "No delete announcement views"
  ON public.announcement_views FOR DELETE
  TO public
  USING (false);
