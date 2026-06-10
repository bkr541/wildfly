
-- ============================================================
-- Notification Enhancements
-- Adds notification_group, detail_text, and audience columns
-- to the notifications table. Creates notification_type_configs
-- for the admin notifications control room.
-- ============================================================


-- ── 1. Alter notifications table ─────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_group  text        NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS detail_text         text,
  ADD COLUMN IF NOT EXISTS audience            text        NOT NULL DEFAULT 'All';

COMMENT ON COLUMN public.notifications.notification_group IS
  'Logical group/category for this notification: Flights, Friends, System, etc.';
COMMENT ON COLUMN public.notifications.detail_text IS
  'Optional extended technical detail text, used for admin-level or technical notifications.';
COMMENT ON COLUMN public.notifications.audience IS
  'Visibility scope. All = every user; Admin = developer_allowlist users only.';

CREATE INDEX IF NOT EXISTS index_notifications_audience
  ON public.notifications (user_id, audience);


-- ── 2. notification_type_configs table ───────────────────────

CREATE TABLE IF NOT EXISTS public.notification_type_configs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type               text        NOT NULL UNIQUE,
  label              text        NOT NULL,
  notification_group text        NOT NULL DEFAULT 'General',
  group_color        text        NOT NULL DEFAULT '#059669',
  description        text,
  default_title      text,
  default_body       text,
  audience           text        NOT NULL DEFAULT 'All',
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_type_configs IS
  'Admin-managed registry of all notification types and their display configuration.';

COMMENT ON COLUMN public.notification_type_configs.type IS
  'Matches the type field on the notifications table (e.g. friend_request_received).';
COMMENT ON COLUMN public.notification_type_configs.group_color IS
  'Hex color used for the group badge in the admin UI.';
COMMENT ON COLUMN public.notification_type_configs.audience IS
  'Default audience for notifications of this type. Mirrors notifications.audience.';

ALTER TABLE public.notification_type_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read notification type configs"
  ON public.notification_type_configs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()
  ));

CREATE POLICY "Devs can insert notification type configs"
  ON public.notification_type_configs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()
  ));

CREATE POLICY "Devs can update notification type configs"
  ON public.notification_type_configs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()
  ));

CREATE POLICY "Devs can delete notification type configs"
  ON public.notification_type_configs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()
  ));


-- ── 3. Seed existing notification types ──────────────────────

INSERT INTO public.notification_type_configs
  (type, label, notification_group, group_color, description, audience)
VALUES
  ('friend_request_received', 'Friend Request Received', 'Friends', '#3B82F6',
   'Sent when a user receives a new friend request from another user.', 'All'),
  ('friend_request_accepted', 'Friend Request Accepted', 'Friends', '#10B981',
   'Sent when your friend request is accepted by another user.', 'All'),
  ('trip_invite_received',    'Trip Invite Received',    'Flights', '#F59E0B',
   'Sent when a user is invited to join a shared trip.', 'All'),
  ('trip_invite_accepted',    'Trip Invite Accepted',    'Flights', '#8B5CF6',
   'Sent when a recipient accepts your trip invitation.', 'All')
ON CONFLICT (type) DO NOTHING;


-- ── 4. Per-type stats RPC ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_notification_type_stats()
RETURNS TABLE (
  type          text,
  total_count   bigint,
  last_sent     timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    type,
    COUNT(*)::bigint   AS total_count,
    MAX(created_at)    AS last_sent
  FROM public.notifications
  GROUP BY type;
$$;


-- ── 5. updated_at trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notification_type_configs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_type_configs_updated_at
  ON public.notification_type_configs;

CREATE TRIGGER notification_type_configs_updated_at
  BEFORE UPDATE ON public.notification_type_configs
  FOR EACH ROW EXECUTE FUNCTION public.notification_type_configs_set_updated_at();
